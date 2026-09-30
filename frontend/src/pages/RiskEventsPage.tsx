import React, { useState, useMemo, useCallback } from 'react'
import {
  AlertTriangle,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import type { RiskEvent } from '@/types/api'

const PAGE_SIZE = 15

export const RiskEventsPage: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(0)

  const fetchEvents = useCallback(() => {
    return apiClient.getRiskEvents({
      region: selectedRegion === 'all' ? undefined : selectedRegion,
      source: selectedSource === 'all' ? undefined : selectedSource,
      limit: 100, // Fetch up to 100 to allow client-side search & pagination
      offset: 0,
    })
  }, [selectedRegion, selectedSource])

  const { data: events, loading, error, errorStatus, refetch } = useApi(fetchEvents, [
    selectedRegion,
    selectedSource,
  ])

  // Client-side search filtering
  const filteredEvents = useMemo(() => {
    if (!events) return []
    if (!search.trim()) return events
    const q = search.toLowerCase()
    return events.filter(
      (e) =>
        e.headline.toLowerCase().includes(q) ||
        (e.summary && e.summary.toLowerCase().includes(q)) ||
        e.event_type.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q)
    )
  }, [events, search])

  // Pagination slice
  const paginatedEvents = useMemo(() => {
    const start = page * PAGE_SIZE
    return filteredEvents.slice(start, start + PAGE_SIZE)
  }, [filteredEvents, page])

  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE)

  if (loading && !events) {
    return <LoadingState message="Fetching live geopolitical, news, and weather signals..." />
  }

  if (error && !events) {
    return (
      <ErrorState
        title="Failed to Load Risk Signals"
        message={error}
        status={errorStatus}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Events Feed"
        subtitle="External real-world signals normalized from GDELT global news and Open-Meteo severe weather."
        actions={
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#141E33] hover:bg-[#1E2C48] text-slate-300 hover:text-white border border-[#233352] text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refetch Signals</span>
          </button>
        }
      />

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search headline, summary, or signal type..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-[#1E2C48] rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50 focus:border-[#3DD6C4]"
          />
        </div>

        {/* Region Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            aria-label="Filter events by corridor region"
            value={selectedRegion}
            onChange={(e) => {
              setSelectedRegion(e.target.value)
              setPage(0)
            }}
            className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs sm:text-sm text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Corridors</option>
            <option value="East Asia">East Asia</option>
            <option value="Southeast Asia">Southeast Asia</option>
            <option value="North America">North America</option>
            <option value="Europe">Europe</option>
          </select>

          {/* Source Filter */}
          <select
            aria-label="Filter events by intelligence source"
            value={selectedSource}
            onChange={(e) => {
              setSelectedSource(e.target.value)
              setPage(0)
            }}
            className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs sm:text-sm text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Sources</option>
            <option value="GDELT">GDELT News</option>
            <option value="Open-Meteo">Open-Meteo Weather</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      {paginatedEvents.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-6 h-6" />}
          title="No events matching criteria"
          description="Try broadening your corridor or source filters, or clearing search."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearch('')
            setSelectedRegion('all')
            setSelectedSource('all')
            setPage(0)
          }}
        />
      ) : (
        <div className="space-y-3">
          {paginatedEvents.map((evt: RiskEvent) => (
            <div
              key={evt.id}
              className="bg-[#111A2E]/80 border border-[#1E2C48] hover:border-[#2C3E63] rounded-xl p-5 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  {/* Badges / metadata */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-[#18253E] text-slate-200 px-2 py-0.5 rounded border border-[#233352] font-semibold">
                      {evt.event_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {new Date(evt.detected_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-slate-400">• Corridor: <strong className="text-slate-300">{evt.region}</strong></span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                      {evt.source}
                    </span>
                  </div>

                  {/* Headline & Summary */}
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {evt.headline}
                  </h3>

                  {evt.summary && (
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {evt.summary}
                    </p>
                  )}

                  {/* Raw URL if available */}
                  {evt.raw_url && (
                    <a
                      href={evt.raw_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-xs text-[#3DD6C4] hover:underline pt-1"
                    >
                      <span>Original Provider Signal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Severity & Confidence */}
                <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0 bg-[#0E1626] border border-[#1E2C48] p-3 rounded-lg min-w-[110px] text-right font-mono">
                  {typeof evt.severity === 'number' && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Severity</span>
                      <span
                        className={`text-sm font-bold ${
                          evt.severity >= 70
                            ? 'text-rose-400'
                            : evt.severity >= 40
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }`}
                      >
                        {evt.severity.toFixed(1)}/100
                      </span>
                    </div>
                  )}

                  {typeof evt.confidence === 'number' && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Confidence</span>
                      <span className="text-xs text-slate-300">
                        {(evt.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#1E2C48] text-xs font-mono text-slate-400">
              <span>
                Page {page + 1} of {totalPages} ({filteredEvents.length} signals)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-md bg-[#111A2E] border border-[#1E2C48] hover:bg-[#1A253E] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="p-1.5 rounded-md bg-[#111A2E] border border-[#1E2C48] hover:bg-[#1A253E] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
