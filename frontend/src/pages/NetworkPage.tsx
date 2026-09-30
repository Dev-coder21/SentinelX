import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Network as NetworkIcon,
  RefreshCw,
  Layers,
  Link2,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Target,
  X,
  ArrowRight,
  ShieldAlert,
  Building2,
  HelpCircle,
} from 'lucide-react'
import { ForceGraph2D } from 'react-force-graph'
import { motion, AnimatePresence } from 'framer-motion'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { RiskBadge } from '@/components/common/RiskBadge'
import type { NetworkNode, RiskLevel } from '@/types/api'

// Extended Graph Node for d3 layout
interface GraphNode extends NetworkNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
  index?: number
}

// Extended Graph Link for d3 layout (source/target can be string or resolved node object)
interface GraphLink {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  dependency_weight: number
  company_product: string
}

// Deterministic Risk Color Palette (Restrained Operational)
const RISK_PALETTE = {
  CRITICAL: '#BE123C', // Deep crimson / rose-700
  HIGH: '#DC2626',     // Warning red / red-600
  MEDIUM: '#D97706',   // Caution amber / amber-600
  LOW: '#059669',      // Stable emerald / emerald-600
  PRODUCT: '#4F46E5',  // Indigo / indigo-600
}

function getNodeRiskLevel(score: number | null | undefined): RiskLevel {
  if (typeof score !== 'number') return 'LOW'
  if (score >= 80.0) return 'CRITICAL'
  if (score >= 70.0) return 'HIGH'
  if (score >= 40.0) return 'MEDIUM'
  return 'LOW'
}

function getNodeColor(node: GraphNode): string {
  if (node.type === 'product') {
    return RISK_PALETTE.PRODUCT
  }
  const level = getNodeRiskLevel(node.current_risk_score)
  return RISK_PALETTE[level]
}

function getNodeRadius(node: GraphNode): number {
  if (node.type === 'product') {
    return 11
  }
  switch (node.criticality_tier) {
    case 1:
      return 8.5
    case 2:
      return 7.0
    default:
      return 5.5
  }
}

