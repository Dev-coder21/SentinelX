/**
 * App data layer: loads suppliers, the dependency network and the dashboard summary
 * from the FastAPI backend once, and derives the view model every page shares.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { apiClient, ApiError } from '@/api/client'
import type { DashboardSummary, NetworkGraphResponse, Supplier } from '@/types/api'
import { REGIONS } from '@/shared/core'

export interface Sup {
  id: string
  idx: number
  name: string
  region: string
  country: string
  category: string
  spend: number
  tier: number
  risk: number
  scored: boolean
  lat: number
  lon: number
  deps: { p: number; w: number }[]
  impact: number
  cost: number
  eff: number
  exposure: number
  protected: number
  roi: number
}

export interface Model {
  suppliers: Sup[]
  products: string[]
  /** [productIndex, supplierIndex, weight] */
  deps: [number, number, number][]
  regions: string[]
  summary: DashboardSummary | null
  byId: Map<string, Sup>
  loadedAt: number
}

/* Map placement. The backend does not store coordinates, so known seed suppliers use their
   facility location and anything else falls back to a country centroid. */
const KNOWN: Record<string, [number, number]> = {
  'Pacific Silicon Foundry': [24.8, 121.0], 'Hanwa Microelectronics': [37.27, 127.44], 'Kyoto Opto-Display Corp': [35.0, 135.77],
  'Formosa Advanced Substrates': [22.62, 120.3], 'Seoul Storage Solutions': [37.57, 126.98], 'Tokyo Nano-Capacitors': [35.68, 139.69],
  'Shenzhen Precision Interconnect': [22.54, 114.06], 'Osaka Thermal Technologies': [34.69, 135.5], 'Taipei Quartz Crystals': [25.03, 121.56],
  'Zenith Power Dynamics': [21.03, 105.85], 'Bangkok Precision Optics': [13.75, 100.5], 'Penang Micro Assembly': [5.41, 100.33],
  'Singapore Global Logistics Hub': [1.35, 103.82], 'Manila Flex Circuits': [14.6, 120.98], 'Silicon Valley RF Labs': [37.39, -122.08],
  'Austin Power Systems': [30.27, -97.74], 'Guadalajara Mechatronics': [20.67, -103.35], 'Delta Maritime Express': [29.95, -90.07],
  'Monterrey Polymer Enclosures': [25.69, -100.32], 'Eindhoven Litho Circuits': [51.44, 5.47], 'Bavaria Sensor Dynamics': [48.14, 11.58],
  'Zurich Micro-Acoustics': [47.66, 9.17], 'Nordic Green Packaging': [53.55, 9.99], 'EuroPac Sustainable Cartons': [51.92, 4.48],
}
const COUNTRY: Record<string, [number, number]> = {
  Taiwan: [23.7, 121.0], 'South Korea': [36.5, 127.8], Japan: [36.2, 138.3], China: [31.2, 114.0], Vietnam: [16.0, 107.8],
  Thailand: [15.0, 101.0], Malaysia: [4.2, 101.9], Singapore: [1.35, 103.82], Philippines: [12.9, 121.8], Indonesia: [-2.5, 117.0],
  India: [21.0, 78.0], 'United States': [38.0, -97.0], Mexico: [23.6, -102.5], Canada: [56.0, -106.0], Germany: [51.2, 10.4],
  Netherlands: [52.1, 5.3], France: [46.6, 2.2], 'United Kingdom': [54.0, -2.0], Switzerland: [46.8, 8.2], Italy: [42.8, 12.8],
  Poland: [52.0, 19.1], Sweden: [62.0, 15.0],
}
const REGION_C: Record<string, [number, number]> = {
  'East Asia': [32, 120], 'Southeast Asia': [10, 105], 'North America': [36, -98], Europe: [50, 8],
}
function locate(name: string, country: string, region: string, i: number): [number, number] {
  if (KNOWN[name]) return KNOWN[name]
  const base = COUNTRY[country] || REGION_C[region] || [20, 0]
  const a = i * 2.39996
  return [base[0] + Math.sin(a) * 1.2, base[1] + Math.cos(a) * 1.2]
}

/* Mirrors backend/app/services/optimization.py so exposure and ROI shown in the UI
   match what the solver uses. */
