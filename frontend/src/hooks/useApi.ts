import { useState, useEffect, useCallback, useRef } from 'react'
import { ApiError } from '@/api/client'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  errorStatus: number | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/**
 * Clean, lightweight React hook for executing API calls with loading, error, and refetch states.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { immediate?: boolean } = { immediate: true }
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: options.immediate !== false,
    error: null,
    errorStatus: null,
  })

  // Prevent state updates after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null, errorStatus: null }))
    try {
      const result = await fetcher()
      if (isMountedRef.current) {
        setState({
          data: result,
          loading: false,
          error: null,
          errorStatus: null,
        })
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        let msg = 'An unexpected error occurred'
        let status: number | null = null

        if (err instanceof ApiError) {
          msg = err.detail || err.message
          status = err.status
        } else if (err instanceof Error) {
          msg = err.message
        }

        setState({
          data: null,
          loading: false,
          error: msg,
          errorStatus: status,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (options.immediate !== false) {
      execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute])

  const setData = useCallback((updater: React.SetStateAction<T | null>) => {
    setState((prev) => ({
      ...prev,
      data: typeof updater === 'function' ? (updater as (p: T | null) => T | null)(prev.data) : updater,
    }))
  }, [])

  return {
    ...state,
    refetch: execute,
    setData,
  }
}
