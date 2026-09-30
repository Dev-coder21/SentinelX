import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.supplier import Supplier
from app.models.dependency import Dependency
from app.models.risk_score import RiskScore
from app.models.mitigation_plan import MitigationPlan
from app.services.optimization import (
    MitigationOptimizerService,
    derive_mitigation_cost,
    derive_mitigation_effectiveness,
    generate_mitigation_reason,
)

# In-memory SQLite engine using StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def test_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def seed_test_portfolio(db_session):
    """Seeds 3 distinct suppliers with dependencies and active risk scores."""
    now = datetime.now(timezone.utc)

    # Supplier A: Critical Tier 1 Semiconductor, High Risk (85.0), High Spend ($5M)
    s_a = Supplier(
        id=uuid.uuid4(),
        name="Apex Foundry Corp",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        annual_spend=5000000.0,
        criticality_tier=1,
    )
    # Supplier B: Tier 2 Sensor, Moderate Risk (50.0), Mid Spend ($2M)
    s_b = Supplier(
        id=uuid.uuid4(),
        name="Optima Sensor Tech",
        region="Europe",
        country="Germany",
        category="Sensors",
        annual_spend=2000000.0,
        criticality_tier=2,
    )
    # Supplier C: Tier 3 Passives, Low Risk (20.0), Low Spend ($500k)
    s_c = Supplier(
        id=uuid.uuid4(),
        name="Global Resistors Ltd",
        region="North America",
        country="USA",
        category="Passives",
        annual_spend=500000.0,
        criticality_tier=3,
    )
    db_session.add_all([s_a, s_b, s_c])
    db_session.flush()

    # Dependencies: Supplier A supports 2 products, Supplier B supports 1, Supplier C supports 1
    d_a1 = Dependency(company_product="Flagship Phone", supplier_id=s_a.id, dependency_weight=1.5)
    d_a2 = Dependency(company_product="Pro Tablet", supplier_id=s_a.id, dependency_weight=1.5)
    d_b1 = Dependency(company_product="Smart Watch", supplier_id=s_b.id, dependency_weight=1.0)
    d_c1 = Dependency(company_product="IoT Hub", supplier_id=s_c.id, dependency_weight=1.0)
    db_session.add_all([d_a1, d_a2, d_b1, d_c1])

    # Risk scores
    sc_a = RiskScore(supplier_id=s_a.id, timestamp=now, risk_score=85.0, contributing_factors={"raw_risk": 70.0})
    sc_b = RiskScore(supplier_id=s_b.id, timestamp=now, risk_score=50.0, contributing_factors={"raw_risk": 45.0})
    sc_c = RiskScore(supplier_id=s_c.id, timestamp=now, risk_score=20.0, contributing_factors={"raw_risk": 20.0})
    db_session.add_all([sc_a, sc_b, sc_c])
    db_session.commit()

    return s_a, s_b, s_c


# ---------------------------------------------------------
# 1. Economic Metric Formula Derivations
# ---------------------------------------------------------
def test_economic_metric_derivations():
    # Tier 1 ($5M spend)
    # Cost = $75,000 + 4% of $5,000,000 = $75,000 + $200,000 = $275,000
    cost_t1 = derive_mitigation_cost(1, 5000000.0)
    assert cost_t1 == 275000.0

    # Tier 2 ($2M spend)
    # Cost = $40,000 + 3% of $2,000,000 = $40,000 + $60,000 = $100,000
    cost_t2 = derive_mitigation_cost(2, 2000000.0)
    assert cost_t2 == 100000.0

    # Tier 3 ($500k spend)
    # Cost = $20,000 + 2% of $500,000 = $20,000 + $10,000 = $30,000
    cost_t3 = derive_mitigation_cost(3, 500000.0)
    assert cost_t3 == 30000.0

    # Effectiveness
    assert derive_mitigation_effectiveness("Semiconductors", 1) == 0.75
    assert derive_mitigation_effectiveness("Sensors", 2) == 0.80
    assert derive_mitigation_effectiveness("Passives", 3) == 0.85

    # Reason generation
    reason = generate_mitigation_reason(
        risk_score=85.0,
        criticality_tier=1,
        dependency_impact=3.0,
        mitigation_cost=275000.0,
        expected_protected_revenue=8000000.0,
        efficiency_ratio=29.1,
    )
    assert "critical" in reason.lower()
    assert "Tier 1" in reason
    assert "$8,000,000" in reason
    assert "$275,000" in reason


