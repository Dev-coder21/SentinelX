import math
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.database import Base, get_db
from app.main import app
from app.seed import seed_database
from app.models.supplier import Supplier
from app.models.dependency import Dependency
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.models.mitigation_plan import MitigationPlan
from app.schemas.risk_event import RiskEventCreate
from app.ingestion.service import IngestionService
from app.ingestion.base import BaseIngestionProvider
from app.nlp.risk_fusion import compute_event_risk_contribution, calculate_recency_weight
from app.services.refresh import refresh_risk_pipeline, RefreshResult, _refresh_lock

from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ==========================================
# 1. API Input Validation & Pagination Bounds
# ==========================================

def test_suppliers_pagination_limits(client):
    """Test limit and offset bounds on /suppliers endpoint."""
    # Limit exceeds maximum of 200
    res = client.get("/suppliers?limit=250")
    assert res.status_code == 422

    # Limit <= 0
    res = client.get("/suppliers?limit=0")
    assert res.status_code == 422
    res = client.get("/suppliers?limit=-10")
    assert res.status_code == 422

    # Offset exceeds maximum of 10000
    res = client.get("/suppliers?offset=10001")
    assert res.status_code == 422

    # Offset negative
    res = client.get("/suppliers?offset=-1")
    assert res.status_code == 422

    # Normal valid pagination
    res = client.get("/suppliers?limit=10&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) <= 10


def test_suppliers_uuid_validation(client):
    """Test UUID validation on /suppliers/{id}."""
    # Malformed UUID string
    res = client.get("/suppliers/not-a-valid-uuid-string")
    assert res.status_code == 422

    # Syntactically valid UUID that does not exist in DB -> 404
    non_existent_uuid = str(uuid.uuid4())
    res = client.get(f"/suppliers/{non_existent_uuid}")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_risk_events_query_bounds_and_filtering(client):
    """Test limit, offset, and query string bounds on /risk-events."""
    # Limit exceeds 200
    res = client.get("/risk-events?limit=201")
    assert res.status_code == 422

    # Offset exceeds 50000
    res = client.get("/risk-events?offset=50001")
    assert res.status_code == 422

    # Region query too long (>100 chars)
    long_region = "A" * 105
    res = client.get(f"/risk-events?region={long_region}")
    assert res.status_code == 422

    # Source query too long (>50 chars)
    long_source = "B" * 55
    res = client.get(f"/risk-events?source={long_source}")
    assert res.status_code == 422

    # Valid empty or padded filter
    res = client.get("/risk-events?region=  North America  ")
    assert res.status_code == 200


# ==========================================
# 2. Optimization Budget Hardening
# ==========================================

def test_prioritize_budget_bounds_and_rejection(client):
    """Test budget bounds, rejection of negative, NaN, Inf, and excessive values."""
    # Negative budget
    res = client.post("/prioritize", json={"budget": -500.0})
    assert res.status_code == 422

    # Budget exceeding 1 billion
    res = client.post("/prioritize", json={"budget": 2_000_000_000.0})
    assert res.status_code == 422

    # NaN / Inf string in JSON
    res = client.post("/prioritize", json={"budget": "NaN"})
    assert res.status_code == 422
    res = client.post("/prioritize", json={"budget": "Infinity"})
    assert res.status_code == 422

    # Zero budget is valid and handled cleanly
    res = client.post("/prioritize", json={"budget": 0.0})
    assert res.status_code == 200
    data = res.json()
    assert data["optimization_status"] in ["Zero Budget", "Optimal"]
    assert data["total_budget_used"] == 0.0
    assert len(data["selected_suppliers"]) == 0
    assert data["remaining_budget"] == 0.0


# ==========================================
# 3. Security & Settings Hardening
# ==========================================

def test_cors_and_interval_settings_validation():
    """Verify CORS origins parsing and scheduler interval validation."""
    # Comma-delimited string
    s1 = Settings(CORS_ORIGINS="http://localhost:3000,https://app.sentinelx.io")
    assert s1.CORS_ORIGINS == ["http://localhost:3000", "https://app.sentinelx.io"]

    # List of strings
    s2 = Settings(CORS_ORIGINS=["https://app.sentinelx.io"])
    assert s2.CORS_ORIGINS == ["https://app.sentinelx.io"]

    # Whitespace cleanup
    s3 = Settings(CORS_ORIGINS="  http://localhost:3000 ,  http://localhost:5173  ")
    assert s3.CORS_ORIGINS == ["http://localhost:3000", "http://localhost:5173"]

    # Invalid scheduler interval (< 1)
    with pytest.raises(ValidationError):
        Settings(RISK_REFRESH_INTERVAL_MINUTES=0)

    with pytest.raises(ValidationError):
        Settings(RISK_REFRESH_INTERVAL_MINUTES=-5)


# ==========================================
# 4. Risk Fusion Mathematical Safeguards
# ==========================================

def test_risk_fusion_nan_inf_safeguards():
    """Verify risk fusion functions cannot return NaN or Inf or crash on edge values."""
    event = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="weather",
        headline="Test Extreme Weather",
        severity=float("nan"),
        sentiment_score=float("nan"),
        detected_at=datetime.now(timezone.utc),
    )

    # NaN severity/sentiment must be safely sanitized
    contrib = compute_event_risk_contribution(event)
    assert not math.isnan(contrib)
    assert not math.isinf(contrib)
    assert 0.0 <= contrib <= 100.0

    # Inf severity
    event.severity = float("inf")
    event.sentiment_score = -1.0
    contrib_inf = compute_event_risk_contribution(event)
    assert not math.isnan(contrib_inf)
    assert not math.isinf(contrib_inf)
    assert 0.0 <= contrib_inf <= 100.0

    # Distant future timestamp
    future_time = datetime(2099, 1, 1, tzinfo=timezone.utc)
    weight_future = calculate_recency_weight(future_time)
    assert weight_future == 1.0

    # Distant past timestamp
    past_time = datetime(1970, 1, 1, tzinfo=timezone.utc)
    weight_past = calculate_recency_weight(past_time)
    assert 0.0 <= weight_past <= 1.0


