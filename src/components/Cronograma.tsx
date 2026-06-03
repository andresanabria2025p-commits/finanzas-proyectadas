/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LedgerRow, Income, Expense, Liability, Transaction } from '../types';
import {
  ListFilter,
  Download,
  Check,
  Ban,
  Search,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Edit2,
  Trash2,
  HelpCircle,
  PlusSquare,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertOctagon,
  Info
} from 'lucide-react';

interface CronogramaProps {
  ledgerData: LedgerRow[];
  incomes: Income[];
  expenses: Expense[];
  liabilities: Liability[];
  transactions: Transaction[];
  safetyMargin?: number;
  onDeleteIncome: (id: number) => void;
  onStartEditIncome: (inc: Income) => void;
  onDeleteExpense: (id: number) => void;
  onStartEditExpense: (exp: Expense) => void;
  onDeleteLiability: (id: number) => void;
  onStartEditLiability: (liab: Liability) => void;
  onDeleteTransaction: (id: number) => void;
  onStartEditTransaction: (txn: Transaction) => void;
  onConfirmRealizedStatus: (
    movementType: string,
    sourceId: number,
    dateStr: string,
    projectedAmount: number,
    actualAmount: number,
    status: 'Realizado' | 'Omitido',
    realizedDate?: string
  ) => void;
  onDeleteRealizedStatus: (movementType: string, sourceId: number, dateStr: string) => void;
  onAmortizeExpense?: (
    movementType: string,
    sourceId: number,
    dateStr: string,
    projectedAmount: number,
    concept: string,
    installments: { date: string; amount: number }[]
  ) => void;
}

type SubTabType = 'pending_projected' | 'realized' | 'all';

