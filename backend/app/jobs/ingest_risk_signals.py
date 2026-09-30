import sys
import logging
from app.core.database import SessionLocal, engine, Base
from app.ingestion.service import IngestionService

# Configure logging format for CLI ingestion runs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)


def main():
    """
    CLI runner for SentinelX external risk signal ingestion.
    Executes GDELT news and Open-Meteo weather ingestion across all active supplier regions.
    """
    # Ensure database schema is initialized
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        service = IngestionService(db=db)
        summary = service.run_ingestion()
        summary.print_summary()
    except Exception as exc:
        print(f"Ingestion job failed: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
