/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Config, Income, Expense, Liability, Transaction } from '../types';
import {
  Calendar,
  DollarSign,
  Plus,
  RefreshCcw,
  Check,
  CreditCard,
  ShoppingBag,
  ListFilter,
  X,
  Clock,
  Sparkles,
  Edit2,
  Trash2
} from 'lucide-react';

interface FormManagerProps {
  config: Config;
  onConfigSave: (cfg: Config) => void;
  incomes: Income[];
  onIncomeAdd: (inc: Omit<Income, 'id'> & { id?: number }) => void;
  onIncomeDelete: (id: number) => void;
  expenses: Expense[];
  onExpenseAdd: (exp: Omit<Expense, 'id'> & { id?: number }) => void;
  onExpenseDelete: (id: number) => void;
  liabilities: Liability[];
  onLiabilityAdd: (liab: Omit<Liability, 'id'> & { id?: number }) => void;
  onLiabilityDelete: (id: number) => void;
  transactions: Transaction[];
  onTransactionAdd: (txn: Omit<Transaction, 'id'> & { id?: number }) => void;
  onTransactionDelete: (id: number) => void;
  
  // Elementos activos bajo edición
  editingIncome: Income | null;
  onCancelEditingIncome: () => void;
  editingExpense: Expense | null;
  onCancelEditingExpense: () => void;
  editingLiability: Liability | null;
  onCancelEditingLiability: () => void;
  editingTransaction: Transaction | null;
  onCancelEditingTransaction: () => void;

  onStartEditIncome: (inc: Income) => void;
  onStartEditExpense: (exp: Expense) => void;
  onStartEditLiability: (liab: Liability) => void;
  onStartEditTransaction: (txn: Transaction) => void;
}

type TabType = 'ciclo' | 'ingresos' | 'gastos' | 'deudas' | 'diarios';

