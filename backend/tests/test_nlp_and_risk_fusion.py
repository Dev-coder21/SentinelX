import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.nlp.sentiment import SentimentAnalyzer, SentimentResult
from app.nlp.classification import (
    GeminiClassifier,
    EventClassificationResult,
    fallback_classify,
)
from app.nlp.risk_fusion import (
    fuse_supplier_risk,
    compute_event_risk_contribution,
    calculate_recency_weight,
    CRITICALITY_MULTIPLIERS,
)
from app.nlp.pipeline import NLPRiskPipeline

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


# ---------------------------------------------------------
# 1. Sentiment Normalization
# ---------------------------------------------------------
def test_sentiment_normalization():
    analyzer = SentimentAnalyzer(auto_load_hf=False)
    # Negative disruption text
    res_neg = analyzer.analyze("Severe factory fire causes major supply disruption and plant shutdown")
    assert res_neg.score < 0.0
    assert res_neg.label == "NEGATIVE"
    assert res_neg.risk_contribution > 0.0

    # Positive recovery text
    res_pos = analyzer.analyze("Operations successfully restored and shipping backlog fully resolved")
    assert res_pos.score > 0.0
    assert res_pos.label == "POSITIVE"
    assert res_pos.risk_contribution == 0.0

    # Mocked HuggingFace model pipeline branch
    analyzer._pipeline = MagicMock(return_value=[{"label": "NEGATIVE", "score": 0.88}])
    res_hf = analyzer.analyze("Port workers announce strike")
    assert res_hf.score == -0.88
    assert res_hf.label == "NEGATIVE"
    assert res_hf.risk_contribution == 88.0


# ---------------------------------------------------------
# 2. Model Loading / Reuse Behavior (Singleton)
# ---------------------------------------------------------
def test_model_loading_reuse_behavior():
    a1 = SentimentAnalyzer.get_instance()
    a2 = SentimentAnalyzer.get_instance()
    assert a1 is a2


# ---------------------------------------------------------
# 3. Gemini Structured Response Parsing
# ---------------------------------------------------------
def test_gemini_structured_response_parsing():
    classifier = GeminiClassifier()
    # Mock Gemini client returning valid JSON
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"event_type": "labor", "severity": 72.5, "confidence": 0.95}'
    mock_client.models.generate_content.return_value = mock_response

    classifier._client = mock_client
    res = classifier.classify("Port workers vote to strike", source="news")

    assert res.event_type == "labor"
    assert res.severity == 72.5
    assert res.confidence == 0.95
    assert res.classification_source == "gemini"


# ---------------------------------------------------------
# 4. Gemini Malformed Response -> Fallback
# ---------------------------------------------------------
def test_gemini_malformed_response():
    classifier = GeminiClassifier()
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "I cannot output JSON today. This is a severe storm."
    mock_client.models.generate_content.return_value = mock_response

    classifier._client = mock_client
    res = classifier.classify("Severe storm and typhoon hits coastal shipping docks", source="news")

    assert res.classification_source == "fallback"
    assert res.event_type == "weather"
    assert res.severity > 0.0


# ---------------------------------------------------------
# 5. Gemini Failure -> Fallback
# ---------------------------------------------------------
def test_gemini_failure():
    classifier = GeminiClassifier()
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("Quota exceeded 429")

    classifier._client = mock_client
    res = classifier.classify("Factory shutdown halts chip assembly", source="news")

    assert res.classification_source == "fallback"
    assert res.event_type == "factory_disruption"


# ---------------------------------------------------------
# 6. Deterministic Fallback Classification
# ---------------------------------------------------------
def test_deterministic_fallback_classification():
    cases = [
        ("Workers union declares indefinite strike at terminal", "labor"),
        ("Container shipping vessel stuck blocking canal port", "logistics"),
        ("Category 4 typhoon causes massive coastal flood", "weather"),
        ("Severe silicon wafer shortage disrupts allocation", "supply_shortage"),
        ("Chemical plant explosion forces factory closure", "factory_disruption"),
        ("Government imposes strict tech export sanctions and tariffs", "geopolitical"),
        ("Company hosts annual shareholder general meeting", "other"),
    ]
    for text, expected_type in cases:
        result = fallback_classify(text)
        assert result.event_type == expected_type
        assert result.classification_source == "fallback"
        assert 0.0 <= result.severity <= 100.0


