import time
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import httpx

from app.schemas.risk_event import RiskEventCreate
from app.ingestion.cache import IngestionCache, default_cache

logger = logging.getLogger("sentinelx.ingestion")


class IngestionError(Exception):
    """Base exception for ingestion failures."""
    pass


class ProviderUnavailableError(IngestionError):
    """Raised when an external provider fails after max retries."""
    pass


class ReliableHttpClient:
    """
    HTTP client featuring connection/read timeouts, exponential backoff retries,
    and intelligent transient vs permanent error classification.
    """

    def __init__(
        self,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
        max_retries: int = 3,
        base_delay: float = 0.5,
        max_delay: float = 4.0,
        client: Optional[httpx.Client] = None,
    ):
        self.timeout = httpx.Timeout(
            timeout=read_timeout,
            connect=connect_timeout,
            read=read_timeout,
            write=5.0,
            pool=5.0,
        )
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self._client = client

    def _get_client(self) -> httpx.Client:
        if self._client is not None:
            return self._client
        return httpx.Client(timeout=self.timeout)

    def get(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> httpx.Response:
        """
        Executes an HTTP GET with retry on transient network errors / 5xx / 429.
        Does NOT retry on permanent client errors (400, 401, 403, 404).
        """
        # Ensure default User-Agent for strict public APIs (like GDELT)
        request_headers = {"User-Agent": "SentinelX/1.0 (SupplyChainRiskIntelligence)"}
        if headers:
            request_headers.update(headers)

        last_exception = None
        for attempt in range(self.max_retries + 1):
            try:
                client = self._get_client()
                response = client.get(url, params=params, headers=request_headers)

                # Check for transient server errors and rate limits that should be retried
                if response.status_code in (429, 500, 502, 503, 504):
                    response.raise_for_status()

                # Raise for permanent client errors without retry
                if 400 <= response.status_code < 500:
                    response.raise_for_status()

                return response

            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exception = exc
                if attempt >= self.max_retries:
                    logger.warning(
                        f"HTTP request to {url} failed after {attempt} retries: {exc}"
                    )
                    raise ProviderUnavailableError(f"Network error contacting {url}: {exc}") from exc

                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                logger.info(
                    f"Transient network error for {url} ({exc}). Retrying in {delay:.2f}s (attempt {attempt + 1}/{self.max_retries})..."
                )
                time.sleep(delay)

            except httpx.HTTPStatusError as exc:
                last_exception = exc
                # If transient 5xx or 429, retry
                if exc.response.status_code in (429, 500, 502, 503, 504):
                    if attempt >= self.max_retries:
                        logger.warning(
                            f"HTTP {exc.response.status_code} from {url} after {attempt} retries."
                        )
                        raise ProviderUnavailableError(f"HTTP {exc.response.status_code} from {url}") from exc

                    delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                    logger.info(
                        f"HTTP {exc.response.status_code} from {url}. Retrying in {delay:.2f}s..."
                    )
                    time.sleep(delay)
                else:
                    # Permanent 4xx error (e.g. 400 Bad Request, 404 Not Found), fail immediately
                    logger.error(f"Permanent HTTP error {exc.response.status_code} from {url}: {exc}")
                    raise exc

        raise ProviderUnavailableError(f"Exhausted retries for {url}: {last_exception}")


class BaseIngestionProvider(ABC):
    """
    Abstract base provider defining the common ingestion interface,
    caching mechanisms, and error isolation.
    """

    def __init__(
        self,
        name: str,
        http_client: Optional[ReliableHttpClient] = None,
        cache: Optional[IngestionCache] = None,
    ):
        self.name = name
        self.http_client = http_client or ReliableHttpClient()
        self.cache = cache or default_cache

    @abstractmethod
    def fetch_events(self, region: str) -> List[RiskEventCreate]:
        """
        Fetches, normalizes, and returns a list of candidate risk events for a given region.
        Must return normalized RiskEventCreate models with fingerprint populated.
        """
        pass
