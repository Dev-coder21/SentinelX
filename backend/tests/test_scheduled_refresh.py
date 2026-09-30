import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.config import settings
from app.core.scheduler import get_scheduler, start_scheduler, shutdown_scheduler
from app.main import app
from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.schemas.risk_event import RiskEventCreate
from app.ingestion.base import BaseIngestionProvider
from app.ingestion.service import IngestionService
from app.nlp.pipeline import NLPRiskPipeline
from app.services.refresh import refresh_risk_pipeline, RefreshResult
from app.services.dashboard import get_dashboard_summary

# Shared in-memory test database using StaticPool
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


class MockIngestionProvider(BaseIngestionProvider):
    def __init__(self, name: str, events: list[RiskEventCreate] = None, fail: bool = False):
        super().__init__(name=name)
        self._events = events or []
        self._fail = fail

    def fetch_events(self, region: str) -> list[RiskEventCreate]:
        if self._fail:
            raise RuntimeError(f"Provider {self.name} connection timed out")
        return [e for e in self._events if e.region == region]


# ---------------------------------------------------------
# 1. Full Refresh Orchestration
# ---------------------------------------------------------
def test_full_refresh_orchestration(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Taipei Silicon Foundries",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_news = RiskEventCreate(
        source="news",
        region="East Asia",
        headline="Major wafer plant halt due to facility power outage",
        summary="A blackout disrupted fabrication lines across the industrial park.",
        event_type="news_disruption",
        fingerprint="fp-news-101",
    )
    sample_weather = RiskEventCreate(
        source="weather",
        region="East Asia",
        headline="Typhoon warning issued for coastal shipping corridor",
        event_type="weather_anomaly",
        severity=70.0,
        fingerprint="fp-weather-102",
    )

    p_news = MockIngestionProvider("gdelt", [sample_news])
    p_weather = MockIngestionProvider("open_meteo", [sample_weather])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    res = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)

    assert res.success is True
    assert res.new_events_inserted == 2
    assert res.events_classified == 2
    assert res.suppliers_rescored == 1
    assert res.highest_risk_score > 0.0
    assert res.highest_risk_supplier == "Taipei Silicon Foundries"


# ---------------------------------------------------------
# 2. Successful Refresh Metrics in Result
# ---------------------------------------------------------
def test_successful_refresh(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Kyoto Opto Displays",
        region="East Asia",
        country="Japan",
        category="Displays",
        criticality_tier=2,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_event = RiskEventCreate(
        source="news",
        region="East Asia",
        headline="Display glass shortages force production cuts",
        event_type="news_disruption",
        fingerprint="fp-displays-201",
    )
    p_news = MockIngestionProvider("gdelt", [sample_event])
    p_weather = MockIngestionProvider("open_meteo", [])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    res = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)

    assert res.news_events == 1
    assert res.weather_events == 0
    assert res.new_events_inserted == 1
    assert res.duplicates_skipped == 0
    assert res.events_classified == 1
    assert res.suppliers_rescored == 1
    assert res.provider_failures == 0
    assert len(res.failure_details) == 0


# ---------------------------------------------------------
# 3. GDELT Failure Isolation
# ---------------------------------------------------------
def test_gdelt_failure_isolation(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Penang Semiconductor Assembly",
        region="Southeast Asia",
        country="Malaysia",
        category="Assembly / test",
        criticality_tier=2,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_weather = RiskEventCreate(
        source="weather",
        region="Southeast Asia",
        headline="Tropical depression brings severe flash floods",
        event_type="weather_anomaly",
        severity=65.0,
        fingerprint="fp-flood-301",
    )
    # GDELT fails, Open-Meteo succeeds
    p_news = MockIngestionProvider("gdelt", fail=True)
    p_weather = MockIngestionProvider("open_meteo", [sample_weather])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    res = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)

    assert res.provider_failures > 0
    assert res.weather_events == 1
    assert res.new_events_inserted == 1
    assert res.suppliers_rescored == 1
    assert res.highest_risk_score > 0.0


# ---------------------------------------------------------
# 4. Open-Meteo Failure Isolation
# ---------------------------------------------------------
def test_open_meteo_failure_isolation(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Munich Sensor Labs",
        region="Europe",
        country="Germany",
        category="Sensors",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_news = RiskEventCreate(
        source="news",
        region="Europe",
        headline="Transport union strike halts cargo logistics",
        event_type="news_disruption",
        fingerprint="fp-strike-401",
    )
    # Open-Meteo fails, GDELT succeeds
    p_news = MockIngestionProvider("gdelt", [sample_news])
    p_weather = MockIngestionProvider("open_meteo", fail=True)
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    res = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)

    assert res.provider_failures > 0
    assert res.news_events == 1
    assert res.new_events_inserted == 1
    assert res.suppliers_rescored == 1
    assert res.highest_risk_score > 0.0


