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
  minHeight = 'min-h-[220px]',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-8 text-center bg-[#0D1628] border border-rose-900/40 rounded-lg ${minHeight} ${className}`}
    >
      <div className="w-10 h-10 rounded-md bg-rose-950/40 border border-rose-900/50 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-rose-400" />
      </div>

      <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
        <span>{title}</span>
        {status ? (
          <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">
            HTTP {status}
          </span>
        ) : null}
      </h3>

      <p className="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#16253F] hover:bg-[#1E3354] text-[#3DD6C4] border border-[#2D4A77] text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#3DD6C4]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Telemetry</span>
        </button>
      )}
    </div>
  )
}
