import csv
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.data.seed_data import RAW_SUPPLIERS, generate_supplier_id
from app.models.risk_event import RiskEvent
from app.models.supplier import Supplier
from app.nlp.risk_fusion import (
    CRITICALITY_MULTIPLIERS,
    calculate_recency_weight,
    compute_event_risk_contribution,
    fuse_supplier_risk,
)
from evaluation.schemas import (
    CaseSummarySchema,
    EvaluationRecordSchema,
    HistoricalCaseSchema,
)

logger = logging.getLogger("sentinelx.evaluation.backtest")

BASE_DIR = Path(__file__).resolve().parent
CASES_DIR = BASE_DIR / "cases"
RESULTS_DIR = BASE_DIR / "results"


def load_historical_cases(cases_dir: Optional[Path] = None) -> List[HistoricalCaseSchema]:
    """Loads and validates all historical case JSON fixtures."""
    target_dir = cases_dir or CASES_DIR
    if not target_dir.exists():
        raise FileNotFoundError(f"Cases directory does not exist: {target_dir}")

    cases = []
    for file_path in sorted(target_dir.glob("*.json")):
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            case = HistoricalCaseSchema(**data)
            cases.append(case)
    return cases


def get_evaluation_suppliers() -> List[Supplier]:
    """
    Constructs in-memory Supplier instances from deterministic seed data.
    Requires no database connection.
    """
    suppliers = []
    for raw in RAW_SUPPLIERS:
        supp_id = generate_supplier_id(raw["name"])
        supplier = Supplier(
            id=supp_id,
            name=raw["name"],
            region=raw["region"],
            country=raw["country"],
            category=raw["category"],
            annual_spend=raw["annual_spend"],
            criticality_tier=raw["criticality_tier"],
        )
        suppliers.append(supplier)
    return suppliers