const CATEGORY_EFFECTIVENESS: Record<string, number> = {
  Semiconductors: 0.75, 'Memory / storage': 0.75, Displays: 0.75, 'PCB / electronic components': 0.8, 'Assembly / test': 0.8,
  Sensors: 0.8, 'Power / battery': 0.85, Passives: 0.85, 'Mechanical / optical': 0.85,
}
const TIER_COST: Record<number, [number, number]> = { 1: [75000, 0.04], 2: [40000, 0.03], 3: [20000, 0.02] }
export const mitigationCost = (tier: number, spend: number) => {
  const [b, r] = TIER_COST[tier] || TIER_COST[2]
  return b + r * spend
}
export const mitigationEff = (category: string, tier: number) =>
  CATEGORY_EFFECTIVENESS[category] ?? ({ 1: 0.75, 2: 0.8, 3: 0.85 } as Record<number, number>)[tier] ?? 0.8

export function buildModel(list: Supplier[], net: NetworkGraphResponse, summary: DashboardSummary | null): Model {
  const productNodes = net.nodes.filter((n) => n.type === 'product')
  const products = productNodes.map((n) => n.name)
  const pIndex = new Map<string, number>()
  productNodes.forEach((n, i) => {
    pIndex.set(n.id, i)
    pIndex.set(n.name, i)
  })
  const netRisk = new Map(net.nodes.filter((n) => n.type === 'supplier').map((n) => [n.id, n.current_risk_score]))
  const suppliers: Sup[] = list.map((s, i) => {
    const raw = s.current_risk_score ?? netRisk.get(s.id) ?? null
    const [lat, lon] = locate(s.name, s.country, s.region, i)
    return {
      id: s.id, idx: i, name: s.name, region: s.region, country: s.country, category: s.category,
      spend: s.annual_spend || 0, tier: s.criticality_tier || 2, risk: raw ?? 0, scored: raw != null,
      lat, lon, deps: [], impact: 1, cost: 0, eff: 0, exposure: 0, protected: 0, roi: 0,
    }
  })
  const byId = new Map(suppliers.map((s) => [s.id, s]))
  const deps: [number, number, number][] = []
  net.edges.forEach((e) => {
    const sup = byId.get(e.source) || byId.get(e.target)
    const pid = byId.has(e.source) ? e.target : e.source
    const p = pIndex.get(pid) ?? pIndex.get(e.company_product)
    if (!sup || p == null) return
    deps.push([p, sup.idx, e.dependency_weight])
    sup.deps.push({ p, w: e.dependency_weight })
  })
  suppliers.forEach((s) => {
    s.impact = Math.max(1, s.deps.reduce((a, d) => a + d.w, 0))
    s.cost = mitigationCost(s.tier, s.spend)
    s.eff = mitigationEff(s.category, s.tier)
    s.exposure = (s.risk / 100) * s.impact * s.spend
    s.protected = s.exposure * s.eff
    s.roi = s.cost ? s.protected / s.cost : 0
  })
  const seen = new Set(suppliers.map((s) => s.region))
  const regions = [...REGIONS.filter((r) => seen.has(r)), ...[...seen].filter((r) => !REGIONS.includes(r))]
  return { suppliers, products, deps, regions, summary, byId, loadedAt: Date.now() }
}

export const prodRisk = (m: Model, p: number) => {
  const ds = m.deps.filter((d) => d[0] === p)
  const w = ds.reduce((a, d) => a + d[2], 0)
  return w ? ds.reduce((a, d) => a + d[2] * m.suppliers[d[1]].risk, 0) / w : 0
}

/* ---------- tiny store so every page shares one fetch ---------- */
type St = { data: Model | null; loading: boolean; error: string | null; status: number | null }
let state: St = { data: null, loading: false, error: null, status: null }
const subs = new Set<() => void>()
const set = (p: Partial<St>) => {
  state = { ...state, ...p }
  subs.forEach((f) => f())
}
let inflight: Promise<void> | null = null

export function loadModel(force = false): Promise<void> {
  if (inflight) return inflight
  if (state.data && !force) return Promise.resolve()
  set({ loading: true, error: null, status: null })
  inflight = Promise.all([
    apiClient.getSuppliers({ limit: 200 }),
    apiClient.getNetwork(),
    apiClient.getDashboardSummary().catch(() => null),
  ])
    .then(([list, net, summary]) => set({ data: buildModel(list, net, summary), loading: false }))
    .catch((err: unknown) => {
      const e = err as ApiError
      set({ loading: false, error: e?.message || 'Request failed', status: e?.status ?? null })
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useModel() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
  useEffect(() => {
    if (!state.data && !state.loading && !state.error) loadModel()
  }, [])
  return { ...s, reload: () => loadModel(true) }
}

/** Current model without subscribing, for one-off lookups outside React render. */
export const getModelSnapshot = () => state.data
