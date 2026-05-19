import uuid

import pytest

from src.recommendations.graph_repository import RecommendationGraphRepository


class DummyDriver:
    pass


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_feed_query_contains_required_visibility_and_exclusion_filters() -> None:
    repository = RecommendationGraphRepository(driver=DummyDriver(), database="neo4j")
    captured: dict = {}

    async def fake_read(query, parameters=None):  # type: ignore[no-untyped-def]
        captured["query"] = query
        captured["parameters"] = parameters or {}
        return [
            {
                "content_id": str(uuid.uuid4()),
                "score": 12.5,
                "reason": "personalized_graph_feed",
            }
        ]

    repository._read = fake_read  # type: ignore[method-assign]

    await repository.get_recommendation_feed(
        viewer_id=uuid.uuid4(),
        content_type="video",
        sort="relevance",
        offset=0,
        limit=10,
    )

    query = captured["query"]
    assert "candidate.status = 'published'" in query
    assert "candidate.visibility = 'public'" in query
    assert "MATCH (:User {user_id: $viewer_id})-[rel:RECOMMENDED_CONTENT]->(candidate:Content)" in query
    assert "candidate.deleted_at IS NULL" in query
    assert "coalesce(rel.reason, 'personalized_graph_feed')" in query
    assert captured["parameters"]["content_type"] == "video"
    assert captured["parameters"]["sort"] == "relevance"


@pytest.mark.anyio
async def test_feed_query_accepts_anonymous_viewer() -> None:
    repository = RecommendationGraphRepository(driver=DummyDriver(), database="neo4j")
    captured: dict = {}

    async def fake_read(query, parameters=None):  # type: ignore[no-untyped-def]
        captured["parameters"] = parameters or {}
        return []

    repository._read = fake_read  # type: ignore[method-assign]

    rows = await repository.get_recommendation_feed(
        viewer_id=None,
        content_type=None,
        sort="newest",
        offset=5,
        limit=7,
    )

    assert rows == []
    assert captured == {}


@pytest.mark.anyio
async def test_recompute_recommended_content_contains_filters_and_scores() -> None:
    repository = RecommendationGraphRepository(driver=DummyDriver(), database="neo4j")
    captured_writes: list[str] = []
    user_id = uuid.uuid4()

    async def fake_write(query, parameters=None):  # type: ignore[no-untyped-def]
        captured_writes.append(query)

    async def fake_read(query, parameters=None):  # type: ignore[no-untyped-def]
        if "RETURN u.user_id AS user_id" in query:
            return [{"user_id": str(user_id)}]
        if "RETURN count(rel) AS edges_count" in query:
            return [{"edges_count": 8}]
        return []

    repository._write = fake_write  # type: ignore[method-assign]
    repository._read = fake_read  # type: ignore[method-assign]

    stats = await repository.recompute_recommended_content([user_id], per_user_limit=50)

    assert stats == {"users_recomputed": 1, "edges_created": 8}
    recompute_query = next(query for query in captured_writes if "RECOMMENDED_CONTENT" in query and "MERGE" in query)
    assert "candidate.status = 'published'" in recompute_query
    assert "candidate.visibility = 'public'" in recompute_query
    assert "candidate.deleted_at IS NULL" in recompute_query
    assert "candidate.author_id <> u.user_id" in recompute_query
    assert "MATCH (u)-[:DISLIKED]->(candidate)" in recompute_query
    assert "coalesce(seen.progress_percent, 0) >= 90" in recompute_query


@pytest.mark.anyio
async def test_recommended_authors_query_excludes_self_followed_and_requires_published_public_content() -> None:
    repository = RecommendationGraphRepository(driver=DummyDriver(), database="neo4j")
    captured: dict = {}
    viewer_id = uuid.uuid4()

    async def fake_read(query, parameters=None):  # type: ignore[no-untyped-def]
        captured["query"] = query
        captured["parameters"] = parameters or {}
        return [
            {
                "user_id": str(uuid.uuid4()),
                "score": 7.8,
                "reason": "topic_author_affinity",
            }
        ]

    repository._read = fake_read  # type: ignore[method-assign]

    rows = await repository.get_recommended_authors(
        viewer_id=viewer_id,
        offset=4,
        limit=6,
    )

    assert len(rows) == 1
    query = captured["query"]
    assert "candidate.user_id <> viewer.user_id" in query
    assert "MATCH (viewer)-[:FOLLOWS]->(candidate)" in query
    assert "published.status = 'published'" in query
    assert "published.visibility = 'public'" in query
    assert "topic_author_affinity" in query
    assert captured["parameters"]["viewer_id"] == str(viewer_id)
    assert captured["parameters"]["offset"] == 4
    assert captured["parameters"]["limit"] == 6