# ---------------------------------------------------------
# 7. Event Severity Calculation
# ---------------------------------------------------------
def test_event_severity_calculation():
    # Mild negative event
    mild_event = RiskEvent(
        region="East Asia",
        source="news",
        headline="Minor logistical delay",
        sentiment_score=-0.2,
        severity=40.0,
    )
    # Severe negative event
    severe_event = RiskEvent(
        region="East Asia",
        source="news",
        headline="Catastrophic factory fire destroys cleanroom",
        sentiment_score=-0.95,
        severity=85.0,
    )

    mild_risk = compute_event_risk_contribution(mild_event)
    severe_risk = compute_event_risk_contribution(severe_event)

    assert severe_risk > mild_risk
    assert 0.0 <= mild_risk <= 100.0
    assert 0.0 <= severe_risk <= 100.0


# ---------------------------------------------------------
# 8. Supplier-Region Association
# ---------------------------------------------------------
def test_supplier_region_association():
    supplier_asia = Supplier(
        id=uuid.uuid4(),
        name="Asia Precision Foundry",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        criticality_tier=1,
    )
    supplier_europe = Supplier(
        id=uuid.uuid4(),
        name="Euro Sensor Tech",
        region="Europe",
        country="Germany",
        category="Sensors",
        criticality_tier=2,
    )

    event_asia = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        headline="Taiwan typhoon halts port",
        sentiment_score=-0.8,
        severity=75.0,
        detected_at=datetime.now(timezone.utc),
    )

    eval_asia = fuse_supplier_risk(supplier_asia, [event_asia])
    eval_europe = fuse_supplier_risk(supplier_europe, [event_asia])

    assert eval_asia.risk_score > 0.0
    assert eval_europe.risk_score == 0.0  # Unaffected by unrelated region event
    assert eval_europe.contributing_factors["event_count"] == 0


# ---------------------------------------------------------
# 9. Risk Fusion Formula
# ---------------------------------------------------------
def test_risk_fusion_formula():
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Apex Foundry",
        region="North America",
        country="United States",
        category="Semiconductors",
        criticality_tier=2,  # Multiplier 1.10
    )
    event = RiskEvent(
        id=uuid.uuid4(),
        region="North America",
        source="news",
        headline="Silicon Valley power grid failure shuts factory",
        sentiment_score=-0.8,
        severity=80.0,
        detected_at=datetime.now(timezone.utc),
    )

    res = fuse_supplier_risk(supplier, [event])
    assert res.risk_score > 0.0
    assert res.contributing_factors["criticality_multiplier"] == 1.10
    assert res.contributing_factors["event_count"] == 1


# ---------------------------------------------------------
# 10. Criticality Influence
# ---------------------------------------------------------
def test_criticality_influence():
    s_tier1 = Supplier(
        id=uuid.uuid4(),
        name="Critical Supplier",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        criticality_tier=1,  # Multiplier 1.30
    )
    s_tier3 = Supplier(
        id=uuid.uuid4(),
        name="Commodity Supplier",
        region="East Asia",
        country="Taiwan",
        category="Packaging",
        criticality_tier=3,  # Multiplier 0.90
    )

    event = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        headline="Regional port congestion",
        sentiment_score=-0.5,
        severity=60.0,
        detected_at=datetime.now(timezone.utc),
    )

    # 1. Under active risk signal, Tier 1 is amplified more than Tier 3
    res1 = fuse_supplier_risk(s_tier1, [event])
    res3 = fuse_supplier_risk(s_tier3, [event])
    assert res1.risk_score > res3.risk_score

    # 2. Under ZERO risk signal, both MUST BE 0.0 (criticality cannot invent risk)
    res1_zero = fuse_supplier_risk(s_tier1, [])
    res3_zero = fuse_supplier_risk(s_tier3, [])
    assert res1_zero.risk_score == 0.0
    assert res3_zero.risk_score == 0.0


