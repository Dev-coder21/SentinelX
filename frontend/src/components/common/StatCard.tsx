import React from 'react'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'info'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  badge,
  variant = 'default',
  className = '',
}) => {
  let borderClass = 'border-[#1E2C48]'
  let textClass = 'text-white'

  if (variant === 'critical') {
    borderClass = 'border-rose-500/30'
    textClass = 'text-rose-400'
  } else if (variant === 'warning') {
    borderClass = 'border-amber-500/30'
    textClass = 'text-amber-400'
  } else if (variant === 'success') {
    borderClass = 'border-emerald-500/30'
    textClass = 'text-emerald-400'
  } else if (variant === 'info') {
    borderClass = 'border-[#3DD6C4]/30'
    textClass = 'text-[#3DD6C4]'
  }

  return (
    <div
      className={`bg-[#111A2E]/80 border ${borderClass} rounded-xl p-5 shadow-sm relative overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className={`text-2xl lg:text-3xl font-bold font-mono tracking-tight ${textClass}`}>
          {value}
        </span>
        {badge}
      </div>

      {subtext && <p className="text-xs text-slate-400 mt-2 line-clamp-1">{subtext}</p>}
    </div>
  )
}
