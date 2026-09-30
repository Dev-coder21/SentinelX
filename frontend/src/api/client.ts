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

// Base URL precedence: VITE_API_BASE_URL -> VITE_API_URL -> http://localhost:8000
const RAW_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '')

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
