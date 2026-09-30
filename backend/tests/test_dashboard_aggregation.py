import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.supplier import Supplier
from app.models.dependency import Dependency
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.models.mitigation_plan import MitigationPlan
from app.services.dashboard import get_dashboard_summary
from app.schemas.dashboard import DashboardSummaryResponse

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


def seed_dashboard_test_data(db_session):
    """Seeds a rich multi-region network with risk scores, events, and a mitigation plan."""
    now = datetime.now(timezone.utc)

    # 4 Suppliers across 2 regions (East Asia, Europe)
    s1 = Supplier(
        id=uuid.uuid4(),
        name="Taipei Silicon Foundries",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        annual_spend=6000000.0,
        criticality_tier=1,
    )
    s2 = Supplier(
        id=uuid.uuid4(),
        name="Kyoto Displays Ltd",
        region="East Asia",
        country="Japan",
        category="Displays",
        annual_spend=4000000.0,
        criticality_tier=1,
    )
    s3 = Supplier(
        id=uuid.uuid4(),
        name="Munich Sensor Labs",
        region="Europe",
        country="Germany",
        category="Sensors",
        annual_spend=2500000.0,
        criticality_tier=2,
    )
    s4 = Supplier(
        id=uuid.uuid4(),
        name="Dresden Passive Corp",
        region="Europe",
        country="Germany",
        category="Passives",
        annual_spend=1000000.0,
        criticality_tier=3,
    )
    db_session.add_all([s1, s2, s3, s4])
    db_session.flush()

    # Risk scores: s1: 85 (CRITICAL), s2: 72 (HIGH), s3: 55 (MEDIUM), s4: 25 (LOW)
    # Total = 85 + 72 + 55 + 25 = 237. Average = 237 / 4 = 59.25 -> 59.3
    t_prev = now - timedelta(days=2)
    sc1_old = RiskScore(supplier_id=s1.id, timestamp=t_prev, risk_score=80.0, contributing_factors={"raw": 65.0})
    sc1 = RiskScore(supplier_id=s1.id, timestamp=now, risk_score=85.0, contributing_factors={"raw": 70.0})
    sc2 = RiskScore(supplier_id=s2.id, timestamp=now, risk_score=72.0, contributing_factors={"raw": 60.0})
    sc3 = RiskScore(supplier_id=s3.id, timestamp=now, risk_score=55.0, contributing_factors={"raw": 45.0})
    sc4 = RiskScore(supplier_id=s4.id, timestamp=now, risk_score=25.0, contributing_factors={"raw": 20.0})
    db_session.add_all([sc1_old, sc1, sc2, sc3, sc4])

    # Risk Events (2 within 14 days, 1 older than 14 days)
    e1 = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        event_type="factory_disruption",
        headline="Wafer plant cleanroom fire disrupts assembly lines",
        severity=75.0,
        detected_at=now - timedelta(days=3),
    )
    e2 = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="weather",
        event_type="weather",
        headline="Typhoon warning halts harbor container shipping",
        severity=65.0,
        detected_at=now - timedelta(days=1),
    )
    e_old = RiskEvent(
        id=uuid.uuid4(),
        region="Europe",
        source="news",
        event_type="labor",
        headline="Historical dockworkers walkout resolved",
        severity=50.0,
        detected_at=now - timedelta(days=30),
    )
    db_session.add_all([e1, e2, e_old])

    # Mitigation Plan
    plan = MitigationPlan(
        generated_at=now,
        budget_constraint=500000.0,
        total_budget_used=335000.0,
        remaining_budget=165000.0,
        expected_revenue_protected=7458000.0,
        objective_value=7458000.0,
        selected_suppliers=[{"supplier_id": str(s1.id), "name": s1.name}],
        optimization_notes="Status: Optimal | Selected: 1",
    )
    db_session.add(plan)
    db_session.commit()

    return s1, s2, s3, s4


# ---------------------------------------------------------
# 1. Overview Metrics
# ---------------------------------------------------------
def test_dashboard_overview_metrics(db_session):
    s1, s2, s3, s4 = seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    assert res.total_suppliers == 4
    assert res.average_risk == 59.2 or res.average_risk == 59.3  # 237 / 4 = 59.25
    assert res.high_risk_supplier_count == 2  # s1 (85 >= 70) and s2 (72 >= 70)
    assert res.medium_risk_supplier_count == 1  # s3 (55)
    assert res.low_risk_supplier_count == 1  # s4 (25)
    assert res.highest_risk_supplier.name == "Taipei Silicon Foundries"
    assert res.highest_risk_supplier.risk_score == 85.0
    assert res.recent_event_count == 2
    assert res.tier_distribution == {"tier_1": 2, "tier_2": 1, "tier_3": 1}

    # Verify structured overview matches
    assert res.overview.total_suppliers == res.total_suppliers
    assert res.overview.average_risk == res.average_risk
    assert res.overview.high_risk_supplier_count == res.high_risk_supplier_count