# ---------------------------------------------------------
# 5. Gemini Failure / Fallback Behavior Remains Intact
# ---------------------------------------------------------
def test_gemini_failure_fallback_intact(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Silicon Valley Logic",
        region="North America",
        country="USA",
        category="Semiconductors",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_news = RiskEventCreate(
        source="news",
        region="North America",
        headline="Port workers union votes for strike at freight terminal",
        event_type="news_disruption",
        fingerprint="fp-port-501",
    )
    p_news = MockIngestionProvider("gdelt", [sample_news])
    p_weather = MockIngestionProvider("open_meteo", [])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    # Mock classifier raising rate-limit or API exception
    mock_classifier = MagicMock()
    mock_classifier.classify.side_effect = RuntimeError("Gemini Quota Exceeded 429")

    nlp_pipeline = NLPRiskPipeline(db=db_session, classifier=mock_classifier)

    res = refresh_risk_pipeline(
        db=db_session,
        ingestion_service=ingest_svc,
        nlp_pipeline=nlp_pipeline,
        log_output=False,
    )

    assert res.events_classified == 1
    assert res.fallback_calls == 1
    assert res.gemini_calls == 0
    assert res.suppliers_rescored == 1


# ---------------------------------------------------------
# 6. Repeated Refresh Produces No Duplicate Events
# ---------------------------------------------------------
def test_repeated_refresh_no_duplicate_events(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Hsinchu Packaging",
        region="East Asia",
        country="Taiwan",
        category="Assembly / test",
        criticality_tier=2,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_event = RiskEventCreate(
        source="news",
        region="East Asia",
        headline="Substrate shortage affects memory module packaging",
        event_type="news_disruption",
        fingerprint="fp-substrate-601",
    )
    p_news = MockIngestionProvider("gdelt", [sample_event])
    p_weather = MockIngestionProvider("open_meteo", [])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    # Run 1
    r1 = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)
    assert r1.new_events_inserted == 1
    assert r1.duplicates_skipped == 0

    # Run 2 with identical event fingerprint
    r2 = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)
    assert r2.new_events_inserted == 0
    assert r2.duplicates_skipped == 1

    total_events = db_session.query(RiskEvent).count()
    assert total_events == 1


# ---------------------------------------------------------
# 7. Already-Classified Events Are Skipped
# ---------------------------------------------------------
def test_already_classified_events_skipped(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Osaka Passive Elements",
        region="East Asia",
        country="Japan",
        category="Passives",
        criticality_tier=3,
    )
    db_session.add(supplier)
    db_session.commit()

    sample_event = RiskEventCreate(
        source="news",
        region="East Asia",
        headline="Capacitor production halted at ceramic plant",
        event_type="news_disruption",
        fingerprint="fp-cap-701",
    )
    p_news = MockIngestionProvider("gdelt", [sample_event])
    p_weather = MockIngestionProvider("open_meteo", [])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    # Run 1: Classifies event
    r1 = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)
    assert r1.events_classified == 1

    # Run 2: Event is already classified, so events_classified must be 0
    r2 = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)
    assert r2.events_classified == 0


# ---------------------------------------------------------
# 8. Historical Risk Scores Persist
# ---------------------------------------------------------
def test_historical_risk_scores_persist(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Dresden Fab Works",
        region="Europe",
        country="Germany",
        category="Semiconductors",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    t1 = datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)

    p_news = MockIngestionProvider("gdelt", [])
    p_weather = MockIngestionProvider("open_meteo", [])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    refresh_risk_pipeline(db=db_session, current_time=t1, ingestion_service=ingest_svc, log_output=False)
    refresh_risk_pipeline(db=db_session, current_time=t2, ingestion_service=ingest_svc, log_output=False)

    history = (
        db_session.query(RiskScore)
        .filter(RiskScore.supplier_id == supplier.id)
        .order_by(RiskScore.timestamp.asc())
        .all()
    )
    assert len(history) == 2
    ts0 = history[0].timestamp.replace(tzinfo=timezone.utc) if history[0].timestamp.tzinfo is None else history[0].timestamp
    ts1 = history[1].timestamp.replace(tzinfo=timezone.utc) if history[1].timestamp.tzinfo is None else history[1].timestamp
    assert ts0 == t1
    assert ts1 == t2


# ---------------------------------------------------------
# 9. Scheduler Does Not Start During Tests or Import
# ---------------------------------------------------------
def test_scheduler_does_not_start_during_tests_or_import():
    # Verify default state
    assert settings.ENABLE_SCHEDULER is False
    assert get_scheduler() is None

    # Test explicit lifecycle control
    sched = start_scheduler(force=True)
    assert sched is not None
    assert sched.running is True
    assert get_scheduler() is not None

    # Re-starting returns existing singleton
    sched_dup = start_scheduler(force=True)
    assert sched_dup is sched

    # Graceful shutdown
    shutdown_scheduler()
    assert get_scheduler() is None


