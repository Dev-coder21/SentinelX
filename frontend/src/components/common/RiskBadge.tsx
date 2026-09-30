import React from 'react'
import type { RiskLevel } from '@/types/api'

interface RiskBadgeProps {
  score?: number | null
  level?: RiskLevel | string | null
  showScore?: boolean
  size?: 'sm' | 'md'
}

function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 80.0) return 'CRITICAL'
  if (score >= 70.0) return 'HIGH'
  if (score >= 40.0) return 'MEDIUM'
  return 'LOW'
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  level,
  showScore = true,
  size = 'md',
}) => {
  const resolvedLevel: RiskLevel =
    (level?.toUpperCase() as RiskLevel) ||
    (typeof score === 'number' ? getRiskLevelFromScore(score) : 'LOW')

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700'
  let dotColor = 'bg-slate-400'

  switch (resolvedLevel) {
    case 'CRITICAL':
      colorClasses = 'bg-rose-950/60 text-rose-300 border-rose-800/60'
      dotColor = 'bg-rose-500'
      break
    case 'HIGH':
      colorClasses = 'bg-amber-950/60 text-amber-300 border-amber-800/60'
      dotColor = 'bg-amber-500'
      break
    case 'MEDIUM':
      colorClasses = 'bg-yellow-950/40 text-yellow-300 border-yellow-800/50'
      dotColor = 'bg-yellow-400'
      break
    case 'LOW':
      colorClasses = 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
      dotColor = 'bg-emerald-400'
      break
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 space-x-1.5'
      : 'text-xs px-2.5 py-1 space-x-2'

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-md border ${colorClasses} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{resolvedLevel}</span>
      {showScore && typeof score === 'number' && (
        <span className="opacity-80 font-bold">({score.toFixed(1)})</span>
      )}
    </span>
  )
}