def run_historical_backtest(
    cases: Optional[List[HistoricalCaseSchema]] = None,
    output_dir: Optional[Path] = None,
) -> Tuple[List[EvaluationRecordSchema], List[CaseSummarySchema]]:
    """
    Executes historical backtest evaluation using production risk fusion.
    Deterministic, offline, safe: zero database writes, zero external network calls.
    """
    active_cases = cases or load_historical_cases()
    suppliers = get_evaluation_suppliers()
    out_dir = output_dir or RESULTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    detailed_records: List[EvaluationRecordSchema] = []
    case_summaries: List[CaseSummarySchema] = []

    for case in active_cases:
        # Convert schema events to production RiskEvent models
        risk_events: List[RiskEvent] = []
        for idx, evt in enumerate(case.events):
            e_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"{case.case_id}:{idx}:{evt.headline}")
            # Ensure timezone awareness
            det_at = evt.detected_at
            if det_at.tzinfo is None:
                det_at = det_at.replace(tzinfo=timezone.utc)

            model_evt = RiskEvent(
                id=e_id,
                headline=evt.headline,
                summary=evt.summary,
                region=evt.region,
                source=evt.source,
                sentiment_score=evt.sentiment_score,
                event_type=evt.event_type,
                detected_at=det_at,
                severity=evt.severity,
            )
            risk_events.append(model_evt)

        # Select relevant suppliers for this case:
        # 1. Affected region: one supplier for each criticality tier (Tier 1, 2, 3)
        # 2. Control region: at least one unaffected supplier
        affected_suppliers_by_tier: Dict[int, List[Supplier]] = {1: [], 2: [], 3: []}
        control_suppliers: List[Supplier] = []

        for s in suppliers:
            if s.region == case.affected_region:
                if s.criticality_tier in affected_suppliers_by_tier:
                    affected_suppliers_by_tier[s.criticality_tier].append(s)
            else:
                control_suppliers.append(s)

        # Pick one representative per tier in affected region
        selected_eval_suppliers: List[Tuple[Supplier, bool]] = []
        for tier in [1, 2, 3]:
            tier_supps = affected_suppliers_by_tier.get(tier, [])
            if tier_supps:
                selected_eval_suppliers.append((tier_supps[0], True))

        # Add 1 control supplier from an unaffected region
        if control_suppliers:
            selected_eval_suppliers.append((control_suppliers[0], False))

        # Windows to evaluate
        window_order = ["baseline", "onset", "peak", "post_event", "decay_check"]
        for supplier, is_affected in selected_eval_suppliers:
            window_scores: Dict[str, float] = {}
            recency_weights: Dict[str, float] = {}

            for w_name in window_order:
                if w_name not in case.windows:
                    continue
                w_time = case.windows[w_name]
                if w_time.tzinfo is None:
                    w_time = w_time.replace(tzinfo=timezone.utc)

                # Signals available up to this window timestamp
                available_events = [e for e in risk_events if e.detected_at <= w_time]

                eval_result = fuse_supplier_risk(
                    supplier=supplier,
                    events=available_events,
                    current_time=w_time,
                )

                final_risk = eval_result.risk_score
                raw_risk = eval_result.contributing_factors.get("raw_risk", 0.0)
                tier_mult = eval_result.contributing_factors.get("criticality_multiplier", 1.0)
                event_count = eval_result.contributing_factors.get("event_count", 0)

                window_scores[w_name] = final_risk

                # Record recency weight of the primary event at this timestamp
                if risk_events:
                    recency_weights[w_name] = round(
                        calculate_recency_weight(risk_events[0].detected_at, current_date=w_time), 4
                    )
                else:
                    recency_weights[w_name] = 0.0

                record = EvaluationRecordSchema(
                    case_id=case.case_id,
                    case_name=case.name,
                    window_name=w_name,
                    window_timestamp=w_time,
                    supplier_id=supplier.id,
                    supplier_name=supplier.name,
                    supplier_region=supplier.region,
                    is_affected_region=is_affected,
                    supplier_tier=supplier.criticality_tier,
                    criticality_multiplier=tier_mult,
                    raw_aggregated_risk=raw_risk,
                    final_supplier_risk=final_risk,
                    event_count=event_count,
                    notes=f"Window: {w_name} | Events: {event_count} | Raw: {raw_risk} | Final: {final_risk}",
                )
                detailed_records.append(record)

            # Summarize affected suppliers across windows
            if is_affected:
                base_r = window_scores.get("baseline", 0.0)
                onset_r = window_scores.get("onset", 0.0)
                peak_r = window_scores.get("peak", 0.0)
                post_r = window_scores.get("post_event", 0.0)
                decay_r = window_scores.get("decay_check", 0.0)
                delta_r = round(peak_r - base_r, 1)

                summary = CaseSummarySchema(
                    case_id=case.case_id,
                    case_name=case.name,
                    affected_region=case.affected_region,
                    supplier_tier=supplier.criticality_tier,
                    supplier_name=supplier.name,
                    criticality_multiplier=CRITICALITY_MULTIPLIERS.get(supplier.criticality_tier, 1.0),
                    baseline_risk=base_r,
                    onset_risk=onset_r,
                    peak_risk=peak_r,
                    post_event_risk=post_r,
                    decay_check_risk=decay_r,
                    risk_delta=delta_r,
                    peak_recency_weight=recency_weights.get("peak", 1.0),
                    post_event_recency_weight=recency_weights.get("post_event", 0.5),
                    multi_signal_count=len(case.events),
                )
                case_summaries.append(summary)

    # Write output artifacts
    results_json_path = out_dir / "historical_validation_results.json"
    with open(results_json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "metadata": {
                    "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_cases_evaluated": len(active_cases),
                    "total_evaluation_records": len(detailed_records),
                    "total_case_summaries": len(case_summaries),
                },
                "cases": [c.model_dump(mode="json") for c in active_cases],
                "summaries": [s.model_dump(mode="json") for s in case_summaries],
                "detailed_records": [r.model_dump(mode="json") for r in detailed_records],
            },
            f,
            indent=2,
        )

    results_csv_path = out_dir / "historical_validation_summary.csv"
    with open(results_csv_path, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "case_id",
            "case_name",
            "affected_region",
            "supplier_tier",
            "supplier_name",
            "criticality_multiplier",
            "baseline_risk",
            "onset_risk",
            "peak_risk",
            "post_event_risk",
            "decay_check_risk",
            "risk_delta",
            "peak_recency_weight",
            "post_event_recency_weight",
            "multi_signal_count",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for summary in case_summaries:
            writer.writerow(summary.model_dump(mode="json"))

    return detailed_records, case_summaries


def print_evaluation_report(case_summaries: List[CaseSummarySchema]) -> None:
    """Prints a clear, formatted summary table to stdout."""
    print("\n" + "=" * 115)
    print("SENTINELX HISTORICAL BACKTEST & RISK VALIDATION REPORT")
    print("=" * 115)
    header = f"{'Case ID':<22} | {'Tier':<4} | {'Mult':<4} | {'Supplier':<26} | {'Base':<5} | {'Onset':<5} | {'Peak':<5} | {'Post':<5} | {'Decay':<5} | {'Delta':<5}"
    print(header)
    print("-" * 115)

    current_case = ""
    for s in case_summaries:
        if s.case_id != current_case:
            if current_case != "":
                print("-" * 115)
            current_case = s.case_id

        row = (
            f"{s.case_id:<22} | "
            f"T{s.supplier_tier:<3} | "
            f"{s.criticality_multiplier:<4.1f} | "
            f"{s.supplier_name[:26]:<26} | "
            f"{s.baseline_risk:<5.1f} | "
            f"{s.onset_risk:<5.1f} | "
            f"{s.peak_risk:<5.1f} | "
            f"{s.post_event_risk:<5.1f} | "
            f"{s.decay_check_risk:<5.1f} | "
            f"{s.risk_delta:<+5.1f}"
        )
        print(row)

    print("=" * 115)
    print("Historical evaluation complete: results written to backend/evaluation/results/\n")


def main():
    records, summaries = run_historical_backtest()
    print_evaluation_report(summaries)


if __name__ == "__main__":
    main()
