from __future__ import annotations

import uuid


KEY_VERSION = "v1"

CACHE_NAMESPACE_RECOMMENDATIONS_FEED = "recommendations_feed"
CACHE_NAMESPACE_RECOMMENDATIONS_SIMILAR = "recommendations_similar"
CACHE_NAMESPACE_RECOMMENDATIONS_AUTHORS = "recommendations_authors"
CACHE_NAMESPACE_SEARCH_POPULAR = "search_popular"
CACHE_NAMESPACE_TAGS = "tags"
CACHE_NAMESPACE_ASSETS = "assets"


def build_recommendations_feed_cache_key(
    *,
    viewer_id: uuid.UUID | None,
    content_type: str,
    sort: str,
    offset: int,
    limit: int,
) -> str:
    viewer_part = str(viewer_id) if viewer_id is not None else "anonymous"
    return (
        f"{KEY_VERSION}:recommendations:feed:{viewer_part}:{content_type}:{sort}:{offset}:{limit}"
    )


def build_recommendations_similar_cache_key(
    *,
    content_id: uuid.UUID,
    content_type: str,
    limit: int,
) -> str:
    return f"{KEY_VERSION}:recommendations:similar:{content_id}:{content_type}:{limit}"


def build_recommendations_authors_cache_key(
    *,
    viewer_id: uuid.UUID,
    offset: int,
    limit: int,
) -> str:
    return f"{KEY_VERSION}:recommendations:authors:{viewer_id}:{offset}:{limit}"


def build_search_popular_cache_key(
    *,
    period: str,
    content_type: str,
    offset: int,
    limit: int,
) -> str:
    return f"{KEY_VERSION}:search:popular:{period}:{content_type}:{offset}:{limit}"


def build_recommendations_feed_user_index_key(*, viewer_id: uuid.UUID) -> str:
    return f"{KEY_VERSION}:cache-index:recommendations:feed:{viewer_id}"


def build_recommendations_authors_user_index_key(*, viewer_id: uuid.UUID) -> str:
    return f"{KEY_VERSION}:cache-index:recommendations:authors:{viewer_id}"


def build_tag_suggestions_cache_key(*, prefix: str, limit: int) -> str:
    return f"{KEY_VERSION}:tags:suggestions:{prefix}:{limit}"


def build_presigned_get_cache_key(
    *,
    bucket: str,
    key: str,
    download_filename: str | None,
    inline: bool,
    response_content_type: str | None,
    expires_in: int,
) -> str:
    filename_part = download_filename or ""
    content_type_part = response_content_type or ""
    return (
        f"{KEY_VERSION}:assets:presigned-get:{bucket}:{key}:{inline}:"
        f"{filename_part}:{content_type_part}:{expires_in}"
    )
