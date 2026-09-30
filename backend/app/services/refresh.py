import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.ingestion.service import IngestionService
from app.nlp.pipeline import NLPRiskPipeline

logger = logging.getLogger("sentinelx.services.refresh")


@dataclass
class RefreshResult:
    news_events: int = 0
    weather_events: int = 0
    new_events_inserted: int = 0
    duplicates_skipped: int = 0
    events_classified: int = 0
    gemini_calls: int = 0
    fallback_calls: int = 0
    suppliers_rescored: int = 0
    average_risk: float = 0.0
    highest_risk_supplier: Optional[str] = None
    highest_risk_score: float = 0.0
    provider_failures: int = 0
    failure_details: List[str] = field(default_factory=list)
    success: bool = True

    def print_concise_log(self) -> None:
        """
        Prints the exact concise operational log format required for SentinelX.
        """
        print("Risk refresh started")
        print(f"News events: {self.news_events}")
        print(f"Weather events: {self.weather_events}")
        print(f"New events: {self.new_events_inserted}")
        print(f"Events classified: {self.events_classified}")
        print(f"Suppliers rescored: {self.suppliers_rescored}")
        print("Risk refresh completed")


def refresh_risk_pipeline(
    db: Optional[Session] = None,
    current_time: Optional[datetime] = None,
    ingestion_service: Optional[IngestionService] = None,
    nlp_pipeline: Optional[NLPRiskPipeline] = None,
    force_rescore: bool = True,
    log_output: bool = True,
) -> RefreshResult:
    """
    Unified orchestration workflow for SentinelX:
    1. Ingests real-world signals (GDELT news, Open-Meteo weather).
    2. Runs NLP sentiment & event classification for newly arrived / unclassified events.
    3. Fuses multi-event risk into 0-100 scores per supplier.
    4. Persists timestamped historical risk scores with explainable JSONB factors.

    Ensures failure isolation: external provider errors (GDELT, Open-Meteo, Gemini)
    do not crash the pipeline or corrupt database state.
    """
    now = current_time or datetime.now(timezone.utc)
    owns_session = False
    session = db

    if session is None:
        session = SessionLocal()
        owns_session = True

    result = RefreshResult()

    try:
        logger.info("SentinelX risk refresh pipeline initiated")

        # -------------------------------------------------------------
        # 1. Ingestion Phase
        # -------------------------------------------------------------
        ingest_svc = ingestion_service or IngestionService(db=session)
        try:
            ingest_summary = ingest_svc.run_ingestion()
            result.news_events = ingest_summary.events_by_provider.get("gdelt", 0)
            result.weather_events = ingest_summary.events_by_provider.get("open_meteo", 0)
            result.new_events_inserted = ingest_summary.events_inserted
            result.duplicates_skipped = ingest_summary.duplicates_skipped
            result.provider_failures = ingest_summary.provider_failures
            result.failure_details = list(ingest_summary.failure_details)
        except Exception as ingest_exc:
            logger.error(f"Ingestion phase encountered top-level error: {ingest_exc}")
            result.provider_failures += 1
            result.failure_details.append(str(ingest_exc))

        # -------------------------------------------------------------
        # 2. NLP Classification & Sentiment Phase
        # -------------------------------------------------------------
        nlp_pipe = nlp_pipeline or NLPRiskPipeline(db=session)
        try:
            analyzed, gemini, fallback = nlp_pipe.process_unclassified_events()
            result.events_classified = analyzed
            result.gemini_calls = gemini
            result.fallback_calls = fallback
        except Exception as nlp_exc:
            logger.error(f"NLP classification phase encountered error: {nlp_exc}")
            result.failure_details.append(f"NLP error: {nlp_exc}")

        # -------------------------------------------------------------
        # 3. Risk Fusion & Persistence Phase
        # -------------------------------------------------------------
        try:
            scores = nlp_pipe.calculate_supplier_risks(current_time=now)
            result.suppliers_rescored = len(scores)

            if scores:
                total_risk = sum(s.risk_score for s in scores)
                result.average_risk = round(total_risk / len(scores), 1)

                top_score = max(scores, key=lambda s: s.risk_score)
                result.highest_risk_score = top_score.risk_score
                from app.models.supplier import Supplier
                supp = session.query(Supplier).filter(Supplier.id == top_score.supplier_id).first()
                if supp:
                    result.highest_risk_supplier = supp.name
        except Exception as score_exc:
            logger.error(f"Supplier rescoring phase encountered error: {score_exc}")
            result.success = False
            result.failure_details.append(f"Scoring error: {score_exc}")
            raise score_exc

        logger.info(
            f"SentinelX risk refresh completed: {result.new_events_inserted} new events, "
            f"{result.events_classified} classified, {result.suppliers_rescored} suppliers scored"
        )

        if log_output:
            result.print_concise_log()

        return result

    except Exception as exc:
        logger.error(f"Critical risk refresh failure: {exc}")
        result.success = False
        raise exc

    finally:
        if owns_session:
            session.close()
