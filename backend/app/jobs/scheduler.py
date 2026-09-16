"""Scheduled jobs (documents/04-ARCHITECTURE.md §8). APScheduler, no queue
infrastructure at v1 volume.

| Job                    | Frequency        |
|-------------------------|------------------|
| Places poll              | Weekly per outlet |
| Trial day-15 check       | Daily            |
| Weekly digest            | Weekly           |
| Event retention prune    | Monthly          |
| Zero-scan alert          | Weekly (day 7)   |
| Cancellation expiry      | Daily            |
"""

import logging
import zlib

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from sqlalchemy import text

from app.core.db import SessionLocal, engine
from app.jobs.cancellation_expiry import run_cancellation_expiry
from app.jobs.event_retention import run_event_retention_prune
from app.jobs.places_poll import run_places_poll
from app.jobs.trial_day15_check import run_trial_day15_check
from app.jobs.weekly_digest import run_weekly_digest
from app.jobs.payment_grace_reminders import run_payment_grace_reminders
from app.jobs.zero_scan_alert import run_zero_scan_nudges

logger = logging.getLogger("revyu.jobs.scheduler")

scheduler = BackgroundScheduler()


def _run_with_session(job_fn, name: str):
    # A Postgres advisory lock on a dedicated connection means that if the API
    # runs several workers, only one of them executes a given job per tick
    # (no duplicate digests, no double lock transitions).
    key = zlib.crc32(f"revyu-job:{name}".encode())
    with engine.connect() as lock_conn:
        got = lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": key}).scalar()
        if not got:
            logger.info("Job '%s' skipped: another worker holds the lock", name)
            return
        db = SessionLocal()
        try:
            result = job_fn(db)
            logger.info("Job '%s' completed: %s", name, result)
        except Exception:
            logger.exception("Job '%s' failed", name)
        finally:
            db.close()
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})
            lock_conn.commit()


def start_scheduler() -> None:
    scheduler.add_job(
        lambda: _run_with_session(run_places_poll, "places_poll"),
        CronTrigger(day_of_week="mon", hour=3),
        id="places_poll",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: _run_with_session(run_trial_day15_check, "trial_day15_check"),
        CronTrigger(hour=2),
        id="trial_day15_check",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: _run_with_session(run_weekly_digest, "weekly_digest"),
        CronTrigger(day_of_week="mon", hour=8),
        id="weekly_digest",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: _run_with_session(run_event_retention_prune, "event_retention_prune"),
        CronTrigger(day=1, hour=4),
        id="event_retention_prune",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: _run_with_session(run_cancellation_expiry, "cancellation_expiry"),
        CronTrigger(hour=2, minute=30),
        id="cancellation_expiry",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: _run_with_session(run_payment_grace_reminders, "payment_grace_reminders"),
        CronTrigger(hour=10),
        id="payment_grace_reminders",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: _run_with_session(run_zero_scan_nudges, "zero_scan_nudges"),
        CronTrigger(day_of_week="mon", hour=9),
        id="zero_scan_alert",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
