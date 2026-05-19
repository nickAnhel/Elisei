from __future__ import annotations

import hashlib
import logging
import time
import uuid

from src.cache.keys import (
    CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
    CACHE_NAMESPACE_RECOMMENDATIONS_FEED,
    CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR,
    build_recommendations_authors_cache_key,
    build_recommendations_authors_user_index_key,
    build_recommendations_feed_cache_key,
    build_recommendations_feed_user_index_key,
    build_recommendations_similar_cache_key,
)
from src.cache.service import CacheService
from src.content.enums import ContentTypeEnum
from src.content.projectors import ContentProjectorRegistry
from src.content.schemas import ContentListItemGet
from src.config import settings
from src.observability.context import get_request_id
from src.observability.metrics import (
    observe_recommendations_authors,
    observe_recommendations_feed,
    observe_recommendations_similar,
)
from src.recommendations.graph_repository import (
    RecommendationAuthorGraphResult,
    RecommendationFeedGraphResult,
    RecommendationGraphRepository,
    SimilarContentGraphResult,
)
from src.recommendations.postgres_repository import RecommendationPostgresRepository
from src.recommendations.schemas import (
    RecommendedAuthorItemGet,
    RecommendationFeedContentTypeEnum,
    RecommendationFeedSortEnum,
    SimilarContentItemGet,
    SimilarContentListGet,
)
from src.users.presentation import build_user_get


logger = logging.getLogger(__name__)


