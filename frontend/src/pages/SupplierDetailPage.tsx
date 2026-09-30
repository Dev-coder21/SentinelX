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

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/suppliers"
        className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Supplier Directory</span>
      </Link>

      {/* Header Profile Card */}
      <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#3DD6C4]" />
                {supplier.name}
              </h1>
              <RiskBadge
                score={supplier.current_risk_score}
                level={supplier.risk_level}
                size="md"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-300">{supplier.region}</strong> ({supplier.country})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Category: <strong className="text-slate-300">{supplier.category}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Annual Spend: <strong className="text-slate-300 font-mono">${supplier.annual_spend.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Criticality & Trend Stats */}
          <div className="flex items-center gap-4 bg-[#0E1626] border border-[#1E2C48] rounded-lg p-3 shrink-0">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Criticality</span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded inline-block mt-0.5 ${
                  supplier.criticality_tier === 1
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                    : 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                }`}
              >
                Tier {supplier.criticality_tier}
              </span>
            </div>

            <div className="border-l border-[#1E2C48] pl-4">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Risk Trend</span>
              <div className="mt-0.5">{renderTrendIcon()}</div>
            </div>

            {typeof supplier.previous_risk_score === 'number' && (
              <div className="border-l border-[#1E2C48] pl-4">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Previous</span>
                <span className="text-xs font-mono text-slate-300 mt-0.5 block">
                  {supplier.previous_risk_score.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Historical Trajectory & Contributing Risk Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Score History Chart */}
        <div className="lg:col-span-2 bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#3DD6C4]" />
                Risk Score Trajectory
              </h3>
              <p className="text-xs text-slate-400">Audit trail of fused risk scores over time</p>
            </div>
            {historyData.length > 0 && (
              <span className="text-xs font-mono text-slate-400">
                {historyData.length} observation{historyData.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

        {/* Contributing Factors Breakdown */}
        <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Contributing Factors</h3>
          <p className="text-xs text-slate-400 mb-4">Explainable risk signal attribution</p>

          {supplier.contributing_factors && Object.keys(supplier.contributing_factors).length > 0 ? (
            <div className="space-y-3 font-mono text-xs">
              {Object.entries(supplier.contributing_factors).map(([key, value]) => (
                <div key={key} className="bg-[#0E1626] border border-[#1E2C48] p-3 rounded-lg">
                  <div className="flex justify-between text-slate-400 uppercase text-[10px] tracking-wider mb-1">
                    <span>{key.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-slate-200 font-semibold">
                    {typeof value === 'object' && value !== null
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Deterministic baseline evaluation active (no anomalous event spikes).
            </p>
          )}
        </div>
      </div>

      {/* Downstream Dependencies & Affected Product Lines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Line Dependencies */}
        <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-400" />
            Downstream Product Dependencies ({supplier.dependencies?.length || 0})
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Finished product lines that depend on this supplier component
          </p>

          {supplier.dependencies && supplier.dependencies.length > 0 ? (
            <div className="space-y-2.5">
              {supplier.dependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#0E1626] border border-[#1E2C48]"
                >
                  <div className="font-medium text-slate-200 text-xs">
                    {dep.company_product}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Impact Weight: <strong className="text-indigo-400">{dep.dependency_weight.toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No registered downstream product links.</p>
          )}
        </div>

        {/* Related Regional Risk Events */}
        <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Active Regional Events ({supplier.related_risk_events?.length || 0})
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Signals detected within {supplier.region} corridor
          </p>

          {supplier.related_risk_events && supplier.related_risk_events.length > 0 ? (
            <div className="space-y-3">
              {supplier.related_risk_events.slice(0, 5).map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg bg-[#0E1626] border border-[#1E2C48] space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 uppercase bg-slate-800 px-1.5 py-0.5 rounded">
                      {evt.event_type}
                    </span>
                    <span className="text-slate-400">
                      {new Date(evt.detected_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xs font-medium text-slate-200 line-clamp-1">{evt.headline}</h4>
                  {typeof evt.severity === 'number' && (
                    <span className="text-[10px] font-mono text-amber-400 block">
                      Severity: {evt.severity.toFixed(0)}/100
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No active external events in this region.</p>
          )}
        </div>
      </div>
    </div>
  )
}
