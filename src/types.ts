/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Profile {
  id: number;
  name: string;
}

export interface Config {
  initial_balance: string | number;
  start_date: string;
  end_date: string;
  safety_margin: string | number;
}

export interface Income {
  id: number;
  day_of_month: number;
  amount: number;
}

export interface Expense {
  id: number;
  name: string;
  frequency: 'Semanal' | 'Quincenal' | 'Mensual';
  amount: number;
  day_of_execution: number; // 1-31 o en semanal 1-7 (Lunes-Domingo)
  can_delay: number; // 0 o 1 (true/false)
}

export interface Liability {
  id: number;
  name: string;
  total_amount: number; // Monto total de deuda en el caso de TDC o Préstamo
  installment_amount: number; // Cuota periódica (para préstamo) o un valor de referencia para TDC
  due_day: number; // Día de pago (1-31 o en semanal 1-7)
  end_date: string; // Para préstamos: final de pagos. TDC: '2099-12-31'
  debt_type: 'Prestamo' | 'TDC';
  cut_off_day: number | null; // Día de corte para TDC
  frequency: 'Semanal' | 'Quincenal' | 'Mensual'; // Frecuencia de cuota
  credit_limit: number; // Límite de crédito en caso de TDC
  payment_plan: 'Minimo' | 'Total' | '3_meses' | '6_meses' | '12_meses' | string;
  can_delay: number; // 0 o 1
  start_date: string; // Fecha de inicio de préstamo o fecha de inicio para TDC
}

export interface Transaction {
  id: number;
  date: string;
  concept: string;
  amount: number; // Negativo para gasto, Positivo para ingreso
  credit_card_id: number | null; // ID de liability de tipo TDC, o null si es en caja/efectivo
}

export interface RealizedMovement {
  movement_type: string; // 'income' | 'expense' | 'liability'
  source_id: number;
  date: string; // Formato YYYY-MM-DD
  projected_amount: number;
  actual_amount: number;
  status: 'Realizado' | 'Omitido';
}

export interface LedgerRow {
  date: string; // YYYY-MM-DD
  type: string; // 'Balance Inicial' | 'Ingreso' | 'Gasto Fijo' | 'Reserva Gasto' | 'Pago Pasivo' | 'Liberación Reserva' | 'Pasivo' | 'Consumo TDC' | 'Amortización' | 'Gasto Variable' | 'Interés TDC' | 'Balance Final'
  concept: string;
  amount: number;
  liquidity: number;
  status: string; // 'Realizado' | 'Pendiente' | 'Proyectado' | 'Falta Liquidez' | 'Alerta de Ajuste' | 'Omitido'
  movement_type: string; // 'income' | 'expense' | 'liability' | 'transaction' | 'initial' | 'final' | ''
  source_id: number | null;
  original_date: string; // dStr de la proyección
  projected_amount: number;
}

export interface OptimizedSuggestion {
  target: string;
  targetDate: string;
  deficit: number;
  varExpense: string;
  varDate: string;
  varAmount: number;
}

export interface TrashItem extends LedgerRow {
  deletedAt: number;
  originalItem?: string;
}
