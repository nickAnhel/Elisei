from __future__ import annotations

import asyncio
import logging

from src.assets.celery_app import celery_app
from src.observability import configure_logging
from src.recommendations.sync import run_incremental_sync, run_refresh_active_users


logger = logging.getLogger(__name__)
configure_logging()


@celery_app.task(name="recommendations.incremental_sync")
def recommendations_incremental_sync_task() -> dict:
    try:
        return asyncio.run(run_incremental_sync())
    except Exception:
        logger.exception("recommendations incremental sync failed")
        raise


@celery_app.task(name="recommendations.refresh_active_users")
def recommendations_refresh_active_users_task() -> dict:
    try:
        return asyncio.run(run_refresh_active_users())
    except Exception:
        logger.exception("recommendations refresh-active-users failed")
        raise
