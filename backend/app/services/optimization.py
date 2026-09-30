import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
import pulp
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.supplier import Supplier
from app.models.dependency import Dependency
from app.models.risk_score import RiskScore
from app.models.mitigation_plan import MitigationPlan
from app.schemas.optimization import (
    PrioritizeRequest,
    PrioritizeResponse,
    SelectedSupplierMitigation,
)

logger = logging.getLogger("sentinelx.services.optimization")

# Deterministic mitigation effectiveness baselines by supplier category
CATEGORY_EFFECTIVENESS: Dict[str, float] = {
    "Semiconductors": 0.75,
    "Memory / storage": 0.75,
    "Displays": 0.75,
    "PCB / electronic components": 0.80,
    "Assembly / test": 0.80,
    "Sensors": 0.80,
    "Power / battery": 0.85,
    "Passives": 0.85,
    "Mechanical / optical": 0.85,
}

# Deterministic mitigation cost baselines and variable rates by criticality tier
TIER_COST_RULES: Dict[int, Dict[str, float]] = {
    1: {"base": 75000.0, "rate": 0.04},  # Base $75k + 4% annual spend
    2: {"base": 40000.0, "rate": 0.03},  # Base $40k + 3% annual spend
    3: {"base": 20000.0, "rate": 0.02},  # Base $20k + 2% annual spend
}


def derive_mitigation_cost(criticality_tier: int, annual_spend: float) -> float:
    """
    Deterministically computes the capital cost required to execute mitigation
    (e.g., dual-source qualification, reserved wafer buffer, expedited air freight).
    """
    rules = TIER_COST_RULES.get(criticality_tier, TIER_COST_RULES[2])
    cost = rules["base"] + (rules["rate"] * annual_spend)
    return round(cost, 2)


def derive_mitigation_effectiveness(category: str, criticality_tier: int) -> float:
    """
    Deterministically derives the fraction of risk mitigated (0.0 to 1.0)
    based on component complexity and market availability.
    """
    if category in CATEGORY_EFFECTIVENESS:
        return CATEGORY_EFFECTIVENESS[category]
    tier_fallback = {1: 0.75, 2: 0.80, 3: 0.85}
    return tier_fallback.get(criticality_tier, 0.80)


def generate_mitigation_reason(
    risk_score: float,
    criticality_tier: int,
    dependency_impact: float,
    mitigation_cost: float,
    expected_protected_revenue: float,
    efficiency_ratio: float,
) -> str:
    """
    Generates a deterministic, human-readable justification citing exact economic factors.
    """
    if risk_score >= 80.0:
        severity_label = "critical"
    elif risk_score >= 60.0:
        severity_label = "high"
    elif risk_score >= 40.0:
        severity_label = "moderate"
    else:
        severity_label = "low"

    return (
        f"Prioritized due to {severity_label} evaluated risk ({risk_score:.1f}/100) and Tier {criticality_tier} "
        f"standing across {dependency_impact:.1f}x dependency impact, protecting an estimated "
        f"${expected_protected_revenue:,.0f} in exposed revenue for ${mitigation_cost:,.0f} cost "
        f"({efficiency_ratio:.1f}x efficiency ROI)."
    )


