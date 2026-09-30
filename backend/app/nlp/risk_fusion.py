import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent


# Criticality exposure amplification multipliers
CRITICALITY_MULTIPLIERS = {
    1: 1.30,  # Tier 1: Single-source, high spend -> amplifies risk exposure by 30%
    2: 1.10,  # Tier 2: Major component supplier -> amplifies risk exposure by 10%
    3: 0.90,  # Tier 3: Standard commodity/packaging -> 10% lower exposure
}

# Half-life for recency decay in days (14 days = 0.05 decay constant)
RECENCY_DECAY_LAMBDA = math.log(2) / 14.0  # ~0.0495


@dataclass
class SupplierRiskEvaluation:
    supplier_id: Any
    supplier_name: str
    risk_score: float  # Final score 0.0 to 100.0
    contributing_factors: Dict[str, Any]


def calculate_recency_weight(event_date: Optional[datetime], current_date: Optional[datetime] = None) -> float:
    """
    Computes an exponential decay weight in [0.1, 1.0] based on event age in days.
    Recent events carry full weight; older events decay with a 14-day half-life.
    """
    if event_date is None:
        return 0.50

    now = current_date or datetime.now(timezone.utc)
    # Ensure timezone awareness
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    delta_days = max(0.0, (now - event_date).total_seconds() / 86400.0)
    if math.isnan(delta_days) or math.isinf(delta_days):
        return 0.50
    weight = math.exp(-RECENCY_DECAY_LAMBDA * delta_days)
    return max(0.10, min(1.0, weight))


def compute_event_risk_contribution(event: RiskEvent) -> float:
    """
    Computes single-event base risk in [0, 100] blending classified severity and sentiment.
    """
    base_severity = event.severity if event.severity is not None else 50.0
    if not isinstance(base_severity, (int, float)) or math.isnan(base_severity) or math.isinf(base_severity):
        base_severity = 50.0

    if event.source == "weather":
        return max(0.0, min(100.0, float(base_severity)))

    # For news, negative sentiment amplifies disruption severity
    # sentiment_score is in [-1.0, +1.0]
    sentiment_score = event.sentiment_score if event.sentiment_score is not None else 0.0
    if not isinstance(sentiment_score, (int, float)) or math.isnan(sentiment_score) or math.isinf(sentiment_score):
        sentiment_score = 0.0

    sentiment_risk = max(0.0, -float(sentiment_score) * 100.0)
    blended = 0.65 * float(base_severity) + 0.35 * sentiment_risk
    return max(0.0, min(100.0, blended))


def fuse_supplier_risk(
    supplier: Supplier,
    events: List[RiskEvent],
    current_time: Optional[datetime] = None,
) -> SupplierRiskEvaluation:
    """
    Fuses external risk events into an explainable 0–100 supplier risk score.

    Mathematical Formulation:
    1. Filter: Events matched by supplier geographic region (supplier.region == event.region).
    2. Recency: Each event is weighted by exponential time decay: w_t = exp(-lambda * delta_t).
    3. Aggregation: Multi-event combination uses diminishing-returns saturation:
       R_raw = 100 * (1 - prod(1 - (E_i * w_ti) / 100))
    4. Criticality Amplification:
       R_final = min(100.0, R_raw * M_tier)
       Rule: If R_raw == 0, R_final == 0 (criticality amplifies exposure, never creates risk from void).
    """
    now = current_time or datetime.now(timezone.utc)

    # 1. Geographic Association
    matched_events = [e for e in events if e.region == supplier.region]

    if not matched_events:
        return SupplierRiskEvaluation(
            supplier_id=supplier.id,
            supplier_name=supplier.name,
            risk_score=0.0,
            contributing_factors={
                "raw_risk": 0.0,
                "final_score": 0.0,
                "criticality_tier": supplier.criticality_tier,
                "criticality_multiplier": CRITICALITY_MULTIPLIERS.get(supplier.criticality_tier, 1.0),
                "news_risk": 0.0,
                "weather_risk": 0.0,
                "event_count": 0,
                "event_types": [],
                "top_events": [],
            },
        )

    # 2. Score Individual Events & Recency Weighting
    news_contributions = []
    weather_contributions = []
    top_event_details = []
    retention_factor = 1.0

    # Sort events by newest first
    sorted_events = sorted(matched_events, key=lambda e: e.detected_at, reverse=True)

    for evt in sorted_events:
        base_contrib = compute_event_risk_contribution(evt)
        recency_w = calculate_recency_weight(evt.detected_at, current_date=now)
        weighted_contrib = base_contrib * recency_w

        # Sublinear saturation: product of (1 - prob)
        term = 1.0 - (weighted_contrib / 100.0)
        retention_factor *= max(0.01, term)

        if evt.source == "weather":
            weather_contributions.append(weighted_contrib)
        else:
            news_contributions.append(weighted_contrib)

        if len(top_event_details) < 5:
            top_event_details.append({
                "id": str(evt.id),
                "headline": evt.headline[:120],
                "event_type": evt.event_type,
                "source": evt.source,
                "severity": evt.severity,
                "detected_at": evt.detected_at.isoformat() if evt.detected_at else None,
            })

    # 3. Aggregated Raw Risk in [0, 100]
    raw_risk = max(0.0, min(100.0, 100.0 * (1.0 - retention_factor)))

    # 4. Criticality Amplification
    tier = supplier.criticality_tier if supplier.criticality_tier in CRITICALITY_MULTIPLIERS else 2
    multiplier = CRITICALITY_MULTIPLIERS[tier]
    final_score = round(min(100.0, raw_risk * multiplier), 1)

    news_subtotal = round(sum(news_contributions) / max(1, len(news_contributions)), 1) if news_contributions else 0.0
    weather_subtotal = round(sum(weather_contributions) / max(1, len(weather_contributions)), 1) if weather_contributions else 0.0
    distinct_types = sorted(list(set(e.event_type for e in matched_events if e.event_type)))

    contributing_factors = {
        "raw_risk": round(raw_risk, 1),
        "final_score": final_score,
        "criticality_tier": tier,
        "criticality_multiplier": multiplier,
        "news_risk": news_subtotal,
        "weather_risk": weather_subtotal,
        "event_count": len(matched_events),
        "event_types": distinct_types,
        "top_events": top_event_details,
    }

    return SupplierRiskEvaluation(
        supplier_id=supplier.id,
        supplier_name=supplier.name,
        risk_score=final_score,
        contributing_factors=contributing_factors,
    )
