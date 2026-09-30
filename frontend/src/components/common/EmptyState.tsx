import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  minHeight?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  minHeight = 'min-h-[200px]',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-[#0D1628]/80 border border-[#1E2E4E] rounded-lg ${minHeight} ${className}`}
    >
      <div className="w-10 h-10 rounded-md bg-[#121F38] border border-[#1E2E4E] flex items-center justify-center mb-3 text-slate-400">
        {icon || <Inbox className="w-5 h-5" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#14233D] hover:bg-[#1C3256] text-[#3DD6C4] border border-[#233B62] text-xs font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
