/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LedgerRow } from '../types';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';

interface DashboardProps {
  ledgerData: LedgerRow[];
  safetyMargin: number;
}

export default function Dashboard({ ledgerData, safetyMargin }: DashboardProps) {
  // 1. Calcular métricas principales a partir de la secuencia de ledger
  let totalInflow = 0;
  let totalFixedOutflow = 0;
  let totalVariableOutflow = 0;
  let runningLiquidity = 0;
  let netFinalLiquidity = 0;

  // Analizar categorías de egresos
  let fixedExpensesSum = 0;
  let provisionExpensesSum = 0;
  let debtPaymentsSum = 0;
  let cardPurchasesSum = 0;
  let variableExpensesSum = 0;

  ledgerData.forEach(row => {
    if (row.status === 'Omitido') return;

    if (row.type === 'Ingreso') {
      totalInflow += row.amount;
    } else if (row.type === 'Gasto Fijo') {
      fixedExpensesSum += Math.abs(row.amount);
      totalFixedOutflow += Math.abs(row.amount);
    } else if (row.type === 'Reserva Gasto') {
      provisionExpensesSum += Math.abs(row.amount);
      totalFixedOutflow += Math.abs(row.amount);
    } else if (row.type === 'Reserva Deuda' || row.type === 'Pago Pasivo' || row.type === 'Pasivo') {
      debtPaymentsSum += Math.abs(row.amount);
      totalFixedOutflow += Math.abs(row.amount);
    } else if (row.type === 'Consumo TDC') {
      cardPurchasesSum += Math.abs(row.amount);
      totalVariableOutflow += Math.abs(row.amount);
    } else if (row.type === 'Gasto Variable') {
      variableExpensesSum += Math.abs(row.amount);
      totalVariableOutflow += Math.abs(row.amount);
    } else if (row.type === 'Balance Final') {
      netFinalLiquidity = row.liquidity;
    }
  });

  // 2. Mapear datos diarios para el gráfico de evolución de liquidez
  // Consolidar liquidez diaria última de cada fecha para simplificar la visualización
  const dailyMap: Record<string, { dateStr: string; label: string; liquidez: number }> = {};
  ledgerData.forEach(row => {
    const rawDate = row.date;
    const parts = rawDate.split('-');
    const formattedLabel = `${parts[2]}/${parts[1]}`; // DD/MM

    dailyMap[rawDate] = {
      dateStr: rawDate,
      label: formattedLabel,
      liquidez: row.liquidity
    };
  });

  const dailyChartData = Object.values(dailyMap).sort(
    (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
  );

  // 3. Preparar distribución de egresos para el gráfico de barras comparativo de rubros
  const budgetDistributionData = [
    { name: 'Gastos Fijos', monto: fixedExpensesSum, fill: '#3b82f6' },
    { name: 'Provisiones Sem.', monto: provisionExpensesSum, fill: '#a855f7' },
    { name: 'Pagos de Deudas', monto: debtPaymentsSum, fill: '#10b981' },
    { name: 'Compras TDC', monto: cardPurchasesSum, fill: '#06b6d4' },
    { name: 'Gastos Variables', monto: variableExpensesSum, fill: '#f59e0b' }
  ].filter(x => x.monto > 0);

  // Determinar riesgo en función del margen de seguridad
  const hasLiquidityRisk = ledgerData.some(r => r.status === 'Falta Liquidez');
  const hasMarginWarning = ledgerData.some(r => r.status === 'Alerta de Ajuste');

  let statusBadgeText = 'Finanzas Sostenibles';
  let statusBadgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30';
  let statusIcon = <TrendingUp size={16} />;

  if (hasLiquidityRisk) {
    statusBadgeText = 'Riesgo Crítico de Liquidez';
    statusBadgeColor = 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 animate-pulse';
    statusIcon = <Flame size={16} />;
  } else if (hasMarginWarning) {
    statusBadgeText = 'Caja por Debajo de Margen';
    statusBadgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30';
    statusIcon = <AlertTriangle size={16} />;
  }

  // Tooltip customizado para el gráfico de área
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-xl text-xs text-white backdrop-blur-md">
          <p className="font-semibold text-slate-300">Fecha: {data.dateStr.split('-').reverse().join('/')}</p>
          <p className="text-emerald-400 font-bold mt-1 text-sm">
            Liquidez: ${data.liquidez.toFixed(2)}
          </p>
          {data.liquidez < 0 ? (
            <span className="text-red-400 font-semibold block mt-1 text-[10px] uppercase">
              ⚠️ Alerta: Déficit de Caja
            </span>
          ) : data.liquidez < safetyMargin ? (
            <span className="text-amber-400 font-semibold block mt-1 text-[10px] uppercase">
              ⚠️ Ajuste: Bajo margen de seguridad
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold block mt-1 text-[10px] uppercase">
              ✓ Holgado
            </span>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6" id="dashboard-container">
      {/* Encabezado Principal de Salud Financiera */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
            Resumen de Proyección Financiera
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Simula las variaciones de caja día a día en base a ingresos, provisiones de gastos y deudas.
          </p>
        </div>
        
        <div className={`flex items-center gap-2 border px-4 py-2 rounded-xl text-xs font-semibold ${statusBadgeColor}`}>
          {statusIcon}
          <span>{statusBadgeText}</span>
        </div>
      </div>

      {/* Grid de Métricas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjeta de Ingresos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm border-l-4 border-l-emerald-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 text-emerald-500/5 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
            <TrendingUp size={84} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Ingresos del Ciclo
            </span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tracking-tight">
              ${totalInflow.toFixed(2)}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <ArrowUpRight size={14} />
            <span>Fijo + Adicionales</span>
          </div>
        </div>

        {/* Tarjeta de Gastos Fijos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm border-l-4 border-l-blue-500/80 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 text-blue-500/5 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
            <Layers size={84} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Gastos Fijos y Provisiones
            </span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tracking-tight">
              ${totalFixedOutflow.toFixed(2)}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
            <ArrowDownRight size={14} />
            <span>Sistemáticos y Cuotas</span>
          </div>
        </div>

        {/* Tarjeta de Gastos Variables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm border-l-4 border-l-amber-500/80 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 text-amber-500/5 group-hover:scale-110 transition-transform duration-300 pointer-events-none">
            <CreditCard size={84} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Gastos Diarios / TDC
            </span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tracking-tight">
              ${totalVariableOutflow.toFixed(2)}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
            <ArrowDownRight size={14} />
            <span>Consumos e Intermedios</span>
          </div>
        </div>

        {/* Tarjeta de Liquidez Neta Final */}
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden group border-l-4 ${netFinalLiquidity < 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
          <div className={`absolute top-1/2 -translate-y-1/2 right-4 group-hover:scale-110 transition-transform duration-300 pointer-events-none ${netFinalLiquidity < 0 ? 'text-rose-500/5' : 'text-emerald-500/5'}`}>
            <Sparkles size={84} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-404 dark:text-slate-550 uppercase tracking-wider block">
              Liquidez Neta Estimada
            </span>
            <h3 className={`text-2xl font-bold mt-2 tracking-tight ${netFinalLiquidity < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              ${netFinalLiquidity.toFixed(2)}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[11px] font-semibold text-slate-500">
            <span>Holgura vs Margen (${safetyMargin})</span>
          </div>
        </div>
      </div>

      {/* Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Evolución de Liquidez */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2 flex flex-col h-[380px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              📊 Curva de Flujo de Caja y Evolución de Liquidez Diaria
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identifica exactamente qué fecha del mes presentas picos de abundancia o baches financieros de caja.
            </p>
          </div>

          <div className="flex-1 w-full min-h-0 text-[10px]">
            {dailyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLiquidez" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.20} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="liquidez"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorLiquidez)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Crea ingresos y egresos sistemáticos para graficar el flujo
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Distribución del Gasto */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col h-[380px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              🏷️ Distribución del Presupuesto por Categoría
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Carga financiera neta de tus egresos.
            </p>
          </div>

          <div className="flex-1 w-full min-h-0 text-[10px]">
            {budgetDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={budgetDistributionData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" width={90} />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Costo']} />
                  <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                    {budgetDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Agrega gastos fijos, préstamos o transacciones para ver la distribución
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