class RecommendationService:
    def __init__(
        self,
        *,
        graph_repository: RecommendationGraphRepository,
        postgres_repository: RecommendationPostgresRepository,
        projector_registry: ContentProjectorRegistry,
        asset_storage,
        cache_service: CacheService,
    ) -> None:
        self._graph_repository = graph_repository
        self._postgres_repository = postgres_repository
        self._projector_registry = projector_registry
        self._asset_storage = asset_storage
        self._cache_service = cache_service

    async def get_similar_content(
        self,
        *,
        content_id: uuid.UUID,
        viewer_id: uuid.UUID | None,
        limit: int,
        content_type: ContentTypeEnum | None,
    ) -> SimilarContentListGet:
        started_at = time.perf_counter()
        request_id = get_request_id()
        graph_limit = max(limit * max(settings.recommendations.graph_limit_multiplier, 1), limit)
        neo4j_ms = 0.0
        postgres_hydration_ms = 0.0
        projection_ms = 0.0
        cache_read_ms = 0.0
        cache_write_ms = 0.0

        cache_key = build_recommendations_similar_cache_key(
            content_id=content_id,
            content_type=content_type.value if content_type is not None else "all",
            limit=limit,
        )
        cache_started_at = time.perf_counter()
        cached_payload = await self._cache_service.get_json(
            cache_key,
            namespace=CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR,
        )
        cache_read_ms = self._to_milliseconds(time.perf_counter() - cache_started_at)

        graph_rows: list[SimilarContentGraphResult] = []
        cache_hit = False
        if cached_payload is not None:
            cached_rows = self._deserialize_similar_rows(cached_payload)
            if cached_rows is not None:
                graph_rows = cached_rows
                cache_hit = True

        if not cache_hit:
            graph_started_at = time.perf_counter()
            try:
                graph_rows = await self._graph_repository.get_similar_content(
                    content_id=content_id,
                    limit=graph_limit,
                    content_type=content_type.value if content_type is not None else None,
                )
                neo4j_ms = self._to_milliseconds(time.perf_counter() - graph_started_at)
            except Exception:
                neo4j_ms = self._to_milliseconds(time.perf_counter() - graph_started_at)
                logger.exception("Neo4j similar-content query failed")
                total_ms = self._to_milliseconds(time.perf_counter() - started_at)
                observe_recommendations_similar(total_seconds=total_ms / 1000)
                self._log_timing_event(
                    level=logging.ERROR,
                    message="recommendations similar completed",
                    extra={
                        "event": "recommendations.similar",
                        "request_id": request_id,
                        "content_id": str(content_id),
                        "viewer_id": str(viewer_id) if viewer_id is not None else None,
                        "neo4j_ms": neo4j_ms,
                        "postgres_hydration_ms": postgres_hydration_ms,
                        "projection_ms": projection_ms,
                        "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR,
                        "cache_key_hash": self._key_digest(cache_key),
                        "cache_hit": False,
                        "cache_read_ms": cache_read_ms,
                        "cache_write_ms": cache_write_ms,
                        "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                        "total_ms": total_ms,
                        "items_count": 0,
                        "error": True,
                    },
                )
                return SimilarContentListGet(items=[], limit=limit)

            cache_write_started_at = time.perf_counter()
            await self._cache_service.set_json(
                cache_key,
                self._serialize_similar_rows(graph_rows),
                settings.cache.similar_content_ttl_seconds,
                namespace=CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR,
            )
            cache_write_ms = self._to_milliseconds(time.perf_counter() - cache_write_started_at)

        if not graph_rows:
            total_ms = self._to_milliseconds(time.perf_counter() - started_at)
            observe_recommendations_similar(total_seconds=total_ms / 1000)
            self._log_timing_event(
                level=logging.INFO,
                message="recommendations similar completed",
                extra={
                    "event": "recommendations.similar",
                    "request_id": request_id,
                    "content_id": str(content_id),
                    "viewer_id": str(viewer_id) if viewer_id is not None else None,
                    "neo4j_ms": neo4j_ms,
                    "postgres_hydration_ms": postgres_hydration_ms,
                    "projection_ms": projection_ms,
                    "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR,
                    "cache_key_hash": self._key_digest(cache_key),
                    "cache_hit": cache_hit,
                    "cache_read_ms": cache_read_ms,
                    "cache_write_ms": cache_write_ms,
                    "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                    "total_ms": total_ms,
                    "items_count": 0,
                    "error": False,
                },
            )
            return SimilarContentListGet(items=[], limit=limit)

        hydration_started_at = time.perf_counter()
        hydrated = await self._postgres_repository.get_visible_content_by_ids(
            content_ids=[row.content_id for row in graph_rows],
            viewer_id=viewer_id,
        )
        postgres_hydration_ms = self._to_milliseconds(time.perf_counter() - hydration_started_at)

        projection_started_at = time.perf_counter()
        items: list[SimilarContentItemGet] = []
        for row in graph_rows:
            content = hydrated.get(row.content_id)
            if content is None:
                continue
            if content_type is not None and content.content_type != content_type:
                continue
            projector = self._projector_registry.get(content.content_type)
            projected = await projector.project_feed_item(
                content,
                viewer_id=viewer_id,
                storage=self._asset_storage,
            )
            items.append(
                SimilarContentItemGet(
                    content_id=row.content_id,
                    score=row.score,
                    reason=row.reason,
                    content=projected,
                )
            )
            if len(items) >= limit:
                break
        projection_ms = self._to_milliseconds(time.perf_counter() - projection_started_at)

        total_ms = self._to_milliseconds(time.perf_counter() - started_at)
        observe_recommendations_similar(total_seconds=total_ms / 1000)
        self._log_timing_event(
            level=self._slow_level(total_ms),
            message="recommendations similar completed",
            extra={
                "event": "recommendations.similar",
                "request_id": request_id,
                "content_id": str(content_id),
                "viewer_id": str(viewer_id) if viewer_id is not None else None,
                "neo4j_ms": neo4j_ms,
                "postgres_hydration_ms": postgres_hydration_ms,
                "projection_ms": projection_ms,
                "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR,
                "cache_key_hash": self._key_digest(cache_key),
                "cache_hit": cache_hit,
                "cache_read_ms": cache_read_ms,
                "cache_write_ms": cache_write_ms,
                "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                "total_ms": total_ms,
                "items_count": len(items),
                "error": False,
            },
        )

        return SimilarContentListGet(items=items, limit=limit)

    async def get_recommendations_feed(
        self,
        *,
        viewer_id: uuid.UUID | None,
        content_type: RecommendationFeedContentTypeEnum,
        sort: RecommendationFeedSortEnum,
        offset: int,
        limit: int,
    ) -> list[ContentListItemGet]:
        started_at = time.perf_counter()
        request_id = get_request_id()
        target_content_type = self._resolve_content_type(content_type)

        graph_rows: list[RecommendationFeedGraphResult] = []
        graph_failed = False
        neo4j_ms = 0.0
        postgres_hydration_ms = 0.0
        fallback_ms = 0.0
        projection_ms = 0.0
        fallback_used = False
        cache_read_ms = 0.0
        cache_write_ms = 0.0

        cache_key = build_recommendations_feed_cache_key(
            viewer_id=viewer_id,
            content_type=content_type.value,
            sort=sort.value,
            offset=offset,
            limit=limit,
        )
        cache_started_at = time.perf_counter()
        cached_payload = await self._cache_service.get_json(
            cache_key,
            namespace=CACHE_NAMESPACE_RECOMMENDATIONS_FEED,
        )
        cache_read_ms = self._to_milliseconds(time.perf_counter() - cache_started_at)

        cache_hit = False
        if cached_payload is not None:
            cached_rows = self._deserialize_feed_rows(cached_payload)
            if cached_rows is not None:
                graph_rows = cached_rows
                cache_hit = True

        if not cache_hit and viewer_id is not None:
            graph_started_at = time.perf_counter()
            try:
                graph_rows = await self._graph_repository.get_recommendation_feed(
                    viewer_id=viewer_id,
                    content_type=target_content_type.value if target_content_type is not None else None,
                    sort=sort.value,
                    offset=offset,
                    limit=limit,
                )
                neo4j_ms = self._to_milliseconds(time.perf_counter() - graph_started_at)
            except Exception:
                graph_failed = True
                logger.exception("Neo4j recommendations feed query failed")
                neo4j_ms = self._to_milliseconds(time.perf_counter() - graph_started_at)

            if not graph_failed:
                cache_write_started_at = time.perf_counter()
                cached = await self._cache_service.set_json(
                    cache_key,
                    self._serialize_feed_rows(graph_rows),
                    settings.cache.recommendation_feed_ttl_seconds,
                    namespace=CACHE_NAMESPACE_RECOMMENDATIONS_FEED,
                )
                cache_write_ms = self._to_milliseconds(time.perf_counter() - cache_write_started_at)
                if cached and viewer_id is not None:
                    await self._cache_service.add_index_member(
                        index_key=build_recommendations_feed_user_index_key(viewer_id=viewer_id),
                        member_key=cache_key,
                        ttl_seconds=settings.cache.recommendation_feed_ttl_seconds,
                        namespace=CACHE_NAMESPACE_RECOMMENDATIONS_FEED,
                    )

        hydrated = {}
        if graph_rows:
            hydration_started_at = time.perf_counter()
            hydrated = await self._postgres_repository.get_visible_content_by_ids(
                content_ids=[row.content_id for row in graph_rows],
                viewer_id=viewer_id,
            )
            postgres_hydration_ms = self._to_milliseconds(time.perf_counter() - hydration_started_at)

        projection_started_at = time.perf_counter()
        items = await self._project_recommendation_rows(
            rows=graph_rows,
            hydrated=hydrated,
            viewer_id=viewer_id,
            content_type=target_content_type,
            limit=limit,
        )
        projection_ms += self._to_milliseconds(time.perf_counter() - projection_started_at)

        if len(items) < limit:
            fallback_needed = limit - len(items)
            fallback_used = True
            fallback_started_at = time.perf_counter()
            fallback_items = await self._postgres_repository.get_recommendation_fallback_content(
                viewer_id=viewer_id,
                content_type=target_content_type,
                sort=sort.value,
                offset=offset if graph_failed or not graph_rows else 0,
                limit=fallback_needed,
                exclude_content_ids=[item.content_id for item in items],
            )
            fallback_ms = self._to_milliseconds(time.perf_counter() - fallback_started_at)

            fallback_projection_started_at = time.perf_counter()
            for content in fallback_items:
                items.append(await self._project_content(content=content, viewer_id=viewer_id))
                if len(items) >= limit:
                    break
            projection_ms += self._to_milliseconds(time.perf_counter() - fallback_projection_started_at)

            if not cache_hit and viewer_id is None:
                cache_payload = [
                    {
                        "content_id": str(item.content_id),
                        "score": 0.0,
                        "reason": "fallback_popular",
                    }
                    for item in items
                ]
                cache_write_started_at = time.perf_counter()
                await self._cache_service.set_json(
                    cache_key,
                    cache_payload,
                    settings.cache.recommendation_feed_ttl_seconds,
                    namespace=CACHE_NAMESPACE_RECOMMENDATIONS_FEED,
                )
                cache_write_ms += self._to_milliseconds(time.perf_counter() - cache_write_started_at)

        total_ms = self._to_milliseconds(time.perf_counter() - started_at)
        observe_recommendations_feed(
            total_seconds=total_ms / 1000,
            neo4j_seconds=neo4j_ms / 1000,
            postgres_seconds=postgres_hydration_ms / 1000,
            fallback_used=fallback_used,
        )
        self._log_timing_event(
            level=self._slow_level(total_ms),
            message="recommendations feed completed",
            extra={
                "event": "recommendations.feed",
                "request_id": request_id,
                "viewer_id": str(viewer_id) if viewer_id is not None else None,
                "content_type": content_type.value,
                "sort": sort.value,
                "offset": offset,
                "limit": limit,
                "neo4j_ms": neo4j_ms,
                "postgres_hydration_ms": postgres_hydration_ms,
                "fallback_ms": fallback_ms,
                "projection_ms": projection_ms,
                "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_FEED,
                "cache_key_hash": self._key_digest(cache_key),
                "cache_hit": cache_hit,
                "cache_read_ms": cache_read_ms,
                "cache_write_ms": cache_write_ms,
                "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                "total_ms": total_ms,
                "items_count": len(items),
                "fallback_used": fallback_used,
                "error": graph_failed,
            },
        )

        return items

    async def get_recommended_authors(
        self,
        *,
        viewer_id: uuid.UUID,
        offset: int,
        limit: int,
    ) -> list[RecommendedAuthorItemGet]:
        started_at = time.perf_counter()
        request_id = get_request_id()
        graph_limit = max(limit * max(settings.recommendations.graph_limit_multiplier, 1), limit)
        neo4j_ms = 0.0
        postgres_ms = 0.0
        cache_read_ms = 0.0
        cache_write_ms = 0.0

        cache_key = build_recommendations_authors_cache_key(
            viewer_id=viewer_id,
            offset=offset,
            limit=limit,
        )
        cache_started_at = time.perf_counter()
        cached_payload = await self._cache_service.get_json(
            cache_key,
            namespace=CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
        )
        cache_read_ms = self._to_milliseconds(time.perf_counter() - cache_started_at)

        graph_rows: list[RecommendationAuthorGraphResult] = []
        cache_hit = False
        if cached_payload is not None:
            cached_rows = self._deserialize_author_rows(cached_payload)
            if cached_rows is not None:
                graph_rows = cached_rows
                cache_hit = True

        if not cache_hit:
            graph_started_at = time.perf_counter()
            try:
                graph_rows = await self._graph_repository.get_recommended_authors(
                    viewer_id=viewer_id,
                    offset=offset,
                    limit=graph_limit,
                )
                neo4j_ms = self._to_milliseconds(time.perf_counter() - graph_started_at)
            except Exception:
                neo4j_ms = self._to_milliseconds(time.perf_counter() - graph_started_at)
                logger.exception("Neo4j recommended-authors query failed")
                total_ms = self._to_milliseconds(time.perf_counter() - started_at)
                observe_recommendations_authors(total_seconds=total_ms / 1000)
                self._log_timing_event(
                    level=logging.ERROR,
                    message="recommendations authors completed",
                    extra={
                        "event": "recommendations.authors",
                        "request_id": request_id,
                        "viewer_id": str(viewer_id),
                        "neo4j_ms": neo4j_ms,
                        "postgres_ms": postgres_ms,
                        "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
                        "cache_key_hash": self._key_digest(cache_key),
                        "cache_hit": False,
                        "cache_read_ms": cache_read_ms,
                        "cache_write_ms": cache_write_ms,
                        "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                        "total_ms": total_ms,
                        "items_count": 0,
                        "error": True,
                    },
                )
                return []

            cache_write_started_at = time.perf_counter()
            cached = await self._cache_service.set_json(
                cache_key,
                self._serialize_author_rows(graph_rows),
                settings.cache.recommended_authors_ttl_seconds,
                namespace=CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
            )
            cache_write_ms = self._to_milliseconds(time.perf_counter() - cache_write_started_at)
            if cached:
                await self._cache_service.add_index_member(
                    index_key=build_recommendations_authors_user_index_key(viewer_id=viewer_id),
                    member_key=cache_key,
                    ttl_seconds=settings.cache.recommended_authors_ttl_seconds,
                    namespace=CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
                )

        if not graph_rows:
            total_ms = self._to_milliseconds(time.perf_counter() - started_at)
            observe_recommendations_authors(total_seconds=total_ms / 1000)
            self._log_timing_event(
                level=logging.INFO,
                message="recommendations authors completed",
                extra={
                    "event": "recommendations.authors",
                    "request_id": request_id,
                    "viewer_id": str(viewer_id),
                    "neo4j_ms": neo4j_ms,
                    "postgres_ms": postgres_ms,
                    "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
                    "cache_key_hash": self._key_digest(cache_key),
                    "cache_hit": cache_hit,
                    "cache_read_ms": cache_read_ms,
                    "cache_write_ms": cache_write_ms,
                    "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                    "total_ms": total_ms,
                    "items_count": 0,
                    "error": False,
                },
            )
            return []

        candidate_user_ids = [row.user_id for row in graph_rows]
        postgres_started_at = time.perf_counter()
        users_by_id = await self._postgres_repository.get_users_by_ids(user_ids=candidate_user_ids)
        visible_author_ids = await self._postgres_repository.get_public_author_ids_by_ids(author_ids=candidate_user_ids)
        subscribed_author_ids = await self._postgres_repository.get_subscribed_user_ids(subscriber_id=viewer_id)
        postgres_ms = self._to_milliseconds(time.perf_counter() - postgres_started_at)

        items: list[RecommendedAuthorItemGet] = []
        for row in graph_rows:
            if row.user_id == viewer_id:
                continue
            if row.user_id in subscribed_author_ids:
                continue
            if row.user_id not in visible_author_ids:
                continue

            author_model = users_by_id.get(row.user_id)
            if author_model is None:
                continue

            author = await build_user_get(
                author_model,
                viewer_id=viewer_id,
                storage=self._asset_storage,
            )
            if bool(author.is_subscribed):
                continue

            items.append(
                RecommendedAuthorItemGet(
                    user_id=row.user_id,
                    score=row.score,
                    reason=row.reason,
                    author=author,
                )
            )
            if len(items) >= limit:
                break

        total_ms = self._to_milliseconds(time.perf_counter() - started_at)
        observe_recommendations_authors(total_seconds=total_ms / 1000)
        self._log_timing_event(
            level=self._slow_level(total_ms),
            message="recommendations authors completed",
            extra={
                "event": "recommendations.authors",
                "request_id": request_id,
                "viewer_id": str(viewer_id),
                "neo4j_ms": neo4j_ms,
                "postgres_ms": postgres_ms,
                "cache_namespace": CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS,
                "cache_key_hash": self._key_digest(cache_key),
                "cache_hit": cache_hit,
                "cache_read_ms": cache_read_ms,
                "cache_write_ms": cache_write_ms,
                "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                "total_ms": total_ms,
                "items_count": len(items),
                "error": False,
            },
        )

        return items

    async def _project_recommendation_rows(
        self,
        *,
        rows: list[RecommendationFeedGraphResult],
        hydrated: dict[uuid.UUID, object],
        viewer_id: uuid.UUID | None,
        content_type: ContentTypeEnum | None,
        limit: int,
    ) -> list[ContentListItemGet]:
        if not rows:
            return []
        items: list[ContentListItemGet] = []
        for row in rows:
            content = hydrated.get(row.content_id)
            if content is None:
                continue
            if content_type is not None and content.content_type != content_type:
                continue
            items.append(await self._project_content(content=content, viewer_id=viewer_id))
            if len(items) >= limit:
                break
        return items

    async def _project_content(self, *, content, viewer_id: uuid.UUID | None) -> ContentListItemGet:
        projector = self._projector_registry.get(content.content_type)
        return await projector.project_feed_item(
            content,
            viewer_id=viewer_id,
            storage=self._asset_storage,
        )

    @staticmethod
    def _serialize_feed_rows(rows: list[RecommendationFeedGraphResult]) -> list[dict[str, object]]:
        return [
            {
                "content_id": str(row.content_id),
                "score": float(row.score),
                "reason": row.reason,
            }
            for row in rows
        ]

    @staticmethod
    def _serialize_similar_rows(rows: list[SimilarContentGraphResult]) -> list[dict[str, object]]:
        return [
            {
                "content_id": str(row.content_id),
                "score": float(row.score),
                "reason": row.reason,
            }
            for row in rows
        ]

    @staticmethod
    def _serialize_author_rows(rows: list[RecommendationAuthorGraphResult]) -> list[dict[str, object]]:
        return [
            {
                "user_id": str(row.user_id),
                "score": float(row.score),
                "reason": row.reason,
            }
            for row in rows
        ]

    @staticmethod
    def _deserialize_feed_rows(payload: object) -> list[RecommendationFeedGraphResult] | None:
        if not isinstance(payload, list):
            return None

        rows: list[RecommendationFeedGraphResult] = []
        for raw_item in payload:
            if not isinstance(raw_item, dict):
                continue
            content_id = raw_item.get("content_id")
            if not isinstance(content_id, str):
                continue
            try:
                rows.append(
                    RecommendationFeedGraphResult(
                        content_id=uuid.UUID(content_id),
                        score=float(raw_item.get("score") or 0.0),
                        reason=str(raw_item.get("reason") or "personalized_graph_feed"),
                    )
                )
            except (TypeError, ValueError):
                continue
        return rows

    @staticmethod
    def _deserialize_similar_rows(payload: object) -> list[SimilarContentGraphResult] | None:
        if not isinstance(payload, list):
            return None

        rows: list[SimilarContentGraphResult] = []
        for raw_item in payload:
            if not isinstance(raw_item, dict):
                continue
            content_id = raw_item.get("content_id")
            if not isinstance(content_id, str):
                continue
            try:
                rows.append(
                    SimilarContentGraphResult(
                        content_id=uuid.UUID(content_id),
                        score=float(raw_item.get("score") or 0.0),
                        reason=str(raw_item.get("reason") or "quality"),
                    )
                )
            except (TypeError, ValueError):
                continue
        return rows

    @staticmethod
    def _deserialize_author_rows(payload: object) -> list[RecommendationAuthorGraphResult] | None:
        if not isinstance(payload, list):
            return None

        rows: list[RecommendationAuthorGraphResult] = []
        for raw_item in payload:
            if not isinstance(raw_item, dict):
                continue
            user_id = raw_item.get("user_id")
            if not isinstance(user_id, str):
                continue
            try:
                rows.append(
                    RecommendationAuthorGraphResult(
                        user_id=uuid.UUID(user_id),
                        score=float(raw_item.get("score") or 0.0),
                        reason=str(raw_item.get("reason") or "topic_author_affinity"),
                    )
                )
            except (TypeError, ValueError):
                continue
        return rows

    @staticmethod
    def _resolve_content_type(
        content_type: RecommendationFeedContentTypeEnum,
    ) -> ContentTypeEnum | None:
        if content_type == RecommendationFeedContentTypeEnum.ALL:
            return None
        return ContentTypeEnum(content_type.value)

    @staticmethod
    def _to_milliseconds(duration_seconds: float) -> float:
        return round(duration_seconds * 1000, 3)

    @staticmethod
    def _log_timing_event(*, level: int, message: str, extra: dict) -> None:
        logger.log(level, message, extra=extra)

    @staticmethod
    def _key_digest(key: str) -> str:
        return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]

    @staticmethod
    def _slow_level(total_ms: float) -> int:
        if total_ms > settings.logging.slow_recommendation_threshold_ms:
            return logging.WARNING
        return logging.INFO
