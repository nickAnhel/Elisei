from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

import redis.asyncio as redis

from src.cache.serialization import deserialize_json, serialize_json
from src.observability.metrics import (
    observe_cache_operation_duration,
    observe_cache_payload_items,
    observe_cache_request,
)


logger = logging.getLogger(__name__)


class CacheService:
    def __init__(
        self,
        *,
        redis_client: redis.Redis,
        enabled: bool,
        default_ttl_seconds: int,
    ) -> None:
        self._redis = redis_client
        self._enabled = enabled
        self._default_ttl_seconds = default_ttl_seconds

    async def get_json(self, key: str, *, namespace: str = "default") -> Any | None:
        if not self._enabled:
            observe_cache_request(namespace=namespace, result="miss")
            return None

        started_at = time.perf_counter()
        try:
            raw = await self._redis.get(key)
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="get",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            if raw is None:
                observe_cache_request(namespace=namespace, result="miss")
                return None

            payload = deserialize_json(raw)
            observe_cache_request(namespace=namespace, result="hit")
            observe_cache_payload_items(namespace=namespace, items=self._payload_items(payload))
            return payload
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="get",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            observe_cache_request(namespace=namespace, result="error")
            logger.warning(
                "cache read failed",
                extra={
                    "event": "cache.read",
                    "cache_namespace": namespace,
                    "cache_key_hash": self._key_digest(key),
                    "cache_read_ms": self._to_milliseconds(duration_seconds),
                    "cache_error": str(exc),
                },
            )
            return None

    async def set_json(
        self,
        key: str,
        value: Any,
        ttl_seconds: int | None = None,
        *,
        namespace: str = "default",
    ) -> bool:
        if not self._enabled:
            return False

        payload = serialize_json(value)
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl_seconds
        started_at = time.perf_counter()
        try:
            await self._redis.set(key, payload, ex=ttl)
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="set",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            observe_cache_payload_items(namespace=namespace, items=self._payload_items(value))
            return True
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="set",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            logger.warning(
                "cache write failed",
                extra={
                    "event": "cache.write",
                    "cache_namespace": namespace,
                    "cache_key_hash": self._key_digest(key),
                    "cache_write_ms": self._to_milliseconds(duration_seconds),
                    "cache_error": str(exc),
                },
            )
            return False

    async def delete(self, key: str, *, namespace: str = "default") -> int:
        if not self._enabled:
            return 0

        started_at = time.perf_counter()
        try:
            deleted = await self._redis.delete(key)
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="delete",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            return int(deleted)
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="delete",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            logger.warning(
                "cache delete failed",
                extra={
                    "event": "cache.delete",
                    "cache_namespace": namespace,
                    "cache_key_hash": self._key_digest(key),
                    "cache_delete_ms": self._to_milliseconds(duration_seconds),
                    "cache_error": str(exc),
                },
            )
            return 0

    async def delete_many(self, keys: list[str], *, namespace: str = "default") -> int:
        if not keys:
            return 0
        if not self._enabled:
            return 0

        started_at = time.perf_counter()
        try:
            deleted = await self._redis.delete(*keys)
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="delete",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            return int(deleted)
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="delete",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            logger.warning(
                "cache delete many failed",
                extra={
                    "event": "cache.delete_many",
                    "cache_namespace": namespace,
                    "cache_delete_ms": self._to_milliseconds(duration_seconds),
                    "cache_error": str(exc),
                    "cache_keys_count": len(keys),
                },
            )
            return 0

    async def add_index_member(
        self,
        *,
        index_key: str,
        member_key: str,
        ttl_seconds: int,
        namespace: str = "default",
    ) -> bool:
        if not self._enabled:
            return False

        started_at = time.perf_counter()
        try:
            await self._redis.sadd(index_key, member_key)
            await self._redis.expire(index_key, ttl_seconds)
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="set",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            return True
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="set",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            logger.warning(
                "cache index add failed",
                extra={
                    "event": "cache.index.add",
                    "cache_namespace": namespace,
                    "cache_key_hash": self._key_digest(index_key),
                    "cache_write_ms": self._to_milliseconds(duration_seconds),
                    "cache_error": str(exc),
                },
            )
            return False

    async def invalidate_index(self, *, index_key: str, namespace: str = "default") -> int:
        if not self._enabled:
            return 0

        started_at = time.perf_counter()
        try:
            keys = await self._redis.smembers(index_key)
            payload_keys = list(keys) if keys else []
            all_keys = [*payload_keys, index_key]
            if not all_keys:
                duration_seconds = time.perf_counter() - started_at
                observe_cache_operation_duration(
                    operation="delete",
                    namespace=namespace,
                    duration_seconds=duration_seconds,
                )
                return 0
            deleted = await self._redis.delete(*all_keys)
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="delete",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            return int(deleted)
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            observe_cache_operation_duration(
                operation="delete",
                namespace=namespace,
                duration_seconds=duration_seconds,
            )
            logger.warning(
                "cache index invalidation failed",
                extra={
                    "event": "cache.index.invalidate",
                    "cache_namespace": namespace,
                    "cache_key_hash": self._key_digest(index_key),
                    "cache_delete_ms": self._to_milliseconds(duration_seconds),
                    "cache_error": str(exc),
                },
            )
            return 0

    @staticmethod
    def _to_milliseconds(duration_seconds: float) -> float:
        return round(duration_seconds * 1000, 3)

    @staticmethod
    def _payload_items(payload: Any) -> int:
        if isinstance(payload, (list, tuple, set)):
            return len(payload)
        if isinstance(payload, dict):
            return len(payload)
        if payload is None:
            return 0
        return 1

    @staticmethod
    def _key_digest(key: str) -> str:
        return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]
