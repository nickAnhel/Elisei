from __future__ import annotations

import redis.asyncio as redis

from src.cache.service import CacheService
from src.config import settings


_cache_service: CacheService | None = None


def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        redis_client = redis.from_url(
            settings.redis.url,
            decode_responses=True,
        )
        _cache_service = CacheService(
            redis_client=redis_client,
            enabled=settings.cache.enabled,
            default_ttl_seconds=settings.cache.default_ttl_seconds,
        )
    return _cache_service