# ---------------------------------------------------------
# 11. Multiple-Event Aggregation (Diminishing Returns)
# ---------------------------------------------------------
def test_multiple_event_aggregation():
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Test Assembly",
        region="Southeast Asia",
        country="Vietnam",
        category="Batteries",
        criticality_tier=2,
    )
    now = datetime.now(timezone.utc)
    single_event = [
        RiskEvent(
            id=uuid.uuid4(),
            region="Southeast Asia",
            source="news",
            headline="Battery raw material cost spike",
            sentiment_score=-0.5,
            severity=50.0,
            detected_at=now,
        )
    ]
    three_events = single_event + [
        RiskEvent(
            id=uuid.uuid4(),
            region="Southeast Asia",
            source="news",
            headline="Factory labor walkout",
            sentiment_score=-0.6,
            severity=60.0,
            detected_at=now,
        ),
        RiskEvent(
            id=uuid.uuid4(),
            region="Southeast Asia",
            source="weather",
            headline="Heavy flooding in industrial zone",
            sentiment_score=0.0,
            severity=70.0,
            detected_at=now,
        ),
    ]

    res_single = fuse_supplier_risk(supplier, single_event)
    res_triple = fuse_supplier_risk(supplier, three_events)

    # Multi-event risk is higher than single event, but exhibits sublinear saturation
    assert res_triple.risk_score > res_single.risk_score
    # Tripling the events does NOT triple the risk score
    assert res_triple.risk_score < (res_single.risk_score * 3.0)


# ---------------------------------------------------------
# 12. Recency Weighting
# ---------------------------------------------------------
def test_recency_weighting():
    now = datetime.now(timezone.utc)
    fresh_date = now - timedelta(hours=2)
    stale_date = now - timedelta(days=35)

    w_fresh = calculate_recency_weight(fresh_date, current_date=now)
    w_stale = calculate_recency_weight(stale_date, current_date=now)

    assert w_fresh > w_stale
    assert w_fresh >= 0.95
    assert w_stale <= 0.25


# ---------------------------------------------------------
# 13. Duplicate Classification Avoidance
# ---------------------------------------------------------
def test_duplicate_classification_avoidance(db_session):
    # Insert event that already has classification_source
    already_processed = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        headline="Old processed event",
        sentiment_score=-0.5,
        severity=60.0,
        confidence=0.9,
        classification_source="gemini",
        detected_at=datetime.now(timezone.utc),
    )
    db_session.add(already_processed)
    db_session.commit()

    mock_classifier = MagicMock()
    pipeline = NLPRiskPipeline(db=db_session, classifier=mock_classifier)
    analyzed, gemini, fallback = pipeline.process_unclassified_events()

    assert analyzed == 0
    assert gemini == 0
    assert mock_classifier.classify.call_count == 0


# ---------------------------------------------------------
# 14. Risk Score Persistence
# ---------------------------------------------------------
def test_risk_score_persistence(db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Pacific Foundry",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        criticality_tier=1,
    )
    event = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        headline="Typhoon warning halts freight shipping",
        sentiment_score=-0.7,
        severity=70.0,
        classification_source="fallback",
        detected_at=datetime.now(timezone.utc),
    )
    db_session.add_all([supplier, event])
    db_session.commit()

    pipeline = NLPRiskPipeline(db=db_session)
    scores = pipeline.calculate_supplier_risks()

    assert len(scores) == 1
    saved_score = db_session.query(RiskScore).filter(RiskScore.supplier_id == supplier.id).first()
    assert saved_score is not None
    assert saved_score.risk_score > 0.0
    assert saved_score.contributing_factors is not None
    assert saved_score.contributing_factors["event_count"] == 1


# ---------------------------------------------------------
# 15. Risk Score Remains Between 0 and 100
# ---------------------------------------------------------
def test_risk_score_bounded_0_to_100():
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Apex Max Tier 1",
        region="East Asia",
        country="Taiwan",
        category="Semiconductors",
        criticality_tier=1,
    )
    now = datetime.now(timezone.utc)
    # Flood of 20 catastrophic events
    events = [
        RiskEvent(
            id=uuid.uuid4(),
            region="East Asia",
            source="news",
            headline=f"Catastrophic event {i}",
            sentiment_score=-1.0,
            severity=100.0,
            detected_at=now,
        )
        for i in range(20)
    ]

    res = fuse_supplier_risk(supplier, events, current_time=now)
    assert 0.0 <= res.risk_score <= 100.0


