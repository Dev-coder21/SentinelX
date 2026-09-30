import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy.orm import Session

from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.ingestion.base import BaseIngestionProvider
from app.ingestion.gdelt import GDELTProvider
from app.ingestion.open_meteo import OpenMeteoProvider

logger = logging.getLogger("sentinelx.ingestion.service")


@dataclass
class IngestionSummary:
    providers_queried: List[str] = field(default_factory=list)
    regions_queried: List[str] = field(default_factory=list)
    events_received: int = 0
    events_inserted: int = 0
    duplicates_skipped: int = 0
    provider_failures: int = 0
    failure_details: List[str] = field(default_factory=list)
    events_by_provider: dict[str, int] = field(default_factory=dict)

    def print_summary(self) -> None:
        print("\n" + "=" * 55)
        print("SENTINELX RISK SIGNAL INGESTION SUMMARY")
        print("=" * 55)
        print(f"Providers Queried:   {', '.join(self.providers_queried)}")
        print(f"Regions Processed:   {', '.join(self.regions_queried)}")
        print(f"Events Received:     {self.events_received}")
        print(f"Events Inserted:     {self.events_inserted}")
        print(f"Duplicates Skipped:  {self.duplicates_skipped}")
        print(f"Provider Failures:   {self.provider_failures}")
        if self.failure_details:
            print("\nFailure Warnings:")
            for warn in self.failure_details:
                print(f"  - {warn}")
        print("=" * 55 + "\n")


class IngestionService:
    """
    Coordinates multi-source risk signal ingestion, normalization,
    error isolation across providers/regions, deduplication, and persistence.
    """

    def __init__(
        self,
        db: Session,
        providers: Optional[List[BaseIngestionProvider]] = None,
    ):
        self.db = db
        self.providers = providers if providers is not None else [
            GDELTProvider(),
            OpenMeteoProvider(),
        ]

    def get_target_regions(self, requested_regions: Optional[List[str]] = None) -> List[str]:
        """
        Discovers active supplier regions from the database, falling back to default regions.
        """
        if requested_regions:
            return requested_regions

        try:
            db_regions = [
                r[0] for r in self.db.query(Supplier.region).distinct().filter(Supplier.region.isnot(None)).all()
            ]
            if db_regions:
                return sorted(list(set(db_regions)))
        except Exception as exc:
            logger.warning(f"Could not read distinct supplier regions: {exc}")

        return ["East Asia", "Southeast Asia", "North America", "Europe"]

    def run_ingestion(self, regions: Optional[List[str]] = None) -> IngestionSummary:
        """
        Executes complete ingestion pipeline across all configured providers and target regions.
        Ensures strict error isolation: failures in one provider/region do not abort others.
        """
        target_regions = self.get_target_regions(regions)
        summary = IngestionSummary(
            providers_queried=[p.name for p in self.providers],
            regions_queried=target_regions,
        )

        seen_fingerprints: set = set()
        seen_ids: set = set()

        for region in target_regions:
            for provider in self.providers:
                try:
                    logger.info(f"Ingesting signals via '{provider.name}' for region '{region}'...")
                    events = provider.fetch_events(region)
                    summary.events_received += len(events)
                    summary.events_by_provider[provider.name] = (
                        summary.events_by_provider.get(provider.name, 0) + len(events)
                    )

                    for evt in events:
                        # Check intra-batch and database deduplication by unique fingerprint or ID
                        is_duplicate = False

                        if evt.fingerprint:
                            if evt.fingerprint in seen_fingerprints:
                                is_duplicate = True
                            else:
                                existing = (
                                    self.db.query(RiskEvent)
                                    .filter(RiskEvent.fingerprint == evt.fingerprint)
                                    .first()
                                )
                                if existing is not None:
                                    is_duplicate = True

                        if not is_duplicate and evt.id:
                            if evt.id in seen_ids:
                                is_duplicate = True
                            else:
                                existing_id = (
                                    self.db.query(RiskEvent)
                                    .filter(RiskEvent.id == evt.id)
                                    .first()
                                )
                                if existing_id is not None:
                                    is_duplicate = True

                        if is_duplicate:
                            summary.duplicates_skipped += 1
                        else:
                            evt_id = evt.id or uuid.uuid4()
                            db_event = RiskEvent(
                                id=evt_id,
                                region=evt.region,
                                source=evt.source,
                                headline=evt.headline,
                                summary=evt.summary,
                                sentiment_score=evt.sentiment_score,
                                event_type=evt.event_type,
                                detected_at=evt.detected_at or datetime.now(timezone.utc),
                                raw_url=evt.raw_url,
                                fingerprint=evt.fingerprint,
                            )
                            self.db.add(db_event)
                            if evt.fingerprint:
                                seen_fingerprints.add(evt.fingerprint)
                            seen_ids.add(evt_id)
                            summary.events_inserted += 1

                except Exception as exc:
                    summary.provider_failures += 1
                    err_msg = f"Provider '{provider.name}' error for '{region}': {exc}"
                    logger.warning(err_msg)
                    summary.failure_details.append(err_msg)
                    # Isolated: continue to other providers and regions!

        try:
            self.db.commit()
        except Exception as commit_exc:
            self.db.rollback()
            logger.error(f"Failed to commit ingested risk events: {commit_exc}")
            raise commit_exc

        return summary
