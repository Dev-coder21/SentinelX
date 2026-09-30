import logging
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings

logger = logging.getLogger("sentinelx.scheduler")

_scheduler: Optional[BackgroundScheduler] = None


def _scheduled_refresh_job():
    """Wrapper for scheduler execution to ensure unhandled job exceptions are logged safely."""
    try:
        from app.services.refresh import refresh_risk_pipeline
        logger.info("Executing scheduled SentinelX risk refresh job...")
        res = refresh_risk_pipeline(log_output=False)
        logger.info(
            f"Scheduled refresh finished: {res.new_events_inserted} new events, "
            f"{res.events_classified} classified, {res.suppliers_rescored} suppliers rescored."
        )
    except Exception as exc:
        logger.error(f"Scheduled risk refresh job encountered an error: {exc}", exc_info=True)


def get_scheduler() -> Optional[BackgroundScheduler]:
    """Returns the active BackgroundScheduler instance if started, or None."""
    return _scheduler


def start_scheduler(force: bool = False) -> Optional[BackgroundScheduler]:
    """
    Initializes and starts the APScheduler background thread.
    Respects settings.ENABLE_SCHEDULER unless force=True.
    Safe against multiple invocations.
    """
    global _scheduler

    if not settings.ENABLE_SCHEDULER and not force:
        logger.info("APScheduler disabled via configuration (ENABLE_SCHEDULER=False).")
        return None

    if _scheduler is not None and _scheduler.running:
        logger.info("APScheduler is already running. Skipping redundant start.")
        return _scheduler

    try:
        _scheduler = BackgroundScheduler(daemon=True)
        interval_mins = max(1, settings.RISK_REFRESH_INTERVAL_MINUTES)
        _scheduler.add_job(
            _scheduled_refresh_job,
            trigger=IntervalTrigger(minutes=interval_mins),
            id="sentinelx_risk_refresh",
            name="SentinelX Scheduled Risk Refresh Pipeline",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        _scheduler.start()
        logger.info(f"APScheduler started successfully. Risk refresh interval: {interval_mins} minutes.")
        return _scheduler
    except Exception as exc:
        logger.error(f"Failed to start APScheduler: {exc}")
        _scheduler = None
        raise exc


def shutdown_scheduler() -> None:
    """
    Gracefully shuts down the background scheduler and releases resources.
    """
    global _scheduler
    if _scheduler is not None:
        try:
            if _scheduler.running:
                _scheduler.shutdown(wait=False)
                logger.info("APScheduler shut down successfully.")
        except Exception as exc:
            logger.warning(f"Error shutting down APScheduler: {exc}")
        finally:
            _scheduler = None
