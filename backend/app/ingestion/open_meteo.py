import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import uuid

from app.schemas.risk_event import RiskEventCreate
from app.ingestion.base import BaseIngestionProvider, ReliableHttpClient, ProviderUnavailableError
from app.ingestion.cache import IngestionCache

logger = logging.getLogger("sentinelx.ingestion.open_meteo")

# Representative geospatial coordinates for primary manufacturing clusters
REGION_COORDINATES: Dict[str, Tuple[float, float]] = {
    "East Asia": (25.0330, 121.5654),       # Taipei, Taiwan
    "Southeast Asia": (10.8231, 106.6297),   # Ho Chi Minh City, Vietnam
    "North America": (37.7749, -122.4194),   # San Francisco / Silicon Valley, CA
    "Europe": (48.1351, 11.5820),            # Munich, Bavaria, Germany
}

# WMO Weather interpretation codes signaling abnormal/severe disruption
SEVERE_WEATHER_CODES = {
    65: ("extreme_precipitation", "Heavy rain"),
    67: ("freezing_rain", "Heavy freezing rain"),
    75: ("extreme_snowfall", "Heavy snowfall"),
    82: ("extreme_precipitation", "Violent rain showers"),
    86: ("extreme_snowfall", "Heavy snow showers"),
    95: ("severe_storm", "Thunderstorm"),
    96: ("severe_storm", "Thunderstorm with slight hail"),
    99: ("severe_storm", "Severe thunderstorm with heavy hail"),
}


class OpenMeteoProvider(BaseIngestionProvider):
    """
    Ingestion client for the Open-Meteo Weather Forecast API.
    Monitors supplier regions for severe weather anomalies (hurricanes/typhoons,
    severe storms, gale-force winds, flooding rains, and extreme temperatures).
    Does NOT require an API key.
    """

    OPEN_METEO_API_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(
        self,
        http_client: Optional[ReliableHttpClient] = None,
        cache: Optional[IngestionCache] = None,
        ttl_seconds: int = 1800,  # 30-minute cache TTL
    ):
        super().__init__(name="open_meteo", http_client=http_client, cache=cache)
        self.ttl_seconds = ttl_seconds

    def fetch_events(self, region: str) -> List[RiskEventCreate]:
        """
        Queries Open-Meteo current meteorological conditions for the region.
        Only generates risk events when conditions exceed abnormal severity thresholds.
        """
        if region not in REGION_COORDINATES:
            logger.warning(f"No coordinates configured for region '{region}'. Skipping weather probe.")
            return []

        lat, lon = REGION_COORDINATES[region]
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
            "timezone": "UTC",
        }

        cache_key = self.cache.generate_key("open_meteo", {"region": region, "lat": lat, "lon": lon})
        cached_data = self.cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Cache hit for Open-Meteo region '{region}' ({len(cached_data)} events).")
            return [RiskEventCreate(**item) for item in cached_data]

        logger.info(f"Querying Open-Meteo API for region '{region}' ({lat}, {lon})...")
        try:
            response = self.http_client.get(self.OPEN_METEO_API_URL, params=params)
        except Exception as exc:
            logger.error(f"Open-Meteo provider error for region '{region}': {exc}")
            raise ProviderUnavailableError(f"Open-Meteo query failed: {exc}") from exc

        try:
            payload = response.json()
        except Exception as json_err:
            logger.warning(f"Failed to parse Open-Meteo JSON for region '{region}': {json_err}")
            return []

        current = payload.get("current", {})
        if not current:
            logger.info(f"No current weather data returned for region '{region}'.")
            self.cache.set(cache_key, [], ttl_seconds=self.ttl_seconds)
            return []

        weather_code = current.get("weather_code", 0)
        wind_gusts = current.get("wind_gusts_10m", 0.0)
        wind_speed = current.get("wind_speed_10m", 0.0)
        precipitation = current.get("precipitation", 0.0)
        temperature = current.get("temperature_2m", 20.0)

        # Evaluate abnormal weather risk triggers
        detected_anomalies = []

        if weather_code in SEVERE_WEATHER_CODES:
            event_type, desc = SEVERE_WEATHER_CODES[weather_code]
            detected_anomalies.append({
                "type": event_type,
                "headline": f"Severe Weather Warning: {desc} in {region}",
                "detail": f"Weather code {weather_code} ({desc}) detected.",
            })

        if wind_gusts >= 75.0 or wind_speed >= 60.0:
            detected_anomalies.append({
                "type": "gale_winds",
                "headline": f"High Wind Alert: Gale gusts reaching {wind_gusts:.1f} km/h in {region}",
                "detail": f"Sustained wind speed {wind_speed:.1f} km/h, peak gusts {wind_gusts:.1f} km/h.",
            })

        if precipitation >= 20.0:
            detected_anomalies.append({
                "type": "extreme_precipitation",
                "headline": f"Flood Risk: Extreme precipitation ({precipitation:.1f} mm/h) in {region}",
                "detail": f"Heavy localized rainfall rate of {precipitation:.1f} mm/h.",
            })

        if temperature >= 42.0:
            detected_anomalies.append({
                "type": "extreme_heat",
                "headline": f"Heatwave Alert: Extreme ambient temperature ({temperature:.1f}°C) in {region}",
                "detail": f"Critical heatwave conditions ({temperature:.1f}°C) threatening factory cooling.",
            })
        elif temperature <= -15.0:
            detected_anomalies.append({
                "type": "severe_freeze",
                "headline": f"Deep Freeze Warning: Extreme low temperature ({temperature:.1f}°C) in {region}",
                "detail": f"Severe freezing conditions ({temperature:.1f}°C) disrupting transport infrastructure.",
            })

        # Ordinary weather produces NO risk events
        if not detected_anomalies:
            logger.info(
                f"Normal meteorological conditions for '{region}' "
                f"(Temp: {temperature}°C, Wind: {wind_speed}km/h, Code: {weather_code}). No risk generated."
            )
            self.cache.set(cache_key, [], ttl_seconds=self.ttl_seconds)
            return []

        now = datetime.now(timezone.utc)
        # Use hourly granularity for weather fingerprint deduplication
        hour_tag = now.strftime("%Y-%m-%d-%H")
        normalized_events: List[RiskEventCreate] = []

        for anomaly in detected_anomalies:
            fingerprint_seed = f"weather:{region}:{anomaly['type']}:{hour_tag}"
            fingerprint = hashlib.sha256(fingerprint_seed.encode("utf-8")).hexdigest()
            event_id = uuid.uuid5(uuid.NAMESPACE_URL, fingerprint_seed)

            summary = (
                f"{anomaly['detail']} Current temp: {temperature:.1f}°C, "
                f"wind: {wind_speed:.1f} km/h (gusts: {wind_gusts:.1f} km/h)."
            )
            raw_url = f"https://open-meteo.com/en/docs#latitude={lat}&longitude={lon}"

            event = RiskEventCreate(
                id=event_id,
                region=region,
                source="weather",
                headline=anomaly["headline"][:500],
                summary=summary,
                sentiment_score=0.0,
                event_type=anomaly["type"],
                detected_at=now,
                raw_url=raw_url,
                fingerprint=fingerprint,
            )
            normalized_events.append(event)

        # Store in local cache
        cacheable_payload = [evt.model_dump(mode="json") for evt in normalized_events]
        self.cache.set(cache_key, cacheable_payload, ttl_seconds=self.ttl_seconds)

        logger.info(f"Open-Meteo generated {len(normalized_events)} risk events for region '{region}'.")
        return normalized_events
