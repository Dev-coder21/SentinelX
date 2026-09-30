import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Supplier, Dependency, RiskEvent, RiskScore, MitigationPlan


def test_models_schema_and_crud():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    try:
        # Create Supplier
        supplier = Supplier(
            name="Apex Precision Microelectronics",
            region="East Asia",
            country="Taiwan",
            category="Semiconductors",
            annual_spend=4500000.0,
            criticality_tier=1,
        )
        db.add(supplier)
        db.commit()
        db.refresh(supplier)

        assert supplier.id is not None
        assert supplier.name == "Apex Precision Microelectronics"

        # Create Dependency
        dep = Dependency(
            company_product="Sentinel Core Controller",
            supplier_id=supplier.id,
            dependency_weight=0.95,
        )
        db.add(dep)
        db.commit()
        db.refresh(dep)

        assert dep.id is not None
        assert dep.supplier_id == supplier.id

        # Create Risk Event
        event = RiskEvent(
            region="East Asia",
            source="news",
            headline="Typhoon warning disrupts shipping lanes in Taiwan Strait",
            summary="Port operations halted temporarily due to high waves.",
            sentiment_score=-0.75,
            event_type="weather",
            raw_url="https://example.com/news/typhoon-warning",
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        assert event.id is not None
        assert event.sentiment_score == -0.75

        # Create Risk Score
        score = RiskScore(
            supplier_id=supplier.id,
            risk_score=78.5,
            contributing_factors={"weather": 0.8, "sentiment": -0.75},
        )
        db.add(score)
        db.commit()
        db.refresh(score)

        assert score.id is not None
        assert score.risk_score == 78.5

        # Create Mitigation Plan
        plan = MitigationPlan(
            budget_constraint=500000.0,
            selected_suppliers=[{"supplier_id": str(supplier.id), "action": "Expedited alternate freight"}],
            expected_revenue_protected=3200000.0,
            optimization_notes="Selected based on highest criticality and revenue risk.",
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        assert plan.id is not None
        assert plan.expected_revenue_protected == 3200000.0
    finally:
        db.close()
