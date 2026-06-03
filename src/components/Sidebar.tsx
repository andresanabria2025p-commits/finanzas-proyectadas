/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Profile, LedgerRow, OptimizedSuggestion, TrashItem } from '../types';
import { AlertCircle, Trash2, HelpCircle, UserPlus, Trash, Sparkles, RotateCcw, Database, Download, Upload, Wallet } from 'lucide-react';

interface SidebarProps {
  profiles: Profile[];
  currentProfileId: number;
  onProfileChange: (id: number) => void;
  onAddProfile: () => void;
  onDeleteProfile: () => void;
  ledgerData: LedgerRow[];
  trashBin: TrashItem[];
  onEmptyTrash: () => void;
  onRestoreTrash: (item: TrashItem) => void;
  onScrollToRow: (movementType: string, sourceId: number, originalDate: string) => void;
  onExportAll: () => void;
  onExportProfile: () => void;
  onImportTrigger: (file: File) => void;
}

export default function Sidebar({
  profiles,
  currentProfileId,
  onProfileChange,
  onAddProfile,
  onDeleteProfile,
  ledgerData,
  trashBin,
  onEmptyTrash,
  onRestoreTrash,
  onScrollToRow,
  onExportAll,
  onExportProfile,
  onImportTrigger,
}: SidebarProps) {
  // Encontrar alertas de liquidez o de ajuste
  const alertItems = ledgerData.filter(
    row =>
      row.status === 'Falta Liquidez' ||
      row.status === 'Alerta de Ajuste' ||
      (row.concept.includes('[Atrasado') && row.status !== 'Realizado' && row.status !== 'Omitido')
  );

  // Generar sugerencias inteligentes analizando el flujo de caja retrospectivamente
  // Si encontramos un déficit en el día D, busca gastos variables anteriores susceptibles de recorte o aplazamiento
  const suggestions: OptimizedSuggestion[] = [];
  
  for (let i = 0; i < ledgerData.length; i++) {
    const row = ledgerData[i];
    if (row.status === 'Alerta de Ajuste' || row.status === 'Falta Liquidez') {
      const deficit = row.liquidity < 0 ? Math.abs(row.liquidity) : 0;
      
      if (deficit > 0) {
        // Buscar hacia atrás un gasto que el usuario pueda flexibilizar (reducir o posponer)
        for (let j = i - 1; j >= 0; j--) {
          const prevRow = ledgerData[j];
          // Gasto Variable, Consumo TDC o Gasto Fijo flexibilizable
          if (
            (prevRow.type === 'Gasto Variable' || prevRow.type === 'Consumo TDC' || prevRow.type === 'Gasto Fijo') &&
            prevRow.status !== 'Realizado' &&
            prevRow.status !== 'Omitido'
          ) {
            suggestions.push({
              target: row.concept.replace('Pago Tarjeta: ', '').split(' [')[0],
              targetDate: row.original_date,
              deficit: deficit,
              varExpense: prevRow.concept,
              varDate: prevRow.original_date,
              varAmount: Math.abs(prevRow.amount)
            });
            break; // Sugerir el cambio principal más reciente
          }
        }
      }
    }
  }

  // Filtrar sugerencias redundantes de forma segura
  const uniqueSuggestions: OptimizedSuggestion[] = [];
  const seenKeys = new Set<string>();
  suggestions.forEach(s => {
    const key = `${s.target}-${s.varExpense}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueSuggestions.push(s);
    }
  });

  return (
    <aside className="flex flex-col gap-6" id="sidebar-container">
      {/* Selector de Perfil */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            👤 Perfil de Presupuesto
          </h3>
          <div className="flex gap-1">
            <button
              onClick={onAddProfile}
              title="Añadir nuevo perfil"
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
            >
              <UserPlus size={16} />
            </button>
            {profiles.length > 1 && (
              <button
                onClick={onDeleteProfile}
                title="Eliminar este perfil"
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        </div>

        <select
          value={currentProfileId}
          onChange={e => onProfileChange(Number(e.target.value))}
          className="w-full text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
        >
          {profiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Métricas del Perfil */}
        {(() => {
          const todayStr = '2026-06-03';
          
          // 1. Neto disponible actual
          const pastOrTodayRows = ledgerData.filter(row => row.date <= todayStr && row.status !== 'Omitido');
          const netoDisponibleActual = pastOrTodayRows.length > 0 
            ? pastOrTodayRows[pastOrTodayRows.length - 1].liquidity 
            : (ledgerData.length > 0 ? ledgerData[0].liquidity : 0);

          // 2. Deudas hasta el próximo ingreso
          const futureIncomes = ledgerData.filter(row => row.date >= todayStr && row.type === 'Ingreso' && row.status !== 'Omitido');
          const nextIncomeDate = futureIncomes.length > 0 ? futureIncomes[0].date : '9999-12-31';

          const deudasHastaProximoIngreso = ledgerData.filter(row => 
            row.date >= todayStr && 
            row.date < nextIncomeDate && 
            row.status !== 'Omitido' &&
            ['Reserva Deuda', 'Pago Pasivo', 'Pasivo'].includes(row.type)
          ).reduce((sum, row) => sum + Math.abs(row.amount), 0);

          return (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
              <div className="bg-slate-50/50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                  <Wallet size={11} className="text-emerald-500" />
                  Neto Disponible Actual
                </div>
                <div className={`text-base font-extrabold font-mono tracking-tight ${netoDisponibleActual >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  ${netoDisponibleActual.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Deudas hasta próx. ingreso
                </div>
                <div className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                  ${deudasHastaProximoIngreso.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Respaldo y Restauración de Datos */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider mb-2.5">
          <Database size={14} className="text-emerald-500" /> Respaldo Manual
        </h3>
        <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-3 leading-normal">
          Exporta tu información para realizar copias de seguridad de tus perfiles u hojas de presupuesto.
        </p>

        <div className="space-y-2.5">
          {/* Botones de Exportar */}
          <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
            <button
              onClick={onExportProfile}
              className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer text-left"
              title="Exportar sólo los datos del perfil seleccionado a un archivo JSON"
            >
              <Download size={12} className="text-emerald-500 flex-shrink-0" />
              <span>Sólamente Perfil</span>
            </button>
            <button
              onClick={onExportAll}
              className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer text-left"
              title="Exportar todos los perfiles de presupuesto y transacciones globales"
            >
              <Download size={12} className="text-blue-500 flex-shrink-0" />
              <span>Todo el Sistema</span>
            </button>
          </div>

          {/* Input de Importación */}
          <div className="relative">
            <input
              type="file"
              id="import-backup-file-input"
              accept=".json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onImportTrigger(e.target.files[0]);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <label
              htmlFor="import-backup-file-input"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/10 dark:hover:bg-emerald-950/10 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer w-full text-center"
            >
              <Upload size={13} className="text-emerald-500" />
              <span>Importar Respaldo JSON</span>
            </label>
          </div>
        </div>
      </div>

      {/* Alertas y Notificaciones */}
      {alertItems.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2 mb-3">
            <AlertCircle size={18} /> Alertas de Caja ({alertItems.length})
          </h3>
          <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-3">
            {alertItems.map((item, idx) => {
              const dateParts = item.original_date.split('-');
              const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
              const isAlerta = item.status === 'Alerta de Ajuste';
              
              return (
                <div
                  key={idx}
                  onClick={() => onScrollToRow(item.movement_type, item.source_id || 0, item.original_date)}
                  className="p-3 bg-red-50/70 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl cursor-pointer hover:bg-red-100/70 dark:hover:bg-red-950/40 transition-all duration-200"
                >
                  <p className="text-slate-800 dark:text-slate-200 text-xs font-semibold">
                    ⚠️ {item.concept}
                  </p>
                  <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                    <span>Monto: <strong className="text-rose-600">-${Math.abs(item.amount).toFixed(2)}</strong></span>
                    <span>Prog: {dateFormatted}</span>
                  </div>
                  <span className="text-[10px] mt-1 block font-semibold uppercase text-rose-700 dark:text-rose-400">
                    {isAlerta ? 'Sugerencia de ajuste activa' : 'Liquidez insostenible'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sugerencias de Optimización */}
      {uniqueSuggestions.length > 0 && (
        <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl p-6 shadow-lg relative overflow-hidden">
          <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-3">
            <Sparkles size={18} /> Asistente de Optimización
          </h3>
          
          <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-3">
            {uniqueSuggestions.slice(0, 3).map((sug, idx) => {
              const targetParts = sug.targetDate.split('-');
              const targetDateFormatted = `${targetParts[2]}/${targetParts[1]}/${targetParts[0]}`;
              
              const varParts = sug.varDate.split('-');
              const varDateFormatted = `${varParts[2]}/${varParts[1]}/${varParts[0]}`;

              return (
                <div
                  key={idx}
                  onClick={() => onScrollToRow('expense', ledgerData.find(r => r.concept === sug.varExpense)?.source_id || 0, sug.varDate)}
                  className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Para subsanar el déficit del <strong className="text-emerald-400">{targetDateFormatted}</strong> en <strong className="text-white">{sug.target}</strong>, puedes modular o diferir el consumo de:
                  </p>
                  <div className="mt-2 text-[11px] bg-slate-950 p-2.5 rounded border border-slate-805">
                    <p className="font-semibold text-white">{sug.varExpense}</p>
                    <div className="flex justify-between mt-1 text-slate-400">
                      <span>Monto: ${sug.varAmount.toFixed(2)}</span>
                      <span>Fecha: {varDateFormatted}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Papelera de Reciclaje */}
      {trashBin.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Trash2 size={16} /> Papelera Recientes ({trashBin.length})
            </h3>
            <button
              onClick={onEmptyTrash}
              className="text-slate-405 hover:text-slate-600 text-xs font-semibold cursor-pointer"
            >
              Vaciar
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Se retienen por 5 días para mitigar deslices accidentales.</p>
          <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-2">
            {trashBin.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
              >
                <div className="truncate pr-2 max-w-[150px]">
                  <strong className="block truncate text-slate-800 dark:text-slate-200">{item.concept}</strong>
                  <span className="text-[10px] text-slate-400 font-mono font-medium">${Math.abs(item.amount).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => onRestoreTrash(item)}
                  title="Recuperar elemento"
                  className="p-1 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 transition-all pointer-events-auto cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Recuperar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
