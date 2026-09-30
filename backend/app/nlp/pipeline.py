import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.nlp.sentiment import SentimentAnalyzer
from app.nlp.classification import GeminiClassifier
from app.nlp.risk_fusion import fuse_supplier_risk

logger = logging.getLogger("sentinelx.nlp.pipeline")


@dataclass
class PipelineRunSummary:
    events_analyzed: int = 0
    gemini_calls: int = 0
    fallback_classifications: int = 0
    suppliers_scored: int = 0
    average_risk_score: float = 0.0
    highest_risk_supplier: Optional[str] = None
    highest_risk_score: float = 0.0

    def print_summary(self) -> None:
        print("\n" + "=" * 55)
        print("SENTINELX NLP INTELLIGENCE & RISK FUSION SUMMARY")
        print("=" * 55)
        print(f"Events Analyzed:            {self.events_analyzed}")
        print(f"Gemini API Classifications: {self.gemini_calls}")
        print(f"Fallback Classifications:   {self.fallback_classifications}")
        print(f"Suppliers Scored:           {self.suppliers_scored}")
        print(f"Average Fleet Risk:         {self.average_risk_score:.1f} / 100")
        if self.highest_risk_supplier:
            print(f"Highest Risk Supplier:      {self.highest_risk_supplier} ({self.highest_risk_score:.1f})")
        print("=" * 55 + "\n")


class NLPRiskPipeline:
    """
    End-to-end event intelligence pipeline:
    1. Selects unprocessed risk_events.
    2. Runs sentiment analysis (HuggingFace CPU inference).
    3. Runs event classification (Gemini structured API or deterministic fallback).
    4. Evaluates event severity.
    5. Fuses multi-event signals per supplier based on geographic region & recency.
    6. Persists explainable risk_scores with JSONB contributing factors.
    """

    def __init__(
        self,
        db: Session,
        sentiment_analyzer: Optional[SentimentAnalyzer] = None,
        classifier: Optional[GeminiClassifier] = None,
    ):
        self.db = db
        self.sentiment_analyzer = sentiment_analyzer or SentimentAnalyzer.get_instance()
        self.classifier = classifier or GeminiClassifier()

    def process_unclassified_events(self) -> tuple[int, int, int]:
        """
        Processes events lacking classification_source to ensure idempotent, quota-efficient operation.
        Returns: (events_analyzed, gemini_calls, fallback_calls)
        """
        unprocessed = (
            self.db.query(RiskEvent)
            .filter(RiskEvent.classification_source.is_(None))
            .all()
        )

        analyzed_count = 0
        gemini_count = 0
        fallback_count = 0

        for evt in unprocessed:
            try:
                # 1. Weather Events already have structured event_type from Open-Meteo
                if evt.source == "weather":
                    evt.sentiment_score = 0.0
                    evt.severity = evt.severity or 65.0
                    evt.confidence = 0.90
                    evt.classification_source = "weather_detector"
                    analyzed_count += 1
                    continue

                # 2. News Sentiment Analysis
                sentiment_res = self.sentiment_analyzer.analyze(evt.headline, evt.summary)
                evt.sentiment_score = sentiment_res.score

                # 3. Gemini / Fallback Event Classification
                cls_res = self.classifier.classify(evt.headline, evt.summary, source=evt.source)
                evt.event_type = cls_res.event_type
                evt.severity = cls_res.severity
                evt.confidence = cls_res.confidence
                evt.classification_source = cls_res.classification_source

                if cls_res.classification_source == "gemini":
                    gemini_count += 1
                else:
                    fallback_count += 1

                analyzed_count += 1

            except Exception as exc:
                logger.error(f"Error analyzing risk event {evt.id}: {exc}")
                # Safe fallback so a single bad event doesn't abort the entire batch
                evt.sentiment_score = 0.0
                evt.severity = 50.0
                evt.confidence = 0.5
                evt.classification_source = "fallback"
                fallback_count += 1
                analyzed_count += 1

        self.db.commit()
        return analyzed_count, gemini_count, fallback_count

    def calculate_supplier_risks(
        self,
        current_time: Optional[datetime] = None,
    ) -> List[RiskScore]:
        """
        Calculates and persists 0–100 risk scores for all suppliers based on active risk events.
        """
        now = current_time or datetime.now(timezone.utc)
        suppliers = self.db.query(Supplier).all()
        events = self.db.query(RiskEvent).all()

        created_scores = []
        for supplier in suppliers:
            evaluation = fuse_supplier_risk(supplier, events, current_time=now)

            score_record = RiskScore(
                supplier_id=supplier.id,
                timestamp=now,
                risk_score=evaluation.risk_score,
                contributing_factors=evaluation.contributing_factors,
            )
            self.db.add(score_record)
            created_scores.append(score_record)

        self.db.commit()
        return created_scores

    def run(self, current_time: Optional[datetime] = None) -> PipelineRunSummary:
        """Executes full pipeline: event classification -> supplier risk fusion -> persistence."""
        analyzed, gemini, fallback = self.process_unclassified_events()
        now = current_time or datetime.now(timezone.utc)
        scores = self.calculate_supplier_risks(current_time=now)

        highest_score = 0.0
        highest_supplier = None
        total_risk = 0.0

        for sc in scores:
            total_risk += sc.risk_score
            if sc.risk_score > highest_score:
                highest_score = sc.risk_score
                # Look up supplier name
                supp = self.db.query(Supplier).filter(Supplier.id == sc.supplier_id).first()
                if supp:
                    highest_supplier = supp.name

        avg_risk = total_risk / max(1, len(scores))

        return PipelineRunSummary(
            events_analyzed=analyzed,
            gemini_calls=gemini,
            fallback_classifications=fallback,
            suppliers_scored=len(scores),
            average_risk_score=avg_risk,
            highest_risk_supplier=highest_supplier,
            highest_risk_score=highest_score,
        )
