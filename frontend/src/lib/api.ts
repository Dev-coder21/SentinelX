const API_BASE_URL = import.meta.env.VITE_API_URL || ""

export interface HealthStatus {
  status: string
  service: string
  version: string
  timestamp: string
}

export async function fetchHealth(): Promise<HealthStatus> {
  const url = `${API_BASE_URL}/health`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`)
  }
  return response.json()
}
