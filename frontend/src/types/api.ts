/**
 * SentinelX TypeScript API Type Definitions
 * Accurately models FastAPI backend schemas for suppliers, dependencies,
 * network graphs, risk events, scores, dashboard aggregates, and optimization plans.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskTrend = 'increasing' | 'decreasing' | 'stable'

// --- Supplier & Dependencies ---

export interface Dependency {
  id: string
  company_product: string
  supplier_id: string
  dependency_weight: number
}

export interface Supplier {
  id: string
  name: string
  region: string
  country: string
  category: string
  annual_spend: number
  criticality_tier: number
  current_risk_score: number | null
  risk_level: RiskLevel | null
  dependency_count: number
  product_lines: string[]
}

export interface SupplierDetail extends Supplier {
  previous_risk_score: number | null
  risk_trend: RiskTrend | null
  contributing_factors: Record<string, unknown> | null
  dependencies: Dependency[]
  product_lines_affected: string[]
  risk_history: RiskScore[]
  related_risk_events: RiskEvent[]
}

// --- Risk Scores ---

export interface RiskScore {
  id: string
  supplier_id: string
  timestamp: string
  risk_score: number
  contributing_factors: Record<string, unknown> | null
}

// --- Risk Events ---

export interface RiskEvent {
  id: string
  region: string
  source: string
  headline: string
  summary: string | null
  sentiment_score: number
  event_type: string
  detected_at: string
  raw_url: string | null
  fingerprint: string | null
  severity: number | null
  confidence: number | null
  classification_source: string | null
}

// --- Network Graph ---

export interface NetworkNode {
  id: string
  name: string
  type: 'supplier' | 'product'
  region: string
  country: string
  category: string
  criticality_tier: number
  annual_spend: number | null
  current_risk_score: number | null
}

export interface NetworkEdge {
  id: string
  source: string
  target: string
  dependency_weight: number
  company_product: string
}

export interface NetworkGraphResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

// --- Dashboard Aggregations ---

export interface HighestRiskSupplierSummary {
  id: string
  name: string
  risk_score: number
  criticality_tier: number
  category?: string
  region: string
}

export interface DashboardOverview {
  total_suppliers: number
  average_risk: number
  high_risk_supplier_count: number
  medium_risk_supplier_count: number
  low_risk_supplier_count: number
  highest_risk_supplier: HighestRiskSupplierSummary | null
  latest_risk_timestamp: string | null
  recent_event_count: number
  tier_distribution: Record<string, number>
}

export interface RiskDistributionItem {
  level: RiskLevel | string
  count: number
  percentage: number
}

export interface RegionalRiskSummary {
  region: string
  supplier_count: number
  average_risk: number
  highest_risk: number
  high_risk_supplier_count: number
}

export interface RiskTrendPoint {
  timestamp: string
  average_risk: number
  high_risk_count: number
  scored_supplier_count: number
}

export interface EventTypeDistributionItem {
  event_type: string
  count: number
  percentage: number
}

export interface DashboardRecentEvent {
  id: string
  detected_at: string
  region: string
  source: string
  event_type: string
  headline: string
  summary: string | null
  severity: number | null
  confidence: number | null
  sentiment_score: number
  affected_suppliers: string[]
}

export interface DashboardOptimizationSummary {
  plan_id: string
  generated_at: string
  budget: number
  total_budget_used: number
  remaining_budget: number
  selected_count: number
  expected_protected_revenue: number
  objective_value: number
  optimization_status: string | null
}

export interface DashboardSummary {
  total_suppliers: number
  average_risk: number
  high_risk_supplier_count: number
  medium_risk_supplier_count: number
  low_risk_supplier_count: number
  highest_risk_supplier: HighestRiskSupplierSummary | null
  latest_risk_timestamp: string | null
  recent_event_count: number
  tier_distribution: Record<string, number>
  overview: DashboardOverview
  risk_distribution: RiskDistributionItem[]
  regional_risk: RegionalRiskSummary[]
  risk_trend: RiskTrendPoint[]
  event_distribution: EventTypeDistributionItem[]
  recent_events: DashboardRecentEvent[]
  latest_optimization: DashboardOptimizationSummary | null
  generated_at: string
}

// --- Optimization / Mitigation Prioritization ---

export interface PrioritizeRequest {
  budget: number
  strategy?: 'max_revenue' | 'cost_efficiency' | 'tier_weighted'
}

export interface SelectedSupplierMitigation {
  supplier_id: string
  supplier_name: string
  current_risk_score: number
  criticality_tier: number
  mitigation_cost: number
  expected_protected_revenue: number
  risk_exposure: number
  dependency_impact: number
  annual_spend: number
  mitigation_effectiveness: number
  efficiency_ratio: number
  reason: string
}

export interface PrioritizeResponse {
  plan_id: string | null
  generated_at: string
  budget: number
  selected_suppliers: SelectedSupplierMitigation[]
  total_budget_used: number
  remaining_budget: number
  total_expected_protected_revenue: number
  objective_value: number
  selected_count: number
  optimization_status: string
  metadata: Record<string, unknown>
}

export interface MitigationPlan {
  id: string
  generated_at: string
  budget_constraint: number
  selected_suppliers: SelectedSupplierMitigation[]
  expected_revenue_protected: number
  optimization_notes: string | null
}

// --- Health Check ---

export interface HealthStatus {
  status: string
  service: string
  version: string
  timestamp: string
}