# ---------------------------------------------------------
# 2. Risk Distribution (LOW, MEDIUM, HIGH, CRITICAL)
# ---------------------------------------------------------
def test_dashboard_risk_distribution(db_session):
    seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    dist = {item.level: item for item in res.risk_distribution}
    assert set(dist.keys()) == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    assert dist["LOW"].count == 1  # s4 (25.0)
    assert dist["MEDIUM"].count == 1  # s3 (55.0)
    assert dist["HIGH"].count == 1  # s2 (72.0)
    assert dist["CRITICAL"].count == 1  # s1 (85.0)

    # Check percentages
    total_pct = sum(item.percentage for item in res.risk_distribution)
    assert round(total_pct) == 100


# ---------------------------------------------------------
# 3. Regional Risk Aggregation
# ---------------------------------------------------------
def test_dashboard_regional_risk_aggregation(db_session):
    seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    reg_map = {r.region: r for r in res.regional_risk}
    assert "East Asia" in reg_map
    assert "Europe" in reg_map

    ea = reg_map["East Asia"]
    assert ea.supplier_count == 2
    # East Asia: (85 + 72) / 2 = 78.5
    assert ea.average_risk == 78.5
    assert ea.highest_risk == 85.0
    assert ea.high_risk_supplier_count == 2

    eu = reg_map["Europe"]
    assert eu.supplier_count == 2
    # Europe: (55 + 25) / 2 = 40.0
    assert eu.average_risk == 40.0
    assert eu.highest_risk == 55.0
    assert eu.high_risk_supplier_count == 0

    # Ordered by average_risk descending
    assert res.regional_risk[0].region == "East Asia"
    assert res.regional_risk[1].region == "Europe"


# ---------------------------------------------------------
# 4. Historical Risk Trend
# ---------------------------------------------------------
def test_dashboard_historical_risk_trend(db_session):
    seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    assert len(res.risk_trend) >= 2
    # Chronological ordering (oldest timestamp first)
    assert res.risk_trend[0].timestamp <= res.risk_trend[1].timestamp
    for point in res.risk_trend:
        assert point.average_risk >= 0.0
        assert point.scored_supplier_count >= 1
        assert point.high_risk_count >= 0


# ---------------------------------------------------------
# 5. Event Type Distribution
# ---------------------------------------------------------
def test_dashboard_event_distribution(db_session):
    seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    # 2 active events: factory_disruption, weather
    evt_types = {item.event_type: item.count for item in res.event_distribution}
    assert "factory_disruption" in evt_types
    assert "weather" in evt_types
    assert evt_types["factory_disruption"] == 1
    assert evt_types["weather"] == 1
    # labor is older than 14 days, so not in active window
    assert "labor" not in evt_types


# ---------------------------------------------------------
# 6. Recent Events with Affected Suppliers
# ---------------------------------------------------------
def test_dashboard_recent_events_with_affected_suppliers(db_session):
    seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    assert len(res.recent_events) == 3
    # Top event should be recent
    top = res.recent_events[0]
    assert isinstance(top.id, uuid.UUID)
    assert top.region in ("East Asia", "Europe")
    assert top.severity > 0.0

    # East Asia event should have Taipei and Kyoto as affected suppliers
    ea_events = [e for e in res.recent_events if e.region == "East Asia"]
    for e in ea_events:
        assert "Taipei Silicon Foundries" in e.affected_suppliers
        assert "Kyoto Displays Ltd" in e.affected_suppliers


# ---------------------------------------------------------
# 7. Latest Optimization Summary
# ---------------------------------------------------------
def test_dashboard_latest_optimization_summary(db_session):
    seed_dashboard_test_data(db_session)
    res = get_dashboard_summary(db_session)

    opt = res.latest_optimization
    assert opt is not None
    assert opt.budget == 500000.0
    assert opt.total_budget_used == 335000.0
    assert opt.remaining_budget == 165000.0
    assert opt.selected_count == 1
    assert opt.expected_protected_revenue == 7458000.0
    assert opt.objective_value == 7458000.0


# ---------------------------------------------------------
# 8. No Optimization Plan Returns Null State
# ---------------------------------------------------------
def test_dashboard_no_optimization_plan_null_state(db_session):
    # Seed suppliers without mitigation plans
    s = Supplier(
        id=uuid.uuid4(),
        name="Solo Supplier",
        region="North America",
        country="USA",
        category="Sensors",
        annual_spend=1000000.0,
        criticality_tier=2,
    )
    db_session.add(s)
    db_session.commit()

    res = get_dashboard_summary(db_session)
    assert res.total_suppliers == 1
    assert res.latest_optimization is None