# ---------------------------------------------------------
# 10. Dashboard Summary Calculation
# ---------------------------------------------------------
def test_dashboard_summary_calculation(db_session):
    now = datetime.now(timezone.utc)
    # Seed 3 suppliers: Tier 1, Tier 2, Tier 3
    s1 = Supplier(
        id=uuid.uuid4(),
        name="Apex High Tech",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        criticality_tier=1,
    )
    s2 = Supplier(
        id=uuid.uuid4(),
        name="Beta Mid Tech",
        region="Europe",
        country="Germany",
        category="Sensors",
        criticality_tier=2,
    )
    s3 = Supplier(
        id=uuid.uuid4(),
        name="Gamma Standard",
        region="North America",
        country="USA",
        category="Passives",
        criticality_tier=3,
    )
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    # Assign risk scores: High (80.0), Medium (50.0), Low (20.0)
    sc1 = RiskScore(
        supplier_id=s1.id,
        timestamp=now,
        risk_score=80.0,
        contributing_factors={"raw_risk": 60.0},
    )
    sc2 = RiskScore(
        supplier_id=s2.id,
        timestamp=now,
        risk_score=50.0,
        contributing_factors={"raw_risk": 43.0},
    )
    sc3 = RiskScore(
        supplier_id=s3.id,
        timestamp=now,
        risk_score=20.0,
        contributing_factors={"raw_risk": 20.0},
    )
    # Add recent event (5 days ago) and old event (25 days ago)
    ev_recent = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        headline="Recent disruption",
        event_type="factory_disruption",
        detected_at=now - timedelta(days=5),
    )
    ev_old = RiskEvent(
        id=uuid.uuid4(),
        region="Europe",
        source="news",
        headline="Old resolved strike",
        event_type="labor",
        detected_at=now - timedelta(days=25),
    )
    db_session.add_all([sc1, sc2, sc3, ev_recent, ev_old])
    db_session.commit()

    summary = get_dashboard_summary(db_session, current_time=now)

    assert summary.total_suppliers == 3
    assert summary.high_risk_supplier_count == 1
    assert summary.medium_risk_supplier_count == 1
    assert summary.low_risk_supplier_count == 1
    assert summary.average_risk == 50.0  # (80 + 50 + 20) / 3 = 50.0
    assert summary.highest_risk_supplier is not None
    assert summary.highest_risk_supplier.name == "Apex High Tech"
    assert summary.highest_risk_supplier.risk_score == 80.0
    assert summary.recent_event_count == 1  # only the 5-day-old event
    assert summary.tier_distribution == {"tier_1": 1, "tier_2": 1, "tier_3": 1}


# ---------------------------------------------------------
# 11. Dashboard Summary Endpoint
# ---------------------------------------------------------
def test_dashboard_summary_endpoint(test_client, db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Global PCB Labs",
        region="East Asia",
        country="South Korea",
        category="PCBs",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    score = RiskScore(
        supplier_id=supplier.id,
        timestamp=datetime.now(timezone.utc),
        risk_score=72.4,
        contributing_factors={"raw_risk": 55.7},
    )
    db_session.add(score)
    db_session.commit()

    # Root route: /dashboard/summary
    res = test_client.get("/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_suppliers"] == 1
    assert data["average_risk"] == 72.4
    assert data["high_risk_supplier_count"] == 1
    assert data["highest_risk_supplier"]["name"] == "Global PCB Labs"

    # Versioned route: /api/v1/dashboard/summary
    res_v1 = test_client.get("/api/v1/dashboard/summary")
    assert res_v1.status_code == 200
    assert res_v1.json()["total_suppliers"] == 1


# ---------------------------------------------------------
# 12. Empty / No-Risk-Event State
# ---------------------------------------------------------
def test_empty_no_risk_event_state(db_session):
    # Empty DB summary
    empty_summary = get_dashboard_summary(db_session)
    assert empty_summary.total_suppliers == 0
    assert empty_summary.average_risk == 0.0
    assert empty_summary.highest_risk_supplier is None
    assert empty_summary.recent_event_count == 0

    # Pipeline on empty DB
    p_news = MockIngestionProvider("gdelt", [])
    p_weather = MockIngestionProvider("open_meteo", [])
    ingest_svc = IngestionService(db=db_session, providers=[p_news, p_weather])

    res = refresh_risk_pipeline(db=db_session, ingestion_service=ingest_svc, log_output=False)
    assert res.success is True
    assert res.suppliers_rescored == 0
    assert res.new_events_inserted == 0
    assert res.average_risk == 0.0
