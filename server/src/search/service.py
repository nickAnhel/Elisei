from __future__ import annotations

import hashlib
import logging
import time
import uuid

from src.cache.keys import CACHE_NAMESPACE_SEARCH_POPULAR, build_search_popular_cache_key
from src.cache.service import CacheService
from src.content.enums import ContentTypeEnum
from src.content.projectors import ContentProjectorRegistry
from src.config import settings
from src.observability.context import get_request_id
from src.search.enums import SearchContentTypeEnum, SearchPopularPeriodEnum, SearchSortEnum, SearchTypeEnum
from src.search.repository import SearchContentMatch, SearchRepository
from src.search.schemas import SearchListGet, SearchResultItemGet
from src.users.presentation import build_user_get


logger = logging.getLogger(__name__)


class SearchService:
    def __init__(
        self,
        repository: SearchRepository,
        projector_registry: ContentProjectorRegistry,
        asset_storage,
        cache_service: CacheService,
    ) -> None:
        self._repository = repository
        self._projector_registry = projector_registry
        self._asset_storage = asset_storage
        self._cache_service = cache_service

    async def search(
        self,
        *,
        query: str,
        search_type: SearchTypeEnum,
        sort: SearchSortEnum,
        offset: int,
        limit: int,
        viewer_id: uuid.UUID | None,
    ) -> SearchListGet:
        normalized_query = " ".join(query.split())
        if not normalized_query:
            return SearchListGet(items=[], offset=offset, limit=limit, has_more=False)

        if search_type == SearchTypeEnum.AUTHOR:
            author_matches, has_more = await self._repository.search_authors(
                query_text=normalized_query,
                sort=sort,
                offset=offset,
                limit=limit,
            )
            authors = await self._repository.get_users_by_ids(
                user_ids=[match.author_id for match in author_matches],
            )
            items = []
            for match in author_matches:
                author = authors.get(match.author_id)
                if author is None:
                    continue
                items.append(
                    SearchResultItemGet(
                        result_type="author",
                        content=None,
                        author=await build_user_get(
                            author,
                            viewer_id=viewer_id,
                            storage=self._asset_storage,
                        ),
                        score=match.score,
                    )
                )
            return SearchListGet(items=items, offset=offset, limit=limit, has_more=has_more)

        if search_type == SearchTypeEnum.ALL:
            mixed_matches, has_more = await self._repository.search_all(
                query_text=normalized_query,
                sort=sort,
                offset=offset,
                limit=limit,
            )
            content_ids = [match.content_id for match in mixed_matches if match.content_id is not None]
            author_ids = [match.author_id for match in mixed_matches if match.author_id is not None]
            content_map = await self._repository.get_content_by_ids(
                content_ids=content_ids,
                viewer_id=viewer_id,
            )
            author_map = await self._repository.get_users_by_ids(user_ids=author_ids)
            items = []
            for match in mixed_matches:
                if match.result_type == "content" and match.content_id is not None:
                    content = content_map.get(match.content_id)
                    if content is None:
                        continue
                    projector = self._projector_registry.get(content.content_type)
                    items.append(
                        SearchResultItemGet(
                            result_type="content",
                            content=await projector.project_feed_item(
                                content,
                                viewer_id=viewer_id,
                                storage=self._asset_storage,
                            ),
                            author=None,
                            score=match.score,
                        )
                    )
                elif match.result_type == "author" and match.author_id is not None:
                    author = author_map.get(match.author_id)
                    if author is None:
                        continue
                    items.append(
                        SearchResultItemGet(
                            result_type="author",
                            content=None,
                            author=await build_user_get(
                                author,
                                viewer_id=viewer_id,
                                storage=self._asset_storage,
                            ),
                            score=match.score,
                        )
                    )
            return SearchListGet(items=items, offset=offset, limit=limit, has_more=has_more)

        content_type = self._content_type_from_search_type(search_type)
        content_matches, has_more = await self._repository.search_content(
            query_text=normalized_query,
            content_type=content_type,
            sort=sort,
            offset=offset,
            limit=limit,
        )
        content_map = await self._repository.get_content_by_ids(
            content_ids=[match.content_id for match in content_matches],
            viewer_id=viewer_id,
        )

        items = []
        for match in content_matches:
            content = content_map.get(match.content_id)
            if content is None:
                continue
            projector = self._projector_registry.get(content.content_type)
            items.append(
                SearchResultItemGet(
                    result_type="content",
                    content=await projector.project_feed_item(
                        content,
                        viewer_id=viewer_id,
                        storage=self._asset_storage,
                    ),
                    author=None,
                    score=match.score,
                )
            )

        return SearchListGet(items=items, offset=offset, limit=limit, has_more=has_more)

    async def search_popular(
        self,
        *,
        search_type: SearchContentTypeEnum,
        period: SearchPopularPeriodEnum,
        offset: int,
        limit: int,
        viewer_id: uuid.UUID | None,
    ) -> SearchListGet:
        started_at = time.perf_counter()
        request_id = get_request_id()
        content_type = self._content_type_from_search_content_type(search_type)
        cache_key = build_search_popular_cache_key(
            period=period.value,
            content_type=search_type.value,
            offset=offset,
            limit=limit,
        )

        cache_read_started_at = time.perf_counter()
        cached_payload = await self._cache_service.get_json(
            cache_key,
            namespace=CACHE_NAMESPACE_SEARCH_POPULAR,
        )
        cache_read_ms = self._to_milliseconds(time.perf_counter() - cache_read_started_at)

        cache_hit = False
        has_more = False
        content_matches: list[SearchContentMatch] = []

        if cached_payload is not None:
            parsed = self._deserialize_popular_cache_payload(cached_payload)
            if parsed is not None:
                content_matches, has_more = parsed
                cache_hit = True

        cache_write_ms = 0.0
        if not cache_hit:
            content_matches, has_more = await self._repository.search_popular_content(
                content_type=content_type,
                period=period,
                offset=offset,
                limit=limit,
            )
            cache_write_started_at = time.perf_counter()
            await self._cache_service.set_json(
                cache_key,
                {
                    "items": self._serialize_popular_content_matches(content_matches),
                    "has_more": has_more,
                },
                settings.cache.search_popular_ttl_seconds,
                namespace=CACHE_NAMESPACE_SEARCH_POPULAR,
            )
            cache_write_ms = self._to_milliseconds(time.perf_counter() - cache_write_started_at)

        content_map = await self._repository.get_content_by_ids(
            content_ids=[match.content_id for match in content_matches],
            viewer_id=viewer_id,
        )

        items = []
        for match in content_matches:
            content = content_map.get(match.content_id)
            if content is None:
                continue
            projector = self._projector_registry.get(content.content_type)
            items.append(
                SearchResultItemGet(
                    result_type="content",
                    content=await projector.project_feed_item(
                        content,
                        viewer_id=viewer_id,
                        storage=self._asset_storage,
                    ),
                    author=None,
                    score=match.score,
                )
            )

        total_ms = self._to_milliseconds(time.perf_counter() - started_at)
        logger.info(
            "search popular completed",
            extra={
                "event": "search.popular",
                "request_id": request_id,
                "period": period.value,
                "content_type": search_type.value,
                "offset": offset,
                "limit": limit,
                "cache_namespace": CACHE_NAMESPACE_SEARCH_POPULAR,
                "cache_key_hash": self._key_digest(cache_key),
                "cache_hit": cache_hit,
                "cache_read_ms": cache_read_ms,
                "cache_write_ms": cache_write_ms,
                "cache_ms": round(cache_read_ms + cache_write_ms, 3),
                "total_ms": total_ms,
                "items_count": len(items),
            },
        )

        return SearchListGet(items=items, offset=offset, limit=limit, has_more=has_more)

    async def search_popular_authors(
        self,
        *,
        period: SearchPopularPeriodEnum,
        offset: int,
        limit: int,
        viewer_id: uuid.UUID | None,
    ) -> SearchListGet:
        author_matches, has_more = await self._repository.search_popular_authors(
            period=period,
            offset=offset,
            limit=limit,
        )
        authors = await self._repository.get_users_by_ids(
            user_ids=[match.author_id for match in author_matches],
        )

        items = []
        for match in author_matches:
            author = authors.get(match.author_id)
            if author is None:
                continue
            items.append(
                SearchResultItemGet(
                    result_type="author",
                    content=None,
                    author=await build_user_get(
                        author,
                        viewer_id=viewer_id,
                        storage=self._asset_storage,
                    ),
                    score=match.score,
                )
            )
        return SearchListGet(items=items, offset=offset, limit=limit, has_more=has_more)

    def _content_type_from_search_type(self, search_type: SearchTypeEnum) -> ContentTypeEnum:
        mapping = {
            SearchTypeEnum.POST: ContentTypeEnum.POST,
            SearchTypeEnum.ARTICLE: ContentTypeEnum.ARTICLE,
            SearchTypeEnum.VIDEO: ContentTypeEnum.VIDEO,
            SearchTypeEnum.MOMENT: ContentTypeEnum.MOMENT,
        }
        content_type = mapping.get(search_type)
        if content_type is None:
            raise ValueError(f"Unsupported search type: {search_type}")
        return content_type

    def _content_type_from_search_content_type(self, search_type: SearchContentTypeEnum) -> ContentTypeEnum | None:
        if search_type == SearchContentTypeEnum.ALL:
            return None
        mapping = {
            SearchContentTypeEnum.POST: ContentTypeEnum.POST,
            SearchContentTypeEnum.ARTICLE: ContentTypeEnum.ARTICLE,
            SearchContentTypeEnum.VIDEO: ContentTypeEnum.VIDEO,
            SearchContentTypeEnum.MOMENT: ContentTypeEnum.MOMENT,
        }
        content_type = mapping.get(search_type)
        if content_type is None:
            raise ValueError(f"Unsupported search content type: {search_type}")
        return content_type

    @staticmethod
    def _serialize_popular_content_matches(matches: list[SearchContentMatch]) -> list[dict[str, object]]:
        return [
            {
                "content_id": str(match.content_id),
                "score": float(match.score),
            }
            for match in matches
        ]

    @staticmethod
    def _deserialize_popular_cache_payload(payload: object) -> tuple[list[SearchContentMatch], bool] | None:
        if isinstance(payload, list):
            parsed_items = payload
            parsed_has_more = False
        elif isinstance(payload, dict):
            parsed_items = payload.get("items")
            parsed_has_more = bool(payload.get("has_more"))
        else:
            return None

        if not isinstance(parsed_items, list):
            return None

        matches: list[SearchContentMatch] = []
        for raw_item in parsed_items:
            if not isinstance(raw_item, dict):
                continue
            content_id = raw_item.get("content_id")
            if not isinstance(content_id, str):
                continue
            try:
                matches.append(
                    SearchContentMatch(
                        content_id=uuid.UUID(content_id),
                        score=float(raw_item.get("score") or 0.0),
                    )
                )
            except (TypeError, ValueError):
                continue

        return matches, parsed_has_more

    @staticmethod
    def _to_milliseconds(duration_seconds: float) -> float:
        return round(duration_seconds * 1000, 3)

    @staticmethod
    def _key_digest(key: str) -> str:
        return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]
