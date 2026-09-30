import re
import json
import logging
from typing import Optional
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings

logger = logging.getLogger("sentinelx.nlp.classification")

VALID_EVENT_TYPES = {
    "weather",
    "labor",
    "geopolitical",
    "logistics",
    "supply_shortage",
    "factory_disruption",
    "other",
}

# Deterministic keyword dictionaries for fallback classification
KEYWORD_RULES = {
    "weather": [
        "storm", "typhoon", "hurricane", "flood", "cyclone", "extreme weather",
        "freeze", "heatwave", "tornado", "heavy rain", "gale", "blizzard", "tsunami"
    ],
    "factory_disruption": [
        "factory closure", "plant shutdown", "production halt", "manufacturing disruption",
        "facility outage", "explosion", "factory fire", "blackout", "factory shutdown",
        "assembly halt", "production stop", "shutdown", "closure", "halt"
    ],
    "supply_shortage": [
        "shortage", "scarce", "supply disruption", "allocation", "unavailable",
        "rationing", "depleted", "wafer shortage"
    ],
    "labor": [
        "strike", "workers", "union", "labor dispute", "protest", "walkout", "picket"
    ],
    "geopolitical": [
        "sanctions", "conflict", "war", "border", "tariff", "export restriction",
        "trade barrier", "embargo", "geopolitical"
    ],
    "logistics": [
        "port", "shipping", "container", "freight", "vessel", "transport", "cargo",
        "canal", "terminal", "airfreight", "carrier", "drayage"
    ],
}

# Baseline severities for each category when classified via deterministic rules
DEFAULT_SEVERITIES = {
    "factory_disruption": 75.0,
    "geopolitical": 70.0,
    "weather": 65.0,
    "labor": 60.0,
    "supply_shortage": 65.0,
    "logistics": 55.0,
    "other": 30.0,
}


class EventClassificationResult(BaseModel):
    event_type: str = Field(..., description="Classified category")
    severity: float = Field(..., ge=0.0, le=100.0, description="Severity rating 0 to 100")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence 0.0 to 1.0")
    classification_source: str = Field(..., description="'gemini', 'fallback', or 'weather_detector'")


def fallback_classify(
    headline: str,
    summary: Optional[str] = None,
    source: str = "news",
) -> EventClassificationResult:
    """
    Deterministic rule-based event classifier.
    Ensures pipeline continuity when Gemini is unavailable or rate-limited.
    """
    if source == "weather":
        return EventClassificationResult(
            event_type="weather",
            severity=65.0,
            confidence=0.90,
            classification_source="fallback",
        )

    text = f"{headline} {summary or ''}".lower()

    best_match_type = "other"
    max_matches = 0

    for event_type, keywords in KEYWORD_RULES.items():
        matches = sum(1 for kw in keywords if kw in text)
        if matches > max_matches:
            max_matches = matches
            best_match_type = event_type

    if best_match_type != "other":
        confidence = min(0.90, 0.60 + 0.1 * max_matches)
        base_sev = DEFAULT_SEVERITIES.get(best_match_type, 50.0)
    else:
        confidence = 0.40
        base_sev = DEFAULT_SEVERITIES["other"]

    return EventClassificationResult(
        event_type=best_match_type,
        severity=base_sev,
        confidence=confidence,
        classification_source="fallback",
    )


class GeminiClassifier:
    """
    Event classifier leveraging Google Gemini API (free tier via Google AI Studio).
    Enforces structured Pydantic JSON validation with automatic fallback.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.provider = settings.LLM_PROVIDER.lower()
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        if not self.api_key or self.api_key.startswith("your_") or self.api_key in ("not_required", "not_set"):
            return None

        try:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
            return self._client
        except Exception as exc:
            logger.warning(f"Could not initialize Google GenAI SDK: {exc}")
            return None

    def classify(
        self,
        headline: str,
        summary: Optional[str] = None,
        source: str = "news",
    ) -> EventClassificationResult:
        """
        Classifies event into structured event_type, severity (0-100), and confidence (0-1).
        Falls back seamlessly to deterministic rules if Gemini is unconfigured or fails.
        """
        client = self._get_client()
        if client is None:
            return fallback_classify(headline, summary, source=source)

        prompt = f"""You are SentinelX's supply chain risk intelligence classifier.
Analyze the following supply chain disruption event:
Headline: "{headline}"
Summary: "{summary or ''}"
Source: "{source}"

Classify into exactly one event_type:
- weather
- labor
- geopolitical
- logistics
- supply_shortage
- factory_disruption
- other

Assess severity on a scale of 0 to 100 based on disruption magnitude.
Estimate your confidence from 0.0 to 1.0.

Respond strictly with a JSON object:
{{
  "event_type": "<weather|labor|geopolitical|logistics|supply_shortage|factory_disruption|other>",
  "severity": <float 0-100>,
  "confidence": <float 0.0-1.0>
}}
"""
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            raw_text = response.text.strip()
            # Parse structured JSON output
            data = json.loads(raw_text)

            # Sanitize event_type
            parsed_type = str(data.get("event_type", "other")).lower().strip()
            if parsed_type not in VALID_EVENT_TYPES:
                parsed_type = "other"

            severity = float(data.get("severity", 50.0))
            severity = max(0.0, min(100.0, severity))

            confidence = float(data.get("confidence", 0.8))
            confidence = max(0.0, min(1.0, confidence))

            result = EventClassificationResult(
                event_type=parsed_type,
                severity=round(severity, 1),
                confidence=round(confidence, 2),
                classification_source="gemini",
            )
            return result

        except Exception as exc:
            logger.warning(
                f"Gemini event classification failed ({exc}). Failing over to deterministic classifier."
            )
            return fallback_classify(headline, summary, source=source)