# ---------------------------------------------------------
# 16. Supplier API Exposes Current Risk
# ---------------------------------------------------------
def test_supplier_api_exposes_current_risk(test_client, db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Kyoto Opto Display",
        region="East Asia",
        country="Japan",
        category="Displays",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    score = RiskScore(
        supplier_id=supplier.id,
        timestamp=datetime.now(timezone.utc),
        risk_score=74.2,
        contributing_factors={"event_count": 2, "news_risk": 70.0},
    )
    db_session.add(score)
    db_session.commit()

    res = test_client.get("/suppliers")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["current_risk_score"] == 74.2
    assert data[0]["risk_level"] == "HIGH"


# ---------------------------------------------------------
# 17. Supplier Detail Exposes History and Trend
# ---------------------------------------------------------
def test_supplier_detail_exposes_history(test_client, db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Seoul Storage Solutions",
        region="East Asia",
        country="South Korea",
        category="Memory / storage",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    s1 = RiskScore(
        supplier_id=supplier.id,
        timestamp=datetime(2026, 9, 20, 12, 0, tzinfo=timezone.utc),
        risk_score=40.0,
        contributing_factors={"raw_risk": 30.0},
    )
    s2 = RiskScore(
        supplier_id=supplier.id,
        timestamp=datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc),
        risk_score=68.5,
        contributing_factors={"raw_risk": 55.0},
    )
    db_session.add_all([s1, s2])
    db_session.commit()

    res = test_client.get(f"/suppliers/{supplier.id}")
    assert res.status_code == 200
    detail = res.json()

    assert detail["current_risk_score"] == 68.5
    assert detail["previous_risk_score"] == 40.0
    assert detail["risk_trend"] == "increasing"
    assert len(detail["risk_history"]) == 2
    # Newest first in history
    assert detail["risk_history"][0]["risk_score"] == 68.5


# ---------------------------------------------------------
# 18. Supplier Detail Exposes Contributing Factors
# ---------------------------------------------------------
def test_supplier_detail_exposes_contributing_factors(test_client, db_session):
    supplier = Supplier(
        id=uuid.uuid4(),
        name="Hanwa Microelectronics",
        region="East Asia",
        country="South Korea",
        category="Memory / storage",
        criticality_tier=1,
    )
    db_session.add(supplier)
    db_session.commit()

    score = RiskScore(
        supplier_id=supplier.id,
        timestamp=datetime.now(timezone.utc),
        risk_score=55.0,
        contributing_factors={
            "raw_risk": 42.3,
            "criticality_multiplier": 1.3,
            "news_risk": 45.0,
            "weather_risk": 0.0,
            "event_count": 1,
            "top_events": [{"headline": "Memory shortage alert"}],
        },
    )
    db_session.add(score)
    db_session.commit()

    res = test_client.get(f"/suppliers/{supplier.id}")
    assert res.status_code == 200
    detail = res.json()

    assert detail["contributing_factors"] is not None
    assert detail["contributing_factors"]["raw_risk"] == 42.3
    assert detail["contributing_factors"]["event_count"] == 1


# ---------------------------------------------------------
# 19. Pipeline Handles One Bad Event Without Crashing
# ---------------------------------------------------------
def test_pipeline_handles_bad_event_without_crashing(db_session):
    bad_event = RiskEvent(
        id=uuid.uuid4(),
        region="East Asia",
        source="news",
        headline="Faulty Event",
        summary="Malformed text",
        detected_at=datetime.now(timezone.utc),
    )
    db_session.add(bad_event)
    db_session.commit()

    # Mock classifier raising unexpected exception
    mock_classifier = MagicMock()
    mock_classifier.classify.side_effect = Exception("Unexpected parser explosion")

    pipeline = NLPRiskPipeline(db=db_session, classifier=mock_classifier)
    analyzed, gemini, fallback = pipeline.process_unclassified_events()

    assert analyzed == 1
    # Safe fallback applied
    refreshed = db_session.query(RiskEvent).filter(RiskEvent.id == bad_event.id).first()
    assert refreshed.classification_source == "fallback"
    assert refreshed.severity == 50.0