class MitigationOptimizerService:
    """
    Linear Programming (PuLP) Knapsack Prioritization Engine:
    Solves the binary knapsack resource allocation problem:
      Maximize: Sum(expected_protected_revenue_i * x_i)
      Subject to: Sum(mitigation_cost_i * x_i) <= Budget
                  x_i in {0, 1}
    """

    def __init__(self, db: Session):
        self.db = db

    def _get_latest_supplier_risk_scores(self) -> Dict[UUID, float]:
        """Fetches the latest risk score for each supplier in a single grouped query."""
        subq = (
            self.db.query(
                RiskScore.supplier_id,
                func.max(RiskScore.timestamp).label("max_ts"),
            )
            .group_by(RiskScore.supplier_id)
            .subquery()
        )

        latest_scores = (
            self.db.query(RiskScore)
            .join(
                subq,
                (RiskScore.supplier_id == subq.c.supplier_id)
                & (RiskScore.timestamp == subq.c.max_ts),
            )
            .all()
        )
        return {sc.supplier_id: sc.risk_score for sc in latest_scores}

    def evaluate_candidates(self) -> List[Dict[str, Any]]:
        """
        Gathers all suppliers, joins active risk state and dependency topologies,
        and computes deterministic economic metrics.
        """
        suppliers = (
            self.db.query(Supplier)
            .options(joinedload(Supplier.dependencies))
            .all()
        )
        risk_by_supplier = self._get_latest_supplier_risk_scores()

        candidates = []
        for supp in suppliers:
            risk_score = risk_by_supplier.get(supp.id, 0.0)

            # 1. Dependency impact: sum of downstream product line dependency weights
            if supp.dependencies:
                dep_impact = sum(d.dependency_weight for d in supp.dependencies)
            else:
                dep_impact = 1.0
            dep_impact = round(max(1.0, dep_impact), 2)

            # 2. Financial metrics
            cost = derive_mitigation_cost(supp.criticality_tier, supp.annual_spend)
            effectiveness = derive_mitigation_effectiveness(supp.category, supp.criticality_tier)

            # Risk exposure = (risk_score / 100) * dependency_impact * annual_spend
            exposure = (risk_score / 100.0) * dep_impact * supp.annual_spend
            exposure = round(exposure, 2)

            # Protected revenue = exposure * effectiveness
            protected_rev = round(exposure * effectiveness, 2)

            # Efficiency ROI multiple
            eff_ratio = round(protected_rev / cost, 2) if cost > 0.0 else 0.0

            candidates.append({
                "supplier_id": supp.id,
                "supplier_name": supp.name,
                "current_risk_score": risk_score,
                "criticality_tier": supp.criticality_tier,
                "annual_spend": supp.annual_spend,
                "dependency_impact": dep_impact,
                "mitigation_cost": cost,
                "mitigation_effectiveness": effectiveness,
                "risk_exposure": exposure,
                "expected_protected_revenue": protected_rev,
                "efficiency_ratio": eff_ratio,
            })

        return candidates

    def optimize(
        self,
        budget: float,
        persist: bool = True,
        current_time: Optional[datetime] = None,
    ) -> PrioritizeResponse:
        """
        Constructs and solves the 0-1 Knapsack linear program for the given budget constraint.
        Persists the result in `mitigation_plans` if persist=True.
        """
        now = current_time or datetime.now(timezone.utc)
        budget = round(max(0.0, float(budget)), 2)

        # 1. Gather all candidates
        candidates = self.evaluate_candidates()
        total_evaluated = len(candidates)

        # Filter candidates eligible for mitigation (positive expected protected revenue)
        eligible = [c for c in candidates if c["expected_protected_revenue"] > 0.0]

        # -------------------------------------------------------------
        # Edge Case 1: Zero Budget
        # -------------------------------------------------------------
        if budget == 0.0:
            response = PrioritizeResponse(
                generated_at=now,
                budget=0.0,
                selected_suppliers=[],
                total_budget_used=0.0,
                remaining_budget=0.0,
                total_expected_protected_revenue=0.0,
                objective_value=0.0,
                selected_count=0,
                optimization_status="Zero Budget",
                metadata={
                    "total_evaluated": total_evaluated,
                    "eligible_count": len(eligible),
                    "solver": "PuLP_CBC",
                    "notes": "Budget is zero; no mitigation actions can be funded.",
                },
            )
            if persist:
                self._persist_plan(response)
            return response

        # -------------------------------------------------------------
        # Edge Case 2: No Eligible Suppliers (e.g. all risk = 0)
        # -------------------------------------------------------------
        if not eligible:
            response = PrioritizeResponse(
                generated_at=now,
                budget=budget,
                selected_suppliers=[],
                total_budget_used=0.0,
                remaining_budget=budget,
                total_expected_protected_revenue=0.0,
                objective_value=0.0,
                selected_count=0,
                optimization_status="No Eligible Suppliers",
                metadata={
                    "total_evaluated": total_evaluated,
                    "eligible_count": 0,
                    "solver": "PuLP_CBC",
                    "notes": "No suppliers currently have active risk requiring capital mitigation.",
                },
            )
            if persist:
                self._persist_plan(response)
            return response

        # -------------------------------------------------------------
        # Edge Case 3: Budget smaller than cheapest mitigation
        # -------------------------------------------------------------
        min_cost = min(c["mitigation_cost"] for c in eligible)
        if budget < min_cost:
            response = PrioritizeResponse(
                generated_at=now,
                budget=budget,
                selected_suppliers=[],
                total_budget_used=0.0,
                remaining_budget=budget,
                total_expected_protected_revenue=0.0,
                objective_value=0.0,
                selected_count=0,
                optimization_status="Budget Insufficient",
                metadata={
                    "total_evaluated": total_evaluated,
                    "eligible_count": len(eligible),
                    "min_mitigation_cost": min_cost,
                    "solver": "PuLP_CBC",
                    "notes": f"Budget of ${budget:,.2f} is below minimum mitigation cost of ${min_cost:,.2f}.",
                },
            )
            if persist:
                self._persist_plan(response)
            return response

        # -------------------------------------------------------------
        # PuLP Mathematical Formulation
        # -------------------------------------------------------------
        prob = pulp.LpProblem("SentinelX_Mitigation_Prioritization", pulp.LpMaximize)

        # Decision variables: x_i in {0, 1}
        x_vars = {}
        candidate_map = {}
        for c in eligible:
            var_name = f"x_{str(c['supplier_id']).replace('-', '_')}"
            x_vars[c["supplier_id"]] = pulp.LpVariable(var_name, cat=pulp.LpBinary)
            candidate_map[c["supplier_id"]] = c

        # Objective Function: Maximize expected protected revenue
        prob += pulp.lpSum(
            candidate_map[s_id]["expected_protected_revenue"] * x_vars[s_id]
            for s_id in candidate_map
        )

        # Constraint: Total mitigation cost <= Budget
        prob += pulp.lpSum(
            candidate_map[s_id]["mitigation_cost"] * x_vars[s_id]
            for s_id in candidate_map
        ) <= budget

        # Solve
        solver = pulp.PULP_CBC_CMD(msg=False)
        try:
            status_code = prob.solve(solver)
            status_name = pulp.LpStatus[status_code]
        except Exception as solver_exc:
            logger.error(f"PuLP solver raised exception: {solver_exc}", exc_info=True)
            raise RuntimeError(f"Optimization solver execution failed: {solver_exc}") from solver_exc

        if status_name != "Optimal":
            logger.warning(f"Optimization completed with non-optimal status: {status_name}")

        # Extract selections
        selected_candidates = []
        total_used = 0.0
        total_protected = 0.0

        for s_id, var in x_vars.items():
            if var.varValue is not None and round(var.varValue) == 1:
                item = candidate_map[s_id]
                reason = generate_mitigation_reason(
                    risk_score=item["current_risk_score"],
                    criticality_tier=item["criticality_tier"],
                    dependency_impact=item["dependency_impact"],
                    mitigation_cost=item["mitigation_cost"],
                    expected_protected_revenue=item["expected_protected_revenue"],
                    efficiency_ratio=item["efficiency_ratio"],
                )
                selected_obj = SelectedSupplierMitigation(
                    supplier_id=item["supplier_id"],
                    supplier_name=item["supplier_name"],
                    current_risk_score=item["current_risk_score"],
                    criticality_tier=item["criticality_tier"],
                    mitigation_cost=item["mitigation_cost"],
                    expected_protected_revenue=item["expected_protected_revenue"],
                    risk_exposure=item["risk_exposure"],
                    dependency_impact=item["dependency_impact"],
                    annual_spend=item["annual_spend"],
                    mitigation_effectiveness=item["mitigation_effectiveness"],
                    efficiency_ratio=item["efficiency_ratio"],
                    reason=reason,
                )
                selected_candidates.append(selected_obj)
                total_used += item["mitigation_cost"]
                total_protected += item["expected_protected_revenue"]

        # Sort selected suppliers by expected protected revenue descending
        selected_candidates.sort(key=lambda s: s.expected_protected_revenue, reverse=True)

        total_used = round(total_used, 2)
        total_protected = round(total_protected, 2)
        remaining = round(budget - total_used, 2)

        # Strict validation: total budget used must NEVER violate budget constraint
        if total_used > budget + 0.01:
            raise RuntimeError(
                f"Optimization budget constraint violated: used {total_used} > budget {budget}"
            )

        response = PrioritizeResponse(
            generated_at=now,
            budget=budget,
            selected_suppliers=selected_candidates,
            total_budget_used=total_used,
            remaining_budget=max(0.0, remaining),
            total_expected_protected_revenue=total_protected,
            objective_value=total_protected,
            selected_count=len(selected_candidates),
            optimization_status=status_name,
            metadata={
                "total_evaluated": total_evaluated,
                "eligible_count": len(eligible),
                "solver": "PuLP_CBC",
                "formulation": "Binary 0-1 Knapsack (PuLP)",
            },
        )

        if persist:
            self._persist_plan(response)

        return response

    def _persist_plan(self, plan_response: PrioritizeResponse) -> MitigationPlan:
        """Persists the computed mitigation plan to the database."""
        # Convert selected_suppliers to JSON serializable dictionaries
        serialized_selections = [s.model_dump(mode="json") for s in plan_response.selected_suppliers]

        plan_entity = MitigationPlan(
            generated_at=plan_response.generated_at,
            budget_constraint=plan_response.budget,
            selected_suppliers=serialized_selections,
            expected_revenue_protected=plan_response.total_expected_protected_revenue,
            total_budget_used=plan_response.total_budget_used,
            remaining_budget=plan_response.remaining_budget,
            objective_value=plan_response.objective_value,
            optimization_notes=f"Status: {plan_response.optimization_status} | Selected: {plan_response.selected_count}",
            optimization_metadata=plan_response.metadata,
        )
        self.db.add(plan_entity)
        self.db.commit()
        self.db.refresh(plan_entity)

        plan_response.plan_id = plan_entity.id
        return plan_entity
