import React, { useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Building2,
  ChevronRight,
  Filter,
  Share2,
  X,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { RiskBadge } from '@/components/common/RiskBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { getRiskLevel } from '@/lib/risk'
import type { Supplier } from '@/types/api'

export const SuppliersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const initialRegion = searchParams.get('region') || 'all'
  const initialRisk = searchParams.get('risk') || 'all'
  const initialTier = searchParams.get('tier') || 'all'
  const initialSearch = searchParams.get('search') || ''

  const [search, setSearch] = useState(initialSearch)
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion)
  const [selectedRisk, setSelectedRisk] = useState<string>(initialRisk)
  const [selectedTier, setSelectedTier] = useState<string>(initialTier)

  const fetchSuppliers = useCallback(() => apiClient.getSuppliers({ limit: 100 }), [])
  const { data: suppliers, loading, error, errorStatus, refetch } = useApi(fetchSuppliers, [])

  // Update URL search parameters when filters change
  const updateFilter = (updates: {
    region?: string
    risk?: string
    tier?: string
    search?: string
  }) => {
    const nextParams = new URLSearchParams(searchParams)

    if (updates.region !== undefined) {
      if (updates.region === 'all') nextParams.delete('region')
      else nextParams.set('region', updates.region)
      setSelectedRegion(updates.region)
    }

    if (updates.risk !== undefined) {
      if (updates.risk === 'all') nextParams.delete('risk')
      else nextParams.set('risk', updates.risk)
      setSelectedRisk(updates.risk)
    }

    if (updates.tier !== undefined) {
      if (updates.tier === 'all') nextParams.delete('tier')
      else nextParams.set('tier', updates.tier)
      setSelectedTier(updates.tier)
    }

    if (updates.search !== undefined) {
      if (!updates.search.trim()) nextParams.delete('search')
      else nextParams.set('search', updates.search)
      setSearch(updates.search)
    }

    setSearchParams(nextParams, { replace: true })
  }

  // Extract unique regions for filter
  const regions = useMemo(() => {
    if (!suppliers) return []
    const set = new Set(suppliers.map((s) => s.region))
    return Array.from(set).sort()
  }, [suppliers])

  // Filtered suppliers
  const filtered = useMemo(() => {
    if (!suppliers) return []
    return suppliers.filter((s) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)

      const matchRegion = selectedRegion === 'all' || s.region === selectedRegion
      const matchTier = selectedTier === 'all' || String(s.criticality_tier) === selectedTier

      const resolvedRisk = (s.risk_level || getRiskLevel(s.current_risk_score)).toUpperCase()
      const matchRisk =
        selectedRisk === 'all' ||
        (selectedRisk === 'HIGH_CRITICAL'
          ? resolvedRisk === 'HIGH' || resolvedRisk === 'CRITICAL'
          : resolvedRisk === selectedRisk.toUpperCase())

      return matchSearch && matchRegion && matchTier && matchRisk
    })
  }, [suppliers, search, selectedRegion, selectedTier, selectedRisk])

  const hasActiveFilters =
    search !== '' || selectedRegion !== 'all' || selectedTier !== 'all' || selectedRisk !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setSelectedRegion('all')
    setSelectedTier('all')
    setSelectedRisk('all')
    setSearchParams({}, { replace: true })
  }

  if (loading && !suppliers) {
    return <LoadingState message="Loading supplier directory..." />
  }

  if (error && !suppliers) {
    return (
      <ErrorState
        title="Failed to Load Suppliers"
        message={error}
        status={errorStatus}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Directory"
        subtitle="Tier-1 and Tier-2 component suppliers with active vulnerability telemetry."
        badge={
          suppliers ? (
            <span className="text-xs font-mono bg-[#162036] text-[#3DD6C4] px-2.5 py-1 rounded-md border border-[#1E2C48]">
              {filtered.length} of {suppliers.length} Nodes
            </span>
          ) : undefined
        }
      />

      {/* Search and Filters Bar */}
      <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by supplier name, category, country, or region..."
              value={search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-[#1E2C48] rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50 focus:border-[#3DD6C4]"
            />
            {search && (
              <button
                type="button"
                onClick={() => updateFilter({ search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-mono">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters:</span>
            </div>

            {/* Region filter */}
            <select
              aria-label="Filter by geographic region"
              value={selectedRegion}
              onChange={(e) => updateFilter({ region: e.target.value })}
              className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
            >
              <option value="all">All Corridors</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>

            {/* Risk filter */}
            <select
              aria-label="Filter by risk severity bracket"
              value={selectedRisk}
              onChange={(e) => updateFilter({ risk: e.target.value })}
              className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50 font-mono"
            >
              <option value="all">All Risk Levels</option>
              <option value="CRITICAL">Critical (≥ 80.0)</option>
              <option value="HIGH">High (70.0–79.9)</option>
              <option value="MEDIUM">Medium (40.0–69.9)</option>
              <option value="LOW">Low (&lt; 40.0)</option>
            </select>

            {/* Tier filter */}
            <select
              aria-label="Filter by criticality tier"
              value={selectedTier}
              onChange={(e) => updateFilter({ tier: e.target.value })}
              className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
            >
              <option value="all">All Tiers</option>
              <option value="1">Tier 1 (Critical)</option>
              <option value="2">Tier 2 (High)</option>
              <option value="3">Tier 3 (Moderate)</option>
            </select>

            {/* Clear filters pill */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-mono text-slate-400 hover:text-rose-400 px-2.5 py-2 rounded-lg bg-[#0E1626] border border-[#1E2C48] transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Supplier List / Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No suppliers match filter criteria"
          description="Try adjusting your search query, corridor region, or risk severity filters."
          actionLabel="Clear Filters"
          onAction={clearAllFilters}
        />
      ) : (
        <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1E2C48] bg-[#0E1626] text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Supplier Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Corridor & Country</th>
                  <th className="py-3 px-4 font-semibold text-center">Criticality</th>
                  <th className="py-3 px-4 font-semibold text-right">Annual Spend</th>
                  <th className="py-3 px-4 font-semibold text-center">Risk Level</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182338]">
                {filtered.map((s: Supplier) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[#152035]/60 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-medium text-slate-100">
                      <Link
                        to={`/suppliers/${s.id}`}
                        className="hover:text-[#3DD6C4] transition-colors flex items-center gap-2"
                      >
                        <Building2 className="w-4 h-4 text-slate-400 group-hover:text-[#3DD6C4] transition-colors shrink-0" />
                        <span className="font-semibold">{s.name}</span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-300 font-mono">
                      <span className="bg-[#152036] px-2 py-0.5 rounded border border-[#1E2C48]">
                        {s.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <button
                        type="button"
                        onClick={() => updateFilter({ region: s.region })}
                        className="text-slate-300 hover:text-[#3DD6C4] underline underline-offset-2 transition-colors"
                        title={`Filter fleet to ${s.region}`}
                      >
                        {s.region}
                      </button>
                      <span className="text-slate-400 ml-1">({s.country})</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          s.criticality_tier === 1
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                            : s.criticality_tier === 2
                              ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        Tier {s.criticality_tier}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-300">
                      ${s.annual_spend.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <RiskBadge
                        score={s.current_risk_score}
                        level={s.risk_level}
                        size="sm"
                      />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-2">
                        <Link
                          to={`/network?select=${s.id}`}
                          className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-[#0E1626] hover:bg-[#1E2C48] border border-[#1E2C48] transition-colors"
                          title="Inspect node in dependency network"
                        >
                          <Share2 className="w-3 h-3 text-indigo-400" />
                          <span className="hidden lg:inline font-mono text-[11px]">Graph</span>
                        </Link>
                        <Link
                          to={`/suppliers/${s.id}`}
                          className="inline-flex items-center space-x-1 text-xs text-[#3DD6C4] hover:text-[#5eead4] font-medium px-2 py-1 rounded bg-[#16253B] hover:bg-[#1F3352] border border-[#2B436E] transition-colors"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