# ==========================================
# 5. Ingestion Deduplication Hardening
# ==========================================

def test_intra_batch_deduplication(test_db):
    """Verify that duplicate events within the same batch do not violate uniqueness."""
    fp = f"intra_batch_test_{uuid.uuid4().hex}"
    ev_id = uuid.uuid4()

    event1 = RiskEventCreate(
        region="East Asia",
        source="weather",
        headline="Intra-batch duplicate event",
        summary="Peak storm gusts",
        sentiment_score=0.0,
        event_type="severe_storm",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/test1",
        fingerprint=fp,
    )
    # Duplicate with same fingerprint
    event2 = RiskEventCreate(
        region="East Asia",
        source="weather",
        headline="Intra-batch duplicate event (copy)",
        summary="Peak storm gusts copy",
        sentiment_score=0.0,
        event_type="severe_storm",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/test2",
        fingerprint=fp,
    )

    mock_provider = MagicMock(spec=BaseIngestionProvider)
    mock_provider.name = "mock_intra_provider"
    mock_provider.fetch_events.return_value = [event1, event2]

    service = IngestionService(db=test_db, providers=[mock_provider])
    summary = service.run_ingestion(regions=["East Asia"])

    # Received 2, inserted 1, skipped 1 duplicate
    assert summary.events_received == 2
    assert summary.events_inserted == 1
    assert summary.duplicates_skipped == 1


# ==========================================
# 6. Concurrency & Mutex Safety in Refresh
# ==========================================

def test_refresh_orchestrator_concurrency_guard(test_db):
    """Verify that concurrent refresh attempts are rejected cleanly by mutex."""
    acquired = _refresh_lock.acquire(blocking=False)
    assert acquired is True

    try:
        # Attempt to run another refresh concurrently
        result = refresh_risk_pipeline(db=test_db)
        assert result.success is False
        assert "Concurrent refresh in progress" in result.failure_details
    finally:
        _refresh_lock.release()


# ==========================================
# 7. Production-Safe Centralized Error Handling
# ==========================================

def test_centralized_error_handling_no_leak(client):
    """Verify that unhandled exceptions do not leak stack traces or internal secrets."""
    @app.get("/api/v1/test-error-leak")
    def trigger_error():
        raise RuntimeError("Secret DB connection string: postgresql://admin:supersecret@localhost:5432/prod")

    res = client.get("/api/v1/test-error-leak")
    assert res.status_code == 500
    body = res.json()

    # Client should receive generic, safe message
    assert "internal server error" in body["detail"].lower()
    # Secret must NOT be in the response body
    assert "supersecret" not in res.text
    assert "RuntimeError" not in res.text
    assert "Traceback" not in res.text
