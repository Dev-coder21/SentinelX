/**
 * Centralized SentinelX API Client
 * Connects the React application to the FastAPI backend.
 */

import type {
  HealthStatus,
  Supplier,
  SupplierDetail,
  NetworkGraphResponse,
  RiskEvent,
  DashboardSummary,
  PrioritizeRequest,
  PrioritizeResponse,
} from '@/types/api'

// Base URL precedence: VITE_API_BASE_URL -> VITE_API_URL -> http://localhost:8004
const RAW_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8004'

export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '')

/**
 * Static hosting (GitHub Pages) has no backend. When no API URL was configured at build
 * time and the page isn't served locally, read the snapshot in public/demo instead, which
 * backend/scripts/export_demo_data.py produces from the real backend.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']
export const DEMO_MODE =
  !import.meta.env.VITE_API_BASE_URL &&
  !import.meta.env.VITE_API_URL &&
  typeof location !== 'undefined' &&
  !LOCAL_HOSTS.includes(location.hostname)

const DEMO_BASE = `${import.meta.env.BASE_URL}demo/`
const demoCache = new Map<string, Promise<unknown>>()
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

function fetchDemo(name: string) {
  return fetch(`${DEMO_BASE}${name}?v=${__BUILD_ID__}`).then((r) => {
    if (!r.ok) throw new ApiError('Not found', r.status === 404 ? 404 : r.status)
    return r.text()
  })
}

// The snapshot was taken once; shift its timestamps so "updated 2 h ago" stays true to it.
let demoShift: Promise<number> | null = null
const getShift = () =>
  (demoShift ??= fetchDemo('health.json')
    .then((t) => Date.now() - Date.parse(JSON.parse(t).timestamp))
    .catch(() => { demoShift = null; return 0 }))

function demoFile<T>(name: string): Promise<T> {
  if (!demoCache.has(name)) {
    demoCache.set(name, Promise.all([fetchDemo(name), getShift()]).then(([text, shift]) =>
      JSON.parse(text, (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(Date.parse(v) + shift).toISOString() : v)),
    ).catch((e) => { demoCache.delete(name); throw e }))
  }
  return demoCache.get(name) as Promise<T>
}

interface DemoPlans {
  step: number
  max: number
  rows: Record<string, PrioritizeResponse['selected_suppliers'][number]>
  index: number[]
  plans: (Omit<PrioritizeResponse, 'plan_id' | 'generated_at' | 'budget' | 'remaining_budget' | 'selected_suppliers'> & { ids: string[] })[]
}

const LATEST_PLAN_KEY = 'sx-demo-plan'

async function demoPrioritize(budget: number): Promise<PrioritizeResponse> {
  const d = await demoFile<DemoPlans>('plans.json')
  // Each stored plan is the solver's optimum at a multiple of `step`; the largest step
  // that fits the budget is always affordable.
  const i = Math.min(d.index.length, Math.floor(budget / d.step)) - 1
  const base = i >= 0 ? d.plans[d.index[i]] : null
  const { ids = [], ...rest } = base ?? { ids: [] as string[] }
  const plan = {
    ...(base ? rest : {
      total_budget_used: 0, total_expected_protected_revenue: 0, objective_value: 0, selected_count: 0,
      optimization_status: 'Optimal', metadata: {},
    }),
    plan_id: crypto.randomUUID?.() ?? String(Date.now()),
    generated_at: new Date().toISOString(),
    budget,
    selected_suppliers: ids.map((id) => d.rows[id]),
  } as PrioritizeResponse
  plan.remaining_budget = budget - plan.total_budget_used
  try { sessionStorage.setItem(LATEST_PLAN_KEY, JSON.stringify(plan)) } catch { /* storage unavailable */ }
  return plan
}

function page<T>(list: T[], q: URLSearchParams): T[] {
  const offset = Number(q.get('offset') || 0)
  const limit = Number(q.get('limit') || 50)
  return list.slice(offset, offset + limit)
}

async function demoRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
  const [path, query = ''] = endpoint.split('?')
  const q = new URLSearchParams(query)
  if (options.method === 'POST' && path === '/prioritize') {
    return demoPrioritize(Number(JSON.parse(String(options.body || '{}')).budget) || 0) as Promise<T>
  }
  if (path === '/health') return demoFile<T>('health.json')
  if (path === '/dashboard/summary') return demoFile<T>('dashboard-summary.json')
  if (path === '/network') return demoFile<T>('network.json')
  if (path === '/suppliers') return page(await demoFile<Supplier[]>('suppliers.json'), q) as T
  if (path.startsWith('/suppliers/')) return demoFile<T>(`suppliers/${encodeURIComponent(path.slice(11))}.json`)
  if (path === '/risk-events') {
    const region = q.get('region'), source = q.get('source')
    const all = await demoFile<RiskEvent[]>('risk-events.json')
    return page(all.filter((e) => (!region || e.region === region) && (!source || e.source === source)), q) as T
  }
  if (path === '/mitigation-plans/latest') {
    let saved: string | null = null
    try { saved = sessionStorage.getItem(LATEST_PLAN_KEY) } catch { /* storage unavailable */ }
    if (saved) return JSON.parse(saved) as T
    throw new ApiError('No mitigation plan has been generated yet', 404)
  }
  throw new ApiError('Not available in the static demo', 404)
}

export class ApiError extends Error {
  public status: number
  public detail?: string

  constructor(message: string, status: number, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options
  if (DEMO_MODE) return demoRequest<T>(endpoint, fetchOptions)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(fetchOptions.headers || {}),
      },
    })

    if (!response.ok) {
      let detail = ''
      try {
        const errorJson = await response.json()
        detail = errorJson.detail || JSON.stringify(errorJson)
      } catch {
        detail = response.statusText
      }
      throw new ApiError(
        detail || `HTTP request failed with status ${response.status}`,
        response.status,
        detail
      )
    }

    return (await response.json()) as T
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(`Request timeout after ${timeoutMs}ms`, 408)
    }
    const message = err instanceof Error ? err.message : 'Network request failed'
    throw new ApiError(message, 0)
  } finally {
    clearTimeout(timeoutId)
  }
}

export const apiClient = {
  // Health
  getHealth: () => request<HealthStatus>('/health'),

  // Dashboard Aggregations (Phase 7 API)
  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),

  // Suppliers
  getSuppliers: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const query = searchParams.toString()
    return request<Supplier[]>(`/suppliers${query ? `?${query}` : ''}`)
  },

  getSupplierDetail: (id: string) => request<SupplierDetail>(`/suppliers/${id}`),

  // Network Graph
  getNetwork: () => request<NetworkGraphResponse>('/network'),

  // Risk Events
  getRiskEvents: (params?: {
    region?: string
    source?: string
    limit?: number
    offset?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.region && params.region !== 'all') searchParams.set('region', params.region)
    if (params?.source && params.source !== 'all') searchParams.set('source', params.source)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const query = searchParams.toString()
    return request<RiskEvent[]>(`/risk-events${query ? `?${query}` : ''}`)
  },

  // Optimization / Mitigation Prioritization
  prioritize: (req: PrioritizeRequest) =>
    request<PrioritizeResponse>('/prioritize', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  getLatestMitigationPlan: () =>
    request<PrioritizeResponse>('/mitigation-plans/latest'),
}
