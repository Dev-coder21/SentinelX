import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from app.schemas.risk_event import RiskEventCreate
from app.ingestion.base import BaseIngestionProvider, ReliableHttpClient, ProviderUnavailableError
from app.ingestion.cache import IngestionCache

logger = logging.getLogger("sentinelx.ingestion.gdelt")

# Canonical risk keyword concepts for supply chain news
DEFAULT_RISK_TERMS = [
    "port",
    "strike",
    "flood",
    "factory",
    "shortage",
    "logistics",
    "disruption",
    "supply chain",
    "shutdown",
]

# Geographic context mapped to supplier operating countries
REGION_GEOGRAPHIC_KEYWORDS = {
    "East Asia": 'Taiwan OR "South Korea" OR Japan OR China',
    "Southeast Asia": 'Vietnam OR Malaysia OR Singapore OR Thailand OR Philippines',
    "North America": '"United States" OR Mexico',
    "Europe": 'Germany OR Netherlands',
}


class GDELTProvider(BaseIngestionProvider):
    """
    Ingestion client for the GDELT 2.0 Doc API.
    Searches real-world geopolitical, environmental, and industrial supply chain disruption events.
    """

    GDELT_DOC_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

    def __init__(
        self,
        search_terms: Optional[List[str]] = None,
        max_records: int = 15,
        http_client: Optional[ReliableHttpClient] = None,
        cache: Optional[IngestionCache] = None,
        ttl_seconds: int = 1800,  # 30-minute cache TTL
    ):
        super().__init__(name="gdelt", http_client=http_client, cache=cache)
        self.search_terms = search_terms or DEFAULT_RISK_TERMS
        self.max_records = max_records
        self.ttl_seconds = ttl_seconds

    def build_query(self, region: str) -> str:
        """
        Constructs GDELT boolean search query joining risk concepts and regional location context.
        """
        terms_clause = " OR ".join(self.search_terms)
        geo_clause = REGION_GEOGRAPHIC_KEYWORDS.get(region, f'"{region}"')
        return f"({terms_clause}) AND ({geo_clause})"

    def fetch_events(self, region: str) -> List[RiskEventCreate]:
        """
        Queries GDELT API for the specified region and normalizes the output into RiskEventCreate models.
        Utilizes local TTL caching to protect free-tier bandwidth.
        """
        query_string = self.build_query(region)
        params = {
            "query": query_string,
            "mode": "artlist",
            "maxrecords": self.max_records,
            "format": "json",
            "sort": "DateDesc",
        }

        cache_key = self.cache.generate_key("gdelt", {"region": region, "query": query_string})
        cached_data = self.cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Cache hit for GDELT region '{region}' ({len(cached_data)} events).")
            return [RiskEventCreate(**item) for item in cached_data]

        logger.info(f"Querying live GDELT API for region '{region}'...")
        try:
            response = self.http_client.get(self.GDELT_DOC_API_URL, params=params)
        except Exception as exc:
            logger.error(f"GDELT provider error for region '{region}': {exc}")
            raise ProviderUnavailableError(f"GDELT query failed: {exc}") from exc

        # Parse GDELT response
        raw_text = response.text.strip()
        if not raw_text:
            logger.warning(f"GDELT returned empty response for region '{region}'.")
            self.cache.set(cache_key, [], ttl_seconds=self.ttl_seconds)
            return []

        try:
            payload = response.json()
        except Exception as json_err:
            logger.warning(f"Failed to parse GDELT JSON for region '{region}': {json_err}. Raw text: {raw_text[:120]}")
            return []

        articles = payload.get("articles", [])
        if not articles:
            logger.info(f"No GDELT articles found for region '{region}'.")
            self.cache.set(cache_key, [], ttl_seconds=self.ttl_seconds)
            return []

        normalized_events: List[RiskEventCreate] = []
        for art in articles:
            headline = art.get("title", "").strip()
            raw_url = art.get("url", "").strip()
            domain = art.get("domain", "Unknown Source")
            source_country = art.get("sourcecountry", "")

            if not headline or not raw_url:
                continue

            # Deterministic fingerprint to prevent duplicate event insertion
            fingerprint_seed = f"news:{region}:{raw_url}"
            fingerprint = hashlib.sha256(fingerprint_seed.encode("utf-8")).hexdigest()

            # Parse GDELT seendate (e.g. '20260928T143000Z')
            detected_at = datetime.now(timezone.utc)
            seendate_str = art.get("seendate")
            if seendate_str and len(seendate_str) >= 15:
                try:
                    detected_at = datetime.strptime(seendate_str[:16], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
                except Exception:
                    pass

            summary = f"Reported by {domain}"
            if source_country:
                summary += f" ({source_country})"

            # Deterministic UUID based on the fingerprint
            event_id = uuid.uuid5(uuid.NAMESPACE_URL, fingerprint_seed)

            event = RiskEventCreate(
                id=event_id,
                region=region,
                source="news",
                headline=headline[:500],
                summary=summary,
                sentiment_score=0.0,
                event_type="news_disruption",
                detected_at=detected_at,
                raw_url=raw_url[:1000],
                fingerprint=fingerprint,
            )
            normalized_events.append(event)

        # Store in local cache
        cacheable_payload = [evt.model_dump(mode="json") for evt in normalized_events]
        self.cache.set(cache_key, cacheable_payload, ttl_seconds=self.ttl_seconds)

        logger.info(f"GDELT returned {len(normalized_events)} normalized events for region '{region}'.")
        return normalized_events
