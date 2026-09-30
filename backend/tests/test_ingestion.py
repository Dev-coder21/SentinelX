import time
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.risk_event import RiskEvent
from app.schemas.risk_event import RiskEventCreate
from app.ingestion.base import ReliableHttpClient, ProviderUnavailableError
from app.ingestion.cache import IngestionCache
from app.ingestion.gdelt import GDELTProvider
from app.ingestion.open_meteo import OpenMeteoProvider
from app.ingestion.service import IngestionService

# Shared in-memory SQLite engine using StaticPool so all threads share the exact same DB
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


# ---------------------------------------------------------
# 1. GDELT Response Normalization
# ---------------------------------------------------------
def test_gdelt_response_normalization():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.text = '{"articles": [{"title": "Port of Kaohsiung cargo backlog cleared", "url": "https://news.example.com/port1", "seendate": "20260928T120000Z", "domain": "reuters.com", "sourcecountry": "Taiwan"}]}'
    mock_response.json.return_value = {
        "articles": [
            {
                "title": "Port of Kaohsiung cargo backlog cleared",
                "url": "https://news.example.com/port1",
                "seendate": "20260928T120000Z",
                "domain": "reuters.com",
                "sourcecountry": "Taiwan",
            }
        ]
    }

    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.return_value = mock_response

    provider = GDELTProvider(http_client=mock_client, cache=IngestionCache())
    events = provider.fetch_events("East Asia")

    assert len(events) == 1
    event = events[0]
    assert event.region == "East Asia"
    assert event.source == "news"
    assert "Port of Kaohsiung" in event.headline
    assert event.raw_url == "https://news.example.com/port1"
    assert event.event_type == "news_disruption"
    assert event.fingerprint is not None
    assert len(event.fingerprint) == 64


# ---------------------------------------------------------
# 2. GDELT Empty Response
# ---------------------------------------------------------
def test_gdelt_empty_response():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.text = '{"articles": []}'
    mock_response.json.return_value = {"articles": []}

    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.return_value = mock_response

    provider = GDELTProvider(http_client=mock_client, cache=IngestionCache())
    events = provider.fetch_events("North America")

    assert events == []


# ---------------------------------------------------------
# 3. GDELT Provider Failure
# ---------------------------------------------------------
def test_gdelt_provider_failure():
    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.side_effect = ProviderUnavailableError("Connection timed out after 3 retries")

    provider = GDELTProvider(http_client=mock_client, cache=IngestionCache())
    with pytest.raises(ProviderUnavailableError):
        provider.fetch_events("Europe")


# ---------------------------------------------------------
# 4. Open-Meteo Response Normalization
# ---------------------------------------------------------
def test_open_meteo_response_normalization():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "current": {
            "temperature_2m": 24.5,
            "relative_humidity_2m": 88,
            "precipitation": 25.0,  # Extreme rain
            "weather_code": 95,     # Thunderstorm
            "wind_speed_10m": 45.0,
            "wind_gusts_10m": 82.0, # Gale winds
        }
    }

    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.return_value = mock_response

    provider = OpenMeteoProvider(http_client=mock_client, cache=IngestionCache())
    events = provider.fetch_events("East Asia")

    assert len(events) >= 1
    types = [e.event_type for e in events]
    assert "severe_storm" in types or "gale_winds" in types or "extreme_precipitation" in types

    sample = events[0]
    assert sample.source == "weather"
    assert sample.region == "East Asia"
    assert sample.fingerprint is not None


# ---------------------------------------------------------
# 5. Open-Meteo Non-Risk Weather Conditions -> No Risk Events
# ---------------------------------------------------------
def test_open_meteo_non_risk_weather_conditions():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    # Normal pleasant weather
    mock_response.json.return_value = {
        "current": {
            "temperature_2m": 22.0,
            "relative_humidity_2m": 50,
            "precipitation": 0.0,
            "weather_code": 1,  # Mainly clear
            "wind_speed_10m": 12.0,
            "wind_gusts_10m": 18.0,
        }
    }

    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.return_value = mock_response

    provider = OpenMeteoProvider(http_client=mock_client, cache=IngestionCache())
    events = provider.fetch_events("Europe")

    # Ordinary weather must NOT generate risk events
    assert events == []


# ---------------------------------------------------------
# 6. Open-Meteo Provider Failure
# ---------------------------------------------------------
def test_open_meteo_provider_failure():
    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.side_effect = ProviderUnavailableError("HTTP 503 Service Unavailable")

    provider = OpenMeteoProvider(http_client=mock_client, cache=IngestionCache())
    with pytest.raises(ProviderUnavailableError):
        provider.fetch_events("Southeast Asia")


# ---------------------------------------------------------
# 7. ReliableHttpClient Retry Behavior
# ---------------------------------------------------------
def test_reliable_http_client_retry_behavior():
    mock_inner_client = MagicMock()
    # Fail twice with connect timeout, then succeed
    mock_success = MagicMock(spec=httpx.Response)
    mock_success.status_code = 200

    mock_inner_client.get.side_effect = [
        httpx.ConnectTimeout("Connect timeout"),
        httpx.ReadTimeout("Read timeout"),
        mock_success,
    ]

    reliable_client = ReliableHttpClient(
        client=mock_inner_client,
        max_retries=3,
        base_delay=0.01,  # Fast delay for test
    )

    resp = reliable_client.get("https://api.example.com/test")
    assert resp.status_code == 200
    assert mock_inner_client.get.call_count == 3


