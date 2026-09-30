import React, { useState, useCallback } from 'react'
import {
  SlidersHorizontal,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Play,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { apiClient, ApiError } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { RiskBadge } from '@/components/common/RiskBadge'

export const PrioritizationPage: React.FC = () => {
  const fetchLatestPlan = useCallback(() => apiClient.getLatestMitigationPlan(), [])
  const {
    data: plan,
    loading: initialLoading,
    setData: setPlan,
  } = useApi(fetchLatestPlan, [])

  const [budgetInput, setBudgetInput] = useState<string>('500000')
  const [strategy, setStrategy] = useState<'max_revenue' | 'cost_efficiency' | 'tier_weighted'>('max_revenue')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleRunOptimization = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const budgetNum = parseFloat(budgetInput)

    if (isNaN(budgetNum) || budgetNum < 0) {
      setSubmitError('Please enter a valid positive capital budget (e.g. $250,000).')
      return
    }

    setSubmitting(true)
    try {
      const response = await apiClient.prioritize({
        budget: budgetNum,
        strategy,
      })
      setPlan(response)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.detail || err.message)
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Failed to execute linear programming optimization.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (initialLoading && !plan) {
    return <LoadingState message="Retrieving latest persisted LP mitigation plan..." />
  }

  // 404 or empty is expected if no plan has been generated yet, don't crash
  const hasPlan = Boolean(plan && plan.plan_id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mitigation Prioritization Engine"
        subtitle="Constrained Linear Programming (PuLP Knapsack) maximizing protected revenue under recovery budget limits."
      />

      {/* Budget Allocation Form */}
      <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl p-5">
        <form onSubmit={handleRunOptimization} className="space-y-4">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-[#3DD6C4]" />
            <h3 className="text-sm font-semibold text-white">Solver Parameters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Capital Budget Input */}
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="budget-input" className="text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>Capital Mitigation Budget (USD)</span>
                <span className="text-[10px] text-slate-400">Total available mitigation budget</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="budget-input"
                  type="number"
                  min="0"
                  step="10000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="500000"
                  className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-[#1E2C48] rounded-lg text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50 focus:border-[#3DD6C4]"
                />
              </div>
            </div>

            {/* Objective Strategy */}
            <div className="space-y-1">
              <label htmlFor="strategy-select" className="text-xs font-mono text-slate-400 block">Objective Function</label>
              <select
                id="strategy-select"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-[#0B1120] border border-[#1E2C48] rounded-lg text-sm text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DD6C4]/50"
              >
                <option value="max_revenue">Maximize Protected Revenue</option>
                <option value="cost_efficiency">Cost Efficiency (ROI)</option>
                <option value="tier_weighted">Tier-1 Criticality Weighted</option>
              </select>
            </div>
          </div>

          {submitError && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400 font-mono">
              Algorithm: 0-1 Binary Knapsack LP (PuLP CBC Solver)
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#1E2C48] hover:bg-[#283B60] text-[#3DD6C4] border border-[#3DD6C4]/40 hover:border-[#3DD6C4] text-xs font-mono font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Solving PuLP Model...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute Optimization</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Plan Results Section */}
      {!hasPlan ? (
        <EmptyState
          icon={<SlidersHorizontal className="w-6 h-6" />}
          title="No optimization plan generated"
          description="Enter a recovery budget above and execute the PuLP LP solver to determine which at-risk suppliers should be mitigated first."
        />
      ) : (
        <div className="space-y-6">
          {/* Plan KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Allocated Capital"
              value={`$${plan!.total_budget_used.toLocaleString()}`}
              subtext={`From $${plan!.budget.toLocaleString()} requested budget`}
              variant="info"
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              label="Remaining Capital"
              value={`$${plan!.remaining_budget.toLocaleString()}`}
              subtext="Unallocated budget cushion"
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              label="Protected Revenue"
              value={`$${plan!.total_expected_protected_revenue.toLocaleString()}`}
              subtext="Expected business value secured"
              variant="success"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              label="Prioritized Nodes"
              value={`${plan!.selected_count} Actions`}
              subtext={`Solver Status: ${plan!.optimization_status}`}
              variant="default"
              icon={<ShieldCheck className="w-5 h-5" />}
            />
          </div>

          {/* Selected Supplier Actions Table */}
          <div className="bg-[#111A2E]/80 border border-[#1E2C48] rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#1E2C48] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Optimal Mitigation Allocations</h3>
                <p className="text-xs text-slate-400">
                  Ranked subset of suppliers yielding the greatest ROI under budget constraint
                </p>
              </div>
              <span className="text-xs font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded">
                Optimal Solution
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2C48] bg-[#0E1626] text-slate-400 text-xs font-mono uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Prioritized Supplier</th>
                    <th className="py-3 px-4 font-semibold text-center">Criticality</th>
                    <th className="py-3 px-4 font-semibold text-center">Risk Score</th>
                    <th className="py-3 px-4 font-semibold text-right">Mitigation Cost</th>
                    <th className="py-3 px-4 font-semibold text-right">Protected Revenue</th>
                    <th className="py-3 px-4 font-semibold text-center">ROI Multiple</th>
                    <th className="py-3 px-4 font-semibold">Mathematical Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182338]">
                  {plan!.selected_suppliers.map((item) => (
                    <tr key={item.supplier_id} className="hover:bg-[#152035]/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-100">
                        <span className="font-semibold block">{item.supplier_name}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Spend: ${item.annual_spend.toLocaleString()} • {item.dependency_impact.toFixed(1)}x impact
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60">
                          Tier {item.criticality_tier}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <RiskBadge score={item.current_risk_score} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-300">
                        ${item.mitigation_cost.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-emerald-400">
                        ${item.expected_protected_revenue.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                          {item.efficiency_ratio.toFixed(1)}x ROI
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300 leading-relaxed max-w-sm">
                        {item.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
