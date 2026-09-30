import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  status?: number | null
  onRetry?: () => void
  className?: string
  minHeight?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Service Communication Error',
  message,
  status,
  onRetry,
  className = '',
  minHeight = 'min-h-[240px]',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-8 text-center bg-[#151D30]/60 border border-red-500/30 rounded-xl ${minHeight} ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>

      <h3 className="text-base font-semibold text-white mb-1">
        {title}
        {status ? <span className="ml-2 text-xs font-mono text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/50">HTTP {status}</span> : null}
      </h3>

      <p className="text-sm text-slate-400 max-w-md mb-6">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#1E2C48] hover:bg-[#283B60] text-[#3DD6C4] border border-[#3DD6C4]/30 hover:border-[#3DD6C4] text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  )
}
