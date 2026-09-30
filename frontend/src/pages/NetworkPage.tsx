import React, { useCallback, useMemo } from 'react'
import {
  Network as NetworkIcon,
  RefreshCw,
  Cpu,
  Layers,
  Link2,
  Info,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'

export const NetworkPage: React.FC = () => {
  const fetchNetwork = useCallback(() => apiClient.getNetwork(), [])
  const { data: network, loading, error, errorStatus, refetch } = useApi(fetchNetwork, [])

  // Partition nodes by supplier vs product hub
  const nodeStats = useMemo(() => {
    if (!network?.nodes) return { suppliers: 0, products: 0, highRisk: 0 }
    let suppliers = 0
    let products = 0
    let highRisk = 0

    network.nodes.forEach((n) => {
      if (n.type === 'product') {
        products++
      } else {
        suppliers++
        if (typeof n.current_risk_score === 'number' && n.current_risk_score >= 70) {
          highRisk++
        }
      }
    })

    return { suppliers, products, highRisk }
  }, [network])

  if (loading && !network) {
    return <LoadingState message="Mapping supply chain topological dependency graph..." />
  }

  if (error && !network) {
    return (
      <ErrorState
        title="Failed to Load Network Topology"
        message={error}
        status={errorStatus}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Dependency Network"
        subtitle="Directed topological relationships connecting global component vendors to finished product assembly lines."
        actions={
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#141E33] hover:bg-[#1E2C48] text-slate-300 hover:text-white border border-[#233352] text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Topology</span>
          </button>
        }
      />

      {/* Network Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Graph Nodes"
          value={network?.nodes.length ?? 0}
          icon={<NetworkIcon className="w-5 h-5" />}
          subtext="Suppliers + Product Hubs"
        />
        <StatCard
          label="Component Suppliers"
          value={nodeStats.suppliers}
          icon={<Cpu className="w-5 h-5 text-[#3DD6C4]" />}
          subtext="Tier-1 and Tier-2 manufacturers"
        />
        <StatCard
          label="Product Lines"
          value={nodeStats.products}
          icon={<Layers className="w-5 h-5 text-indigo-400" />}
          subtext="Flagship assembly sinks"
        />
        <StatCard
          label="Directed Dependencies"
          value={network?.edges.length ?? 0}
          icon={<Link2 className="w-5 h-5 text-slate-400" />}
          subtext="Weighted Bill of Materials links"
        />
      </div>

      {/* Network Canvas Container (Phase 8 Foundation, Phase 9 Interactive Target) */}
      <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl overflow-hidden p-6 min-h-[460px] flex flex-col justify-between relative">
        {/* Graph Info Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E2C48]/60">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3DD6C4]" />
            <h3 className="text-sm font-semibold text-white">Topology Canvas Viewport</h3>
            <span className="text-[10px] font-mono uppercase bg-[#18253E] text-slate-300 px-2 py-0.5 rounded border border-[#233352]">
              Real Data: {network?.nodes.length} Nodes / {network?.edges.length} Edges
            </span>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#6366F1]" /> Product Line Hub
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Low Risk Supplier
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Medium Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F43F5E]" /> High / Critical Risk
            </span>
          </div>
        </div>

        {/* Foundation Visualizer Grid / Node Directory */}
        <div className="py-8 my-auto">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#1A253E] border border-[#2B3E63] flex items-center justify-center mx-auto text-[#3DD6C4]">
              <NetworkIcon className="w-6 h-6 animate-pulse" />
            </div>
            <h4 className="text-base font-bold text-white">Graph Topology Loaded Successfully</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real 28-node multi-tier dependency dataset is connected to the backend.
              Phase 9 will introduce the full signature force-directed canvas with particle flow,
              node physics, and interactive blast-radius inspection.
            </p>
          </div>

          {/* Connected Product Lines Summary */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {network?.nodes
              .filter((n) => n.type === 'product')
              .map((prod) => {
                const incomingEdges = network.edges.filter((e) => e.target === prod.id)
                return (
                  <div
                    key={prod.id}
                    className="p-3.5 rounded-lg bg-[#0E1626] border border-[#1E2C48] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold">
                        Assembly Sink
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {incomingEdges.length} suppliers
                      </span>
                    </div>
                    <h5 className="text-sm font-semibold text-white">{prod.name}</h5>
                    <p className="text-[11px] text-slate-400">
                      Region: <span className="text-slate-300">{prod.region}</span>
                    </p>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Phase 9 Foundation Notice */}
        <div className="pt-4 border-t border-[#1E2C48]/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Connected endpoints: <code>GET /network</code> &amp; <code>GET /suppliers</code></span>
          </span>
          <span className="font-mono text-[11px]">Ready for Phase 9 Force-Directed Canvas</span>
        </div>
      </div>
    </div>
  )
}
