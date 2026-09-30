import type { RiskLevel } from '@/types/api'

export const RISK_THRESHOLDS = {
  LOW_MAX: 40.0,
  MEDIUM_MAX: 70.0,
  HIGH_MAX: 80.0,
} as const

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#10B981',      // Emerald
  MEDIUM: '#F59E0B',   // Amber
  HIGH: '#F97316',     // Orange
  CRITICAL: '#F43F5E', // Rose / Red
}

export function getRiskLevel(score: number | null | undefined): RiskLevel {
  if (typeof score !== 'number' || isNaN(score)) return 'LOW'
  if (score >= 80.0) return 'CRITICAL'
  if (score >= 70.0) return 'HIGH'
  if (score >= 40.0) return 'MEDIUM'
  return 'LOW'
}

export function getRiskColor(score: number | null | undefined): string {
  return RISK_COLORS[getRiskLevel(score)]
}
