import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#1E2C48] mb-6">
      <div>
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center space-x-3">{actions}</div>}
    </div>
  )
}
