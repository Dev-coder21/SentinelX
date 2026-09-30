import React, { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  RefreshCw,
  Activity,
  Layers,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { StatCard } from '@/components/common/StatCard'
import { RiskBadge } from '@/components/common/RiskBadge'
import { PageHeader } from '@/components/common/PageHeader'

const RISK_LEVEL_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#F43F5E',
}

export const DashboardPage: React.FC = () => {
  const fetchSummary = useCallback(() => apiClient.getDashboardSummary(), [])
  const { data, loading, error, errorStatus, refetch } = useApi(fetchSummary, [])

  if (loading && !data) {
    return <LoadingState message="Aggregating supply chain operational risk metrics..." />
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Failed to Load Dashboard Intelligence"
        message={error}
        status={errorStatus}
        onRetry={refetch}
      />
    )
  }

  const overview = data?.overview
  const riskDist = data?.risk_distribution || []
  const regionalRisk = data?.regional_risk || []
  const riskTrend = data?.risk_trend || []
  const eventDist = data?.event_distribution || []
  const recentEvents = data?.recent_events || []
  const latestOpt = data?.latest_optimization

  // Format historical trend dates for Recharts
  const formattedTrend = riskTrend.map((pt) => ({
    ...pt,
    formattedTime: new Date(pt.timestamp).toLocaleTimeString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Command Center Overview"
        subtitle="Real-time multi-tier supplier vulnerability, risk signals, and optimization posture."
        actions={
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#141E33] hover:bg-[#1E2C48] text-slate-300 hover:text-white border border-[#233352] text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Telemetry</span>
          </button>
        }
      />

      {/* Top Fleet KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Monitored Suppliers"
          value={overview?.total_suppliers ?? 0}
          icon={<Building2 className="w-5 h-5" />}
          subtext="Deterministic Tier-1 & Tier-2 Network"
        />
        <StatCard
          label="Fleet Average Risk"
          value={overview ? `${overview.average_risk.toFixed(1)}/100` : '—'}
          variant={
            (overview?.average_risk ?? 0) >= 70
              ? 'critical'
              : (overview?.average_risk ?? 0) >= 40
                ? 'warning'
                : 'success'
          }
          icon={<Activity className="w-5 h-5" />}
          subtext="Weighted external NLP & weather signals"
        />
        <StatCard
          label="High / Critical Risk Suppliers"
          value={overview?.high_risk_supplier_count ?? 0}
          variant={(overview?.high_risk_supplier_count ?? 0) > 0 ? 'critical' : 'success'}
          icon={<ShieldAlert className="w-5 h-5" />}
          subtext={`Score >= 70.0 (${overview?.medium_risk_supplier_count ?? 0} medium, ${overview?.low_risk_supplier_count ?? 0} low)`}
        />
        <StatCard
          label="Active 14-Day Risk Events"
          value={overview?.recent_event_count ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          subtext="GDELT news & Open-Meteo extreme weather"
        />
      </div>

      {/* Highest Risk Alert Banner & Latest Optimization Teaser */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Highest Risk Supplier Callout */}
        <div className="lg:col-span-2 bg-[#121A2E]/80 border border-[#1E2C48] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
                Highest Risk Node Alert
              </h3>
            </div>
            {overview?.highest_risk_supplier && (
              <RiskBadge score={overview.highest_risk_supplier.risk_score} />
            )}
          </div>

          {overview?.highest_risk_supplier ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xl font-bold text-white tracking-tight">
                  {overview.highest_risk_supplier.name}
                </h4>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span>Region: <strong className="text-slate-300">{overview.highest_risk_supplier.region}</strong></span>
                  <span>•</span>
                  <span>Criticality: <strong className="text-slate-300">Tier {overview.highest_risk_supplier.criticality_tier}</strong></span>
                  {overview.highest_risk_supplier.category && (
                    <>
                      <span>•</span>
                      <span>Category: <strong className="text-slate-300">{overview.highest_risk_supplier.category}</strong></span>
                    </>
                  )}
                </div>
              </div>
              <Link
                to={`/suppliers/${overview.highest_risk_supplier.id}`}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#1E2C48] hover:bg-[#25375A] text-[#3DD6C4] border border-[#3DD6C4]/30 text-xs font-medium transition-colors self-start sm:self-center"
              >
                <span>Inspect Node</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No high risk supplier detected in the active baseline.</p>
          )}
        </div>

        {/* Latest Optimization Summary Card */}
        <div className="bg-[#121A2E]/80 border border-[#1E2C48] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Latest LP Mitigation Plan
            </span>
          </div>

          {latestOpt ? (
            <div className="space-y-2 my-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Budget Allocated:</span>
                <span className="text-sm font-mono font-bold text-white">
                  ${latestOpt.total_budget_used.toLocaleString()} / ${latestOpt.budget.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Protected Value:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  ${latestOpt.expected_protected_revenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Suppliers Prioritized:</span>
                <span className="text-sm font-mono text-slate-300">
                  {latestOpt.selected_count} actions
                </span>
              </div>
              <Link
                to="/prioritization"
                className="inline-flex items-center justify-center w-full mt-3 px-3 py-1.5 rounded-lg bg-[#19243C] hover:bg-[#213050] text-[#3DD6C4] text-xs font-medium border border-[#2B3E63] transition-colors"
              >
                Open Optimizer Workspace
              </Link>
            </div>
          ) : (
            <div className="my-auto py-2">
              <p className="text-xs text-slate-400 mb-3">No mitigation plan computed yet.</p>
              <Link
                to="/prioritization"
                className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-lg bg-[#19243C] hover:bg-[#213050] text-[#3DD6C4] text-xs font-medium border border-[#2B3E63] transition-colors"
              >
                Run LP Optimization
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Charts Section: Historical Trend & Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historical Fleet Risk Trend */}
        <div className="lg:col-span-2 bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#3DD6C4]" />
                Fleet Risk Trajectory (Historical Snapshots)
              </h3>
              <p className="text-xs text-slate-400">Average risk score tracked across refresh intervals</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {formattedTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3DD6C4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3DD6C4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2C48" vertical={false} />
                  <XAxis
                    dataKey="formattedTime"
                    stroke="#64748B"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748B"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0E1626',
                      borderColor: '#1E2C48',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="average_risk"
                    name="Avg Fleet Risk"
                    stroke="#3DD6C4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#riskGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Single snapshot active. Historical trend accumulates with background refresh cycles.
              </div>
            )}
          </div>
        </div>

        {/* Risk Distribution Breakdown */}
        <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#8B7CFF]" />
                Risk Tier Distribution
              </h3>
              <p className="text-xs text-slate-400">Supplier count per risk severity bracket</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {riskDist.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDist} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2C48" horizontal={false} />
                  <XAxis type="number" stroke="#64748B" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="level"
                    type="category"
                    stroke="#94A3B8"
                    tick={{ fontSize: 11, fontWeight: 500 }}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0E1626',
                      borderColor: '#1E2C48',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Suppliers" radius={[0, 4, 4, 0]}>
                    {riskDist.map((entry) => (
                      <Cell
                        key={`cell-${entry.level}`}
                        fill={RISK_LEVEL_COLORS[entry.level] || '#64748B'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No risk distribution available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regional Risk Table & Event Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Regional Aggregation Table */}
        <div className="lg:col-span-2 bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Regional Risk Concentration</h3>
          <p className="text-xs text-slate-400 mb-4">
            Aggregated supplier exposure by primary operating corridor
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1E2C48] text-slate-400 uppercase font-mono tracking-wider">
                  <th className="pb-3 font-semibold">Corridor / Region</th>
                  <th className="pb-3 font-semibold text-center">Suppliers</th>
                  <th className="pb-3 font-semibold text-center">Average Risk</th>
                  <th className="pb-3 font-semibold text-center">Peak Risk</th>
                  <th className="pb-3 font-semibold text-right">High-Risk Nodes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182338]">
                {regionalRisk.map((r) => (
                  <tr key={r.region} className="hover:bg-[#152035]/50 transition-colors">
                    <td className="py-3 font-medium text-slate-200">{r.region}</td>
                    <td className="py-3 text-center font-mono text-slate-300">{r.supplier_count}</td>
                    <td className="py-3 text-center">
                      <span className="font-mono font-semibold text-slate-200">
                        {r.average_risk.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 text-center font-mono text-slate-400">{r.highest_risk.toFixed(1)}</td>
                    <td className="py-3 text-right">
                      {r.high_risk_supplier_count > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/60 text-rose-300 border border-rose-800/50">
                          {r.high_risk_supplier_count} critical
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Event Type Breakdown */}
        <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Signal Types (14 Days)</h3>
          <p className="text-xs text-slate-400 mb-4">Classified external disruption events</p>

          <div className="space-y-3">
            {eventDist.map((item) => (
              <div key={item.event_type} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 capitalize">{item.event_type.replace('_', ' ')}</span>
                  <span className="text-slate-400">
                    {item.count} ({item.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-[#1A253E] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#3DD6C4] h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Risk Events Feed */}
      <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Significant Risk Signals</h3>
            <p className="text-xs text-slate-400">Real-world intelligence feeds mapped to supply corridors</p>
          </div>
          <Link
            to="/risk-events"
            className="text-xs font-medium text-[#3DD6C4] hover:underline flex items-center gap-1"
          >
            <span>View All Signals</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-[#182338]">
          {recentEvents.length > 0 ? (
            recentEvents.slice(0, 5).map((evt) => (
              <div key={evt.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-[#18253E] text-slate-300 px-2 py-0.5 rounded border border-[#233352]">
                      {evt.event_type}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(evt.detected_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">• {evt.region}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {evt.source}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-200 line-clamp-1">{evt.headline}</h4>
                  {evt.affected_suppliers && evt.affected_suppliers.length > 0 && (
                    <p className="text-xs text-slate-400">
                      Corridor nodes: <span className="text-slate-300">{evt.affected_suppliers.slice(0, 3).join(', ')}{evt.affected_suppliers.length > 3 ? ` +${evt.affected_suppliers.length - 3} more` : ''}</span>
                    </p>
                  )}
                </div>

                {typeof evt.severity === 'number' && (
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-semibold text-amber-400">
                      Sev {evt.severity.toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-4">No risk events in the current monitoring window.</p>
          )}
        </div>
      </div>
    </div>
  )
}
