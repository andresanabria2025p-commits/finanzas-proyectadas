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
  ChevronUp
} from 'lucide-react';

interface CronogramaProps {
  ledgerData: LedgerRow[];
  incomes: Income[];
  expenses: Expense[];
  liabilities: Liability[];
  transactions: Transaction[];
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
    status: 'Realizado' | 'Omitido'
  ) => void;
  onDeleteRealizedStatus: (movementType: string, sourceId: number, dateStr: string) => void;
}

type SubTabType = 'pending_projected' | 'realized' | 'all';

export default function Cronograma({
  ledgerData,
  incomes,
  expenses,
  liabilities,
  transactions,
  onDeleteIncome,
  onStartEditIncome,
  onDeleteExpense,
  onStartEditExpense,
  onDeleteLiability,
  onStartEditLiability,
  onDeleteTransaction,
  onStartEditTransaction,
  onConfirmRealizedStatus,
  onDeleteRealizedStatus
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
    setIsModalOpen(true);
  };

  const handleConfirmConciliacion = () => {
    if (!modalData) return;
    const value = parseFloat(modalActualAmount);
    if (isNaN(value) || value < 0) {
      alert('Por favor ingrese un monto absoluto coherente.');
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
      'Realizado'
    );
    setIsModalOpen(false);
    setModalData(null);
  };

  const handleOmitirConciliacion = (row: LedgerRow) => {
    if (window.confirm('¿Estás seguro de que deseas omitir este movimiento proyectado en este ciclo? El dinero reservado se liberará.')) {
      onConfirmRealizedStatus(
        row.movement_type,
        row.source_id || 0,
        row.original_date,
        row.amount,
        0,
        'Omitido'
      );
    }
  };

  return (
    <div className="flex flex-col gap-6" id="cronograma-container">
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
                  } else if (row.status === 'Falta Liquidez') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/20 animate-pulse">Sin fondos</span>;
                    rowColor = 'bg-rose-50/30 dark:bg-rose-950/5';
                  } else if (row.status === 'Alerta de Ajuste') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/20">⚠ Alerta</span>;
                    rowColor = 'bg-amber-50/20 dark:bg-amber-950/5';
                  } else if (row.status === 'Pendiente') {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/20">Pendiente</span>;
                  } else {
                    statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-250 dark:border-slate-750">Proyectado</span>;
                  }

                  // Fila identificadora para scrolling suave
                  const rowIdAttr = `${row.movement_type}-${row.source_id}-${row.original_date}`;

                  return (
                    <tr
                      key={idx}
                      id={`ledger-row-${rowIdAttr}`}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-all ${rowColor}`}
                    >
                      <td className="p-4 font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {dateFormatted}
                      </td>
                      <td className="p-4">{categoryBadge}</td>
                      <td className="p-4 max-w-xs truncate font-medium text-slate-700 dark:text-slate-300">
                        {row.concept}
                      </td>
                      <td className={`p-4 text-right ${amountStyle}`}>
                        {row.status === 'Omitido' ? '$0.00' : `${amountPrefix}$${Math.abs(row.amount).toFixed(2)}`}
                      </td>
                      <td className="p-4 text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${row.liquidity.toFixed(2)}
                      </td>
                      <td className="p-4">{statusBadge}</td>
                      <td className="p-4 text-center">
                        {row.movement_type && row.movement_type !== 'initial' && row.movement_type !== 'final' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {row.status === 'Realizado' || row.status === 'Omitido' ? (
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
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-550 border border-emerald-600 hover:bg-emerald-600 text-white shadow-sm cursor-pointer"
                                >
                                  <Check size={10} />
                                  <span>Conciliar</span>
                                </button>
                                <button
                                  onClick={() => handleOmitirConciliacion(row)}
                                  title="Omitir/Descartar movimiento proyectado"
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                >
                                  <Ban size={10} className="hover:scale-110 duration-200" />
                                  <span>Descartar</span>
                                </button>
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
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-605 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">Ingreso</span>;
            } else if (row.type === 'Reserva Gasto') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30">Provisión</span>;
            } else if (row.type === 'Reserva Deuda') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20 font-semibold">Pre-Fondeo</span>;
            } else if (row.type === 'Liberación Reserva') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">Liberación</span>;
            } else if (row.type === 'Gasto Variable' || row.type === 'Consumo TDC') {
              categoryBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-608 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20">Variable</span>;
            }

            // Badge de Estatus de Liquidación y colores de tarjeta móvil
            let statusBadge = '';
            let cardMobileColor = 'bg-white dark:bg-slate-900';

            if (row.type === 'Balance Inicial' || row.type === 'Balance Final') {
              statusBadge = <span className="text-slate-400 font-medium">-</span>;
            } else if (row.status === 'Realizado') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-emerald-100 dark:bg-emerald-955/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">Realizado</span>;
              cardMobileColor = 'bg-emerald-50/5 dark:bg-emerald-955/5';
            } else if (row.status === 'Omitido') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">Omitido</span>;
              cardMobileColor = 'opacity-65 bg-slate-50 dark:bg-slate-900/40';
            } else if (row.status === 'Falta Liquidez') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-rose-100 dark:bg-rose-955/30 text-rose-700 dark:text-rose-455 border border-rose-200/50 dark:border-rose-800/20 animate-pulse font-main">Sin fondos</span>;
              cardMobileColor = 'border-rose-100 dark:border-rose-950 bg-rose-50/10 dark:bg-rose-950/5';
            } else if (row.status === 'Alerta de Ajuste') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-bold bg-amber-100 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-808/20">⚠ Alerta</span>;
              cardMobileColor = 'border-amber-100 dark:border-amber-950 bg-amber-50/10 dark:bg-amber-955/5';
            } else if (row.status === 'Pendiente') {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/20">Pendiente</span>;
            } else {
              statusBadge = <span className="px-2 py-0.5 text-[9px] rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-250 dark:border-slate-755">Proyectado</span>;
            }

            const rowIdAttr = `${row.movement_type}-${row.source_id}-${row.original_date}`;
            const isExpanded = expandedRow === rowIdAttr;

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
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate pr-1">
                      {row.concept}
                    </span>
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
                        {row.status === 'Realizado' || row.status === 'Omitido' ? (
                          <button
                            onClick={() => onDeleteRealizedStatus(row.movement_type, row.source_id || 0, row.original_date)}
                            className="w-full text-center py-2 text-xs font-bold rounded-xl border border-slate-205 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:text-slate-300 transition-colors cursor-pointer animate-none"
                          >
                            Reiniciar Conciliación
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOmitirConciliacion(row)}
                              title="Ignorar consumo"
                              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-404 hover:text-rose-600 dark:hover:text-rose-404 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-all cursor-pointer animate-none"
                            >
                              <Ban size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenConfirmModal(row)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl bg-emerald-550 hover:bg-emerald-600 text-white shadow-sm cursor-pointer animate-none"
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
    </div>
  );
}
