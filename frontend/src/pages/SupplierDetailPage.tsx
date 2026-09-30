import React, { useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Link2,
  Activity,
  Layers,
  MapPin,
  DollarSign,
  Share2,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  CloudRain,
  Newspaper,
  Compass,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { RiskBadge } from '@/components/common/RiskBadge'
import { RISK_COLORS, getRiskLevel } from '@/lib/risk'
import { CHART_THEME } from '@/lib/tokens'
import type { ContributingFactors, TopEventDetail } from '@/types/api'

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const fetchDetail = useCallback(() => {
    if (!id) return Promise.reject(new Error('Missing supplier ID'))
    return apiClient.getSupplierDetail(id)
  }, [id])

  const { data: supplier, loading, error, errorStatus, refetch } = useApi(fetchDetail, [id])

  if (loading && !supplier) {
    return <LoadingState message="Fetching supplier telemetry and historical audit..." />
  }

  if (error || !supplier) {
    return (
      <div className="space-y-4">
        <Link
          to="/suppliers"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Suppliers</span>
        </Link>
        <ErrorState
          title={errorStatus === 404 ? 'Supplier Not Found' : 'Failed to Load Supplier'}
          message={
            errorStatus === 404
              ? `No supplier exists with ID "${id}". It may have been removed or the link is invalid.`
              : error || 'Unable to retrieve supplier details.'
          }
          status={errorStatus}
          onRetry={refetch}
        />
      </div>
    )
  }

  // Format historical scores for Recharts
  const historyData = [...(supplier.risk_history || [])]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((item) => ({
      timestamp: item.timestamp,
      formattedTime: new Date(item.timestamp).toLocaleTimeString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      score: item.risk_score,
    }))

  const renderTrendIcon = () => {
    if (supplier.risk_trend === 'increasing') {
      return (
        <span className="flex items-center text-rose-400 text-xs font-mono font-semibold">
          <TrendingUp className="w-3.5 h-3.5 mr-1" /> Increasing
        </span>
      )
    }
    if (supplier.risk_trend === 'decreasing') {
      return (
        <span className="flex items-center text-emerald-400 text-xs font-mono font-semibold">
          <TrendingDown className="w-3.5 h-3.5 mr-1" /> Decreasing
        </span>
      )
    }
    return (
      <span className="flex items-center text-slate-400 text-xs font-mono font-semibold">
        <Minus className="w-3.5 h-3.5 mr-1" /> Stable
      </span>
    )
  }

  const factors: ContributingFactors = supplier.contributing_factors || {}
  const rawRisk = typeof factors.raw_risk === 'number' ? factors.raw_risk : null
  const finalScore = typeof factors.final_score === 'number' ? factors.final_score : supplier.current_risk_score
  const multiplier = typeof factors.criticality_multiplier === 'number' ? factors.criticality_multiplier : 1.0
  const newsRisk = typeof factors.news_risk === 'number' ? factors.news_risk : 0.0
  const weatherRisk = typeof factors.weather_risk === 'number' ? factors.weather_risk : 0.0
  const eventCount = typeof factors.event_count === 'number' ? factors.event_count : (supplier.related_risk_events?.length || 0)
  const eventTypes: string[] = Array.isArray(factors.event_types) ? factors.event_types : []
  const topEvents: TopEventDetail[] = Array.isArray(factors.top_events) ? factors.top_events : []

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/suppliers"
          className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Supplier Directory</span>
        </Link>

        {/* Cross-page operational shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/network?select=${supplier.id}`}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#0D1628] hover:bg-[#14233D] text-slate-300 hover:text-white border border-[#1E2E4E] text-xs font-mono transition-colors"
            title="Inspect supplier and blast-radius in dependency network"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Inspect in Network</span>
          </Link>
          <Link
            to="/prioritization"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#0D1628] hover:bg-[#14233D] text-slate-300 hover:text-white border border-[#1E2E4E] text-xs font-mono transition-colors"
            title="Optimize mitigation allocations"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#3DD6C4]" />
            <span>LP Optimizer</span>
          </Link>
          <Link
            to={`/risk-events?region=${encodeURIComponent(supplier.region)}`}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#0D1628] hover:bg-[#14233D] text-slate-300 hover:text-white border border-[#1E2E4E] text-xs font-mono transition-colors"
            title="View signals in this corridor"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Corridor Events</span>
          </Link>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 font-sans">
                <Building2 className="w-5 h-5 text-[#3DD6C4]" />
                {supplier.name}
              </h1>
              <RiskBadge
                score={supplier.current_risk_score}
                level={supplier.risk_level}
                size="md"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <Link
                  to={`/suppliers?region=${encodeURIComponent(supplier.region)}`}
                  className="text-slate-300 hover:text-[#3DD6C4] underline underline-offset-2"
                >
                  {supplier.region}
                </Link>{' '}
                ({supplier.country})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Category: <strong className="text-slate-300 font-sans">{supplier.category}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                Annual Spend:{' '}
                <strong className="text-slate-200 font-mono">
                  ${supplier.annual_spend.toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          {/* Criticality & Trend Stats */}
          <div className="flex items-center gap-3 bg-[#080E1C] border border-[#1E2E4E] rounded-md p-2.5 shrink-0">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Criticality</span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded inline-block mt-0.5 ${
                  supplier.criticality_tier === 1
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                    : supplier.criticality_tier === 2
                      ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                Tier {supplier.criticality_tier}
              </span>
            </div>

            <div className="border-l border-[#1E2E4E] pl-3">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Risk Trend</span>
              <div className="mt-0.5">{renderTrendIcon()}</div>
            </div>

            {typeof supplier.previous_risk_score === 'number' && (
              <div className="border-l border-[#1E2E4E] pl-3">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Previous</span>
                <span className="text-xs font-mono text-slate-300 mt-0.5 block">
                  {supplier.previous_risk_score.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mathematical Explainability: Contributing Risk Factors */}
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2E4E] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3DD6C4]" />
              Explainable Risk Attribution & Mathematical Decomposition
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic fusion formula: Raw time-decayed corridor signals amplified by supplier criticality tier
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-[#080E1C] px-2.5 py-1 rounded border border-[#1E2E4E] self-start sm:self-auto">
            {eventCount} Correlated Signal{eventCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* 1. Mathematical Derivation Hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Raw Risk */}
          <div className="bg-[#080E1C] border border-[#1E2E4E] rounded-md p-3 text-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Raw Signal Exposure
            </span>
            <span className="text-xl font-bold font-mono text-slate-200">
              {rawRisk !== null ? rawRisk.toFixed(1) : '—'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">Sublinear saturation</span>
          </div>

          {/* Multiplication Operator */}
          <div className="text-center text-slate-500 font-mono text-base font-bold hidden md:block">
            ×
          </div>

          {/* Criticality Multiplier */}
          <div className="bg-[#080E1C] border border-[#1E2E4E] rounded-md p-3 text-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Tier {supplier.criticality_tier} Multiplier
            </span>
            <span className="text-xl font-bold font-mono text-indigo-400">
              {multiplier.toFixed(1)}×
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
              {supplier.criticality_tier === 1 ? 'Primary Component' : supplier.criticality_tier === 2 ? 'Secondary Component' : 'Commodity'}
            </span>
          </div>

          {/* Equal Operator */}
          <div className="text-center text-slate-500 font-mono text-base font-bold hidden md:block">
            =
          </div>

          {/* Final Fused Score */}
          <div className="bg-[#080E1C] border border-[#1E2E4E] rounded-md p-3 text-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Fused Supplier Risk
            </span>
            <span
              className="text-2xl font-bold font-mono"
              style={{ color: RISK_COLORS[getRiskLevel(finalScore)] }}
            >
              {typeof finalScore === 'number' ? finalScore.toFixed(1) : '0.0'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
              / 100 ({getRiskLevel(finalScore)})
            </span>
          </div>
        </div>

        {/* 2. Sub-factor breakdown: News vs Weather & Event Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* News and Weather Contributions */}
          <div className="bg-[#080E1C] border border-[#1E2E4E] rounded-md p-3.5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Signal Source Attribution
            </h3>

            {/* News Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5 text-blue-400" />
                  GDELT Geopolitical / News Signals
                </span>
                <span className="text-slate-200 font-bold">{newsRisk.toFixed(1)} / 100</span>
              </div>
              <div className="w-full bg-[#121F38] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, newsRisk)}%` }}
                />
              </div>
            </div>

            {/* Weather Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-teal-400" />
                  Open-Meteo Severe Weather / Climate
                </span>
                <span className="text-slate-200 font-bold">{weatherRisk.toFixed(1)} / 100</span>
              </div>
              <div className="w-full bg-[#121F38] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-teal-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, weatherRisk)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Classified Disruption Categories */}
          <div className="bg-[#080E1C] border border-[#1E2E4E] rounded-md p-3.5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Detected Disruption Types ({eventTypes.length})
            </h3>
            {eventTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {eventTypes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-[#121F38] text-slate-200 border border-[#1E2E4E]"
                  >
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 pt-1 font-mono">
                No active external disruptions classified in this corridor.
              </p>
            )}
          </div>
        </div>

        {/* 3. Top Contributing External Risk Events */}
        {topEvents.length > 0 && (
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Top Contributing Real-World Risk Signals
            </h3>
            <div className="overflow-x-auto border border-[#1E2E4E] rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2E4E] bg-[#0A1120] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-2 px-3 font-semibold">Signal Headline</th>
                    <th className="py-2 px-3 font-semibold">Type</th>
                    <th className="py-2 px-3 font-semibold">Source</th>
                    <th className="py-2 px-3 font-semibold text-center">Severity</th>
                    <th className="py-2 px-3 font-semibold text-right">Detected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#16233B]">
                  {topEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-[#121E36] transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-200">
                        <Link
                          to={`/risk-events?search=${encodeURIComponent(evt.headline.slice(0, 30))}`}
                          className="hover:text-[#3DD6C4] inline-flex items-center gap-1 text-xs"
                          title="Inspect signal in investigation feed"
                        >
                          <span className="line-clamp-1">{evt.headline}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                        </Link>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300 capitalize text-[11px]">
                        {evt.event_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">{evt.source}</td>
                      <td className="py-2 px-3 text-center font-mono">
                        {typeof evt.severity === 'number' ? (
                          <span
                            className="font-bold"
                            style={{ color: RISK_COLORS[getRiskLevel(evt.severity)] }}
                          >
                            {evt.severity.toFixed(0)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400 text-[11px]">
                        {evt.detected_at
                          ? new Date(evt.detected_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Historical Trajectory & Product Line Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Score History Chart */}
        <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#3DD6C4]" />
                Risk Score Trajectory
              </h2>
              <p className="text-xs text-slate-400">Audit trail of fused risk scores across pipeline runs</p>
            </div>
            {historyData.length > 0 && (
              <span className="text-xs font-mono text-slate-400 bg-[#080E1C] px-2 py-0.5 rounded border border-[#1E2E4E]">
                {historyData.length} snapshot{historyData.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                  <XAxis
                    dataKey="formattedTime"
                    stroke={CHART_THEME.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={CHART_THEME.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: CHART_THEME.tooltip.backgroundColor,
                      borderColor: CHART_THEME.tooltip.borderColor,
                      borderRadius: CHART_THEME.tooltip.borderRadius,
                      fontSize: CHART_THEME.tooltip.fontSize,
                      color: CHART_THEME.tooltip.color,
                    }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)} / 100`, 'Risk Score']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Risk Score"
                    stroke="#3DD6C4"
                    strokeWidth={2.5}
                    dot={{ fill: '#3DD6C4', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Initial evaluation active. Additional points will accumulate with pipeline refreshes.
              </div>
            )}
          </div>
        </div>

        {/* Product Line Dependencies */}
        <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-400" />
              Connected Product Lines ({supplier.dependencies?.length || 0})
            </h2>
            <Link
              to={`/network?select=${supplier.id}`}
              className="text-xs font-mono text-[#3DD6C4] hover:underline"
            >
              Inspect in Graph →
            </Link>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Finished product lines dependent on this supplier component
          </p>

          {supplier.dependencies && supplier.dependencies.length > 0 ? (
            <div className="space-y-2.5">
              {supplier.dependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between p-3 rounded-md bg-[#080E1C] border border-[#1E2E4E]"
                >
                  <div>
                    <div className="font-medium text-slate-200 text-xs">
                      {dep.company_product}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Downstream manufacturing line
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-300 bg-[#121F38] px-2 py-1 rounded border border-[#1E2E4E]">
                    Weight: <strong className="text-indigo-400">{dep.dependency_weight.toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No registered downstream product links.</p>
          )}
        </div>
      </div>

      {/* Corridor External Risk Events Feed */}
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Corridor External Risk Signals ({supplier.related_risk_events?.length || 0})
            </h2>
            <p className="text-xs text-slate-400">
              Active external events detected within the {supplier.region} corridor
            </p>
          </div>
          <Link
            to={`/risk-events?region=${encodeURIComponent(supplier.region)}`}
            className="text-xs font-mono text-[#3DD6C4] hover:underline"
          >
            All Corridor Signals →
          </Link>
        </div>

        {supplier.related_risk_events && supplier.related_risk_events.length > 0 ? (
          <div className="space-y-3">
            {supplier.related_risk_events.slice(0, 6).map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-md bg-[#080E1C] border border-[#1E2E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="text-slate-300 uppercase bg-[#121F38] px-1.5 py-0.5 rounded border border-[#1E2E4E]">
                      {evt.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400">
                      {new Date(evt.detected_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-slate-400">• Source: {evt.source}</span>
                  </div>
                  <h3 className="text-xs font-medium text-slate-200 line-clamp-1">
                    {evt.headline}
                  </h3>
                </div>

                {typeof evt.severity === 'number' && (
                  <div className="text-right shrink-0">
                    <span
                      className="text-xs font-mono font-bold"
                      style={{ color: RISK_COLORS[getRiskLevel(evt.severity)] }}
                    >
                      Sev {evt.severity.toFixed(0)}/100
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No active external events in this region.</p>
        )}
      </div>
    </div>
  )
}