# ---------------------------------------------------------
# 9. Risk Threshold Boundaries
# ---------------------------------------------------------
def test_dashboard_risk_threshold_boundaries(db_session):
    now = datetime.now(timezone.utc)
    # Test suppliers right at boundary scores: 39.9, 40.0, 69.9, 70.0, 79.9, 80.0
    scores = [39.9, 40.0, 69.9, 70.0, 79.9, 80.0]
    for idx, sc_val in enumerate(scores):
        supp = Supplier(
            id=uuid.uuid4(),
            name=f"Supplier Boundary {idx}",
            region="East Asia",
            country="Japan",
            category="Passives",
            annual_spend=500000.0,
            criticality_tier=3,
        )
        db_session.add(supp)
        db_session.flush()
        db_session.add(RiskScore(supplier_id=supp.id, timestamp=now, risk_score=sc_val))
    db_session.commit()

    res = get_dashboard_summary(db_session, current_time=now)
    assert res.total_suppliers == 6

    # 39.9 -> LOW
    # 40.0, 69.9 -> MEDIUM (count = 2)
    # 70.0, 79.9 -> HIGH (count = 2)
    # 80.0 -> CRITICAL (count = 1)
    dist = {item.level: item.count for item in res.risk_distribution}
    assert dist["LOW"] == 1
    assert dist["MEDIUM"] == 2
    assert dist["HIGH"] == 2
    assert dist["CRITICAL"] == 1

    # High risk supplier count = HIGH (2) + CRITICAL (1) = 3
    assert res.high_risk_supplier_count == 3
    assert res.medium_risk_supplier_count == 2
    assert res.low_risk_supplier_count == 1


# ---------------------------------------------------------
# 10. Empty Database State
# ---------------------------------------------------------
def test_dashboard_empty_database_state(db_session):
    res = get_dashboard_summary(db_session)
    assert res.total_suppliers == 0
    assert res.average_risk == 0.0
    assert res.high_risk_supplier_count == 0
    assert res.medium_risk_supplier_count == 0
    assert res.low_risk_supplier_count == 0
    assert res.highest_risk_supplier is None
    assert res.latest_risk_timestamp is None
    assert res.recent_event_count == 0
    assert res.regional_risk == []
    assert res.risk_trend == []
    assert res.event_distribution == []
    assert res.recent_events == []
    assert res.latest_optimization is None


# ---------------------------------------------------------
# 11. API Endpoints Return Valid Response
# ---------------------------------------------------------
def test_dashboard_api_endpoints_return_valid_response(test_client, db_session):
    seed_dashboard_test_data(db_session)

    # 1. Root route: GET /dashboard/summary
    res = test_client.get("/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_suppliers"] == 4
    assert "overview" in data
    assert "risk_distribution" in data
    assert "regional_risk" in data
    assert "risk_trend" in data
    assert "event_distribution" in data
    assert "recent_events" in data
    assert "latest_optimization" in data
    assert "generated_at" in data

    # 2. Versioned route: GET /api/v1/dashboard/summary
    res_v1 = test_client.get("/api/v1/dashboard/summary")
    assert res_v1.status_code == 200
    assert res_v1.json()["total_suppliers"] == 4


# ---------------------------------------------------------
# 12. No N+1 Query Behavior
# ---------------------------------------------------------
def test_dashboard_no_n_plus_one_queries(db_session):
    # Seed 20 suppliers to verify query count does not scale with supplier count
    now = datetime.now(timezone.utc)
    for i in range(20):
        s = Supplier(
            id=uuid.uuid4(),
            name=f"Scale Supplier {i}",
            region="East Asia" if i % 2 == 0 else "Europe",
            country="Taiwan" if i % 2 == 0 else "Germany",
            category="Passives",
            annual_spend=1000000.0,
            criticality_tier=2,
        )
        db_session.add(s)
        db_session.flush()
        db_session.add(RiskScore(supplier_id=s.id, timestamp=now, risk_score=50.0))
    db_session.commit()

    # Query counter listener
    query_count = 0

    from sqlalchemy import event

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        query_count += 1

    event.listen(db_session.bind, "before_cursor_execute", before_cursor_execute)
    try:
        res = get_dashboard_summary(db_session)
        assert res.total_suppliers == 20
        # 6 fixed constant queries (suppliers, latest_scores subq, plan, trend, events, recent_events)
        assert query_count <= 8, f"Too many queries executed: {query_count}"
    finally:
        event.remove(db_session.bind, "before_cursor_execute", before_cursor_execute)
