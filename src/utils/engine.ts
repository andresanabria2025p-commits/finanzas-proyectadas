/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, Income, Expense, Liability, Transaction, RealizedMovement, LedgerRow } from '../types';

// Helpers de fechas
export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateSmall(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Generador de fechas para días del mes o de la semana
export function getDateStringForDayOfMonth(day: number, configStart: string): string {
  const parts = configStart.split('-');
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  const d = new Date(y, m, targetDay);
  return d.toISOString().split('T')[0];
}

export function getDateStringForWeekday(targetWeekday: number, configStart: string): string {
  const d = new Date(configStart + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    let wd = d.getDay();
    if (wd === 0) wd = 7;
    if (wd === targetWeekday) {
      return d.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() + 1);
  }
  return configStart;
}

export function calculateLedger(
  config: Config,
  incomes: Income[],
  expenses: Expense[],
  liabilities: Liability[],
  transactions: Transaction[],
  realizedMovements: RealizedMovement[]
): LedgerRow[] {
  const initialBalance = parseFloat(String(config.initial_balance || '0')) || 0;
  const startDateStr = config.start_date;
  const endDateStr = config.end_date;

  if (!startDateStr || !endDateStr) {
    return [];
  }

  const startDate = new Date(startDateStr + 'T00:00:00');
  const endDate = new Date(endDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Mapear los movimientos realizados/omitidos para una búsqueda rápida
  const realizedLookup: Record<string, { status: string; actual_amount: number; projected_amount: number }> = {};
  realizedMovements.forEach(r => {
    realizedLookup[`${r.movement_type}_${r.source_id}_${r.date}`] = {
      status: r.status,
      actual_amount: parseFloat(String(r.actual_amount)),
      projected_amount: parseFloat(String(r.projected_amount))
    };
  });

  // 1. Encontrar todos los meses cargados en este rango
  const months: { year: number; month: number }[] = [];
  let currMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const cycleEndLimit = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);

  while (currMonth < cycleEndLimit) {
    months.push({ year: currMonth.getFullYear(), month: currMonth.getMonth() });
    currMonth.setMonth(currMonth.getMonth() + 1);
  }

  // 2. Generar ocurrencias de ingresos para encontrar pre-fondeos (Reservas)
  const incomeOccurrences: LedgerRow[] = [];
  months.forEach(m => {
    incomes.forEach(inc => {
      const lastDay = getDaysInMonth(m.year, m.month);
      const day = Math.min(inc.day_of_month, lastDay);
      const d = new Date(m.year, m.month, day);
      const dStr = formatDateISO(d);
      
      if (d >= startDate && d <= endDate) {
        const key = `income_${inc.id}_${dStr}`;
        const hasRealized = key in realizedLookup;
        const projAmt = parseFloat(String(inc.amount)) || 0;
        let amt = projAmt;
        let finalStatus = d <= today ? 'Pendiente' : 'Proyectado';

        if (hasRealized) {
          const realized = realizedLookup[key];
          if (realized.status === 'Omitido') {
            amt = 0;
            finalStatus = 'Omitido';
          } else {
            amt = realized.actual_amount;
            finalStatus = 'Realizado';
          }
        }

        incomeOccurrences.push({
          date: dStr,
          type: 'Ingreso',
          concept: `Ingreso Recurrente (Día ${inc.day_of_month})`,
          amount: amt,
          liquidity: 0,
          status: finalStatus,
          movement_type: 'income',
          source_id: inc.id,
          original_date: dStr,
          projected_amount: projAmt
        });
      }
    });
  });

  // Ordenar ingresos para lookup
  incomeOccurrences.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const incomeDates = incomeOccurrences
    .filter(x => x.status !== 'Omitido')
    .map(x => new Date(x.date).getTime());

  function getPrecedingIncomeDate(targetDate: Date): Date | null {
    const targetMs = targetDate.getTime();
    const preceding = incomeDates.filter(t => t <= targetMs);
    if (preceding.length > 0) {
      return new Date(Math.max(...preceding));
    }
    return null;
  }

  function getNextIncomeDate(targetDate: Date): Date | null {
    const targetMs = targetDate.getTime();
    const upcoming = incomeDates.filter(t => t >= targetMs);
    if (upcoming.length > 0) {
      return new Date(Math.min(...upcoming));
    }
    return null;
  }

  // Eventos crudos que se compilarán en el ledger
  const rawEvents: {
    date: Date;
    type: string;
    concept: string;
    amount: number;
    impacts_liquidity: boolean;
    status: string;
    movement_type: string;
    source_id: number;
    original_date: string;
    projected_amount: number;
  }[] = [];

  // 3. Procesar Gastos Fijos (Mensuales y Quincenales)
  months.forEach(m => {
    expenses.forEach(exp => {
      const projAmt = parseFloat(String(exp.amount)) || 0;

      if (exp.frequency === 'Mensual') {
        const lastDay = getDaysInMonth(m.year, m.month);
        const day = Math.min(exp.day_of_execution, lastDay);
        const d = new Date(m.year, m.month, day);
        const dStr = formatDateISO(d);

        if (d >= startDate && d <= endDate) {
          const key = `expense_${exp.id}_${dStr}`;
          const hasRealized = key in realizedLookup;
          let amt = projAmt;
          let finalStatus = d <= today ? 'Pendiente' : 'Proyectado';

          if (hasRealized) {
            const realized = realizedLookup[key];
            if (realized.status === 'Omitido') {
              amt = 0;
              finalStatus = 'Omitido';
            } else {
              amt = realized.actual_amount;
              finalStatus = 'Realizado';
            }
          }

          rawEvents.push({
            date: d,
            type: 'Gasto Fijo',
            concept: `Gasto Fijo: ${exp.name}`,
            amount: -amt,
            impacts_liquidity: true,
            status: finalStatus,
            movement_type: 'expense',
            source_id: exp.id,
            original_date: dStr,
            projected_amount: projAmt
          });
        }
      } else if (exp.frequency === 'Quincenal') {
        const lastDay = getDaysInMonth(m.year, m.month);
        const day1 = Math.min(exp.day_of_execution, lastDay);
        const base2 = exp.day_of_execution <= 15 ? exp.day_of_execution + 15 : exp.day_of_execution - 15;
        const day2 = Math.min(base2, lastDay);

        const uniqueDays = Array.from(new Set([day1, day2])).sort((a, b) => a - b);
        uniqueDays.forEach((day, index) => {
          const d = new Date(m.year, m.month, day);
          const dStr = formatDateISO(d);

          if (d >= startDate && d <= endDate) {
            const key = `expense_${exp.id}_${dStr}`;
            const hasRealized = key in realizedLookup;
            let amt = projAmt;
            let finalStatus = d <= today ? 'Pendiente' : 'Proyectado';

            if (hasRealized) {
              const realized = realizedLookup[key];
              if (realized.status === 'Omitido') {
                amt = 0;
                finalStatus = 'Omitido';
              } else {
                amt = realized.actual_amount;
                finalStatus = 'Realizado';
              }
            }

            rawEvents.push({
              date: d,
              type: 'Gasto Fijo',
              concept: `Gasto Quincenal (Q${index + 1}): ${exp.name}`,
              amount: -amt,
              impacts_liquidity: true,
              status: finalStatus,
              movement_type: 'expense',
              source_id: exp.id,
              original_date: dStr,
              projected_amount: projAmt
            });
          }
        });
      }
    });
  });

  // 4. Procesar Gastos Fijos de Frecuencia Semanal (Generando Provisionamiento)
  let iterDate = new Date(startDate);
  while (iterDate <= endDate) {
    let weekday = iterDate.getDay();
    let weekdayNormalized = weekday === 0 ? 7 : weekday; // 1: Lunes, ..., 7: Domingo

    expenses.forEach(exp => {
      if (exp.frequency === 'Semanal' && exp.day_of_execution === weekdayNormalized) {
        const dStr = formatDateISO(iterDate);
        const projAmt = parseFloat(String(exp.amount)) || 0;
        const key = `expense_${exp.id}_${dStr}`;
        const hasRealized = key in realizedLookup;
        let amt = projAmt;
        let finalStatus = iterDate <= today ? 'Pendiente' : 'Proyectado';

        if (hasRealized) {
          const realized = realizedLookup[key];
          if (realized.status === 'Omitido') {
            amt = 0;
            finalStatus = 'Omitido';
          } else {
            amt = realized.actual_amount;
            finalStatus = 'Realizado';
          }
        }

        // Buscar fecha de ingreso anterior para guardar provisiones
        const precIncome = getPrecedingIncomeDate(iterDate);
        const provDate = precIncome ? new Date(precIncome) : new Date(startDate);

        // Si ya está realizado u omitido, la provisión bloquea el monto real/límite de la misma manera
        rawEvents.push({
          date: provDate,
          type: 'Reserva Gasto',
          concept: `Provisión Semanal: ${exp.name} (Para consumo del ${formatDateSmall(iterDate)})`,
          amount: -amt,
          impacts_liquidity: true,
          status: finalStatus,
          movement_type: 'expense',
          source_id: exp.id,
          original_date: dStr,
          projected_amount: projAmt
        });

        rawEvents.push({
          date: new Date(iterDate),
          type: 'Gasto Fijo',
          concept: `Consumo Gasto Semanal: ${exp.name}`,
          amount: -amt,
          impacts_liquidity: false, // La liquidez ya fue reducida en la reserva/provisión
          status: finalStatus,
          movement_type: 'expense',
          source_id: exp.id,
          original_date: dStr,
          projected_amount: projAmt
        });

        rawEvents.push({
          date: new Date(iterDate),
          type: 'Liberación Reserva',
          concept: `Reversa Provisión: ${exp.name}`,
          amount: amt,
          impacts_liquidity: false, // Se libera del bolsillo de reserva
          status: finalStatus,
          movement_type: 'expense',
          source_id: exp.id,
          original_date: dStr,
          projected_amount: projAmt
        });
      }
    });

    iterDate.setDate(iterDate.getDate() + 1);
  }

  // 5. Procesar Pasivos y Deudas (Préstamos con provisionamiento y Tarjetas de Crédito de forma recurrente)
  liabilities.forEach(liab => {
    const debtType = liab.debt_type || 'Prestamo';

    if (debtType === 'TDC') {
      // MOTOR DE TARJETA DE CRÉDITO
      let currentDebt = parseFloat(String(liab.total_amount)) || 0;
      const cutOffDayNum = parseInt(String(liab.cut_off_day)) || 15;
      const dueDayNum = parseInt(String(liab.due_day)) || 25;

      // Consumos del mes correspondientes a esta TDC
      const cardTxns = transactions.filter(
        t => t.credit_card_id && String(t.credit_card_id) === String(liab.id)
      );

      months.forEach(m => {
        // Encontrar ciclo de facturación
        const lastDayOfMonth = getDaysInMonth(m.year, m.month);
        const cycleEndDay = Math.min(cutOffDayNum, lastDayOfMonth);
        const cycleEnd = new Date(m.year, m.month, cycleEndDay);
        
        let prevY = m.month === 0 ? m.year - 1 : m.year;
        let prevM = m.month === 0 ? 11 : m.month - 1;
        const prevLastDay = getDaysInMonth(prevY, prevM);
        const prevCycleEndDay = Math.min(cutOffDayNum, prevLastDay);
        const cycleStart = new Date(prevY, prevM, prevCycleEndDay + 1);

        // Sumar compras del periodo
        let cyclePurchases = 0;
        cardTxns.forEach(t => {
          const tDate = new Date(t.date + 'T00:00:00');
          if (tDate >= cycleStart && tDate <= cycleEnd) {
            cyclePurchases += Math.abs(t.amount);
          }
        });

        const statementBalance = currentDebt + cyclePurchases;

        // Determinar fecha de pago
        let paymentDate: Date;
        if (dueDayNum > cutOffDayNum) {
          const payDueDay = Math.min(dueDayNum, getDaysInMonth(m.year, m.month));
          paymentDate = new Date(m.year, m.month, payDueDay);
        } else {
          let nextY = m.month === 11 ? m.year + 1 : m.year;
          let nextM = m.month === 11 ? 0 : m.month + 1;
          const payDueDay = Math.min(dueDayNum, getDaysInMonth(nextY, nextM));
          paymentDate = new Date(nextY, nextM, payDueDay);
        }

        const paymentDateStr = formatDateISO(paymentDate);

        if (statementBalance > 0) {
          // Calcular el monto a pagar según la estrategia/plan
          const plan = liab.payment_plan || 'Minimo';
          let paymentAmount = 0;

          if (plan === 'Total') {
            paymentAmount = statementBalance;
          } else if (plan === 'Minimo') {
            const fallbackQuota = parseFloat(String(liab.installment_amount)) || 0;
            paymentAmount = Math.min(
              statementBalance,
              Math.max(10.0, fallbackQuota > 0 ? fallbackQuota : statementBalance * 0.10)
            );
          } else if (plan === '3_meses') {
            paymentAmount = Math.min(statementBalance, statementBalance * 0.367208); // Factor amortización 3-meses
          } else if (plan === '6_meses') {
            paymentAmount = Math.min(statementBalance, statementBalance * 0.197017); // amortización 6-meses
          } else if (plan === '12_meses') {
            paymentAmount = Math.min(statementBalance, statementBalance * 0.112825); // amortización 12-meses
          } else {
            paymentAmount = Math.min(statementBalance, Math.max(10.0, parseFloat(String(liab.installment_amount)) || 10));
          }

          if (paymentDate >= startDate && paymentDate <= endDate) {
            const key = `liability_${liab.id}_${paymentDateStr}`;
            const hasRealized = key in realizedLookup;
            let finalStatus = paymentDate <= today ? 'Pendiente' : 'Proyectado';
            let amt = paymentAmount;

            if (hasRealized) {
              const realized = realizedLookup[key];
              if (realized.status === 'Omitido') {
                amt = 0;
                finalStatus = 'Omitido';
              } else {
                amt = realized.actual_amount;
                finalStatus = 'Realizado';
              }
            }

            const nextInc = getNextIncomeDate(paymentDate);

            // Regla de reserva: Si vence antes del siguiente ingreso, bloquear fondos en ingreso anterior
            if (nextInc && paymentDate.getTime() < nextInc.getTime()) {
              const precInc = getPrecedingIncomeDate(paymentDate);
              const reserveDate = precInc ? new Date(precInc) : new Date(startDate);

              rawEvents.push({
                date: reserveDate,
                type: 'Reserva Deuda',
                concept: `Reserva Bloqueada: ${liab.name} (Vence el ${formatDateSmall(paymentDate)})`,
                amount: -amt,
                impacts_liquidity: true,
                status: finalStatus,
                movement_type: 'liability',
                source_id: liab.id,
                original_date: paymentDateStr,
                projected_amount: paymentAmount
              });

              rawEvents.push({
                date: paymentDate,
                type: 'Pago Pasivo',
                concept: `Pago Tarjeta: ${liab.name} (${plan})`,
                amount: -amt,
                impacts_liquidity: false,
                status: finalStatus,
                movement_type: 'liability',
                source_id: liab.id,
                original_date: paymentDateStr,
                projected_amount: paymentAmount
              });

              rawEvents.push({
                date: paymentDate,
                type: 'Liberación Reserva',
                concept: `Liberación Reserva Deuda: ${liab.name}`,
                amount: amt,
                impacts_liquidity: false,
                status: finalStatus,
                movement_type: 'liability',
                source_id: liab.id,
                original_date: paymentDateStr,
                projected_amount: paymentAmount
              });
            } else {
              rawEvents.push({
                date: paymentDate,
                type: 'Pasivo',
                concept: `Pago Tarjeta Directo: ${liab.name} (${plan})`,
                amount: -amt,
                impacts_liquidity: true,
                status: finalStatus,
                movement_type: 'liability',
                source_id: liab.id,
                original_date: paymentDateStr,
                projected_amount: paymentAmount
              });
            }
          }

          // Generación de intereses devengados por saldo insoluto
          const unpaidBalance = statementBalance - paymentAmount;
          if (unpaidBalance > 0) {
            const interestCharge = unpaidBalance * 0.05; // 5% mensual interés revolving
            currentDebt = unpaidBalance + interestCharge;

            if (paymentDate >= startDate && paymentDate <= endDate) {
              const keyInterest = `interest_${liab.id}_${paymentDateStr}`;
              const hasRealizedInterest = keyInterest in realizedLookup;
              let finalStatus = paymentDate <= today ? 'Pendiente' : 'Proyectado';
              let intAmt = interestCharge;

              if (hasRealizedInterest) {
                const realized = realizedLookup[keyInterest];
                if (realized.status === 'Omitido') {
                  intAmt = 0;
                  finalStatus = 'Omitido';
                } else {
                  intAmt = realized.actual_amount;
                  finalStatus = 'Realizado';
                }
              }

              rawEvents.push({
                date: paymentDate,
                type: 'Interés TDC',
                concept: `Cargo Interés: ${liab.name} (+5% mensual revolving)`,
                amount: -intAmt,
                impacts_liquidity: false, // Incrementa la deuda flotante de la TDC, no resta caja hoy
                status: finalStatus,
                movement_type: 'interest',
                source_id: liab.id,
                original_date: paymentDateStr,
                projected_amount: interestCharge
              });
            }
          } else {
            currentDebt = 0;
          }
        } else {
          currentDebt = 0;
        }
      });
    } else {
      // MOTOR DE PRESTAMO (MULTI-ALCANCE/FRECUENCIA)
      const liabEndDate = new Date(liab.end_date + 'T00:00:00');
      const liabStartDateStr = liab.start_date || '2026-05-01';
      const liabStartDate = new Date(liabStartDateStr + 'T00:00:00');
      const freq = liab.frequency || 'Mensual';

      const dueDatesList: { date: Date; concept: string }[] = [];

      if (freq === 'Mensual') {
        months.forEach(m => {
          const lastDayNum = getDaysInMonth(m.year, m.month);
          const dueDay = Math.min(liab.due_day, lastDayNum);
          const dDue = new Date(m.year, m.month, dueDay);
          if (
            dDue >= startDate &&
            dDue <= endDate &&
            dDue <= liabEndDate &&
            dDue >= liabStartDate
          ) {
            dueDatesList.push({ date: dDue, concept: `Ref Deuda Préstamo: ${liab.name}` });
          }
        });
      } else if (freq === 'Quincenal') {
        months.forEach(m => {
          const lastDayNum = getDaysInMonth(m.year, m.month);
          const day1 = Math.min(14, lastDayNum);
          const day2 = Math.min(28, lastDayNum);

          const uniqueDays = Array.from(new Set([day1, day2])).sort((a, b) => a - b);
          uniqueDays.forEach((day, idx) => {
            const dDue = new Date(m.year, m.month, day);
            if (
              dDue >= startDate &&
              dDue <= endDate &&
              dDue <= liabEndDate &&
              dDue >= liabStartDate
            ) {
              dueDatesList.push({
                date: dDue,
                concept: `Cuota Quincenal Q${idx + 1}: ${liab.name}`
              });
            }
          });
        });
      } else if (freq === 'Semanal') {
        const targetWeekday = 1; // Fijo todos los Lunes
        let iterD = new Date(startDate);
        while (iterD <= endDate && iterD <= liabEndDate) {
          let wd = iterD.getDay();
          let wdNorm = wd === 0 ? 7 : wd;
          if (wdNorm === targetWeekday && iterD >= liabStartDate) {
            dueDatesList.push({
              date: new Date(iterD),
              concept: `Cuota Semanal: ${liab.name}`
            });
          }
          iterD.setDate(iterD.getDate() + 1);
        }
      }

      dueDatesList.forEach(item => {
        const dDue = item.date;
        const dDueStr = formatDateISO(dDue);
        const projAmt = parseFloat(String(liab.installment_amount)) || 0;
        const key = `liability_${liab.id}_${dDueStr}`;
        const hasRealized = key in realizedLookup;
        let amt = projAmt;
        let finalStatus = dDue <= today ? 'Pendiente' : 'Proyectado';

        if (hasRealized) {
          const realized = realizedLookup[key];
          if (realized.status === 'Omitido') {
            amt = 0;
            finalStatus = 'Omitido';
          } else {
            amt = realized.actual_amount;
            finalStatus = 'Realizado';
          }
        }

        const nextInc = getNextIncomeDate(dDue);

        // Si la cuota vence antes del ingreso inmediato próximo, provisionarla en el anterior
        if (nextInc && dDue.getTime() < nextInc.getTime()) {
          const precInc = getPrecedingIncomeDate(dDue);
          const reserveDate = precInc ? new Date(precInc) : new Date(startDate);

          rawEvents.push({
            date: reserveDate,
            type: 'Reserva Deuda',
            concept: `Reserva Bloqueada: ${liab.name} (Vence el ${formatDateSmall(dDue)})`,
            amount: -amt,
            impacts_liquidity: true,
            status: finalStatus,
            movement_type: 'liability',
            source_id: liab.id,
            original_date: dDueStr,
            projected_amount: projAmt
          });

          rawEvents.push({
            date: dDue,
            type: 'Pago Pasivo',
            concept: item.concept,
            amount: -amt,
            impacts_liquidity: false,
            status: finalStatus,
            movement_type: 'liability',
            source_id: liab.id,
            original_date: dDueStr,
            projected_amount: projAmt
          });

          rawEvents.push({
            date: dDue,
            type: 'Liberación Reserva',
            concept: `Liberación Cuota: ${liab.name}`,
            amount: amt,
            impacts_liquidity: false,
            status: finalStatus,
            movement_type: 'liability',
            source_id: liab.id,
            original_date: dDueStr,
            projected_amount: projAmt
          });
        } else {
          rawEvents.push({
            date: dDue,
            type: 'Pasivo',
            concept: `Pago Directo Deuda: ${liab.name}`,
            amount: -amt,
            impacts_liquidity: true,
            status: finalStatus,
            movement_type: 'liability',
            source_id: liab.id,
            original_date: dDueStr,
            projected_amount: projAmt
          });
        }
      });
    }
  });

  // 6. Procesar transacciones intermedias individuales/manuales
  transactions.forEach(txn => {
    const d = new Date(txn.date + 'T00:00:00');
    const dStr = formatDateISO(d);

    if (d >= startDate && d <= endDate) {
      const projAmt = parseFloat(String(txn.amount)) || 0;
      const ccId = txn.credit_card_id;

      if (ccId !== null && ccId !== undefined && String(ccId) !== 'null' && String(ccId) !== '') {
        // Gasto con tarjeta de crédito: no afecta la liquidez diaria hoy, sino la deuda de la tarjeta
        const cardObj = liabilities.find(c => String(c.id) === String(ccId));
        const cardLabelName = cardObj ? cardObj.name : 'TDC';

        rawEvents.push({
          date: d,
          type: 'Consumo TDC',
          concept: `Consumo TDC: ${txn.concept} (${cardLabelName})`,
          amount: projAmt,
          impacts_liquidity: false, // No resta dinero en efectivo de la caja principal
          status: 'Realizado',
          movement_type: 'transaction',
          source_id: txn.id,
          original_date: dStr,
          projected_amount: projAmt
        });
      } else {
        // Transacción normal con efectivo/caja direc: afecta la liquidez directamente
        const isExp = projAmt < 0;

        rawEvents.push({
          date: d,
          type: isExp ? 'Gasto Variable' : 'Ingreso',
          concept: isExp ? `Gasto Manual: ${txn.concept}` : `Ingreso Extra: ${txn.concept}`,
          amount: projAmt,
          impacts_liquidity: true,
          status: 'Realizado',
          movement_type: 'transaction',
          source_id: txn.id,
          original_date: dStr,
          projected_amount: projAmt
        });
      }
    }
  });

  // 7. Insertar todos los ingresos recurrentes calculados en la lista de eventos crudos
  incomeOccurrences.forEach(inc => {
    rawEvents.push({
      date: new Date(inc.date + 'T00:00:00'),
      type: inc.type,
      concept: inc.concept,
      amount: inc.amount,
      impacts_liquidity: inc.status !== 'Omitido', // Si es omitido no afecta la liquidez de caja
      status: inc.status,
      movement_type: inc.movement_type,
      source_id: inc.source_id || 0,
      original_date: inc.original_date,
      projected_amount: inc.projected_amount
    });
  });

  // Prioridades en el mismo día para procesar ordenadamente
  const typePriority: Record<string, number> = {
    'Balance Inicial': 0,
    'Ingreso': 1,
    'Reserva Gasto': 2,
    'Reserva Deuda': 3,
    'Gasto Fijo': 4,
    'Pasivo': 5,
    'Pago Pasivo': 6,
    'Consumo TDC': 7,
    'Gasto Variable': 8,
    'Interés TDC': 9,
    'Liberación Reserva': 10,
    'Balance Final': 11
  };

  // Ordenamiento cronológico del ledger
  rawEvents.sort((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) {
      return a.date.getTime() - b.date.getTime();
    }
    const pA = typePriority[a.type] !== undefined ? typePriority[a.type] : 99;
    const pB = typePriority[b.type] !== undefined ? typePriority[b.type] : 99;
    if (pA !== pB) return pA - pB;
    return a.concept.localeCompare(b.concept);
  });

  // 8. Compilación y cálculo de balance neta acumulada en Caja
  const ledger: LedgerRow[] = [];

  // Agregar fila inicial de Balance Inicial
  ledger.push({
    date: startDateStr,
    type: 'Balance Inicial',
    concept: 'Balance Inicial de Caja',
    amount: initialBalance,
    liquidity: initialBalance,
    status: 'Realizado',
    movement_type: 'initial',
    source_id: null,
    original_date: startDateStr,
    projected_amount: initialBalance
  });

  let currentLiquidity = initialBalance;

  rawEvents.forEach(ev => {
    if (ev.status === 'Omitido') {
      // Ignorar sumatorias y registrar sólo de adorno
      ledger.push({
        date: formatDateISO(ev.date),
        type: ev.type,
        concept: ev.concept,
        amount: 0,
        liquidity: currentLiquidity,
        status: 'Omitido',
        movement_type: ev.movement_type,
        source_id: ev.source_id,
        original_date: ev.original_date,
        projected_amount: ev.projected_amount
      });
      return;
    }

    if (ev.impacts_liquidity) {
      currentLiquidity += ev.amount;
    }

    ledger.push({
      date: formatDateISO(ev.date),
      type: ev.type,
      concept: ev.concept,
      amount: ev.amount,
      liquidity: currentLiquidity,
      status: ev.status || 'Proyectado',
      movement_type: ev.movement_type,
      source_id: ev.source_id,
      original_date: ev.original_date,
      projected_amount: ev.projected_amount
    });
  });

  // Alertas de Liquidez Insuficiente y de Ajuste por Déficit
  // Si encontramos que la liquidez neta es menor que el margen de seguridad o menor que 0, marcamos alertas
  const safetyMarginVal = parseFloat(String(config.safety_margin || '20')) || 0;

  for (let i = 0; i < ledger.length; i++) {
    const row = ledger[i];
    if (row.type === 'Balance Inicial' || row.type === 'Balance Final' || row.status === 'Realizado' || row.status === 'Omitido') {
      continue;
    }

    if (row.liquidity < 0) {
      // Si la liquidez es menor a 0, ¡Falta liquidez real!
      row.status = 'Falta Liquidez';
    } else if (row.liquidity < safetyMarginVal) {
      // Si la liquidez cae por debajo del margen de seguridad configurado por el usuario, ¡Alerta de Ajuste!
      row.status = 'Alerta de Ajuste';
    }
  }

  // Fila final de Balance Final
  ledger.push({
    date: endDateStr,
    type: 'Balance Final',
    concept: 'Cierre de Ciclo Financiero',
    amount: 0,
    liquidity: currentLiquidity,
    status: 'Proyectado',
    movement_type: 'final',
    source_id: null,
    original_date: endDateStr,
    projected_amount: 0
  });

  return ledger;
}
