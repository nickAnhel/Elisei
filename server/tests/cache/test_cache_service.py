from __future__ import annotations

import pytest

from src.cache.service import CacheService


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.sets: dict[str, set[str]] = {}
        self.raise_on_get = False
        self.raise_on_set = False
        self.raise_on_delete = False

    async def get(self, key: str) -> str | None:
        if self.raise_on_get:
            raise RuntimeError("redis get failed")
        return self.store.get(key)

    async def set(self, key: str, payload: str, ex: int | None = None) -> bool:  # noqa: ARG002
        if self.raise_on_set:
            raise RuntimeError("redis set failed")
        self.store[key] = payload
        return True

    async def delete(self, *keys: str) -> int:
        if self.raise_on_delete:
            raise RuntimeError("redis delete failed")
        deleted = 0
        for key in keys:
            if key in self.store:
                del self.store[key]
                deleted += 1
            if key in self.sets:
                del self.sets[key]
                deleted += 1
        return deleted

    async def sadd(self, key: str, member_key: str) -> int:
        values = self.sets.setdefault(key, set())
        prev_size = len(values)
        values.add(member_key)
        return 0 if len(values) == prev_size else 1

    async def expire(self, key: str, ttl_seconds: int) -> bool:  # noqa: ARG002
        return key in self.store or key in self.sets

    async def smembers(self, key: str) -> set[str]:
        return self.sets.get(key, set())


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_cache_service_get_set_and_delete_json() -> None:
    redis = FakeRedis()
    cache_service = CacheService(redis_client=redis, enabled=True, default_ttl_seconds=300)  # type: ignore[arg-type]

    written = await cache_service.set_json("k1", [{"content_id": "c1", "score": 1.0}], 120, namespace="test")
    assert written is True

    payload = await cache_service.get_json("k1", namespace="test")
    assert isinstance(payload, list)
    assert payload[0]["content_id"] == "c1"

    deleted = await cache_service.delete("k1", namespace="test")
    assert deleted == 1
    assert await cache_service.get_json("k1", namespace="test") is None


@pytest.mark.anyio
async def test_cache_service_delete_many_and_invalidate_index() -> None:
    redis = FakeRedis()
    cache_service = CacheService(redis_client=redis, enabled=True, default_ttl_seconds=300)  # type: ignore[arg-type]
    await cache_service.set_json("k1", {"x": 1}, 120, namespace="test")
    await cache_service.set_json("k2", {"x": 2}, 120, namespace="test")

    deleted = await cache_service.delete_many(["k1", "k2"], namespace="test")
    assert deleted == 2

    await cache_service.set_json("k3", {"x": 3}, 120, namespace="test")
    await cache_service.add_index_member(index_key="idx", member_key="k3", ttl_seconds=120, namespace="test")

    deleted_by_index = await cache_service.invalidate_index(index_key="idx", namespace="test")
    assert deleted_by_index >= 2


@pytest.mark.anyio
async def test_cache_service_redis_errors_do_not_raise() -> None:
    redis = FakeRedis()
    cache_service = CacheService(redis_client=redis, enabled=True, default_ttl_seconds=300)  # type: ignore[arg-type]

    redis.raise_on_set = True
    assert await cache_service.set_json("k1", {"x": 1}, 120, namespace="test") is False

    redis.raise_on_get = True
    assert await cache_service.get_json("k1", namespace="test") is None

    redis.raise_on_delete = True
    assert await cache_service.delete("k1", namespace="test") == 0
    assert await cache_service.delete_many(["k1"], namespace="test") == 0
