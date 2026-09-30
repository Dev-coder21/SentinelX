import os
import logging
from dataclasses import dataclass
from typing import Optional, Any

logger = logging.getLogger("sentinelx.nlp.sentiment")

# Default lightweight model suitable for CPU execution on Apple Silicon
DEFAULT_SENTIMENT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"


@dataclass
class SentimentResult:
    score: float       # Normalized -1.0 (extremely negative) to +1.0 (extremely positive)
    label: str         # "NEGATIVE", "POSITIVE", or "NEUTRAL"
    confidence: float  # 0.0 to 1.0
    risk_contribution: float  # 0.0 to 100.0 (higher negative sentiment = higher risk)


class SentimentAnalyzer:
    """
    Sentiment analysis service supporting both local HuggingFace CPU pipeline
    and high-performance deterministic lexical scoring.
    Loaded once and reused across events to optimize CPU memory.
    """

    _instance: Optional["SentimentAnalyzer"] = None

    def __init__(self, model_name: str = DEFAULT_SENTIMENT_MODEL, auto_load_hf: Optional[bool] = None):
        self.model_name = model_name
        self._pipeline = None

        # Only download/load HuggingFace weights if explicitly requested or via env var
        # (prevents heavy network downloads during normal automated testing and local dev)
        should_load = auto_load_hf
        if should_load is None:
            should_load = os.getenv("SENTINELX_LOAD_HF_MODEL", "false").lower() == "true"

        if should_load:
            self._load_pipeline()

    @classmethod
    def get_instance(cls, model_name: str = DEFAULT_SENTIMENT_MODEL) -> "SentimentAnalyzer":
        """Singleton accessor to guarantee model instance is loaded once and reused."""
        if cls._instance is None:
            cls._instance = SentimentAnalyzer(model_name=model_name)
        return cls._instance

    def _load_pipeline(self):
        if self._pipeline is not None:
            return

        try:
            from transformers import pipeline
            logger.info(f"Loading HuggingFace sentiment pipeline ({self.model_name}) on CPU...")
            # device=-1 forces CPU inference
            self._pipeline = pipeline(
                "sentiment-analysis",
                model=self.model_name,
                device=-1,
                truncation=True,
                max_length=512,
            )
            logger.info("HuggingFace sentiment model loaded successfully.")
        except Exception as exc:
            logger.warning(
                f"Could not load HuggingFace model '{self.model_name}': {exc}. "
                "Rule-based sentiment fallback will be used."
            )
            self._pipeline = None

    def analyze(self, headline: str, summary: Optional[str] = None) -> SentimentResult:
        """
        Analyzes combined headline and summary text.
        Returns normalized sentiment score in [-1.0, 1.0] and risk contribution in [0, 100].
        """
        text = headline
        if summary:
            text = f"{headline}. {summary}"
        text = text.strip()

        if not text:
            return SentimentResult(score=0.0, label="NEUTRAL", confidence=1.0, risk_contribution=0.0)

        # 1. Use HuggingFace pipeline if loaded
        if self._pipeline is not None:
            try:
                results = self._pipeline(text[:512])
                if results and isinstance(results, list):
                    res = results[0]
                    raw_label = res.get("label", "POSITIVE").upper()
                    raw_score = float(res.get("score", 0.5))

                    if raw_label == "NEGATIVE":
                        normalized_score = -raw_score
                    else:
                        normalized_score = raw_score

                    # Convert negative sentiment into risk contribution (0 to 100)
                    risk_contribution = max(0.0, -normalized_score * 100.0)
                    return SentimentResult(
                        score=round(normalized_score, 4),
                        label=raw_label,
                        confidence=round(raw_score, 4),
                        risk_contribution=round(risk_contribution, 2),
                    )
            except Exception as exc:
                logger.warning(f"Inference error in HuggingFace pipeline: {exc}. Using rule-based fallback.")

        # 2. Deterministic Lexical Fallback
        return self._rule_based_sentiment(text)

    def _rule_based_sentiment(self, text: str) -> SentimentResult:
        """Deterministic lexical sentiment engine for fast, reproducible evaluation."""
        lower = text.lower()
        negative_words = [
            "disrupt", "shortage", "strike", "halt", "shutdown", "closure", "delay",
            "fire", "flood", "storm", "typhoon", "crisis", "damage", "warning", "fail",
            "threat", "sanction", "conflict", "bottleneck", "loss", "crash", "explosion",
            "halts", "shuts", "scarcity", "halted", "destroyed", "delays"
        ]
        positive_words = [
            "resolve", "recover", "cleared", "agreement", "growth", "expand", "boost",
            "stable", "success", "open", "resumed", "improves", "record", "restored"
        ]

        neg_matches = sum(1 for w in negative_words if w in lower)
        pos_matches = sum(1 for w in positive_words if w in lower)

        if neg_matches > pos_matches:
            confidence = min(0.95, 0.60 + 0.1 * neg_matches)
            score = -confidence
            label = "NEGATIVE"
            risk_contribution = min(100.0, neg_matches * 25.0)
        elif pos_matches > neg_matches:
            confidence = min(0.95, 0.60 + 0.1 * pos_matches)
            score = confidence
            label = "POSITIVE"
            risk_contribution = 0.0
        else:
            confidence = 0.5
            score = 0.0
            label = "NEUTRAL"
            risk_contribution = 0.0

        return SentimentResult(
            score=round(score, 4),
            label=label,
            confidence=round(confidence, 4),
            risk_contribution=round(risk_contribution, 2),
        )