# ---------------------------------------------------------
# 2. Optimization Normal Budget & Knapsack Behavior
# ---------------------------------------------------------
def test_optimization_normal_budget(db_session):
    s_a, s_b, s_c = seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    # Budget $300k: enough for Supplier A ($275k) alone, or Suppliers B ($100k) + C ($30k)
    # Supplier A expected protected revenue is much higher than B + C
    res = optimizer.optimize(budget=300000.0)

    assert res.optimization_status == "Optimal"
    assert res.total_budget_used <= 300000.0
    assert res.remaining_budget >= 0.0
    assert res.total_expected_protected_revenue > 0.0
    assert res.objective_value == res.total_expected_protected_revenue

    # Supplier A should be selected due to overwhelming protected value
    selected_ids = [s.supplier_id for s in res.selected_suppliers]
    assert s_a.id in selected_ids


# ---------------------------------------------------------
# 3. Budget Constraint is Never Violated
# ---------------------------------------------------------
def test_budget_constraint_never_violated(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    for test_budget in [50000.0, 150000.0, 300000.0, 400000.0, 1000000.0]:
        res = optimizer.optimize(budget=test_budget)
        assert res.total_budget_used <= test_budget
        assert res.remaining_budget == round(test_budget - res.total_budget_used, 2)


# ---------------------------------------------------------
# 4. Selected Suppliers Validity and Reasoning
# ---------------------------------------------------------
def test_selected_suppliers_validity_and_reasoning(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    res = optimizer.optimize(budget=500000.0)
    assert res.selected_count > 0

    for s in res.selected_suppliers:
        assert isinstance(s.supplier_id, uuid.UUID)
        assert len(s.supplier_name) > 0
        assert s.current_risk_score > 0.0
        assert s.criticality_tier in (1, 2, 3)
        assert s.mitigation_cost > 0.0
        assert s.expected_protected_revenue > 0.0
        assert s.risk_exposure > 0.0
        assert s.dependency_impact >= 1.0
        assert s.mitigation_effectiveness > 0.0
        assert s.efficiency_ratio > 0.0
        assert len(s.reason) > 20
        assert "protected" in s.reason.lower() or "revenue" in s.reason.lower()


# ---------------------------------------------------------
# 5. Different Budgets Produce Different Allocations
# ---------------------------------------------------------
def test_different_budgets_produce_different_allocations(db_session):
    s_a, s_b, s_c = seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    # Budget $35k: only enough for Supplier C ($30k)
    r_small = optimizer.optimize(budget=35000.0)
    assert r_small.selected_count == 1
    assert r_small.selected_suppliers[0].supplier_id == s_c.id

    # Budget $150k: enough for Supplier B ($100k) + C ($30k) = $130k
    r_mid = optimizer.optimize(budget=150000.0)
    assert r_mid.selected_count == 2
    selected_mid_ids = {s.supplier_id for s in r_mid.selected_suppliers}
    assert s_b.id in selected_mid_ids
    assert s_c.id in selected_mid_ids

    # Budget $500k: enough for Supplier A ($275k) + B ($100k) + C ($30k) = $405k
    r_large = optimizer.optimize(budget=500000.0)
    assert r_large.selected_count == 3


# ---------------------------------------------------------
# 6. Zero Budget Edge Case
# ---------------------------------------------------------
def test_zero_budget(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    res = optimizer.optimize(budget=0.0)
    assert res.selected_count == 0
    assert res.selected_suppliers == []
    assert res.total_budget_used == 0.0
    assert res.remaining_budget == 0.0
    assert res.total_expected_protected_revenue == 0.0
    assert res.objective_value == 0.0
    assert res.optimization_status == "Zero Budget"


# ---------------------------------------------------------
# 7. Budget Smaller Than Any Mitigation Cost
# ---------------------------------------------------------
def test_budget_smaller_than_any_supplier(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    # Cheapest mitigation is $30k (Supplier C). Test with $10k
    res = optimizer.optimize(budget=10000.0)
    assert res.selected_count == 0
    assert res.selected_suppliers == []
    assert res.total_budget_used == 0.0
    assert res.remaining_budget == 10000.0
    assert res.total_expected_protected_revenue == 0.0
    assert res.optimization_status == "Budget Insufficient"


# ---------------------------------------------------------
# 8. No Eligible Suppliers (All Risk = 0)
# ---------------------------------------------------------
def test_no_eligible_suppliers(db_session):
    # Seed suppliers with no risk scores or risk = 0
    s1 = Supplier(
        id=uuid.uuid4(),
        name="Zero Risk Co",
        region="East Asia",
        country="Japan",
        category="Passives",
        annual_spend=1000000.0,
        criticality_tier=3,
    )
    db_session.add(s1)
    db_session.commit()

    optimizer = MitigationOptimizerService(db=db_session)
    res = optimizer.optimize(budget=100000.0)

    assert res.selected_count == 0
    assert res.selected_suppliers == []
    assert res.total_budget_used == 0.0
    assert res.remaining_budget == 100000.0
    assert res.optimization_status == "No Eligible Suppliers"


# ---------------------------------------------------------
# 9. Budget Larger Than Total Costs
# ---------------------------------------------------------
def test_budget_larger_than_total_costs(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    # Total costs are ~$405k. Test with $5,000,000
    res = optimizer.optimize(budget=5000000.0)
    assert res.selected_count == 3
    assert res.total_budget_used < 5000000.0
    assert res.remaining_budget > 4500000.0
    assert res.total_expected_protected_revenue > 0.0


# ---------------------------------------------------------
# 10. Deterministic Repeated Optimization
# ---------------------------------------------------------
def test_deterministic_repeated_optimization(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    res1 = optimizer.optimize(budget=300000.0, persist=False)
    res2 = optimizer.optimize(budget=300000.0, persist=False)

    assert res1.total_budget_used == res2.total_budget_used
    assert res1.total_expected_protected_revenue == res2.total_expected_protected_revenue
    assert res1.selected_count == res2.selected_count
    assert [s.supplier_id for s in res1.selected_suppliers] == [s.supplier_id for s in res2.selected_suppliers]


# ---------------------------------------------------------
# 11. Mitigation Plan Persistence
# ---------------------------------------------------------
def test_mitigation_plan_persistence(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    res = optimizer.optimize(budget=250000.0, persist=True)
    assert res.plan_id is not None

    saved_plan = db_session.query(MitigationPlan).filter(MitigationPlan.id == res.plan_id).first()
    assert saved_plan is not None
    assert saved_plan.budget_constraint == 250000.0
    assert saved_plan.total_budget_used == res.total_budget_used
    assert saved_plan.expected_revenue_protected == res.total_expected_protected_revenue
    assert len(saved_plan.selected_suppliers) == res.selected_count


# ---------------------------------------------------------
# 12. GET /mitigation-plans/latest Endpoint
# ---------------------------------------------------------
def test_get_mitigation_plans_latest(test_client, db_session):
    seed_test_portfolio(db_session)

    # 1. Post optimization plan
    post_res = test_client.post("/prioritize", json={"budget": 350000.0})
    assert post_res.status_code == 200
    posted_data = post_res.json()
    assert posted_data["budget"] == 350000.0

    # 2. Retrieve latest via root endpoint: /mitigation-plans/latest
    get_res = test_client.get("/mitigation-plans/latest")
    assert get_res.status_code == 200
    latest_data = get_res.json()
    assert latest_data["plan_id"] == posted_data["plan_id"]
    assert latest_data["budget"] == 350000.0
    assert latest_data["selected_count"] == posted_data["selected_count"]

    # 3. Retrieve latest via versioned endpoint: /api/v1/mitigation-plans/latest
    get_v1_res = test_client.get("/api/v1/mitigation-plans/latest")
    assert get_v1_res.status_code == 200
    assert get_v1_res.json()["plan_id"] == posted_data["plan_id"]


# ---------------------------------------------------------
# 13. No-Plan-Yet Response
# ---------------------------------------------------------
def test_no_plan_yet_response(test_client, db_session):
    # Empty DB has no plans
    res = test_client.get("/mitigation-plans/latest")
    assert res.status_code == 404
    assert "No mitigation plan" in res.json()["detail"]


# ---------------------------------------------------------
# 14. Malformed and Negative Budget Validation
# ---------------------------------------------------------
def test_malformed_negative_budget(test_client):
    # Negative budget
    res_neg = test_client.post("/prioritize", json={"budget": -1000.0})
    assert res_neg.status_code == 422

    # String budget
    res_str = test_client.post("/prioritize", json={"budget": "not_a_number"})
    assert res_str.status_code == 422

    # Missing budget field
    res_empty = test_client.post("/prioritize", json={})
    assert res_empty.status_code == 422


# ---------------------------------------------------------
# 15. Solver Failure Handling
# ---------------------------------------------------------
def test_solver_failure_handling(db_session):
    seed_test_portfolio(db_session)
    optimizer = MitigationOptimizerService(db=db_session)

    # Mock pulp.LpProblem.solve to simulate solver engine failure
    with patch("pulp.LpProblem.solve", side_effect=RuntimeError("Solver binary crash")):
        with pytest.raises(RuntimeError) as exc_info:
            optimizer.optimize(budget=300000.0)
        assert "Optimization solver execution failed" in str(exc_info.value)
