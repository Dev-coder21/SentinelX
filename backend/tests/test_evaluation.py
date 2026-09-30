import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.nlp.risk_fusion import (
    CRITICALITY_MULTIPLIERS,
    calculate_recency_weight,
    compute_event_risk_contribution,
    fuse_supplier_risk,
)
from app.models.risk_event import RiskEvent
from app.models.supplier import Supplier
from evaluation.backtest import (
    load_historical_cases,
    run_historical_backtest,
    get_evaluation_suppliers,
)
from evaluation.schemas import HistoricalCaseSchema, CaseEventSchema


def test_historical_case_fixtures_valid():
    """Verify that all committed historical case fixtures match schema and have valid dates."""
    cases = load_historical_cases()
    assert len(cases) >= 4

    case_ids = [c.case_id for c in cases]
    assert "case_suez_2021" in case_ids
    assert "case_red_sea_2024" in case_ids
    assert "case_typhoon_gaemi_2024" in case_ids
    assert "case_us_ila_strike_2024" in case_ids

    for case in cases:
        assert case.name
        assert case.affected_region in ["Europe", "East Asia", "North America", "Southeast Asia"]
        assert len(case.source_urls) >= 1
        assert len(case.events) >= 1
        assert "baseline" in case.windows
        assert "peak" in case.windows
        assert "post_event" in case.windows

        # Verify chronology
        assert case.windows["baseline"] < case.windows["peak"]
        assert case.windows["peak"] < case.windows["post_event"]


def test_recency_decay_conforms_to_14_day_half_life():
    """Verify that calculate_recency_weight decays by ~50% every 14 days."""
    t0 = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    w0 = calculate_recency_weight(t0, current_date=t0)
    assert w0 == 1.0

    t14 = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    w14 = calculate_recency_weight(t0, current_date=t14)
    # Theoretical value is exp(-0.04951 * 14) = 0.50
    assert abs(w14 - 0.50) < 0.01

    t28 = datetime(2024, 1, 29, 12, 0, 0, tzinfo=timezone.utc)
    w28 = calculate_recency_weight(t0, current_date=t28)
    # Theoretical value is 0.25
    assert abs(w28 - 0.25) < 0.01


def test_criticality_amplification_multipliers():
    """Verify that criticality multipliers amplify exposure without generating risk from void."""
    evt = RiskEvent(
        region="Europe",
        source="news",
        headline="Major logistics disruption",
        event_type="logistics",
        severity=70.0,
        sentiment_score=-0.5,
        detected_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    t_eval = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    s1 = Supplier(name="T1 Supp", region="Europe", criticality_tier=1, annual_spend=1e6)
    s2 = Supplier(name="T2 Supp", region="Europe", criticality_tier=2, annual_spend=1e6)
    s3 = Supplier(name="T3 Supp", region="Europe", criticality_tier=3, annual_spend=1e6)

    res1 = fuse_supplier_risk(s1, [evt], current_time=t_eval)
    res2 = fuse_supplier_risk(s2, [evt], current_time=t_eval)
    res3 = fuse_supplier_risk(s3, [evt], current_time=t_eval)

    # Tier 1 > Tier 2 > Tier 3
    assert res1.risk_score > res2.risk_score > res3.risk_score
    # Raw risk is identical
    raw = res1.contributing_factors["raw_risk"]
    assert res2.contributing_factors["raw_risk"] == raw
    assert res3.contributing_factors["raw_risk"] == raw

    # Zero risk scenario
    res_zero = fuse_supplier_risk(s1, [], current_time=t_eval)
    assert res_zero.risk_score == 0.0


def test_multi_event_diminishing_returns():
    """Verify that multiple concurrent events compound with diminishing returns."""
    t0 = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    evt1 = RiskEvent(
        region="Europe",
        source="news",
        headline="Chokepoint blocked",
        event_type="logistics",
        severity=80.0,
        sentiment_score=-0.7,
        detected_at=t0,
    )
    evt2 = RiskEvent(
        region="Europe",
        source="news",
        headline="Port strike declared",
        event_type="labor",
        severity=75.0,
        sentiment_score=-0.6,
        detected_at=t0,
    )

    s = Supplier(name="Test Supp", region="Europe", criticality_tier=2, annual_spend=1e6)

    res_single = fuse_supplier_risk(s, [evt1], current_time=t0)
    res_multi = fuse_supplier_risk(s, [evt1, evt2], current_time=t0)

    # Multi-event risk must be higher than single event
    assert res_multi.risk_score > res_single.risk_score
    # But strictly bounded by 100
    assert res_multi.risk_score <= 100.0


def test_geographic_isolation():
    """Verify that unaffected regions remain at 0.0 risk."""
    evt_europe = RiskEvent(
        region="Europe",
        source="news",
        headline="European port disruption",
        event_type="logistics",
        severity=90.0,
        detected_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )

    s_east_asia = Supplier(name="Asia Supp", region="East Asia", criticality_tier=1, annual_spend=1e6)
    res = fuse_supplier_risk(s_east_asia, [evt_europe], current_time=datetime(2024, 1, 1, tzinfo=timezone.utc))

    assert res.risk_score == 0.0
    assert res.contributing_factors["event_count"] == 0


def test_run_historical_backtest_deterministic(tmp_path):
    """Verify that run_historical_backtest produces complete, deterministic output files."""
    records, summaries = run_historical_backtest(output_dir=tmp_path)

    assert len(records) > 0
    assert len(summaries) >= 4

    json_path = tmp_path / "historical_validation_results.json"
    csv_path = tmp_path / "historical_validation_summary.csv"

    assert json_path.exists()
    assert csv_path.exists()

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        assert "metadata" in data
        assert "cases" in data
        assert "summaries" in data
        assert "detailed_records" in data