export const NetworkPage: React.FC = () => {
  const fetchNetwork = useCallback(() => apiClient.getNetwork(), [])
  const { data: network, loading, error, errorStatus, refetch } = useApi(fetchNetwork, [])

  // Graph Canvas & Dimensions
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  })

  // Interaction State
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // Filters State
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [showHubs, setShowHubs] = useState<boolean>(true)
  const [showLegend, setShowLegend] = useState<boolean>(true)

  // Motion preference detection
  const reducedMotion = usePrefersReducedMotion()

  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setDimensions({
          width: clientWidth || 800,
          height: Math.max(540, clientHeight || 600),
        })
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Extracted unique regions for filter
  const availableRegions = useMemo(() => {
    if (!network?.nodes) return []
    const regions = new Set<string>()
    network.nodes.forEach((n) => {
      if (n.region && n.region !== 'Global') regions.add(n.region)
    })
    return Array.from(regions).sort()
  }, [network])

  // Top-level network metrics
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

  // Filtered graph dataset
  const filteredData = useMemo(() => {
    if (!network?.nodes || !network?.edges) {
      return { nodes: [], links: [] }
    }

    // 1. Filter Nodes
    const filteredNodes: GraphNode[] = network.nodes.filter((node) => {
      if (node.type === 'product') {
        return showHubs
      }

      // Supplier filters
      if (riskFilter !== 'all') {
        const level = getNodeRiskLevel(node.current_risk_score)
        if (level !== riskFilter) return false
      }

      if (regionFilter !== 'all' && node.region !== regionFilter) {
        return false
      }

      if (tierFilter !== 'all' && String(node.criticality_tier) !== tierFilter) {
        return false
      }

      return true
    })

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id))

    // 2. Filter Edges (only where both source and target are visible)
    const filteredLinks: GraphLink[] = network.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        dependency_weight: edge.dependency_weight,
        company_product: edge.company_product,
      }))

    return {
      nodes: filteredNodes.map((n) => ({ ...n } as GraphNode)),
      links: filteredLinks,
    }
  }, [network, riskFilter, regionFilter, tierFilter, showHubs])

  // Adjacency map for O(1) hover & highlight resolution
  const { neighborMap, edgeMap } = useMemo(() => {
    const neighborMap = new Map<string, Set<string>>()
    const edgeMap = new Map<string, Set<string>>()

    filteredData.links.forEach((link) => {
      const sourceId =
        typeof link.source === 'object' && link.source !== null ? (link.source as any).id : link.source
      const targetId =
        typeof link.target === 'object' && link.target !== null ? (link.target as any).id : link.target

      if (!neighborMap.has(sourceId)) neighborMap.set(sourceId, new Set())
      if (!neighborMap.has(targetId)) neighborMap.set(targetId, new Set())
      neighborMap.get(sourceId)!.add(targetId)
      neighborMap.get(targetId)!.add(sourceId)

      if (!edgeMap.has(sourceId)) edgeMap.set(sourceId, new Set())
      if (!edgeMap.has(targetId)) edgeMap.set(targetId, new Set())
      edgeMap.get(sourceId)!.add(link.id)
      edgeMap.get(targetId)!.add(link.id)
    })

    return { neighborMap, edgeMap }
  }, [filteredData])

  // Active focus node (hover takes precedence over selected)
  const focusNode = hoverNode || selectedNode

  const highlightNodes = useMemo(() => {
    const set = new Set<string>()
    if (focusNode) {
      set.add(focusNode.id)
      const neighbors = neighborMap.get(focusNode.id)
      if (neighbors) {
        neighbors.forEach((nid) => set.add(nid))
      }
    }
    return set
  }, [focusNode, neighborMap])

  const highlightEdges = useMemo(() => {
    const set = new Set<string>()
    if (focusNode) {
      const edges = edgeMap.get(focusNode.id)
      if (edges) {
        edges.forEach((eid) => set.add(eid))
      }
    }
    return set
  }, [focusNode, edgeMap])

  // Connected details for selected node
  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode || !network) return null

    if (selectedNode.type === 'product') {
      // Find all incoming suppliers to this product line
      const incomingEdges = network.edges.filter((e) => e.target === selectedNode.id)
      const supplierIds = new Set(incomingEdges.map((e) => e.source))
      const connectedSuppliers = network.nodes.filter((n) => supplierIds.has(n.id))
      return {
        type: 'product' as const,
        suppliers: connectedSuppliers,
        edges: incomingEdges,
      }
    } else {
      // Find all product lines this supplier feeds
      const outgoingEdges = network.edges.filter((e) => e.source === selectedNode.id)
      return {
        type: 'supplier' as const,
        productLines: outgoingEdges,
      }
    }
  }, [selectedNode, network])

  // Graph Camera Controls
  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.35, 400)
    }
  }

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.35, 400)
    }
  }

  const handleZoomToFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, 45)
    }
  }

  const handleCenterSelected = () => {
    if (fgRef.current && selectedNode && typeof selectedNode.x === 'number' && typeof selectedNode.y === 'number') {
      fgRef.current.centerAt(selectedNode.x, selectedNode.y, 500)
      fgRef.current.zoom(2.2, 500)
    }
  }

  // Preselected node from URL parameter (e.g. from Prioritization page)
  const [searchParams] = useSearchParams()
  const preselectId = searchParams.get('select')

  // Initial auto-fit or auto-focus preselected node after data load
  useEffect(() => {
    if (filteredData.nodes.length > 0 && fgRef.current) {
      if (preselectId) {
        const found = filteredData.nodes.find((n) => n.id === preselectId)
        if (found) {
          const timer = setTimeout(() => {
            setSelectedNode(found)
            if (typeof found.x === 'number' && typeof found.y === 'number') {
              fgRef.current?.centerAt(found.x, found.y, 500)
              fgRef.current?.zoom(2.2, 500)
            } else {
              fgRef.current?.zoomToFit(600, 40)
            }
          }, 350)
          return () => clearTimeout(timer)
        }
      }
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(600, 40)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [filteredData.nodes, preselectId])

  // Custom Canvas Rendering for Nodes
  const renderNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { x, y } = node
      if (typeof x !== 'number' || typeof y !== 'number') return

      const isFocused = focusNode ? highlightNodes.has(node.id) : true
      const isSelected = selectedNode?.id === node.id
      const isHovered = hoverNode?.id === node.id
      const isDimmed = Boolean(focusNode && !isFocused)

      const baseColor = getNodeColor(node)
      const radius = getNodeRadius(node)

      // 1. Draw PRODUCT HUB Nodes (Distinct Square / Octagon geometry)
      if (node.type === 'product') {
        const size = radius * 2
        ctx.save()
        ctx.beginPath()

        // Rounded rect for product line assembly hub
        const rx = x - size / 2
        const ry = y - size / 2
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(rx, ry, size, size, 4)
        } else {
          ctx.rect(rx, ry, size, size)
        }

        ctx.fillStyle = isDimmed ? 'rgba(79, 70, 229, 0.2)' : baseColor
        ctx.fill()

        ctx.lineWidth = isSelected || isHovered ? 3 : 2
        ctx.strokeStyle = isSelected
          ? '#3DD6C4'
          : isDimmed
            ? 'rgba(129, 140, 248, 0.25)'
            : '#818CF8'
        ctx.stroke()

        // Inner hub glyph
        ctx.fillStyle = isDimmed ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF'
        ctx.font = `${Math.max(8, 10 / Math.sqrt(globalScale))}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('HUB', x, y)

        // Permanent clean label for Product Lines
        const labelText = node.name
        const fontSize = Math.max(10, 11 / Math.sqrt(globalScale))
        ctx.font = `600 ${fontSize}px sans-serif`
        const textWidth = ctx.measureText(labelText).width
        const bPadding = 3

        ctx.fillStyle = isDimmed ? 'rgba(11, 17, 32, 0.6)' : 'rgba(11, 17, 32, 0.85)'
        ctx.fillRect(
          x - textWidth / 2 - bPadding,
          y + radius + 3,
          textWidth + bPadding * 2,
          fontSize + bPadding * 1.5
        )

        ctx.fillStyle = isDimmed ? 'rgba(148, 163, 184, 0.4)' : '#E2E8F0'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(labelText, x, y + radius + 4)

        ctx.restore()
        return
      }

      // 2. Draw SUPPLIER Nodes
      ctx.save()

      // Subtle active risk ring for High (>=70) and Critical (>=80) nodes
      const riskScore = node.current_risk_score ?? 0
      if (riskScore >= 70 && !isDimmed) {
        ctx.beginPath()
        if (reducedMotion) {
          // Static subtle warning border
          ctx.arc(x, y, radius + 3, 0, 2 * Math.PI)
          ctx.strokeStyle = riskScore >= 80 ? 'rgba(190, 18, 60, 0.6)' : 'rgba(220, 38, 38, 0.5)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else {
          // Subtle purposeful pulse
          const pulse = (Math.sin(Date.now() / 450) + 1) / 2
          const pulseR = radius + 2 + pulse * 3.5
          ctx.arc(x, y, pulseR, 0, 2 * Math.PI)
          ctx.strokeStyle =
            riskScore >= 80
              ? `rgba(190, 18, 60, ${0.7 - pulse * 0.45})`
              : `rgba(220, 38, 38, ${0.6 - pulse * 0.4})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Main circular body
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = isDimmed ? 'rgba(30, 41, 59, 0.4)' : baseColor
      ctx.fill()

      // Stroke border
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 1.5
      ctx.strokeStyle = isSelected
        ? '#3DD6C4'
        : isHovered
          ? '#FFFFFF'
          : isDimmed
            ? 'rgba(71, 85, 105, 0.2)'
            : 'rgba(241, 245, 249, 0.35)'
      ctx.stroke()

      // Tier 1 inner indicator dot
      if (node.criticality_tier === 1 && !isDimmed) {
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
      }

      // Contextual Label (render on hover, selection, or when zoomed in)
      if (isHovered || isSelected || globalScale > 1.6) {
        const label = node.name
        const fontSize = Math.max(9, 10 / Math.sqrt(globalScale))
        ctx.font = `500 ${fontSize}px sans-serif`
        const textWidth = ctx.measureText(label).width
        const pad = 3

        ctx.fillStyle = 'rgba(11, 17, 32, 0.9)'
        ctx.fillRect(
          x - textWidth / 2 - pad,
          y + radius + 2,
          textWidth + pad * 2,
          fontSize + pad * 1.5
        )

        ctx.fillStyle = isSelected ? '#3DD6C4' : '#F8FAFC'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(label, x, y + radius + 3)
      }

      ctx.restore()
    },
    [focusNode, highlightNodes, selectedNode, hoverNode, reducedMotion]
  )

  // Custom Pointer Paint Area for Hit Testing
  const renderPointerArea = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    const { x, y } = node
    if (typeof x !== 'number' || typeof y !== 'number') return
    const radius = getNodeRadius(node) + 4
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

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
      {/* Header */}
      <PageHeader
        title="Supplier Dependency Network"
        subtitle="Directed topological relationships connecting component suppliers to finished product assembly sinks."
        actions={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className={`px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
                showLegend
                  ? 'bg-[#14233D] text-[#3DD6C4] border-[#3DD6C4]/40'
                  : 'bg-[#0D1628] text-slate-400 border-[#1E2E4E] hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 inline mr-1" />
              Legend
            </button>
            <button
              type="button"
              onClick={refetch}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#0D1628] hover:bg-[#14233D] text-slate-300 hover:text-white border border-[#1E2E4E] text-xs font-mono transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh Topology</span>
            </button>
          </div>
        }
      />

      {/* Overview Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Graph Nodes"
          value={network?.nodes.length ?? 0}
          icon={<NetworkIcon className="w-4 h-4 text-[#3DD6C4]" />}
          subtext="24 component suppliers + 4 product lines"
        />
        <StatCard
          label="At-Risk Suppliers (≥70)"
          value={nodeStats.highRisk}
          variant={nodeStats.highRisk > 0 ? 'critical' : 'success'}
          icon={<ShieldAlert className="w-4 h-4" />}
          subtext="Vulnerable nodes requiring mitigation"
        />
        <StatCard
          label="Directed Dependencies"
          value={network?.edges.length ?? 0}
          icon={<Link2 className="w-4 h-4 text-indigo-400" />}
          subtext="Critical product bill-of-materials paths"
        />
        <StatCard
          label="Visible Subgraph"
          value={`${filteredData.nodes.length} Nodes`}
          icon={<Filter className="w-4 h-4 text-slate-400" />}
          subtext={`${filteredData.links.length} active edges after filter`}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </span>

          {/* Risk Level Filter */}
          <select
            aria-label="Filter by Risk Level"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs font-mono text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Risk Levels</option>
            <option value="CRITICAL">Critical (≥80)</option>
            <option value="HIGH">High (70-79)</option>
            <option value="MEDIUM">Medium (40-69)</option>
            <option value="LOW">Low (&lt;40)</option>
          </select>

          {/* Region Filter */}
          <select
            aria-label="Filter by Operating Corridor"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs font-mono text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Corridors</option>
            {availableRegions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          {/* Criticality Tier Filter */}
          <select
            aria-label="Filter by Criticality Tier"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs font-mono text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#3DD6C4]/50"
          >
            <option value="all">All Criticality Tiers</option>
            <option value="1">Tier 1 (Critical Single-Source)</option>
            <option value="2">Tier 2 (High Impact)</option>
            <option value="3">Tier 3 (Standard / Multi-Source)</option>
          </select>

          {/* Hubs Toggle */}
          <button
            type="button"
            onClick={() => setShowHubs(!showHubs)}
            className={`px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
              showHubs
                ? 'bg-[#15233E] text-indigo-300 border-indigo-700/60'
                : 'bg-[#080E1C] text-slate-400 border-[#1E2E4E]'
            }`}
          >
            {showHubs ? 'Product Hubs: Shown' : 'Product Hubs: Hidden'}
          </button>

          {(riskFilter !== 'all' || regionFilter !== 'all' || tierFilter !== 'all' || !showHubs) && (
            <button
              type="button"
              onClick={() => {
                setRiskFilter('all')
                setRegionFilter('all')
                setTierFilter('all')
                setShowHubs(true)
              }}
              className="text-xs text-[#3DD6C4] hover:underline font-mono px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Keyboard Quick Node Search / Dropdown Selector */}
        <div className="flex items-center space-x-2">
          <label htmlFor="node-select" className="text-xs text-slate-400 font-mono hidden md:inline">
            Select Node:
          </label>
          <select
            id="node-select"
            aria-label="Quick Select Node"
            value={selectedNode?.id || ''}
            onChange={(e) => {
              const found = filteredData.nodes.find((n) => n.id === e.target.value)
              setSelectedNode(found || null)
              if (found && fgRef.current && typeof found.x === 'number' && typeof found.y === 'number') {
                fgRef.current.centerAt(found.x, found.y, 500)
                fgRef.current.zoom(2.0, 500)
              }
            }}
            className="bg-[#080E1C] border border-[#1E2E4E] rounded-md text-xs font-mono text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#3DD6C4]/50 max-w-[220px]"
          >
            <option value="">Choose Node...</option>
            <optgroup label="Product Lines">
              {filteredData.nodes
                .filter((n) => n.type === 'product')
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Component Suppliers">
              {filteredData.nodes
                .filter((n) => n.type !== 'product')
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.current_risk_score?.toFixed(0) ?? '—'})
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Main Interactive Graph Canvas & Side Panel Container */}
      <div className="relative bg-[#080E1C] border border-[#1E2E4E] rounded-lg overflow-hidden shadow-xl">
        {/* Force Directed Graph Canvas */}
        <div ref={containerRef} className="w-full h-[620px] relative bg-[#080E1C]">
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={filteredData}
            nodeId="id"
            nodeRelSize={6}
            nodeCanvasObject={renderNode}
            nodePointerAreaPaint={renderPointerArea}
            // Edge Styling
            linkWidth={(link: any) => {
              const isHigh = highlightEdges.has(link.id)
              const base = (link.dependency_weight || 0.5) * 2.5 + 0.8
              return isHigh ? base + 1.8 : base
            }}
            linkColor={(link: any) => {
              if (focusNode) {
                return highlightEdges.has(link.id)
                  ? '#3DD6C4'
                  : 'rgba(51, 65, 85, 0.12)'
              }
              const weight = link.dependency_weight || 0.5
              return `rgba(148, 163, 184, ${0.2 + weight * 0.35})`
            }}
            linkDirectionalArrowLength={4.5}
            linkDirectionalArrowRelPos={0.93}
            linkDirectionalArrowColor={(link: any) =>
              highlightEdges.has(link.id) ? '#3DD6C4' : 'rgba(148, 163, 184, 0.4)'
            }
            // Interactivity Handlers
            onNodeHover={(node: any) => setHoverNode(node || null)}
            onNodeClick={(node: any) => {
              setSelectedNode(node || null)
              if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                fgRef.current?.centerAt(node.x, node.y, 450)
              }
            }}
            onBackgroundClick={() => {
              setSelectedNode(null)
              setHoverNode(null)
            }}
            // Force Engine Configurations
            d3VelocityDecay={0.3}
            cooldownTicks={120}
            warmupTicks={50}
            enableNodeDrag={true}
          />

          {/* Floating Graph Camera Controls Toolbar (Top Right) */}
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-1.5 bg-[#0D1628]/95 border border-[#1E2E4E] backdrop-blur rounded-md p-1 shadow-lg">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom In"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-[#14233D] rounded transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-[#14233D] rounded transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomToFit}
              title="Fit Entire Graph"
              aria-label="Fit Entire Graph"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-[#14233D] rounded transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {selectedNode && (
              <button
                type="button"
                onClick={handleCenterSelected}
                title="Center Selected Node"
                aria-label="Center Selected Node"
                className="p-1.5 text-[#3DD6C4] hover:bg-[#14233D] rounded transition-colors"
              >
                <Target className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Floating Compact Legend (Bottom Left) */}
          {showLegend && (
            <div className="absolute bottom-4 left-4 z-10 bg-[#0D1628]/95 border border-[#1E2E4E] backdrop-blur rounded-md p-3 text-[11px] font-mono shadow-xl max-w-[280px]">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1E2E4E]">
                <span className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
                  Visual Encoding
                </span>
                <button
                  type="button"
                  onClick={() => setShowLegend(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close Legend"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-sm bg-[#4F46E5] border border-[#818CF8]" />
                  <span>Product Line Assembly Hub</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#BE123C]" />
                  <span>Critical Risk (≥80) • Pulsing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                  <span>High Risk (70–79) • Pulsing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                  <span>Medium Risk (40–69)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                  <span>Low Risk (&lt;40)</span>
                </div>
                <div className="flex items-center space-x-2 pt-1 border-t border-[#1E2E4E]/60 text-[10px] text-slate-400">
                  <span className="w-4 h-[2px] bg-slate-400 inline-block" />
                  <span>Edge Width = Dependency Weight</span>
                </div>
              </div>
            </div>
          )}

          {/* Contextual Selected Node Detail Slide-Over Card (Bottom Right / Side) */}
          <AnimatePresence>
            {selectedNode && selectedNodeDetails && (
              <motion.div
                initial={{ opacity: 0, x: reducedMotion ? 0 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reducedMotion ? 0 : 20 }}
                transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-4 left-4 sm:left-auto sm:right-16 z-20 w-auto max-w-[340px] sm:max-w-[360px] bg-[#0D1628]/95 border border-[#2B426E] backdrop-blur rounded-lg p-4 shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1E2E4E]">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      {selectedNode.type === 'product' ? 'Product Line Assembly Hub' : 'Component Supplier Node'}
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      {selectedNode.type === 'product' ? (
                        <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                      ) : (
                        <Building2 className="w-4 h-4 text-[#3DD6C4] shrink-0" />
                      )}
                      <span className="line-clamp-1">{selectedNode.name}</span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#14233D] transition-colors"
                    aria-label="Deselect node"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Node Properties */}
                <div className="py-3 space-y-2.5 text-xs font-mono">
                  {selectedNode.type === 'product' ? (
                    <>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Assembly Corridor:</span>
                        <span className="font-semibold text-white">{selectedNode.region}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Feeding Suppliers:</span>
                        <span className="font-semibold text-[#3DD6C4]">
                          {selectedNodeDetails.suppliers?.length ?? 0} components
                        </span>
                      </div>

                      {/* Connected Suppliers preview */}
                      <div className="pt-2 border-t border-[#1E2E4E]">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                          Connected Component Feeders:
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {selectedNodeDetails.suppliers?.map((sup) => (
                            <div
                              key={sup.id}
                              onClick={() => {
                                const node = filteredData.nodes.find((n) => n.id === sup.id)
                                if (node) {
                                  setSelectedNode(node)
                                  fgRef.current?.centerAt(node.x, node.y, 400)
                                }
                              }}
                              className="p-1.5 rounded bg-[#080E1C] hover:bg-[#14233D] cursor-pointer flex items-center justify-between text-[11px] border border-[#16233B] transition-colors"
                            >
                              <span className="text-slate-200 truncate max-w-[190px]">{sup.name}</span>
                              <RiskBadge score={sup.current_risk_score} size="sm" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Current Risk Status:</span>
                        <RiskBadge
                          score={selectedNode.current_risk_score}
                          level={getNodeRiskLevel(selectedNode.current_risk_score)}
                          size="sm"
                        />
                      </div>

                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Criticality Standing:</span>
                        <span className="font-bold text-amber-400">
                          Tier {selectedNode.criticality_tier}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Corridor / Country:</span>
                        <span className="text-white">
                          {selectedNode.region} ({selectedNode.country})
                        </span>
                      </div>

                      {typeof selectedNode.annual_spend === 'number' && (
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400">Annual Procurement:</span>
                          <span className="text-white">${selectedNode.annual_spend.toLocaleString()}</span>
                        </div>
                      )}

                      {/* Downstream product lines */}
                      <div className="pt-2 border-t border-[#1E2E4E]">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Downstream Product Dependents:
                        </span>
                        <div className="space-y-1">
                          {selectedNodeDetails.productLines?.map((pl) => (
                            <div
                              key={pl.id}
                              className="flex items-center justify-between text-[11px] p-1.5 rounded bg-[#080E1C] border border-[#16233B]"
                            >
                              <span className="text-indigo-300">{pl.company_product}</span>
                              <span className="text-slate-400">
                                Weight: <strong>{pl.dependency_weight.toFixed(2)}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action button to open full supplier telemetry */}
                      <div className="pt-3 border-t border-[#1E2E4E]">
                        <Link
                          to={`/suppliers/${selectedNode.id}`}
                          className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-md bg-[#142540] hover:bg-[#1C3357] text-[#3DD6C4] border border-[#3DD6C4]/30 hover:border-[#3DD6C4] text-xs font-semibold transition-colors"
                        >
                          <span>Open Deep-Dive Telemetry</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