export default function FormManager({
  config,
  onConfigSave,
  incomes,
  onIncomeAdd,
  onIncomeDelete,
  expenses,
  onExpenseAdd,
  onExpenseDelete,
  liabilities,
  onLiabilityAdd,
  onLiabilityDelete,
  transactions,
  onTransactionAdd,
  onTransactionDelete,
  
  editingIncome,
  onCancelEditingIncome,
  editingExpense,
  onCancelEditingExpense,
  editingLiability,
  onCancelEditingLiability,
  editingTransaction,
  onCancelEditingTransaction,
  onStartEditIncome,
  onStartEditExpense,
  onStartEditLiability,
  onStartEditTransaction
}: FormManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ciclo');

  // 1. Estado para Formulario de Configuración
  const [initialBalance, setInitialBalance] = useState(String(config.initial_balance));
  const [startDate, setStartDate] = useState(config.start_date);
  const [endDate, setEndDate] = useState(config.end_date);
  const [safetyMargin, setSafetyMargin] = useState(String(config.safety_margin));

  // 2. Estado para Formulario de Ingresos
  const [incAmount, setIncAmount] = useState('');
  const [incDay, setIncDay] = useState('5');

  // Sincronizar inputs bajo edición para Ingresos
  React.useEffect(() => {
    if (editingIncome) {
      setIncAmount(String(editingIncome.amount));
      setIncDay(String(editingIncome.day_of_month));
      setActiveTab('ingresos');
    }
  }, [editingIncome]);

  // 3. Estado para Formulario de Gastos
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFrequency, setExpFrequency] = useState<'Semanal' | 'Quincenal' | 'Mensual'>('Mensual');
  const [expDay, setExpDay] = useState('10');
  const [expCanDelay, setExpCanDelay] = useState(false);

  // Sincronizar inputs bajo edición para Gastos
  React.useEffect(() => {
    if (editingExpense) {
      setExpName(editingExpense.name);
      setExpAmount(String(editingExpense.amount));
      setExpFrequency(editingExpense.frequency);
      setExpDay(String(editingExpense.day_of_execution));
      setExpCanDelay(editingExpense.can_delay === 1);
      setActiveTab('gastos');
    }
  }, [editingExpense]);

  // 4. Estado para Formulario de Deudas / Tarjetas
  const [liabType, setLiabType] = useState<'Prestamo' | 'TDC'>('Prestamo');
  const [liabName, setLiabName] = useState('');
  const [liabTotal, setLiabTotal] = useState('');
  const [liabQuota, setLiabQuota] = useState('');
  const [liabDueDay, setLiabDueDay] = useState('15');
  const [liabEndDate, setLiabEndDate] = useState('');
  const [liabCutOffDay, setLiabCutOffDay] = useState('10');
  const [liabFrequency, setLiabFrequency] = useState<'Semanal' | 'Quincenal' | 'Mensual'>('Mensual');
  const [liabCreditLimit, setLiabCreditLimit] = useState('');
  const [liabPaymentPlan, setLiabPaymentPlan] = useState('Minimo');
  const [liabCanDelay, setLiabCanDelay] = useState(false);
  const [liabStartDate, setLiabStartDate] = useState('');

  // Sincronizar inputs bajo edición para Deudas
  React.useEffect(() => {
    if (editingLiability) {
      setLiabType(editingLiability.debt_type);
      setLiabName(editingLiability.name);
      setLiabTotal(String(editingLiability.total_amount));
      setLiabQuota(String(editingLiability.installment_amount));
      setLiabDueDay(String(editingLiability.due_day));
      setLiabEndDate(editingLiability.end_date);
      setLiabCutOffDay(String(editingLiability.cut_off_day || '10'));
      setLiabFrequency(editingLiability.frequency);
      setLiabCreditLimit(String(editingLiability.credit_limit || ''));
      setLiabPaymentPlan(editingLiability.payment_plan);
      setLiabCanDelay(editingLiability.can_delay === 1);
      setLiabStartDate(editingLiability.start_date);
      setActiveTab('deudas');
    }
  }, [editingLiability]);

  // 5. Estado para Formulario de Gastos Diarios / Consumos TDC rápidos
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);
  const [txnConcept, setTxnConcept] = useState('');
  const [txnType, setTxnType] = useState<'Ingreso' | 'Gasto'>('Gasto');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnPaymentMethod, setTxnPaymentMethod] = useState('Cash'); // 'Cash' o ID de la TDC

  // Sincronizar inputs bajo edición para Transacciones
  React.useEffect(() => {
    if (editingTransaction) {
      setTxnDate(editingTransaction.date);
      setTxnConcept(editingTransaction.concept);
      setTxnType(editingTransaction.amount < 0 ? 'Gasto' : 'Ingreso');
      setTxnAmount(String(Math.abs(editingTransaction.amount)));
      setTxnPaymentMethod(editingTransaction.credit_card_id ? String(editingTransaction.credit_card_id) : 'Cash');
      setActiveTab('diarios');
    }
  }, [editingTransaction]);

  // Envíos de Formularios
  const submitConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onConfigSave({
      initial_balance: parseFloat(initialBalance) || 0,
      start_date: startDate,
      end_date: endDate,
      safety_margin: parseFloat(safetyMargin) || 0
    });
  };

  const submitIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(incAmount);
    const dayVal = parseInt(incDay);
    if (isNaN(amountVal) || isNaN(dayVal)) return;

    onIncomeAdd({
      id: editingIncome ? editingIncome.id : undefined,
      day_of_month: dayVal,
      amount: amountVal
    });

    setIncAmount('');
    setIncDay('5');
  };

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(expAmount);
    const dayVal = parseInt(expDay);
    if (!expName || isNaN(amountVal) || isNaN(dayVal)) return;

    onExpenseAdd({
      id: editingExpense ? editingExpense.id : undefined,
      name: expName,
      frequency: expFrequency,
      amount: amountVal,
      day_of_execution: dayVal,
      can_delay: expCanDelay ? 1 : 0
    });

    setExpName('');
    setExpAmount('');
    setExpFrequency('Mensual');
    setExpDay('10');
    setExpCanDelay(false);
  };

  const submitLiability = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liabName) return;

    const totalVal = parseFloat(liabTotal) || 0;
    const quotaVal = parseFloat(liabQuota) || 0;
    const dueDayVal = parseInt(liabDueDay) || 15;
    const limitVal = parseFloat(liabCreditLimit) || 0;

    onLiabilityAdd({
      id: editingLiability ? editingLiability.id : undefined,
      name: liabName,
      total_amount: totalVal,
      installment_amount: liabType === 'TDC' ? 0 : quotaVal,
      due_day: dueDayVal,
      end_date: liabType === 'TDC' ? '2099-12-31' : liabEndDate,
      debt_type: liabType,
      cut_off_day: liabType === 'TDC' ? parseInt(liabCutOffDay) : null,
      frequency: liabType === 'TDC' ? 'Mensual' : liabFrequency,
      credit_limit: limitVal,
      payment_plan: liabPaymentPlan,
      can_delay: liabCanDelay ? 1 : 0,
      start_date: liabStartDate || config.start_date
    });

    setLiabName('');
    setLiabTotal('');
    setLiabQuota('');
    setLiabDueDay('15');
    setLiabEndDate('');
    setLiabCutOffDay('10');
    setLiabFrequency('Mensual');
    setLiabCreditLimit('');
    setLiabPaymentPlan('Minimo');
    setLiabCanDelay(false);
    setLiabStartDate('');
  };

  const submitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(txnAmount);
    if (!txnConcept || isNaN(amountVal)) return;

    // Negativo si es gasto
    const netAmount = txnType === 'Gasto' ? -amountVal : amountVal;
    const cardId = txnPaymentMethod === 'Cash' ? null : parseInt(txnPaymentMethod);

    onTransactionAdd({
      id: editingTransaction ? editingTransaction.id : undefined,
      date: txnDate,
      concept: txnConcept,
      amount: netAmount,
      credit_card_id: cardId
    });

    setTxnConcept('');
    setTxnAmount('');
    setTxnPaymentMethod('Cash');
    setTxnDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm transition-all duration-300">
      {/* Selector de pestañas */}
      <div className="grid grid-cols-5 border-b border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/60 rounded-t-3xl overflow-hidden">
        {[
          { key: 'ciclo', label: '1. Ciclo', icon: <Clock size={14} /> },
          { key: 'ingresos', label: '2. Ingresos', icon: <Plus size={14} /> },
          { key: 'gastos', label: '3. Gastos', icon: <DollarSign size={14} /> },
          { key: 'deudas', label: '4. Deudas', icon: <CreditCard size={14} /> },
          { key: 'diarios', label: '5. Diario', icon: <ShoppingBag size={14} /> }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 text-center sm:text-left font-semibold text-[10px] sm:text-xs transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* PESTAÑA 1: CICLO PRESUPUESTARIO */}
        {activeTab === 'ciclo' && (
          <form onSubmit={submitConfig} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
              📅 Rango de Fechas y Balance Inicial
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Balance de Caja Inicial ($)</label>
                <div className="relative flex items-center">
                  <DollarSign size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={initialBalance}
                    onChange={e => setInitialBalance(e.target.value)}
                    className="w-full text-sm rounded-xl py-2 px-3 pl-8 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Margen de Caja de Seguridad ($)</label>
                <div className="relative flex items-center">
                  <DollarSign size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={safetyMargin}
                    onChange={e => setSafetyMargin(e.target.value)}
                    className="w-full text-sm rounded-xl py-2 px-3 pl-8 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Fecha de Inicio de Ciclo</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Fecha Límite / Cierre de Ciclo</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCcw size={14} />
              <span>Guardar Ciclo Financiero</span>
            </button>
          </form>
        )}

        {/* PESTAÑA 2: INGRESOS RECURRENTES */}
        {activeTab === 'ingresos' && (
          <>
            <form onSubmit={submitIncome} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                ➕ {editingIncome ? 'Editar Ingreso Recurrente' : 'Añadir Ingresos Sistemáticos mensuales'}
              </h3>
              {editingIncome && (
                <button
                  type="button"
                  onClick={onCancelEditingIncome}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Monto del Ingreso ($)</label>
                <div className="relative flex items-center">
                  <DollarSign size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Monto de cobro habitual"
                    value={incAmount}
                    onChange={e => setIncAmount(e.target.value)}
                    className="w-full text-sm rounded-xl py-2 px-3 pl-8 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Día de Cobro del mes (1-31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  placeholder="Día de desembolso (ej. 15)"
                  value={incDay}
                  onChange={e => setIncDay(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {editingIncome ? <Check size={14} /> : <Plus size={14} />}
              <span>{editingIncome ? 'Guardar Cambios' : 'Añadir Ingreso Sistemático'}</span>
            </button>
          </form>

          {/* Lista de Ingresos Planificados */}
          <div className="mt-8 border-t border-slate-150 dark:border-slate-800/80 pt-6" id="plan-incomes-container">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus size={14} className="text-emerald-500" /> Cobros Sistemáticos Registrados ({incomes.length})
            </h4>
            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-2">
              {incomes.length > 0 ? (
                incomes.map(inc => (
                  <div
                    key={inc.id}
                    id={`plan-income-row-${inc.id}`}
                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl text-xs hover:border-emerald-500/35 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Plus size={14} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          Ingreso mensual habitual
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Se ejecuta el día {inc.day_of_month} de cada mes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ${inc.amount.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onStartEditIncome(inc)}
                          title="Editar cobro"
                          className="p-1.5 text-slate-404 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer animate-none"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onIncomeDelete(inc.id)}
                          title="Eliminar cobro"
                          className="p-1.5 text-slate-404 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer animate-none"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2.5 text-center bg-slate-25 dark:bg-slate-900/10 rounded-xl" id="no-incomes-msg">
                  No se han registrado cobros sistemáticos para este perfil.
                </p>
              )}
            </div>
          </div>
         </>
        )}

        {/* PESTAÑA 3: GASTOS RECURRENTES */}
        {activeTab === 'gastos' && (
          <>
            <form onSubmit={submitExpense} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                💵 {editingExpense ? 'Editar Gastos Sistemáticos' : 'Añadir Gastos Sistemáticos'}
              </h3>
              {editingExpense && (
                <button
                  type="button"
                  onClick={onCancelEditingExpense}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Concepto o Nombre del Gasto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Alquiler, Internet"
                  value={expName}
                  onChange={e => setExpName(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Monto del Consumo ($)</label>
                <div className="relative flex items-center">
                  <DollarSign size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Monto a pagar"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    className="w-full text-sm rounded-xl py-2 px-3 pl-8 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Frecuencia de Repetición</label>
                <select
                  value={expFrequency}
                  onChange={e => setExpFrequency(e.target.value as any)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="Mensual">Cada Mes (Fijo)</option>
                  <option value="Quincenal">Cada 15 días (Fijo)</option>
                  <option value="Semanal">Semanal (Provisional)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">
                  {expFrequency === 'Semanal'
                    ? 'Día de Consumo Semanal (1: Lun, ..., 7: Dom)'
                    : expFrequency === 'Quincenal'
                    ? 'Día inicial de Consumo Quincenal (1-31)'
                    : 'Día de Consumo mensual fijo (1-31)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={expFrequency === 'Semanal' ? '7' : '31'}
                  required
                  placeholder={expFrequency === 'Semanal' ? 'Día de la semana (1-7)' : 'Día del mes (1-31)'}
                  value={expDay}
                  onChange={e => setExpDay(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input
                id="expCanDelay"
                type="checkbox"
                checked={expCanDelay}
                onChange={e => setExpCanDelay(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-auto cursor-pointer"
              />
              <label htmlFor="expCanDelay" className="text-xs font-semibold text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                Este gasto es flexible / se puede reducir ante un déficit.
              </label>
            </div>

            <button
              type="submit"
              className="mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {editingExpense ? <Check size={14} /> : <Plus size={14} />}
              <span>{editingExpense ? 'Guardar Cambios' : 'Añadir Gasto Habitual'}</span>
            </button>
          </form>

          {/* Lista de Gastos Planificados */}
          <div className="mt-8 border-t border-slate-150 dark:border-slate-800/80 pt-6" id="plan-expenses-container">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingBag size={14} className="text-emerald-500" /> Egresos de Consumo Habitual Registrados ({expenses.length})
            </h4>
            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-2">
              {expenses.length > 0 ? (
                expenses.map(exp => (
                  <div
                    key={exp.id}
                    id={`plan-expense-row-${exp.id}`}
                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl text-xs hover:border-emerald-500/35 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <ShoppingBag size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{exp.name}</span>
                          {exp.can_delay === 1 && (
                            <span className="text-[9px] bg-emerald-50 dark:bg-emerald-955 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                              Flexible
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Frecuencia: <span className="font-semibold">{exp.frequency}</span> • Día programado: <span className="font-semibold">{exp.day_of_execution}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        -${exp.amount.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onStartEditExpense(exp)}
                          title="Editar gasto habitual"
                          className="p-1.5 text-slate-404 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer animate-none"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExpenseDelete(exp.id)}
                          title="Eliminar gasto habitual"
                          className="p-1.5 text-slate-404 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer animate-none"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2.5 text-center bg-slate-25 dark:bg-slate-900/10 rounded-xl" id="no-expenses-msg">
                  No se han registrado consumos sistemáticos para este perfil.
                </p>
              )}
            </div>
          </div>
         </>
        )}

        {/* PESTAÑA 4: DEUDAS Y PASIVOS / TARJETAS */}
        {activeTab === 'deudas' && (
          <>
            <form onSubmit={submitLiability} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                💳 {editingLiability ? 'Editar Crédito / Deuda' : 'Cargar Créditos o Tarjetas de Crédito'}
              </h3>
              {editingLiability && (
                <button
                  type="button"
                  onClick={onCancelEditingLiability}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Tipo de Compromiso Pasivo</label>
                <select
                  value={liabType}
                  onChange={e => setLiabType(e.target.value as any)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="Prestamo">Préstamo Tradicional (Cuota Fija habitual)</option>
                  <option value="TDC">Tarjeta de Crédito (Simulada revolving cobro/corte)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Nombre de la Entidad o Crédito</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Visa Santander, Préstamo Coche Coppel"
                  value={liabName}
                  onChange={e => setLiabName(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {liabType === 'Prestamo' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Saldo Pendiente de Deuda ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Monto remanente"
                      value={liabTotal}
                      onChange={e => setLiabTotal(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Monto de Cuota Periódica ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Cuota a cobrar"
                      value={liabQuota}
                      onChange={e => setLiabQuota(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Frecuencia de Abonos</label>
                    <select
                      value={liabFrequency}
                      onChange={e => setLiabFrequency(e.target.value as any)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    >
                      <option value="Mensual">Cuotas Mensuales</option>
                      <option value="Quincenal">Cuotas Quincenales</option>
                      <option value="Semanal">Cuotas Semanales</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-550">
                      {liabFrequency === 'Semanal' ? 'Día de pago Semanal (1-7)' : 'Día de vencimiento (1-31)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={liabFrequency === 'Semanal' ? '7' : '31'}
                      required
                      value={liabDueDay}
                      onChange={e => setLiabDueDay(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Fecha de Inicio del Préstamo</label>
                    <input
                      type="date"
                      required
                      value={liabStartDate}
                      onChange={e => setLiabStartDate(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Fecha Límite / Último Pago</label>
                    <input
                      type="date"
                      required
                      value={liabEndDate}
                      onChange={e => setLiabEndDate(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Saldo Deudor de Tarjeta ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Deuda actual en la tarjeta"
                      value={liabTotal}
                      onChange={e => setLiabTotal(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Límite de Línea de Crédito ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Financiamiento máximo tolerado"
                      value={liabCreditLimit}
                      onChange={e => setLiabCreditLimit(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Estrategia / Plan de Pago Mensual</label>
                    <select
                      value={liabPaymentPlan}
                      onChange={e => setLiabPaymentPlan(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    >
                      <option value="Minimo">Pago Mínimo en ciclo</option>
                      <option value="Total">Pagar Monto para no generar Intereses (Completo)</option>
                      <option value="3_meses">Plan Amortizable Diferido 3 meses</option>
                      <option value="6_meses">Plan Amortizable Diferido 6 meses</option>
                      <option value="12_meses">Plan Amortizable Diferido 12 meses</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Día de Corte Mensual (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      placeholder="Día de emisión de corte"
                      value={liabCutOffDay}
                      onChange={e => setLiabCutOffDay(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">Día Límite de Pago Mensual (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      placeholder="Último día para no atrasarse"
                      value={liabDueDay}
                      onChange={e => setLiabDueDay(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-550">Cuota mínima si es Plan Mínimo ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Cuota de pago mínimo base"
                      value={liabQuota}
                      onChange={e => setLiabQuota(e.target.value)}
                      className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 mt-1">
              <input
                id="liabCanDelay"
                type="checkbox"
                checked={liabCanDelay}
                onChange={e => setLiabCanDelay(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer pointer-events-auto"
              />
              <label htmlFor="liabCanDelay" className="text-xs font-semibold text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                Esta cuota de pago de deuda se puede mitigar / prorrogar temporalmente.
              </label>
            </div>

            <button
              type="submit"
              className="mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {editingLiability ? <Check size={14} /> : <Plus size={14} />}
              <span>{editingLiability ? 'Guardar Cambios' : 'Añadir Compromiso Crédito'}</span>
            </button>
          </form>

          {/* Lista de Deudas */}
          <div className="mt-8 border-t border-slate-150 dark:border-slate-800/80 pt-6" id="plan-liabilities-container">
            <h4 className="text-xs font-bold text-slate-404 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-emerald-500" /> Compromisos Pasivos y Cuentas Financieras ({liabilities.length})
            </h4>
            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-2">
              {liabilities.length > 0 ? (
                liabilities.map(liab => {
                  const isTDC = liab.debt_type === 'TDC';
                  return (
                    <div
                      key={liab.id}
                      id={`plan-liability-row-${liab.id}`}
                      className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl text-xs hover:border-emerald-500/35 transition-all animate-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isTDC ? 'bg-amber-50 dark:bg-amber-955/30 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-955/30 text-red-650 dark:text-red-400'}`}>
                          <CreditCard size={14} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{liab.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${isTDC ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-955/55 text-red-600 dark:text-red-400'}`}>
                              {isTDC ? 'TDC / Revolving' : 'Préstamo Fijo'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-1">
                            {isTDC ? (
                              <>
                                Día de Corte: <span className="font-semibold">{liab.cut_off_day}</span> • Límite de Crédito: <span className="font-semibold">${liab.credit_limit.toFixed(2)}</span>
                              </>
                            ) : (
                              <>
                                Día de Pago: <span className="font-semibold">{liab.due_day}</span> • Fecha fin: <span className="font-semibold">{liab.end_date}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-705 dark:text-slate-300">
                            Deuda: ${liab.total_amount.toFixed(2)}
                          </p>
                          {!isTDC && (
                            <p className="text-[10px] text-slate-404 dark:text-slate-500 font-mono mt-0.5">
                              Cuota: ${liab.installment_amount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onStartEditLiability(liab)}
                            title="Editar pasivo"
                            className="p-1.5 text-slate-404 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer animate-none"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onLiabilityDelete(liab.id)}
                            title="Eliminar pasivo"
                            className="p-1.5 text-slate-404 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer animate-none"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-404 dark:text-slate-500 italic py-2.5 text-center bg-slate-25 dark:bg-slate-900/10 rounded-xl" id="no-liabilities-msg">
                  No se han registrado compromisos de créditos o pasivos.
                </p>
              )}
            </div>
          </div>
         </>
        )}

        {/* PESTAÑA 5: GASTO DIARIO DETALLADO / CONSUMOS RÁPIDOS */}
        {activeTab === 'diarios' && (
          <>
            <form onSubmit={submitTransaction} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 font-main">
                🛍️ {editingTransaction ? 'Editar Gasto Diario' : 'Registrar Gasto Diario / Flujos Manuales'}
              </h3>
              {editingTransaction && (
                <button
                  type="button"
                  onClick={onCancelEditingTransaction}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Monto Transaccional ($)</label>
                <div className="relative flex items-center">
                  <DollarSign size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Monto gastado u obtenido"
                    value={txnAmount}
                    onChange={e => setTxnAmount(e.target.value)}
                    className="w-full text-sm rounded-xl py-2 px-3 pl-8 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Tipo de Flujo Manual</label>
                <select
                  value={txnType}
                  onChange={e => setTxnType(e.target.value as any)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="Gasto">Gasto / Consumo Detallado (Resta)</option>
                  <option value="Ingreso">Ingreso Extra / Flujo Caja Entrante (Suma)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Concepto o Descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Taxis, Oxxo refresco, Cena familiar"
                  value={txnConcept}
                  onChange={e => setTxnConcept(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Fecha de la Transacción</label>
                <input
                  type="date"
                  required
                  value={txnDate}
                  onChange={e => setTxnDate(e.target.value)}
                  className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Método de Liquidación</label>
              <select
                value={txnPaymentMethod}
                onChange={e => setTxnPaymentMethod(e.target.value)}
                disabled={txnType === 'Ingreso'}
                className="w-full text-sm rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="Cash">Efectivo / Caja direct de Caja principal</option>
                {liabilities
                  .filter(c => c.debt_type === 'TDC')
                  .map(card => (
                    <option key={card.id} value={card.id}>
                      Tarjeta de Crédito: {card.name} (Saldo amortizable)
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="submit"
              className="mt-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {editingTransaction ? <Check size={14} /> : <Plus size={14} />}
              <span>{editingTransaction ? 'Guardar Cambios' : 'Registrar Gasto Diario'}</span>
            </button>
          </form>

          {/* Lista de Transacciones Diarias */}
          <div className="mt-8 border-t border-slate-150 dark:border-slate-800/80 pt-6" id="plan-transactions-container">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ListFilter size={14} className="text-amber-500" /> Gastos y Movimientos Diarios Manuales ({transactions.length})
            </h4>
            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-2">
              {transactions.length > 0 ? (
                transactions.map(txn => {
                  const isIncome = txn.amount > 0;
                  const linkedCard = liabilities.find(l => l.id === txn.credit_card_id);
                  return (
                    <div
                      key={txn.id}
                      id={`plan-transaction-row-${txn.id}`}
                      className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl text-xs hover:border-amber-500/35 transition-all animate-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-50 dark:bg-emerald-955/35 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-955/35 text-rose-600 dark:text-rose-455'}`}>
                          <ListFilter size={14} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{txn.concept}</span>
                            {linkedCard && (
                              <span className="text-[9px] bg-amber-50 dark:bg-amber-955 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                                💳 {linkedCard.name}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Fecha de ejecución: <span className="font-semibold text-slate-605 dark:text-slate-350">{txn.date.split('-').reverse().join('/')}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-mono font-bold text-sm ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {isIncome ? '+' : '-'}${Math.abs(txn.amount).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onStartEditTransaction(txn)}
                            title="Editar movimiento manual"
                            className="p-1.5 text-slate-404 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer animate-none"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onTransactionDelete(txn.id)}
                            title="Eliminar movimiento manual"
                            className="p-1.5 text-slate-404 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer animate-none"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2.5 text-center bg-slate-25 dark:bg-slate-900/10 rounded-xl" id="no-transactions-msg">
                  No se han registrado movimientos manuales o consumos rápidos diarios.
                </p>
              )}
            </div>
          </div>
         </>
        )}
      </div>
    </div>
  );
}
