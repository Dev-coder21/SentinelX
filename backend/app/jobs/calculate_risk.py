import sys
import logging
from app.core.database import SessionLocal, engine, Base
from app.nlp.pipeline import NLPRiskPipeline

# Configure logging format for CLI pipeline runs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)


def main():
    """
    CLI runner for SentinelX NLP Event Intelligence and Supplier Risk Fusion.
    Transforms raw risk_events into explainable 0–100 risk_scores per supplier.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        pipeline = NLPRiskPipeline(db=db)
        summary = pipeline.run()
        summary.print_summary()
    except Exception as exc:
        print(f"Risk calculation pipeline failed: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
