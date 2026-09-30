import time
import json
import hashlib
import threading
from typing import Any, Dict, Optional, Tuple


class IngestionCache:
    """
    Thread-safe, in-memory local caching mechanism with TTL.
    Protects external provider free-tier API quotas and prevents redundant calls.
    """

    def __init__(self, default_ttl_seconds: int = 1800):
        self._default_ttl = default_ttl_seconds
        self._store: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def generate_key(self, provider: str, params: Dict[str, Any]) -> str:
        """
        Generates a deterministic cache key from provider name and query parameters.
        """
        serialized = json.dumps(params, sort_keys=True, default=str)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]
        return f"{provider}:{digest}"

    def get(self, key: str) -> Optional[Any]:
        """
        Retrieves cached data if key exists and has not expired.
        Returns None if missing or expired.
        """
        with self._lock:
            if key not in self._store:
                return None
            value, expires_at = self._store[key]
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """
        Stores data with a TTL in seconds.
        """
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expires_at = time.time() + ttl
        with self._lock:
            self._store[key] = (value, expires_at)

    def delete(self, key: str) -> bool:
        """
        Removes a specific key from the cache.
        """
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def clear(self) -> None:
        """
        Clears all cached entries.
        """
        with self._lock:
            self._store.clear()

    def size(self) -> int:
        """
        Returns count of non-expired cached entries.
        """
        with self._lock:
            now = time.time()
            # Clean expired items
            keys_to_remove = [k for k, (_, exp) in self._store.items() if now > exp]
            for k in keys_to_remove:
                del self._store[k]
            return len(self._store)


# Global singleton instance for shared ingestion caching
default_cache = IngestionCache()
