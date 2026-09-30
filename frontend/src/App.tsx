import { useState, useEffect } from "react"
import { Activity, ShieldCheck, Cpu, Database, Network, SlidersHorizontal, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { fetchHealth, type HealthStatus } from "@/lib/api"

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<string>("")

  const checkBackendHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHealth()
      setHealth(data)
      setLastChecked(new Date().toLocaleTimeString())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to reach FastAPI backend")
      setLastChecked(new Date().toLocaleTimeString())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkBackendHealth()
  }, [])

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col font-sans selection:bg-[#3DD6C4]/30 selection:text-[#3DD6C4]">
      {/* Top Navigation Bar */}
      <header className="border-b border-[#1E2C48] bg-[#111A2E]/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#3DD6C4] to-[#8B7CFF] flex items-center justify-center shadow-lg shadow-[#3DD6C4]/10">
            <ShieldCheck className="h-5 w-5 text-[#0B1120] stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white">SentinelX</span>
              <span className="text-[10px] font-mono uppercase bg-[#1E2C48] text-[#3DD6C4] px-2 py-0.5 rounded border border-[#3DD6C4]/30 tracking-wider">
                Phase 1 Active
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Supply Chain Risk Intelligence & LP Prioritization</p>
          </div>
        </div>

        {/* Backend Connectivity Status Badge */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs font-mono bg-[#162036] px-3 py-1.5 rounded-md border border-[#1E2C48]">
            <span className="text-slate-400">Backend API:</span>
            {loading ? (
              <span className="flex items-center text-amber-400">
                <RefreshCw className="h-3 w-3 animate-spin mr-1" /> Connecting...
              </span>
            ) : health ? (
              <span className="flex items-center text-[#3DD6C4] font-medium">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {health.status.toUpperCase()} (v{health.version})
              </span>
            ) : (
              <span className="flex items-center text-rose-400 font-medium">
                <AlertCircle className="h-3 w-3 mr-1" /> Offline (Local Dev)
              </span>
            )}
          </div>

          <button
            onClick={checkBackendHealth}
            className="p-1.5 rounded bg-[#162036] hover:bg-[#1E2C48] border border-[#1E2C48] text-slate-300 hover:text-white transition-colors"
            title="Refresh backend status"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#3DD6C4]" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Context Alert Banner */}
        <div className="rounded-xl p-4 bg-gradient-to-r from-[#162036] to-[#111A2E] border border-[#1E2C48] shadow-sm flex items-start space-x-4">
          <div className="p-2 rounded-lg bg-[#3DD6C4]/10 text-[#3DD6C4] mt-0.5">
            <Activity className="h-5 w-5" />
          </div>
          <div className="flex-1 text-sm">
            <h2 className="font-semibold text-white tracking-wide">Target Domain: Hypothetical Mid-Size Electronics Manufacturer</h2>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              SentinelX models 15–30 Tier-1 and Tier-2 suppliers across global manufacturing corridors (East Asia, Southeast Asia, North America, Europe)
              to demonstrate predictive risk fusion and constrained LP revenue-protection optimization.
            </p>
          </div>
        </div>

        {/* System Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-xl bg-[#162036] border border-[#1E2C48] p-5 hover:border-[#3DD6C4]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-md bg-[#3DD6C4]/10 text-[#3DD6C4]">
                <Database className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-mono text-[#3DD6C4] bg-[#3DD6C4]/10 px-2 py-0.5 rounded">Configured</span>
            </div>
            <h3 className="font-semibold text-white text-base">PostgreSQL + Alembic</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Relational core modeling suppliers, dependencies, risk events, scores, and mitigation plans.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1E2C48] text-[11px] font-mono text-slate-400 flex justify-between">
              <span>Tables: 5</span>
              <span>Migrations: Ready</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#162036] border border-[#1E2C48] p-5 hover:border-[#8B7CFF]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-md bg-[#8B7CFF]/10 text-[#8B7CFF]">
                <Cpu className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Phase 2 Target</span>
            </div>
            <h3 className="font-semibold text-white text-base">NLP & Risk Fusion</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Multi-source ingestion (News + Weather) scored via HuggingFace transformer and Gemini LLM.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1E2C48] text-[11px] font-mono text-slate-400 flex justify-between">
              <span>Provider: Gemini API</span>
              <span>Scoring: 0–100</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#162036] border border-[#1E2C48] p-5 hover:border-amber-500/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
                <Network className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Phase 3 Target</span>
            </div>
            <h3 className="font-semibold text-white text-base">Dependency Graph</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Interactive force-directed graph with real-time risk pulses and weighted product dependency edges.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1E2C48] text-[11px] font-mono text-slate-400 flex justify-between">
              <span>Engine: react-force-graph</span>
              <span>Physics: 2D/3D</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#162036] border border-[#1E2C48] p-5 hover:border-[#3DD6C4]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-md bg-[#8B7CFF]/10 text-[#8B7CFF]">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Centerpiece</span>
            </div>
            <h3 className="font-semibold text-white text-base">LP Prioritization Engine</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Constrained resource optimization (PuLP) maximizing protected revenue under budget ceilings.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1E2C48] text-[11px] font-mono text-slate-400 flex justify-between">
              <span>Algorithm: Knapsack LP</span>
              <span>Solver: PuLP</span>
            </div>
          </div>
        </div>

        {/* Live Diagnostics Card */}
        <div className="rounded-xl bg-[#111A2E] border border-[#1E2C48] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center">
              <Activity className="h-4 w-4 mr-2 text-[#3DD6C4]" />
              Foundation Diagnostics & Runtime Status
            </h2>
            {lastChecked && (
              <span className="text-[11px] font-mono text-slate-500">Last verified: {lastChecked}</span>
            )}
          </div>

          <div className="bg-[#0B1120] rounded-lg p-4 font-mono text-xs border border-[#1E2C48] space-y-2 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">API Health Probe:</span>
              <span className={health ? "text-[#3DD6C4]" : "text-amber-400"}>
                {loading ? "CHECKING..." : health ? `200 OK (${health.service})` : "NO CONNECTION (FASTAPI OFFLINE)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">FastAPI Host:</span>
              <span>http://localhost:8000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Frontend Host:</span>
              <span>http://localhost:5173</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">LLM Provider:</span>
              <span className="text-[#3DD6C4]">Google Gemini API (free tier via Google AI Studio)</span>
            </div>
            {error && (
              <div className="mt-3 pt-2 border-t border-[#1E2C48] text-rose-400">
                Note: {error}. When running locally, start the backend with `uvicorn app.main:app --reload`.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E2C48] py-4 px-6 text-center text-xs text-slate-500 font-mono">
        SentinelX Flagship Project • Phase 1 Foundation Active • Next: Data Ingestion & Risk Scoring
      </footer>
    </div>
  )
}
