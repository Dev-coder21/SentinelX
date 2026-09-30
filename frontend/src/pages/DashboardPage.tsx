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
  CheckCircle2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { StatCard } from '@/components/common/StatCard'
import { RiskBadge } from '@/components/common/RiskBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { RISK_COLORS, getRiskLevel } from '@/lib/risk'
import { CHART_THEME } from '@/lib/tokens'
import type { RiskLevel } from '@/types/api'

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

  // Chronologically order historical trend points
  const sortedTrend = [...riskTrend].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const formattedTrend = sortedTrend.map((pt) => ({
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
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#0D1628] hover:bg-[#14233D] text-slate-300 hover:text-white border border-[#1E2E4E] hover:border-[#2D4573] text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh Telemetry</span>
          </button>
        }
      />

      {/* Top Fleet KPI Cards: 5-column responsive grid communicating total, fleet avg, high, medium, low */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link to="/suppliers" className="group">
          <StatCard
            label="Total Fleet"
            value={overview?.total_suppliers ?? 0}
            icon={<Building2 className="w-4 h-4 group-hover:text-[#3DD6C4] transition-colors" />}
            subtext="Tier-1 & Tier-2 Network"
            className="group-hover:border-[#2A4370] transition-all h-full"
          />
        </Link>
        <div>
          <StatCard
            label="Fleet Avg Risk"
            value={overview ? `${overview.average_risk.toFixed(1)}/100` : '—'}
            variant={
              (overview?.average_risk ?? 0) >= 70
                ? 'critical'
                : (overview?.average_risk ?? 0) >= 40
                  ? 'warning'
                  : 'success'
            }
            icon={<Activity className="w-4 h-4" />}
            subtext="Fused NLP & Weather"
            className="h-full"
          />
        </div>
        <Link to="/suppliers?risk=HIGH" className="group">
          <StatCard
            label="High / Critical"
            value={overview?.high_risk_supplier_count ?? 0}
            variant={(overview?.high_risk_supplier_count ?? 0) > 0 ? 'critical' : 'success'}
            icon={<ShieldAlert className="w-4 h-4 group-hover:text-rose-400 transition-colors" />}
            subtext="Score ≥ 70.0 (Filter)"
            className="group-hover:border-rose-800/80 transition-all h-full"
          />
        </Link>
        <Link to="/suppliers?risk=MEDIUM" className="group">
          <StatCard
            label="Medium Risk"
            value={overview?.medium_risk_supplier_count ?? 0}
            variant="warning"
            icon={<AlertTriangle className="w-4 h-4 group-hover:text-amber-400 transition-colors" />}
            subtext="Score 40.0–69.9 (Filter)"
            className="group-hover:border-amber-800/80 transition-all h-full"
          />
        </Link>
        <Link to="/suppliers?risk=LOW" className="group">
          <StatCard
            label="Low Risk"
            value={overview?.low_risk_supplier_count ?? 0}
            variant="success"
            icon={<CheckCircle2 className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />}
            subtext="Score < 40.0 (Filter)"
            className="group-hover:border-emerald-800/80 transition-all h-full"
          />
        </Link>
      </div>

      {/* Highest Risk Alert Banner & Latest Optimization Teaser */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Highest Risk Supplier Callout */}
        <div className="lg:col-span-2 bg-[#0D1628] border border-rose-900/50 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
                Highest Risk Node Alert
              </h2>
            </div>
            {overview?.highest_risk_supplier && (
              <RiskBadge score={overview.highest_risk_supplier.risk_score} />
            )}
          </div>

          {overview?.highest_risk_supplier ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {overview.highest_risk_supplier.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono">
                  <span>
                    Corridor:{' '}
                    <Link
                      to={`/suppliers?region=${encodeURIComponent(overview.highest_risk_supplier.region)}`}
                      className="text-slate-300 hover:text-[#3DD6C4] underline underline-offset-2"
                    >
                      {overview.highest_risk_supplier.region}
                    </Link>
                  </span>
                  <span>•</span>
                  <span>
                    Criticality: <strong className="text-slate-200">Tier {overview.highest_risk_supplier.criticality_tier}</strong>
                  </span>
                  {overview.highest_risk_supplier.category && (
                    <>
                      <span>•</span>
                      <span>
                        Category: <strong className="text-slate-200">{overview.highest_risk_supplier.category}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <Link
                  to={`/network?select=${overview.highest_risk_supplier.id}`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#121D34] hover:bg-[#182644] text-slate-300 hover:text-white border border-[#1E2E4E] text-xs font-mono transition-colors"
                >
                  <span>Network</span>
                </Link>
                <Link
                  to={`/suppliers/${overview.highest_risk_supplier.id}`}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-[#142540] hover:bg-[#1C3357] text-[#3DD6C4] border border-[#3DD6C4]/30 text-xs font-medium transition-colors"
                >
                  <span>Investigate Node</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No high risk supplier detected in the active baseline.</p>
          )}
        </div>

        {/* Latest Optimization Summary Card */}
        <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5 flex flex-col justify-between">
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
                className="inline-flex items-center justify-center w-full mt-3 px-3 py-1.5 rounded-md bg-[#121D34] hover:bg-[#182644] text-[#3DD6C4] text-xs font-medium border border-[#233B62] transition-colors"
              >
                Open Optimizer Workspace
              </Link>
            </div>
          ) : (
            <div className="my-auto py-2">
              <p className="text-xs text-slate-400 mb-3">No mitigation plan computed yet.</p>
              <Link
                to="/prioritization"
                className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-md bg-[#121D34] hover:bg-[#182644] text-[#3DD6C4] text-xs font-medium border border-[#233B62] transition-colors"
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
        <div className="lg:col-span-2 bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#3DD6C4]" />
                Fleet Risk Trajectory & High-Risk Counts
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Chronological audit trail of fleet average risk and high-risk supplier count</p>
            </div>
            {formattedTrend.length > 0 && (
              <span className="text-[11px] font-mono text-slate-400 bg-[#0A1120] px-2 py-0.5 rounded border border-[#1E2E4E]">
                {formattedTrend.length} observation{formattedTrend.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            {formattedTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedTrend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_THEME.avgRisk} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_THEME.avgRisk} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                  <XAxis
                    dataKey="formattedTime"
                    stroke={CHART_THEME.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    stroke={CHART_THEME.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 'auto']}
                    stroke={CHART_THEME.highRisk}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_THEME.tooltip}
                    formatter={(value: any, name: any) => {
                      if (name === 'Avg Fleet Risk') return [`${Number(value).toFixed(1)} / 100`, name]
                      return [`${value} suppliers`, name]
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="average_risk"
                    name="Avg Fleet Risk"
                    stroke={CHART_THEME.avgRisk}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#riskGrad)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="high_risk_count"
                    name="High-Risk Suppliers"
                    stroke={CHART_THEME.highRisk}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ fill: CHART_THEME.highRisk, r: 3 }}
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
        <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#8B7CFF]" />
                Risk Tier Distribution
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                {overview?.total_suppliers ?? 0} Total
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Supplier volume and percentage per risk severity</p>

            <div className="h-44 w-full">
              {riskDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskDist} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                    <XAxis type="number" stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="level"
                      type="category"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      width={65}
                    />
                    <Tooltip
                      contentStyle={CHART_THEME.tooltip}
                      formatter={(_val: any, _name: any, item: any) => {
                        const payload = item?.payload
                        if (!payload) return [_val, _name]
                        return [`${payload.count} suppliers (${payload.percentage.toFixed(1)}%)`, payload.level]
                      }}
                    />
                    <Bar dataKey="count" name="Suppliers" radius={[0, 4, 4, 0]}>
                      {riskDist.map((entry) => (
                        <Cell
                          key={`cell-${entry.level}`}
                          fill={RISK_COLORS[entry.level as RiskLevel] || '#64748B'}
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

          {/* Interactive Tier Filter Links */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1E2E4E] mt-2">
            {riskDist.map((item) => (
              <Link
                key={item.level}
                to={`/suppliers?risk=${item.level}`}
                className="flex items-center justify-between p-2 rounded-md bg-[#0A1120] hover:bg-[#121E36] border border-[#1E2E4E] hover:border-[#2A4370] transition-colors text-xs font-mono group"
              >
                <div className="flex items-center space-x-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: RISK_COLORS[item.level as RiskLevel] || '#64748B' }}
                  />
                  <span className="text-slate-300 group-hover:text-white font-medium">{item.level}</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-bold">{item.count}</span>
                  <span className="text-slate-500 text-[10px] ml-1">({item.percentage.toFixed(0)}%)</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Regional Risk Table & Event Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Regional Aggregation Table */}
        <div className="lg:col-span-2 bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-white">Regional Risk Concentration</h2>
            <span className="text-xs text-slate-400 font-mono">Click region to filter directory</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Aggregated supplier exposure by primary operating corridor
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1E2E4E] bg-[#0A1120] text-slate-400 uppercase font-mono tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Corridor / Region</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Suppliers</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Average Risk</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Peak Risk</th>
                  <th className="py-2.5 px-3 font-semibold text-center">High-Risk Nodes</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#16233B]">
                {regionalRisk.map((r) => (
                  <tr key={r.region} className="hover:bg-[#121E36] transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-200">
                      <Link
                        to={`/suppliers?region=${encodeURIComponent(r.region)}`}
                        className="hover:text-[#3DD6C4] inline-flex items-center gap-1 font-medium transition-colors"
                      >
                        <span>{r.region}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-500 hover:text-[#3DD6C4]" />
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{r.supplier_count}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className="font-mono font-semibold px-2 py-0.5 rounded text-xs"
                        style={{
                          color: RISK_COLORS[getRiskLevel(r.average_risk)],
                          backgroundColor: `${RISK_COLORS[getRiskLevel(r.average_risk)]}15`,
                        }}
                      >
                        {r.average_risk.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{r.highest_risk.toFixed(1)}</td>
                    <td className="py-3 px-3 text-center">
                      {r.high_risk_supplier_count > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/60 text-rose-300 border border-rose-800/50">
                          {r.high_risk_supplier_count} critical
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/suppliers?region=${encodeURIComponent(r.region)}`}
                        className="text-xs font-mono text-[#3DD6C4] hover:underline"
                      >
                        View {r.supplier_count} Nodes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Event Type Breakdown */}
        <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-white">Signal Types (14 Days)</h2>
            <span className="text-xs font-mono text-slate-400">{overview?.recent_event_count ?? 0} Total</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Classified external disruption events</p>

          <div className="space-y-3">
            {eventDist.map((item) => (
              <div key={item.event_type} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 capitalize">{item.event_type.replace(/_/g, ' ')}</span>
                  <span className="text-slate-400">
                    {item.count} ({item.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-[#121D34] h-1.5 rounded-full overflow-hidden">
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
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Significant Risk Signals</h2>
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

        <div className="divide-y divide-[#16233B]">
          {recentEvents.length > 0 ? (
            recentEvents.slice(0, 5).map((evt) => (
              <div key={evt.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-[#121F38] text-slate-200 px-2 py-0.5 rounded border border-[#1E2E4E] font-semibold">
                      {evt.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(evt.detected_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      • Corridor:{' '}
                      <Link
                        to={`/risk-events?region=${encodeURIComponent(evt.region)}`}
                        className="text-slate-300 hover:text-[#3DD6C4] underline underline-offset-2"
                      >
                        {evt.region}
                      </Link>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-[#0A1120] px-1.5 py-0.5 rounded border border-[#16233B]">
                      {evt.source}
                    </span>
                  </div>

                  <h3 className="text-sm font-medium text-slate-200 line-clamp-1">
                    {evt.headline}
                  </h3>

                  {evt.affected_suppliers && evt.affected_suppliers.length > 0 && (
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px]">Corridor nodes:</span>
                      {evt.affected_suppliers.slice(0, 3).map((suppName) => (
                        <Link
                          key={suppName}
                          to={`/suppliers?search=${encodeURIComponent(suppName)}`}
                          className="text-[#3DD6C4] hover:underline bg-[#0A1120] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#1E2E4E]"
                        >
                          {suppName}
                        </Link>
                      ))}
                      {evt.affected_suppliers.length > 3 && (
                        <span className="text-slate-500 text-[11px] font-mono">
                          +{evt.affected_suppliers.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-1.5 shrink-0 bg-[#0A1120] border border-[#1E2E4E] px-3 py-2 rounded-md text-right font-mono min-w-[100px]">
                  {typeof evt.severity === 'number' && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Severity</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: RISK_COLORS[getRiskLevel(evt.severity)] }}
                      >
                        {evt.severity.toFixed(1)}/100
                      </span>
                    </div>
                  )}
                  {typeof evt.confidence === 'number' && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Confidence</span>
                      <span className="text-[11px] text-slate-300">
                        {(evt.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
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
