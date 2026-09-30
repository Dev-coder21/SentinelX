import { useEffect } from 'react'

/**
 * Custom hook to update document title for each view.
 * Guarantees consistent product identity branding: `${title} | SentinelX`
 */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title ? `${title} | SentinelX` : 'SentinelX | Supply Chain Risk Intelligence'
    return () => {
      document.title = prevTitle
    }
  }, [title])
}
