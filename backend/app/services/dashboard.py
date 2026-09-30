from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.models.mitigation_plan import MitigationPlan
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    DashboardOverview,
    HighestRiskSupplierSummary,
    RiskDistributionItem,
    RegionalRiskSummary,
    RiskTrendPoint,
    EventTypeDistributionItem,
    DashboardRecentEvent,
    DashboardOptimizationSummary,
)


def get_dashboard_summary(db: Session, current_time: Optional[datetime] = None) -> DashboardSummaryResponse:
    """
    Production-grade, N+1-free aggregator computing comprehensive supply chain
    risk intelligence for the SentinelX executive command-center dashboard.
    """
    now = current_time or datetime.now(timezone.utc)
    suppliers = db.query(Supplier).all()
    total_suppliers = len(suppliers)

    # 1. Fetch latest mitigation plan if available
    latest_plan = (
        db.query(MitigationPlan)
        .order_by(MitigationPlan.generated_at.desc())
        .first()
    )
    opt_summary = None
    if latest_plan is not None:
        selected_cnt = len(latest_plan.selected_suppliers) if latest_plan.selected_suppliers else 0
        opt_summary = DashboardOptimizationSummary(
            plan_id=latest_plan.id,
            generated_at=latest_plan.generated_at,
            budget=latest_plan.budget_constraint,
            total_budget_used=latest_plan.total_budget_used or 0.0,
            remaining_budget=latest_plan.remaining_budget or 0.0,
            selected_count=selected_cnt,
            expected_protected_revenue=latest_plan.expected_revenue_protected,
            objective_value=latest_plan.objective_value or latest_plan.expected_revenue_protected,
            optimization_status=latest_plan.optimization_notes,
        )

    # Edge Case: Zero Suppliers
    if total_suppliers == 0:
        empty_overview = DashboardOverview(
            total_suppliers=0,
            average_risk=0.0,
            high_risk_supplier_count=0,
            medium_risk_supplier_count=0,
            low_risk_supplier_count=0,
            highest_risk_supplier=None,
            latest_risk_timestamp=None,
            recent_event_count=0,
            tier_distribution={"tier_1": 0, "tier_2": 0, "tier_3": 0},
        )
        return DashboardSummaryResponse(
            total_suppliers=0,
            average_risk=0.0,
            high_risk_supplier_count=0,
            medium_risk_supplier_count=0,
            low_risk_supplier_count=0,
            highest_risk_supplier=None,
            latest_risk_timestamp=None,
            recent_event_count=0,
            tier_distribution={"tier_1": 0, "tier_2": 0, "tier_3": 0},
            overview=empty_overview,
            risk_distribution=[
                RiskDistributionItem(level="LOW", count=0, percentage=0.0),
                RiskDistributionItem(level="MEDIUM", count=0, percentage=0.0),
                RiskDistributionItem(level="HIGH", count=0, percentage=0.0),
                RiskDistributionItem(level="CRITICAL", count=0, percentage=0.0),
            ],
            regional_risk=[],
            risk_trend=[],
            event_distribution=[],
            recent_events=[],
            latest_optimization=opt_summary,
            generated_at=now,
        )

    # 2. Fetch latest risk score for each supplier in a single joined subquery
    subq = (
        db.query(
            RiskScore.supplier_id,
            func.max(RiskScore.timestamp).label("max_ts"),
        )
        .group_by(RiskScore.supplier_id)
        .subquery()
    )

    latest_scores = (
        db.query(RiskScore)
        .join(
            subq,
            (RiskScore.supplier_id == subq.c.supplier_id) & (RiskScore.timestamp == subq.c.max_ts),
        )
        .all()
    )
    score_by_supplier = {sc.supplier_id: sc for sc in latest_scores}

    # 3. Compute Fleet Risk Metrics & Risk Distribution
    low_count = 0
    med_count = 0
    high_count = 0
    critical_count = 0
    total_score = 0.0
    highest_score = -1.0
    highest_supplier_obj = None
    latest_ts = None

    # Track suppliers by region for regional risk aggregation and event correlation
    suppliers_by_region: Dict[str, List[Supplier]] = defaultdict(list)

    for supp in suppliers:
        suppliers_by_region[supp.region].append(supp)
        rec = score_by_supplier.get(supp.id)
        sc_val = rec.risk_score if rec is not None else 0.0
        total_score += sc_val

        if rec is not None and (latest_ts is None or rec.timestamp > latest_ts):
            latest_ts = rec.timestamp

        # Risk Classification Tiers:
        # LOW: < 40.0
        # MEDIUM: 40.0 <= score < 70.0
        # HIGH: 70.0 <= score < 80.0
        # CRITICAL: >= 80.0
        # Note: (HIGH + CRITICAL) = total suppliers with risk >= 70.0
        if sc_val >= 80.0:
            critical_count += 1
        elif sc_val >= 70.0:
            high_count += 1
        elif sc_val >= 40.0:
            med_count += 1
        else:
            low_count += 1

        if sc_val > highest_score:
            highest_score = sc_val
            highest_supplier_obj = supp

    avg_risk = round(total_score / total_suppliers, 1)
    combined_high_count = high_count + critical_count

    highest_summary = None
    if highest_supplier_obj is not None and highest_score >= 0.0:
        highest_summary = HighestRiskSupplierSummary(
            id=highest_supplier_obj.id,
            name=highest_supplier_obj.name,
            risk_score=highest_score,
            criticality_tier=highest_supplier_obj.criticality_tier,
            region=highest_supplier_obj.region,
        )

    # Risk Distribution List (for donut / bar charts)
    risk_distribution = [
        RiskDistributionItem(
            level="LOW",
            count=low_count,
            percentage=round((low_count / total_suppliers) * 100.0, 1),
        ),
        RiskDistributionItem(
            level="MEDIUM",
            count=med_count,
            percentage=round((med_count / total_suppliers) * 100.0, 1),
        ),
        RiskDistributionItem(
            level="HIGH",
            count=high_count,
            percentage=round((high_count / total_suppliers) * 100.0, 1),
        ),
        RiskDistributionItem(
            level="CRITICAL",
            count=critical_count,
            percentage=round((critical_count / total_suppliers) * 100.0, 1),
        ),
    ]

    # 4. Regional Risk Aggregation (Dynamic from database)
    regional_risk_list: List[RegionalRiskSummary] = []
    for region_name, reg_supps in suppliers_by_region.items():
        reg_count = len(reg_supps)
        reg_scores = [
            score_by_supplier.get(s.id).risk_score if s.id in score_by_supplier else 0.0
            for s in reg_supps
        ]
        reg_avg = round(sum(reg_scores) / max(1, reg_count), 1)
        reg_max = round(max(reg_scores), 1) if reg_scores else 0.0
        reg_high = sum(1 for s_score in reg_scores if s_score >= 70.0)

        regional_risk_list.append(
            RegionalRiskSummary(
                region=region_name,
                supplier_count=reg_count,
                average_risk=reg_avg,
                highest_risk=reg_max,
                high_risk_supplier_count=reg_high,
            )
        )
    # Sort regional risk by average risk descending
    regional_risk_list.sort(key=lambda r: r.average_risk, reverse=True)

    # 5. Historical Risk Trend (Bounded window: up to 30 snapshots)
    trend_rows = (
        db.query(
            RiskScore.timestamp,
            func.round(func.avg(RiskScore.risk_score), 1).label("avg_risk"),
            func.sum(case((RiskScore.risk_score >= 70.0, 1), else_=0)).label("high_risk_cnt"),
            func.count(RiskScore.id).label("total_cnt"),
        )
        .group_by(RiskScore.timestamp)
        .order_by(RiskScore.timestamp.desc())
        .limit(30)
        .all()
    )
    # Reverse to present chronological order for Recharts line/area charts
    risk_trend = [
        RiskTrendPoint(
            timestamp=row.timestamp,
            average_risk=float(row.avg_risk or 0.0),
            high_risk_count=int(row.high_risk_cnt or 0),
            scored_supplier_count=int(row.total_cnt or 0),
        )
        for row in reversed(trend_rows)
    ]

    # 6. Event Type Distribution (Active 14-day window)
    fourteen_days_ago = now - timedelta(days=14)
    event_type_rows = (
        db.query(
            RiskEvent.event_type,
            func.count(RiskEvent.id).label("cnt"),
        )
        .filter(RiskEvent.detected_at >= fourteen_days_ago)
        .group_by(RiskEvent.event_type)
        .order_by(func.count(RiskEvent.id).desc())
        .all()
    )
    recent_events_total = sum(row.cnt for row in event_type_rows)
    event_distribution = [
        EventTypeDistributionItem(
            event_type=row.event_type,
            count=row.cnt,
            percentage=round((row.cnt / max(1, recent_events_total)) * 100.0, 1),
        )
        for row in event_type_rows
    ]

    # 7. Recent Significant Events (Top 10 most recent)
    recent_db_events = (
        db.query(RiskEvent)
        .order_by(RiskEvent.detected_at.desc())
        .limit(10)
        .all()
    )
    recent_events = [
        DashboardRecentEvent(
            id=evt.id,
            detected_at=evt.detected_at,
            region=evt.region,
            source=evt.source,
            event_type=evt.event_type,
            headline=evt.headline,
            summary=evt.summary,
            severity=evt.severity,
            confidence=evt.confidence,
            sentiment_score=evt.sentiment_score or 0.0,
            affected_suppliers=[s.name for s in suppliers_by_region.get(evt.region, [])],
        )
        for evt in recent_db_events
    ]

    # 8. Criticality tier distribution
    tier_dist = {
        "tier_1": sum(1 for s in suppliers if s.criticality_tier == 1),
        "tier_2": sum(1 for s in suppliers if s.criticality_tier == 2),
        "tier_3": sum(1 for s in suppliers if s.criticality_tier == 3),
    }

    overview = DashboardOverview(
        total_suppliers=total_suppliers,
        average_risk=avg_risk,
        high_risk_supplier_count=combined_high_count,
        medium_risk_supplier_count=med_count,
        low_risk_supplier_count=low_count,
        highest_risk_supplier=highest_summary,
        latest_risk_timestamp=latest_ts,
        recent_event_count=recent_events_total,
        tier_distribution=tier_dist,
    )

    return DashboardSummaryResponse(
        total_suppliers=total_suppliers,
        average_risk=avg_risk,
        high_risk_supplier_count=combined_high_count,
        medium_risk_supplier_count=med_count,
        low_risk_supplier_count=low_count,
        highest_risk_supplier=highest_summary,
        latest_risk_timestamp=latest_ts,
        recent_event_count=recent_events_total,
        tier_distribution=tier_dist,
        overview=overview,
        risk_distribution=risk_distribution,
        regional_risk=regional_risk_list,
        risk_trend=risk_trend,
        event_distribution=event_distribution,
        recent_events=recent_events,
        latest_optimization=opt_summary,
        generated_at=now,
    )
