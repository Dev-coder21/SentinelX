import React, { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Building2,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { RiskBadge } from '@/components/common/RiskBadge'
import { PageHeader } from '@/components/common/PageHeader'
import type { Supplier } from '@/types/api'

export const SuppliersPage: React.FC = () => {
  const fetchSuppliers = useCallback(() => apiClient.getSuppliers({ limit: 100 }), [])
  const { data: suppliers, loading, error, errorStatus, refetch } = useApi(fetchSuppliers, [])

  const [search, setSearch] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedTier, setSelectedTier] = useState<string>('all')

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
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase()) ||
        s.country.toLowerCase().includes(search.toLowerCase())

      const matchRegion = selectedRegion === 'all' || s.region === selectedRegion
      const matchTier = selectedTier === 'all' || String(s.criticality_tier) === selectedTier

      return matchSearch && matchRegion && matchTier
    })
  }, [suppliers, search, selectedRegion, selectedTier])

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
              {suppliers.length} Active Nodes
            </span>
          ) : undefined
        }
      />

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-4">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by supplier name, category, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-[#1E2C48] rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50 focus:border-[#3DD6C4]"
          />
        </div>

        {/* Region filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            aria-label="Filter by geographic region"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs sm:text-sm text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Regions</option>
            {regions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          {/* Tier filter */}
          <select
            aria-label="Filter by criticality tier"
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="bg-[#0B1120] border border-[#1E2C48] rounded-lg text-xs sm:text-sm text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Tiers</option>
            <option value="1">Tier 1 (Critical)</option>
            <option value="2">Tier 2 (High)</option>
            <option value="3">Tier 3 (Moderate)</option>
          </select>
        </div>
      </div>

      {/* Supplier List / Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No suppliers match criteria"
          description="Try adjusting your search query, region, or tier filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearch('')
            setSelectedRegion('all')
            setSelectedTier('all')
          }}
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
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182338]">
                {filtered.map((s: Supplier) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[#152035]/60 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-medium text-slate-100">
                      <Link
                        to={`/suppliers/${s.id}`}
                        className="hover:text-[#3DD6C4] transition-colors flex items-center gap-2"
                      >
                        <Building2 className="w-4 h-4 text-slate-400 group-hover:text-[#3DD6C4] transition-colors" />
                        <span>{s.name}</span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-300 font-mono">
                      {s.category}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <span className="text-slate-200">{s.region}</span>
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
                      <Link
                        to={`/suppliers/${s.id}`}
                        className="inline-flex items-center space-x-1 text-xs text-[#3DD6C4] hover:text-[#5eead4] font-medium transition-colors"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
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
