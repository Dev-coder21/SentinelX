import sys
import logging

from app.core.database import SessionLocal, engine, Base
from app.services.refresh import refresh_risk_pipeline

# Configure concise standard output logging for CLI jobs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
# Suppress overly verbose HTTP client logs in CLI output
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def main():
    """
    Manual CLI entrypoint for SentinelX risk refresh:
    Executes ingestion -> NLP classification -> risk fusion -> score persistence.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        res = refresh_risk_pipeline(db=db, log_output=True)
        if not res.success:
            print("Risk refresh encountered partial or total failure.", file=sys.stderr)
            sys.exit(1)
    except Exception as exc:
        print(f"Risk refresh job failed: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