# ---------------------------------------------------------
# 8. Cache Hit
# ---------------------------------------------------------
def test_cache_hit():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.text = '{"articles": [{"title": "Cached headline", "url": "https://news.example.com/c1"}]}'
    mock_response.json.return_value = {
        "articles": [{"title": "Cached headline", "url": "https://news.example.com/c1"}]
    }

    mock_client = MagicMock(spec=ReliableHttpClient)
    mock_client.get.return_value = mock_response

    shared_cache = IngestionCache(default_ttl_seconds=60)
    provider = GDELTProvider(http_client=mock_client, cache=shared_cache)

    # First call: cache miss
    first_events = provider.fetch_events("East Asia")
    assert len(first_events) == 1
    assert mock_client.get.call_count == 1

    # Second call: cache hit, no HTTP call
    second_events = provider.fetch_events("East Asia")
    assert len(second_events) == 1
    assert mock_client.get.call_count == 1  # Unchanged


# ---------------------------------------------------------
# 9. Cache Expiration
# ---------------------------------------------------------
def test_cache_expiration():
    cache = IngestionCache(default_ttl_seconds=1)
    cache.set("key1", "sample_val", ttl_seconds=0.05)

    assert cache.get("key1") == "sample_val"
    time.sleep(0.08)
    assert cache.get("key1") is None


# ---------------------------------------------------------
# 10. Database Duplicate Event Prevention
# ---------------------------------------------------------
def test_duplicate_event_prevention(db_session):
    event_fingerprint = "weather:East Asia:severe_storm:2026-09-30-14"
    existing = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="weather",
        headline="Typhoon winds warning",
        summary="Peak gusts",
        sentiment_score=0.0,
        event_type="severe_storm",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/w1",
        fingerprint=event_fingerprint,
    )
    db_session.add(existing)
    db_session.commit()

    # Create mock provider returning identical event
    mock_provider = MagicMock(spec=OpenMeteoProvider)
    mock_provider.name = "mock_weather"
    mock_provider.fetch_events.return_value = [
        RiskEventCreate(
            region="East Asia",
            source="weather",
            headline="Typhoon winds warning",
            summary="Peak gusts",
            sentiment_score=0.0,
            event_type="severe_storm",
            detected_at=datetime.now(timezone.utc),
            raw_url="https://example.com/w1",
            fingerprint=event_fingerprint,
        )
    ]

    service = IngestionService(db=db_session, providers=[mock_provider])
    summary = service.run_ingestion(regions=["East Asia"])

    assert summary.events_received == 1
    assert summary.duplicates_skipped == 1
    assert summary.events_inserted == 0

    # Ensure total in DB is still 1
    assert db_session.query(RiskEvent).count() == 1


# ---------------------------------------------------------
# 11. Successful Combined Ingestion (News + Weather)
# ---------------------------------------------------------
def test_successful_combined_ingestion(db_session):
    mock_gdelt = MagicMock(spec=GDELTProvider)
    mock_gdelt.name = "gdelt"
    mock_gdelt.fetch_events.return_value = [
        RiskEventCreate(
            region="East Asia",
            source="news",
            headline="Taiwan port strike averted after talks",
            summary="Logistics update",
            sentiment_score=0.0,
            event_type="news_disruption",
            detected_at=datetime.now(timezone.utc),
            raw_url="https://news.example.com/a1",
            fingerprint="fp_news_1",
        )
    ]

    mock_weather = MagicMock(spec=OpenMeteoProvider)
    mock_weather.name = "open_meteo"
    mock_weather.fetch_events.return_value = [
        RiskEventCreate(
            region="East Asia",
            source="weather",
            headline="Gale winds warning for Taipei hub",
            summary="Wind gusts 80km/h",
            sentiment_score=0.0,
            event_type="gale_winds",
            detected_at=datetime.now(timezone.utc),
            raw_url="https://weather.example.com/w1",
            fingerprint="fp_weather_1",
        )
    ]

    service = IngestionService(db=db_session, providers=[mock_gdelt, mock_weather])
    summary = service.run_ingestion(regions=["East Asia"])

    assert summary.events_received == 2
    assert summary.events_inserted == 2
    assert summary.duplicates_skipped == 0
    assert summary.provider_failures == 0
    assert db_session.query(RiskEvent).count() == 2


