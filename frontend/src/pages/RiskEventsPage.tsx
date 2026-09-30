import React, { useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Building2,
  X,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { RISK_COLORS, getRiskLevel } from '@/lib/risk'
import type { RiskEvent } from '@/types/api'

const PAGE_SIZE = 15

export const RiskEventsPage: React.FC = () => {
  useDocumentTitle('Risk Events Feed')
  const reducedMotion = usePrefersReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedRegion = searchParams.get('region') || 'all'
  const selectedSource = searchParams.get('source') || 'all'
  const selectedType = searchParams.get('type') || 'all'
  const selectedSeverity = (searchParams.get('severity') || 'all').toUpperCase()
  const search = searchParams.get('search') || ''
  const [page, setPage] = useState<number>(0)

  // Fetch up to 200 events from the backend (the maximum supported limit)
  const fetchEvents = useCallback(() => {
    return apiClient.getRiskEvents({
      region: selectedRegion === 'all' ? undefined : selectedRegion,
      source: selectedSource === 'all' ? undefined : selectedSource,
      limit: 200,
      offset: 0,
    })
  }, [selectedRegion, selectedSource])

  const { data: events, loading, error, errorStatus, refetch } = useApi(fetchEvents, [
    selectedRegion,
    selectedSource,
  ])

  // Extract distinct event types from active events
  const eventTypes = useMemo(() => {
    if (!events) return []
    const set = new Set<string>()
    for (const e of events) {
      if (e.event_type) set.add(e.event_type)
    }
    return Array.from(set).sort()
  }, [events])

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val === 'all' || !val) {
      next.delete(key)
    } else {
      next.set(key, val)
    }
    setPage(0)
    setSearchParams(next, { replace: true })
  }

  const handleRegionChange = (reg: string) => updateParam('region', reg)
  const handleSourceChange = (src: string) => updateParam('source', src)
  const handleTypeChange = (typ: string) => updateParam('type', typ)
  const handleSeverityChange = (sev: string) => updateParam('severity', sev)
  const handleSearchChange = (q: string) => updateParam('search', q)

  // Client-side multi-axis filtering
  const filteredEvents = useMemo(() => {
    if (!events) return []
    return events.filter((e) => {
      // Search matching
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        e.headline.toLowerCase().includes(q) ||
        (e.summary && e.summary.toLowerCase().includes(q)) ||
        e.event_type.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q)

      // Event type matching
      const matchType = selectedType === 'all' || e.event_type === selectedType

      // Severity matching
      let matchSeverity = true
      if (selectedSeverity !== 'all' && typeof e.severity === 'number') {
        const sevLevel = getRiskLevel(e.severity)
        if (selectedSeverity === 'CRITICAL') matchSeverity = sevLevel === 'CRITICAL'
        else if (selectedSeverity === 'HIGH') matchSeverity = sevLevel === 'HIGH' || sevLevel === 'CRITICAL'
        else if (selectedSeverity === 'MEDIUM') matchSeverity = sevLevel === 'MEDIUM'
        else if (selectedSeverity === 'LOW') matchSeverity = sevLevel === 'LOW'
      }

      return matchSearch && matchType && matchSeverity
    })
  }, [events, search, selectedType, selectedSeverity])

  // Pagination slice
  const paginatedEvents = useMemo(() => {
    const start = page * PAGE_SIZE
    return filteredEvents.slice(start, start + PAGE_SIZE)
  }, [filteredEvents, page])

  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE)

  const hasActiveFilters =
    search !== '' ||
    selectedRegion !== 'all' ||
    selectedSource !== 'all' ||
    selectedType !== 'all' ||
    selectedSeverity !== 'all'

  const clearAllFilters = () => {
    setPage(0)
    setSearchParams({}, { replace: true })
  }

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
        badge={
          events ? (
            <span className="text-xs font-mono bg-[#121F38] text-[#3DD6C4] px-2.5 py-1 rounded-md border border-[#1E2E4E]">
              {filteredEvents.length} of {events.length} Signals
            </span>
          ) : undefined
        }
        actions={
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#121D34] hover:bg-[#172644] text-slate-300 hover:text-white border border-[#1E2E4E] text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refetch Signals</span>
          </button>
        }
      />

      {/* Filter and Search Controls */}
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search headline, summary, region, or signal type..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#080E1C] border border-[#1E2E4E] rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#3DD6C4] focus:border-[#3DD6C4]"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters:</span>
            </div>

            {/* Region Filter */}
            <select
              aria-label="Filter events by corridor region"
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:border-[#3DD6C4]"
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
              onChange={(e) => handleSourceChange(e.target.value)}
              className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:border-[#3DD6C4]"
            >
              <option value="all">All Sources</option>
              <option value="GDELT">GDELT News</option>
              <option value="Open-Meteo">Open-Meteo Weather</option>
            </select>

            {/* Event Type Filter */}
            {eventTypes.length > 0 && (
              <select
                aria-label="Filter events by disruption type"
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:border-[#3DD6C4]"
              >
                <option value="all">All Event Types</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}

            {/* Severity Filter */}
            <select
              aria-label="Filter events by minimum severity"
              value={selectedSeverity}
              onChange={(e) => handleSeverityChange(e.target.value)}
              className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:border-[#3DD6C4] font-mono"
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">Critical (≥ 80.0)</option>
              <option value="HIGH">High (≥ 70.0)</option>
              <option value="MEDIUM">Medium (40.0–69.9)</option>
              <option value="LOW">Low (&lt; 40.0)</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-mono text-slate-400 hover:text-rose-400 px-2.5 py-2 rounded-md bg-[#080E1C] border border-[#1E2E4E] transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events List */}
      {events && events.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-6 h-6" />}
          title="No risk events recorded"
          description="The system has not ingested any geopolitical news or severe weather signals yet."
          actionLabel="Refetch Signals"
          onAction={refetch}
        />
      ) : paginatedEvents.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-6 h-6" />}
          title="No events matching criteria"
          description="Try broadening your corridor or source filters, or clearing search."
          actionLabel="Clear Filters"
          onAction={clearAllFilters}
        />
      ) : (
        <div className="space-y-3">
          {paginatedEvents.map((evt: RiskEvent) => {
            const isCritical = typeof evt.severity === 'number' && evt.severity >= 80
            const isHigh = typeof evt.severity === 'number' && evt.severity >= 70 && evt.severity < 80
            const borderAccent = isCritical ? 'border-rose-900/60' : isHigh ? 'border-orange-900/50' : 'border-[#1E2E4E]'

            return (
              <motion.div
                key={evt.id}
                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`bg-[#0D1628] border ${borderAccent} hover:border-[#283E66] rounded-lg p-5 transition-colors`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    {/* Badges / metadata */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono uppercase bg-[#121F38] text-slate-200 px-2 py-0.5 rounded border border-[#1E2E4E] font-semibold">
                        {evt.event_type.replace(/_/g, ' ')}
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
                      <span className="text-xs text-slate-400">
                        • Corridor:{' '}
                        <Link
                          to={`/suppliers?region=${encodeURIComponent(evt.region)}`}
                          className="text-slate-300 hover:text-[#3DD6C4] font-medium underline underline-offset-2"
                          title="Filter supplier directory to this corridor"
                        >
                          {evt.region}
                        </Link>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-[#080E1C] px-2 py-0.5 rounded border border-[#1E2E4E]">
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

                    {/* Actions & Links */}
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                      <Link
                        to={`/suppliers?region=${encodeURIComponent(evt.region)}`}
                        className="inline-flex items-center space-x-1 text-[#3DD6C4] hover:underline"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>View corridor suppliers</span>
                      </Link>

                      {evt.raw_url && (
                        <a
                          href={evt.raw_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-slate-400 hover:text-white"
                        >
                          <span>Original Provider Signal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Severity & Confidence */}
                  <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0 bg-[#080E1C] border border-[#1E2E4E] p-3 rounded-md min-w-[110px] text-right font-mono">
                    {typeof evt.severity === 'number' && (
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Severity</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: RISK_COLORS[getRiskLevel(evt.severity)] }}
                        >
                          {evt.severity.toFixed(1)}/100
                        </span>
                      </div>
                    )}

                    {typeof evt.confidence === 'number' && (
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Confidence</span>
                        <span className="text-xs text-slate-300">
                          {(evt.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#1E2E4E] text-xs font-mono text-slate-400">
              <div>
                Showing Page <strong className="text-slate-200">{page + 1}</strong> of{' '}
                <strong className="text-slate-200">{totalPages}</strong> ({filteredEvents.length} total events)
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 rounded-md bg-[#080E1C] border border-[#1E2E4E] hover:bg-[#121D34] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 text-slate-300"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-3 py-1 rounded-md bg-[#080E1C] border border-[#1E2E4E] hover:bg-[#121D34] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 text-slate-300"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