export default function Cronograma({
  ledgerData,
  incomes,
  expenses,
  liabilities,
  transactions,
  safetyMargin = 300,
  onDeleteIncome,
  onStartEditIncome,
  onDeleteExpense,
  onStartEditExpense,
  onDeleteLiability,
  onStartEditLiability,
  onDeleteTransaction,
  onStartEditTransaction,
  onConfirmRealizedStatus,
  onDeleteRealizedStatus,
  onAmortizeExpense
}: CronogramaProps) {
  const [subTab, setSubTab] = useState<SubTabType>('pending_projected');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Modal de conciliación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    movementType: string;
    sourceId: number;
    dateStr: string;
    projectedAmount: number;
    concept: string;
  } | null>(null);
  const [modalActualAmount, setModalActualAmount] = useState('');
  const [modalRealizedDate, setModalRealizedDate] = useState('');
  const [rowToDiscard, setRowToDiscard] = useState<string | null>(null);
  const [selectedExplainRow, setSelectedExplainRow] = useState<LedgerRow | null>(null);

  // Estados de amortización
  const [isAmortizeActive, setIsAmortizeActive] = useState(false);
  const [amortizeInstallmentsCount, setAmortizeInstallmentsCount] = useState<number>(3);

  // Encontrar las siguientes N fechas de ingresos o incrementos de 15 días si no hay suficientes
  const getAmortizationDates = (startDateStr: string, count: number): string[] => {
    const upcomingIncomes = ledgerData
      .filter(row => row.type === 'Ingreso' && row.status !== 'Omitido' && row.original_date >= startDateStr)
      .map(row => row.original_date);
    const uniqueIncomes = [...new Set(upcomingIncomes)].sort();

    const dates: string[] = [];
    const parts = startDateStr.split('-');
    let baseDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    for (let i = 0; i < count; i++) {
      if (uniqueIncomes[i]) {
        dates.push(uniqueIncomes[i]);
      } else {
        const lastDate = dates.length > 0 ? (() => {
          const lp = dates[dates.length - 1].split('-');
          return new Date(Number(lp[0]), Number(lp[1]) - 1, Number(lp[2]));
        })() : baseDate;
        const extra = new Date(lastDate.getTime() + (15 * 24 * 60 * 60 * 1000));
        const y = extra.getFullYear();
        const m = String(extra.getMonth() + 1).padStart(2, '0');
        const d = String(extra.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
      }
    }
    return dates;
  };

  // 1. Filtrar registros por subpestaña y búsqueda rápida
  const filteredLedger = ledgerData.filter(row => {
    // Buscar concepto
    const matchSearch = row.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        row.type.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    // Diferenciar por subpestañas
    if (row.type === 'Balance Inicial' || row.type === 'Balance Final') return true;
    if (subTab === 'all') return true;
    if (subTab === 'realized') return row.status === 'Realizado' || row.status === 'Omitido';
    if (subTab === 'pending_projected') {
      return (
        row.status === 'Pendiente' ||
        row.status === 'Proyectado' ||
        row.status === 'Falta Liquidez' ||
        row.status === 'Alerta de Ajuste'
      );
    }
    return true;
  });

  // 2. Exportación a CSV simplificada
  const exportToCSV = () => {
    if (ledgerData.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Fecha,Tipo,Concepto,Monto,Liquidez,Estado\n';

    ledgerData.forEach(row => {
      const cleanConcept = row.concept.replace(/,/g, ';');
      csvContent += `${row.date},${row.type},${cleanConcept},${row.amount.toFixed(2)},${row.liquidity.toFixed(2)},${row.status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cashflow_cronograma_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir modal de confirmación
  const handleOpenConfirmModal = (row: LedgerRow) => {
    setModalData({
      movementType: row.movement_type,
      sourceId: row.source_id || 0,
      dateStr: row.original_date,
      projectedAmount: row.amount,
      concept: row.concept
    });
    setModalActualAmount(String(Math.abs(row.amount)));
    setModalRealizedDate(row.original_date);
    setIsModalOpen(true);
  };

  const handleConfirmConciliacion = () => {
    if (!modalData) return;
    const value = parseFloat(modalActualAmount);
    if (isNaN(value) || value < 0) {
      alert('Por favor ingrese un monto absoluto coherente.');
      return;
    }

    if (!modalRealizedDate) {
      alert('Por favor seleccione una fecha válida para la operación.');
      return;
    }

    // El monto real conserva el signo del proyectado (si era egreso, el real se guarda negativo)
    const isOutflow = modalData.projectedAmount < 0;
    const finalAmount = isOutflow ? -value : value;

    onConfirmRealizedStatus(
      modalData.movementType,
      modalData.sourceId,
      modalData.dateStr,
      modalData.projectedAmount,
      finalAmount,
      'Realizado',
      modalRealizedDate
    );
    setIsModalOpen(false);
    setModalData(null);
  };

  const handleOmitirConciliacion = (row: LedgerRow) => {
    onConfirmRealizedStatus(
      row.movement_type,
      row.source_id || 0,
      row.original_date,
      row.amount,
      0,
      'Omitido'
    );
  };

  const postponedRows = ledgerData.filter(
    row => row.autoPostponed && row.status !== 'Realizado' && row.status !== 'Omitido'
  );

  const criticalUnpostponableRows = ledgerData.filter(
    row => (row.status === 'Falta Liquidez' || row.status === 'Alerta de Ajuste') && row.can_delay === 0
  );

  return (
    <div className="flex flex-col gap-6" id="cronograma-container">
      {/* Alerta de Ajuste Obligatorio para Gastos Críticos No Posponibles */}
      {criticalUnpostponableRows.length > 0 && (
        <div id="cash-safety-critical-alert" className="bg-rose-50/70 dark:bg-rose-950/20 border-2 border-rose-300 dark:border-rose-800/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-955/20 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertOctagon size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                🚨 ALERTA CRÍTICA: Gastos Obligatorios No Posponibles en Riesgo ({criticalUnpostponableRows.length} {criticalUnpostponableRows.length === 1 ? 'gasto en peligro' : 'gastos en peligro'})
              </h4>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                Tienes gastos obligatorios que <strong>no se pueden posponer</strong> y causarán un déficit o reducirán tu colchón de seguridad. Debes realizar un <strong>ajuste inmediato</strong> en tu distribución o reservas.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 animate-pulse">
            <span className="text-[9px] bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-lg font-extrabold text-rose-800 dark:text-rose-300 uppercase tracking-widest whitespace-nowrap">
              Ajuste Requerido
            </span>
          </div>
        </div>
      )}

      {/* Alertas de Caja por Postergación Automática de Seguridad */}
      {postponedRows.length > 0 && (
        <div id="cash-safety-margin-alert" className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-650 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-800 dark:text-amber-300">
                Alerta de Caja: Postergación Automática ({postponedRows.length} {postponedRows.length === 1 ? 'gasto protegido' : 'gastos protegidos'})
              </h4>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                Para prevenir que el balance de caja caiga por debajo de tu <strong>colchón mínimo de seguridad</strong>, el simulador reprogramó automáticamente los gastos proyectados con fondos insuficientes para que sean pagados con tu próximo ingreso.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-widest whitespace-nowrap">
              Colchón Protegido
            </span>
          </div>
        </div>
      )}

      {/* Controles de búsqueda y filtros */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por concepto o tipo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 pl-10 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Subpestañas */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex font-semibold">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'pending_projected', label: 'Pendientes' },
              { key: 'realized', label: 'Conciliados' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSubTab(tab.key as SubTabType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer ${
                  subTab === tab.key
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Botón Exportar */}
          <button
            onClick={exportToCSV}
            title="Exportar presupuesto a CSV"
            className="flex items-center gap-1.5 py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Tabla del Cronograma Proyectado - Escritorio */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 font-bold">
                <th className="p-4">Fecha</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Concepto</th>
                <th className="p-4 text-right">Monto</th>
                <th className="p-4 text-right">Liquidez en Caja</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {filteredLedger.length > 0 ? (
                filteredLedger.map((row, idx) => {
                  const dateParts = row.date.split('-');
                  const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                  // Visualización adaptativa de montos
                  const isIncome = row.amount > 0 || row.type === 'Ingreso' || row.type === 'Liberación Reserva';
                  let amountStyle = isIncome ? 'text-emerald-600 font-semibold' : 'text-slate-800 dark:text-slate-100';
                  let amountPrefix = '';

                  if (row.type === 'Gasto Fijo' || row.type === 'Reserva Gasto' || row.type === 'Reserva Deuda' || row.type === 'Pago Pasivo' || row.type === 'Pasivo' || row.type === 'Gasto Variable' || row.type === 'Consumo TDC') {
                    if (row.amount < 0 && row.status !== 'Omitido') {
                      amountStyle = 'text-rose-600 dark:text-rose-400 font-semibold';
                    }
                  } else if (row.type === 'Liberación Reserva') {
                    amountStyle = 'text-purple-600 dark:text-purple-400 font-semibold';
                  }

                  if (row.status === 'Omitido') {
                    amountStyle = 'text-slate-400 dark:text-slate-500 line-through';
                  } else {
                    amountPrefix = isIncome ? '+' : '-';
                  }

                  // Badge de Categoría
                  let categoryBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                      {row.type}
                    </span>
                  );
                  if (row.type === 'Ingreso') {
                    categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">Ingreso</span>;
                  } else if (row.type === 'Reserva Gasto') {
                    categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30">Provisión</span>;
                  } else if (row.type === 'Reserva Deuda') {
                    categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20">Pre-Fondeo</span>;
                  } else if (row.type === 'Liberación Reserva') {
                    categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">Liberación</span>;
                  } else if (row.type === 'Gasto Variable' || row.type === 'Consumo TDC') {
                    categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20">Variable</span>;
                  }

                  // Badge de Estatus de Liquidación
                  let statusBadge = '';
                  let rowColor = '';

                  if (row.type === 'Balance Inicial' || row.type === 'Balance Final') {
                    statusBadge = <span className="text-slate-400">-</span>;
                  } else if (row.status === 'Realizado') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">Realizado</span>;
                  } else if (row.status === 'Omitido') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">Omitido</span>;
                    rowColor = 'opacity-60 bg-slate-50/50 dark:bg-slate-900/40';
                  } else if (row.status === 'Pospuesto') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/30 dark:border-amber-800/10">🕒 Pospuesto</span>;
                    rowColor = 'opacity-75 bg-amber-50/5 dark:bg-amber-950/5 border-l-2 border-l-amber-300 dark:border-l-amber-800/30 text-slate-500';
                  } else if (row.autoPostponed && row.status !== 'Realizado' && row.status !== 'Omitido') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/20 animate-pulse">🕒 Autopospuesto</span>;
                    rowColor = 'bg-amber-50/20 dark:bg-amber-950/10 border-l-4 border-l-amber-400';
                  } else if (row.status === 'Falta Liquidez') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/20 animate-pulse">Sin fondos</span>;
                    rowColor = 'bg-rose-50/30 dark:bg-rose-950/5';
                  } else if (row.status === 'Alerta de Ajuste') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/20">⚠ Alerta</span>;
                    rowColor = 'bg-amber-50/20 dark:bg-amber-950/5';
                  } else if (row.status === 'Pendiente') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/20">Pendiente</span>;
                  } else {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-805 text-slate-600 dark:text-slate-400 border border-slate-250 dark:border-slate-750">Proyectado</span>;
                  }

                  const rowIdAttr = `${row.movement_type}-${row.source_id}-${row.original_date}`;
                  const isExplainable = row.status === 'Pospuesto' || row.autoPostponed || ((row.status === 'Falta Liquidez' || row.status === 'Alerta de Ajuste') && row.can_delay === 0);

                  return (
                    <tr
                      key={idx}
                      id={`ledger-row-${rowIdAttr}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('input')) {
                          return;
                        }
                        if (isExplainable) {
                          setSelectedExplainRow(row);
                        }
                      }}
                      className={`transition-all ${rowColor} ${isExplainable ? 'cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/80' : 'hover:bg-slate-50/50 dark:hover:bg-slate-850/50'}`}
                    >
                      <td className="p-4 font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {dateFormatted}
                      </td>
                      <td className="p-4">{categoryBadge}</td>
                      <td className="p-4 max-w-xs truncate font-medium text-slate-700 dark:text-slate-300">
                        <div className="flex flex-col">
                          <span>{row.concept}</span>
                          {row.status === 'Realizado' && row.date !== row.original_date && (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 max-w-max px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800/20" title={`Pospuesto desde el ${row.original_date.split('-').reverse().join('/')}`}>
                              🕒 Pospuesto del {row.original_date.split('-').reverse().join('/')} (Próximo ingreso)
                            </span>
                          )}
                          {row.autoPostponed && row.status !== 'Realizado' && row.status !== 'Omitido' && (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 max-w-max px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800/20" title={`Originalmente programado para el ${row.original_date.split('-').reverse().join('/')}`}>
                              ⚠ Postergado al siguiente ingreso por resguardo de colchón (Original: {row.original_date.split('-').reverse().join('/')})
                            </span>
                          )}
                          {isExplainable && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-amber-650 dark:text-amber-400 font-extrabold opacity-95 hover:opacity-100">
                              <Info size={11} className="animate-pulse" />
                              <span>Ver simulación de caja (Clic para detalles)</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {row.status === 'Omitido' ? (
                          <span className={`font-mono text-slate-400`}>$0.00</span>
                        ) : row.status === 'Pospuesto' ? (
                          <div className="flex flex-col items-end">
                            <span className="line-through text-slate-400 dark:text-slate-500 font-mono">-${Math.abs(row.projected_amount).toFixed(2)}</span>
                            <span className="text-[9px] font-extrabold text-amber-605 dark:text-amber-400 whitespace-nowrap bg-amber-50/60 dark:bg-amber-950/30 px-1 py-0.5 rounded border border-amber-200/40">Diferido</span>
                          </div>
                        ) : (
                          <span className={`${amountStyle} font-mono`}>{amountPrefix}${Math.abs(row.amount).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${row.liquidity.toFixed(2)}
                      </td>
                      <td className="p-4">{statusBadge}</td>
                      <td className="p-4 text-center">
                        {row.movement_type && row.movement_type !== 'initial' && row.movement_type !== 'final' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {row.status === 'Pospuesto' ? (
                              <span className="px-2 py-1 text-[9px] font-bold rounded-lg bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
                                Pago Diferido
                              </span>
                            ) : row.status === 'Realizado' || row.status === 'Omitido' ? (
                              <button
                                onClick={() => onDeleteRealizedStatus(row.movement_type, row.source_id || 0, row.original_date)}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                              >
                                Reiniciar
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenConfirmModal(row)}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-600 border border-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
                                >
                                  <Check size={10} />
                                  <span>Conciliar</span>
                                </button>
                                {rowToDiscard === `${row.movement_type}_${row.source_id || 0}_${row.original_date}` ? (
                                  <div className="flex items-center gap-1 border border-rose-200 bg-rose-50/50 dark:border-rose-950/40 dark:bg-rose-950/10 p-1 rounded-lg">
                                    <button
                                      onClick={() => {
                                        handleOmitirConciliacion(row);
                                        setRowToDiscard(null);
                                      }}
                                      className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                                    >
                                      Sí
                                    </button>
                                    <button
                                      onClick={() => setRowToDiscard(null)}
                                      className="px-1.5 py-0.5 text-[9px] font-bold rounded border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-450 cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setRowToDiscard(`${row.movement_type}_${row.source_id || 0}_${row.original_date}`)}
                                    title="Omitir/Descartar movimiento proyectado"
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                  >
                                    <Ban size={10} className="hover:scale-110 duration-200" />
                                    <span>Descartar</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500">
                    No se encontraron movimientos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista Móvil Inteligente - Tarjetas de información resumida y expandible */}
      <div className="block md:hidden space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
        {filteredLedger.length > 0 ? (
          filteredLedger.map((row, idx) => {
            const dateParts = row.date.split('-');
            const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            const dateShort = `${dateParts[2]}/${dateParts[1]}`;

            // Visualización adaptativa de montos
            const isIncome = row.amount > 0 || row.type === 'Ingreso' || row.type === 'Liberación Reserva';
            let amountStyle = isIncome ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-800 dark:text-slate-100 font-medium';
            let amountPrefix = '';

            if (row.type === 'Gasto Fijo' || row.type === 'Reserva Gasto' || row.type === 'Reserva Deuda' || row.type === 'Pago Pasivo' || row.type === 'Pasivo' || row.type === 'Gasto Variable' || row.type === 'Consumo TDC') {
              if (row.amount < 0 && row.status !== 'Omitido') {
                amountStyle = 'text-rose-600 dark:text-rose-400 font-bold';
              }
            } else if (row.type === 'Liberación Reserva') {
              amountStyle = 'text-purple-600 dark:text-purple-400 font-bold';
            }

            if (row.status === 'Omitido') {
              amountStyle = 'text-slate-400 dark:text-slate-500 line-through';
            } else {
              amountPrefix = isIncome ? '+' : '-';
            }

            // Badge de Categoría
            let categoryBadge = (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                {row.type}
              </span>
            );
            if (row.type === 'Ingreso') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">Ingreso</span>;
            } else if (row.type === 'Reserva Gasto') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30">Provisión</span>;
            } else if (row.type === 'Reserva Deuda') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20 font-semibold">Pre-Fondeo</span>;
            } else if (row.type === 'Liberación Reserva') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">Liberación</span>;
            } else if (row.type === 'Gasto Variable' || row.type === 'Consumo TDC') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20">Variable</span>;
            }

            // Badge de Estatus de Liquidación y colores de tarjeta móvil
            let statusBadge = '';
            let cardMobileColor = 'bg-white dark:bg-slate-900';

            if (row.type === 'Balance Inicial' || row.type === 'Balance Final') {
              statusBadge = <span className="text-slate-400 font-medium">-</span>;
            } else if (row.status === 'Realizado') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">Realizado</span>;
              cardMobileColor = 'bg-emerald-50/5 dark:bg-emerald-950/5';
            } else if (row.status === 'Omitido') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">Omitido</span>;
              cardMobileColor = 'opacity-65 bg-slate-50 dark:bg-slate-900/40';
            } else if (row.status === 'Pospuesto') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-50 dark:bg-amber-950/25 text-amber-600 dark:text-amber-400 border border-amber-200/30 dark:border-amber-800/10">🕒 Pospuesto</span>;
              cardMobileColor = 'opacity-75 border-dashed border-amber-200 dark:border-amber-800/35 bg-amber-50/5 dark:bg-amber-950/5 border-l-2 border-l-amber-400 text-slate-500';
            } else if (row.autoPostponed && row.status !== 'Realizado' && row.status !== 'Omitido') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-100 dark:bg-amber-955/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/20 animate-pulse">🕒 Autopospuesto</span>;
              cardMobileColor = 'border-amber-200 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-955/5 border-l-4 border-l-amber-500';
            } else if (row.status === 'Falta Liquidez') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-rose-100 dark:bg-rose-955/30 text-rose-700 dark:text-rose-455 border border-rose-200/50 dark:border-rose-800/20 animate-pulse font-main">Sin fondos</span>;
              cardMobileColor = 'border-rose-100 dark:border-rose-955 bg-rose-50/10 dark:bg-rose-950/5';
            } else if (row.status === 'Alerta de Ajuste') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-100 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-808/20">⚠ Alerta</span>;
              cardMobileColor = 'border-amber-100 dark:border-amber-955 bg-amber-50/10 dark:bg-amber-955/5';
            } else if (row.status === 'Pendiente') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/20">Pendiente</span>;
            } else {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-250 dark:border-slate-755">Proyectado</span>;
            }

            const rowIdAttr = `${row.movement_type}-${row.source_id}-${row.original_date}`;
            const isExpanded = expandedRow === rowIdAttr;
            const isExplainable = row.status === 'Pospuesto' || row.autoPostponed || ((row.status === 'Falta Liquidez' || row.status === 'Alerta de Ajuste') && row.can_delay === 0);

            return (
              <div
                key={idx}
                id={`ledger-card-${rowIdAttr}`}
                className={`border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 transition-all ${cardMobileColor} cursor-pointer hover:border-emerald-500/30`}
                onClick={() => setExpandedRow(isExpanded ? null : rowIdAttr)}
              >
                {/* Cabecera compacta optimizada */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {dateShort}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {row.concept}
                      </span>
                      {row.status === 'Realizado' && row.date !== row.original_date && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 max-w-max px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800/10">
                          🕒 Pospuesto del {row.original_date.split('-').reverse().join('/')}
                        </span>
                      )}
                      {row.autoPostponed && row.status !== 'Realizado' && row.status !== 'Omitido' && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 max-w-max px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800/10">
                          ⚠ Postergado al siguiente ingreso por resguardo de colchón (Original: {row.original_date.split('-').reverse().join('/')})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-xs font-mono font-bold ${amountStyle}`}>
                        {row.status === 'Omitido' ? '$0.00' : `${amountPrefix}$${Math.abs(row.amount).toFixed(2)}`}
                      </p>
                      <p className="text-[9px] text-slate-404 dark:text-slate-500 font-mono mt-0.5">
                        caja: ${row.liquidity.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-slate-404">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>

                {/* Contenido detallado expandible */}
                {isExpanded && (
                  <div className="mt-3.5 border-t border-slate-100 dark:border-slate-800/80 pt-3.5 space-y-3 text-[11px]" onClick={e => e.stopPropagation()}>
                    {isExplainable && (
                      <div 
                        onClick={() => setSelectedExplainRow(row)}
                        className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/25 rounded-xl flex items-center justify-between gap-2 cursor-pointer hover:bg-amber-100/20 shadow-sm"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Info size={13} className="text-amber-650 dark:text-amber-400 font-bold" />
                          <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold truncate">Ver analítica de simulación de caja</span>
                        </div>
                        <ChevronRight size={12} className="text-amber-500" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-xl">
                      <div>
                        <p className="text-slate-404 dark:text-slate-505 uppercase tracking-widest text-[9px] font-extrabold font-mono">Fecha</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{dateFormatted}</p>
                      </div>
                      <div>
                        <p className="text-slate-404 dark:text-slate-505 uppercase tracking-widest text-[9px] font-extrabold font-mono">Categoría</p>
                        <span className="inline-block mt-0.5">{categoryBadge}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-xl">
                      <div>
                        <p className="text-slate-404 dark:text-slate-505 uppercase tracking-widest text-[9px] font-extrabold font-mono font-main">Caja Proyectada</p>
                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ${row.liquidity.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-404 dark:text-slate-500 uppercase tracking-widest text-[9px] font-extrabold font-mono font-main">Estado</p>
                        <span className="inline-block mt-0.5">{statusBadge}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40">
                      <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[9px] font-extrabold font-mono mb-1">Concepto Detallado</p>
                      <p className="text-slate-750 dark:text-slate-300 font-medium leading-relaxed">
                        {row.concept}
                      </p>
                    </div>

                    {/* Acciones para móvil */}
                    {row.movement_type && row.movement_type !== 'initial' && row.movement_type !== 'final' && (
                      <div className="mt-4 pt-1 flex items-center justify-end gap-2">
                        {row.status === 'Pospuesto' ? (
                          <span className="w-full text-center py-2 text-xs font-bold rounded-xl bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
                            Pago Diferido al Siguiente Ingreso
                          </span>
                        ) : row.status === 'Realizado' || row.status === 'Omitido' ? (
                          <button
                            onClick={() => onDeleteRealizedStatus(row.movement_type, row.source_id || 0, row.original_date)}
                            className="w-full text-center py-2 text-xs font-bold rounded-xl border border-slate-205 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:text-slate-300 transition-colors cursor-pointer animate-none"
                          >
                            Reiniciar Conciliación
                          </button>
                        ) : (
                          <>
                            {rowToDiscard === `${row.movement_type}_${row.source_id || 0}_${row.original_date}` ? (
                              <div className="flex items-center gap-1.5 border border-rose-250 bg-rose-50/50 dark:border-rose-950/40 dark:bg-rose-950/10 p-1.5 rounded-xl">
                                <span className="text-[10px] font-bold text-rose-650 dark:text-rose-455 mr-1">¿Descartar?</span>
                                <button
                                  onClick={() => {
                                    handleOmitirConciliacion(row);
                                    setRowToDiscard(null);
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                                >
                                  Sí
                                </button>
                                <button
                                  onClick={() => setRowToDiscard(null)}
                                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-205 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRowToDiscard(`${row.movement_type}_${row.source_id || 0}_${row.original_date}`)}
                                title="Ignorar consumo"
                                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-404 hover:text-rose-600 dark:hover:text-rose-404 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer animate-none"
                              >
                                <Ban size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenConfirmModal(row)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer animate-none"
                            >
                              <Check size={13} />
                              <span>Conciliar</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-405 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-3xl">
            No hay movimientos proyectados elegibles.
          </div>
        )}
      </div>

      {/* Secciones CRUD auxiliares de los Rubros Registrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Administrar Ingresos fijos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" /> Ingresos Mensuales Configurados ({incomes.length})
          </h4>
          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {incomes.length > 0 ? (
              incomes.map(inc => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/50 rounded-xl"
                >
                  <div>
                    <strong className="block text-slate-800 dark:text-slate-250 text-xs">Ingreso Recurrente</strong>
                    <span className="text-[10px] text-slate-400">Ejecución: Día {inc.day_of_month} de cada mes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-600">+${inc.amount.toFixed(2)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onStartEditIncome(inc)}
                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteIncome(inc.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No hay ingresos habituales registrados</p>
            )}
          </div>
        </div>

        {/* Administrar Gastos Recurrentes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShoppingBag size={16} className="text-emerald-500" /> Egresos Habituales ({expenses.length})
          </h4>
          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {expenses.length > 0 ? (
              expenses.map(exp => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/50 rounded-xl"
                >
                  <div className="truncate pr-2">
                    <strong className="block text-slate-800 dark:text-slate-250 text-xs truncate">{exp.name}</strong>
                    <span className="text-[10px] text-slate-400">
                      {exp.frequency} (Vence: {exp.frequency === 'Semanal' ? `Día ${exp.day_of_execution} de sem.` : `Día ${exp.day_of_execution}`})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">-${exp.amount.toFixed(2)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onStartEditExpense(exp)}
                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No hay egresos habituales registrados</p>
            )}
          </div>
        </div>

        {/* Administrar Préstamos y TDC */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-emerald-500" /> Cuentas Financieras y Deudas ({liabilities.length})
          </h4>
          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {liabilities.length > 0 ? (
              liabilities.map(liab => (
                <div
                  key={liab.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/50 rounded-xl"
                >
                  <div className="truncate pr-2">
                    <strong className="block text-slate-800 dark:text-slate-250 text-xs truncate">
                      {liab.name} <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400">{liab.debt_type}</span>
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      {liab.debt_type === 'TDC'
                        ? `Cierre: Corte ${liab.cut_off_day} / Pago ${liab.due_day}`
                        : `Vence: ${liab.frequency} (Final: ${liab.end_date})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {liab.debt_type === 'TDC'
                        ? `Límite: $${liab.credit_limit.toFixed(0)}`
                        : `Cuota: $${liab.installment_amount.toFixed(0)}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onStartEditLiability(liab)}
                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteLiability(liab.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No hay compromisos financieros registrados</p>
            )}
          </div>
        </div>

        {/* Administrar Transacciones Diarias */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ListFilter size={16} className="text-amber-500" /> Gastos y Movimientos Diarios ({transactions.length})
          </h4>
          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {transactions.length > 0 ? (
              transactions.map(txn => {
                const parts = txn.date.split('-');
                const dFormatted = `${parts[2]}/${parts[1]}`;
                const isExpense = txn.amount < 0;
                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/50 rounded-xl"
                  >
                    <div className="truncate pr-2">
                      <strong className="block text-slate-800 dark:text-slate-250 text-xs truncate">{txn.concept}</strong>
                      <span className="text-[10px] text-slate-400">
                        Fecha: {dFormatted} | {txn.credit_card_id ? 'Crédito' : 'Caja Principal'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                        {isExpense ? '-' : '+'}${Math.abs(txn.amount).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onStartEditTransaction(txn)}
                          className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(txn.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No hay gastos diarios cargados para el mes</p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE CONCILIACIÓN INTERACTIVO */}
      {isModalOpen && modalData && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100 mb-2 flex items-center gap-1.5 leading-tight">
              ✔️ Conciliar Movimiento Proyectado
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
              Por favor confirma que se ha efectuado este movimiento e ingresa el monto real final de la operación para recalcular el saldo.
            </p>

            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl mb-4 border border-slate-100 dark:border-slate-800 text-[11px] flex flex-col gap-1 text-slate-600 dark:text-slate-300">
              <p><strong>Concepto:</strong> {modalData.concept}</p>
              <p><strong>Fecha Programada:</strong> {modalData.dateStr.split('-').reverse().join('/')}</p>
              <p><strong>Monto Estimado:</strong> ${Math.abs(modalData.projectedAmount).toFixed(2)}</p>
            </div>

            <div className="flex flex-col gap-1.5 mb-3">
              <label className="text-xs font-semibold text-slate-500">Fecha de Realización (Efectiva)</label>
              <input
                type="date"
                value={modalRealizedDate}
                onChange={e => setModalRealizedDate(e.target.value)}
                className="w-full text-sm font-semibold rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 mb-2"
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-xs font-semibold text-slate-500">Monto Real de la Operación ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={modalActualAmount}
                onChange={e => setModalActualAmount(e.target.value)}
                className="w-full text-sm font-semibold rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500"
              />
            </div>

            {/* NOTIFICAR / POSPONER AL SIGUIENTE INGRESO */}
            {(() => {
              const incomesInLedger = ledgerData
                .filter(row => row.type === 'Ingreso' && row.status !== 'Omitido')
                .map(row => row.original_date);
              const sortedIncomes = [...new Set(incomesInLedger)].sort();
              const nextIncomeDate = modalData ? sortedIncomes.find(d => d > modalData.dateStr) : null;

              if (!nextIncomeDate) return null;

              return (
                <div className="mb-4 p-3 bg-blue-50/55 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20 rounded-xl text-left">
                  <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest block">
                    Alternativa: Retrasar al siguiente ingreso
                  </span>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                    ¿Prefieres pagar este gasto con tu próximo ingreso el <span className="font-bold text-blue-600 dark:text-blue-400">{nextIncomeDate.split('-').reverse().join('/')}</span>?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalRealizedDate(nextIncomeDate);
                    }}
                    className="mt-2 w-full py-1.5 px-3 rounded-lg text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>🕒 Cambiar fecha al ingreso ({nextIncomeDate.split('-').reverse().join('/')})</span>
                  </button>
                  {modalRealizedDate === nextIncomeDate && (
                    <span className="mt-1.5 block text-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ Fecha de realización configurada para el próximo ingreso.
                    </span>
                  )}
                </div>
              );
            })()}

            {/* AMORTIZACIÓN EN CUOTAS PARA GASTOS DE 3 CIFRAS */}
            {Math.abs(modalData.projectedAmount) >= 100 && (
              <div className="mb-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-left">
                <button
                  type="button"
                  onClick={() => setIsAmortizeActive(!isAmortizeActive)}
                  className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isAmortizeActive
                      ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                      : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    🪙 Dividir en Cuotas (Gasto de 3 Cifras)
                  </span>
                  <span>{isAmortizeActive ? 'Cerrar ×' : 'Configurar ❯'}</span>
                </button>

                {isAmortizeActive && (
                  <div className="mt-2.5 p-3 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Divide este compromiso de tres cifras en cuotas periódicas de amortización vinculadas a tus futuros ingresos para amortiguar el impacto. El gasto proyectado original se descartará de la caja.
                    </p>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500">Cuotas:</span>
                      {[2, 3, 4].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAmortizeInstallmentsCount(n)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                            amortizeInstallmentsCount === n
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wide block">
                        Amortización de Cuotas Prevista:
                      </span>
                      <div className="max-h-[110px] overflow-y-auto space-y-1.5 pr-1">
                        {getAmortizationDates(modalData.dateStr, amortizeInstallmentsCount).map((date, idx) => {
                          const amountPerInstallment = Math.abs(modalData.projectedAmount) / amortizeInstallmentsCount;
                          return (
                            <div key={idx} className="flex items-center justify-between text-[10px] py-1 border-b border-purple-100/30 dark:border-purple-905/15 last:border-b-0">
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                Cuota {idx + 1}/{amortizeInstallmentsCount} ({date.split('-').reverse().join('/')})
                              </span>
                              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                                ${amountPerInstallment.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const calculatedDates = getAmortizationDates(modalData.dateStr, amortizeInstallmentsCount);
                        const amountPerInstallment = Math.abs(modalData.projectedAmount) / amortizeInstallmentsCount;
                        const installmentList = calculatedDates.map(d => ({
                          date: d,
                          amount: amountPerInstallment
                        }));

                        if (onAmortizeExpense) {
                          onAmortizeExpense(
                            modalData.movementType,
                            modalData.sourceId,
                            modalData.dateStr,
                            modalData.projectedAmount,
                            modalData.concept,
                            installmentList
                          );
                          setIsModalOpen(false);
                          setModalData(null);
                          setIsAmortizeActive(false);
                        }
                      }}
                      className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>✨ Amortizar en {amortizeInstallmentsCount} cuotas (\${(Math.abs(modalData.projectedAmount) / amortizeInstallmentsCount).toFixed(2)} c/u)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setModalData(null);
                }}
                className="py-2 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmConciliacion}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/10 cursor-pointer transition-all"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE SIMULACIÓN / NOTIFICACIÓN DE POSPUESTO */}
      {selectedExplainRow && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 flex items-center gap-2 leading-tight">
                {selectedExplainRow.status === 'Pospuesto' || selectedExplainRow.autoPostponed ? (
                  <>
                    <span className="p-1 px-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-655 dark:text-amber-400 text-xs">🕒</span>
                    <span>Simulación: Gasto Diferido Recurrente</span>
                  </>
                ) : (
                  <>
                    <span className="p-1 px-1.5 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-655 dark:text-rose-400 text-xs">🚨</span>
                    <span>Alerta de Caja: Gasto No Posponible</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setSelectedExplainRow(null)}
                className="text-slate-450 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded-lg text-lg select-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl mb-4 border border-slate-100 dark:border-slate-800/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-slate-100/60 dark:border-slate-800/20 pb-2">
                <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold">Concepto</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={selectedExplainRow.concept}>
                  {selectedExplainRow.concept.replace(/\(Resguardo Colchón: Pospuesto.*\)/, '')}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100/60 dark:border-slate-800/20 pb-2">
                <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold">Monto Proyectado</span>
                <span className="text-xs font-mono font-black text-rose-600 dark:text-rose-450">
                  -${Math.abs(selectedExplainRow.projected_amount || selectedExplainRow.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100/60 dark:border-slate-800/20 pb-2">
                <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold">Fecha Original</span>
                <span className="text-xs font-mono font-bold text-slate-650 dark:text-slate-350">
                  {selectedExplainRow.original_date.split('-').reverse().join('/')}
                </span>
              </div>
              {selectedExplainRow.postponedTo && (
                <div className="flex items-center justify-between border-b border-slate-100/60 dark:border-slate-800/20 pb-2">
                  <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold">Diferido al Ingreso</span>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    {selectedExplainRow.postponedTo.split('-').reverse().join('/')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold">Configuración</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${selectedExplainRow.can_delay === 1 ? 'bg-amber-105 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-rose-105 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400'}`}>
                  {selectedExplainRow.can_delay === 1 ? 'Flexible / Posponible' : 'Inflexible / Obligatorio'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-3 mb-6">
              {selectedExplainRow.status === 'Pospuesto' || selectedExplainRow.autoPostponed ? (
                <>
                  <p>
                    <strong>¿Qué sucedió?</strong><br />
                    Para resguardar tu <strong>colchón mínimo de seguridad (${safetyMargin.toFixed(2)})</strong> y evitar saldos negativos en tu flujo de caja proyectado, este pago fue programado para realizarse coincidiendo con tu próximo ingreso del periodo salarial positivo.
                  </p>
                  <p>
                    <strong>¿Cómo funciona?</strong><br />
                    Al estar configurado como gasto <strong>Flexible</strong>, la simulación postergó el desembolso a la fecha <span className="text-blue-605 dark:text-blue-400 font-bold font-mono">{selectedExplainRow.postponedTo?.split('-').reverse().join('/')}</span> de manera automática. Su importe original se mantiene tachado/neutralizado en la fecha de vencimiento inicial.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>⚠️ Alerta de Ajuste de Liquidez:</strong><br />
                    Este compromiso vence el <span className="font-bold underline">{selectedExplainRow.original_date.split('-').reverse().join('/')}</span> pero causa un déficit crítico o reduce excesivamente tu margen de seguridad de colchón (Caja neta proyectada caería a ${selectedExplainRow.liquidity.toFixed(2)}).
                  </p>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/35 rounded-xl text-rose-700 dark:text-rose-350 text-[11px] leading-relaxed">
                    <strong>¿Por qué no se posterga?</strong><br />
                    Este gasto está preestablecido como <strong>gasto obligatorio (No Posponible)</strong> en tu configuración de perfil. El motor respeta esto y no lo desplaza de su fecha original de vencimiento.
                  </div>
                  <p className="mt-2 font-bold text-[11px] text-slate-800 dark:text-slate-200">
                    💡 Acción Recomendada (Ajuste en la distribución y reserva):
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <li>Reduce gastos variables de esa quincena para compensar la caja.</li>
                    <li>Utiliza el fondo de reserva acumulada para pre-fondear libremente el pasivo.</li>
                    <li>Si es posible reprogramarlo, cámbialo a "Flexible / Posponible" en el Gestor de Gastos y Pasivos.</li>
                  </ul>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedExplainRow(null)}
                className="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300 transition-colors text-xs text-center cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