# ---------------------------------------------------------
# 12. Error Isolation (One Provider Fails, Other Succeeds)
# ---------------------------------------------------------
def test_one_provider_failure_isolation(db_session):
    mock_gdelt = MagicMock(spec=GDELTProvider)
    mock_gdelt.name = "gdelt"
    mock_gdelt.fetch_events.side_effect = ProviderUnavailableError("GDELT 503 error")

    mock_weather = MagicMock(spec=OpenMeteoProvider)
    mock_weather.name = "open_meteo"
    mock_weather.fetch_events.return_value = [
        RiskEventCreate(
            region="Europe",
            source="weather",
            headline="Bavaria severe thunderstorm warning",
            summary="Hail storm",
            sentiment_score=0.0,
            event_type="severe_storm",
            detected_at=datetime.now(timezone.utc),
            raw_url="https://weather.example.com/eur1",
            fingerprint="fp_weather_eur",
        )
    ]

    service = IngestionService(db=db_session, providers=[mock_gdelt, mock_weather])
    summary = service.run_ingestion(regions=["Europe"])

    assert summary.provider_failures == 1
    assert summary.events_inserted == 1
    assert db_session.query(RiskEvent).count() == 1


# ---------------------------------------------------------
# 13. GET /risk-events Endpoint
# ---------------------------------------------------------
def test_get_risk_events_endpoint(test_client, db_session):
    e1 = RiskEvent(
        region="East Asia",
        source="news",
        headline="Semiconductor fab power outage reported",
        summary="Factory impacted",
        sentiment_score=0.0,
        event_type="factory_shutdown",
        detected_at=datetime(2026, 9, 29, 10, 0, tzinfo=timezone.utc),
        raw_url="https://example.com/e1",
        fingerprint="fp1",
    )
    e2 = RiskEvent(
        region="Southeast Asia",
        source="weather",
        headline="Tropical depression offshore Vietnam",
        summary="Shipping warning",
        sentiment_score=0.0,
        event_type="severe_storm",
        detected_at=datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc),
        raw_url="https://example.com/e2",
        fingerprint="fp2",
    )
    db_session.add_all([e1, e2])
    db_session.commit()

    res = test_client.get("/risk-events")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    # Verify newest-first ordering
    assert data[0]["headline"] == "Tropical depression offshore Vietnam"
    assert data[1]["headline"] == "Semiconductor fab power outage reported"


# ---------------------------------------------------------
# 14. Region Filtering
# ---------------------------------------------------------
def test_risk_events_region_filtering(test_client, db_session):
    e1 = RiskEvent(
        region="East Asia",
        source="news",
        headline="Taiwan component factory fire",
        summary="Minor fire",
        sentiment_score=0.0,
        event_type="factory_incident",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/r1",
        fingerprint="fp_r1",
    )
    e2 = RiskEvent(
        region="Europe",
        source="news",
        headline="Rotterdam dock strike begins",
        summary="Labor dispute",
        sentiment_score=0.0,
        event_type="labor_strike",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/r2",
        fingerprint="fp_r2",
    )
    db_session.add_all([e1, e2])
    db_session.commit()

    res = test_client.get("/risk-events?region=East Asia")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["region"] == "East Asia"


# ---------------------------------------------------------
# 15. Source Filtering
# ---------------------------------------------------------
def test_risk_events_source_filtering(test_client, db_session):
    e1 = RiskEvent(
        region="North America",
        source="news",
        headline="Port of LA truck queue delay",
        summary="Logistics bottleneck",
        sentiment_score=0.0,
        event_type="logistics_delay",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/s1",
        fingerprint="fp_s1",
    )
    e2 = RiskEvent(
        region="North America",
        source="weather",
        headline="Heatwave warning in Texas grid",
        summary="43C heatwave",
        sentiment_score=0.0,
        event_type="extreme_heat",
        detected_at=datetime.now(timezone.utc),
        raw_url="https://example.com/s2",
        fingerprint="fp_s2",
    )
    db_session.add_all([e1, e2])
    db_session.commit()

    res = test_client.get("/risk-events?source=weather")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["source"] == "weather"
    assert data[0]["headline"] == "Heatwave warning in Texas grid"


# ---------------------------------------------------------
# 16. Pagination
# ---------------------------------------------------------
def test_risk_events_pagination(test_client, db_session):
    for i in range(5):
        event = RiskEvent(
            region="East Asia",
            source="news",
            headline=f"Test Event {i}",
            summary="Summary",
            sentiment_score=0.0,
            event_type="news_disruption",
            detected_at=datetime(2026, 9, 20 + i, 12, 0, tzinfo=timezone.utc),
            raw_url=f"https://example.com/item{i}",
            fingerprint=f"fp_page_{i}",
        )
        db_session.add(event)
    db_session.commit()

    # Page 1: 2 items
    p1 = test_client.get("/risk-events?limit=2&offset=0").json()
    assert len(p1) == 2
    # Page 2: 2 items
    p2 = test_client.get("/risk-events?limit=2&offset=2").json()
    assert len(p2) == 2
    # Page 3: 1 item
    p3 = test_client.get("/risk-events?limit=2&offset=4").json()
    assert len(p3) == 1

    ids_p1 = {x["id"] for x in p1}
    ids_p2 = {x["id"] for x in p2}
    ids_p3 = {x["id"] for x in p3}
    assert ids_p1.isdisjoint(ids_p2)
    assert ids_p2.isdisjoint(ids_p3)
