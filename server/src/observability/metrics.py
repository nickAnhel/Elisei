from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram


http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    labelnames=("method", "path", "status_code"),
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    labelnames=("method", "path", "status_code"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

http_requests_in_progress = Gauge(
    "http_requests_in_progress",
    "In-progress HTTP requests",
    labelnames=("method", "path"),
)

recommendations_feed_duration_seconds = Histogram(
    "recommendations_feed_duration_seconds",
    "Recommendations feed duration",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

recommendations_similar_duration_seconds = Histogram(
    "recommendations_similar_duration_seconds",
    "Similar content recommendations duration",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

recommendations_authors_duration_seconds = Histogram(
    "recommendations_authors_duration_seconds",
    "Recommended authors duration",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

recommendations_sync_duration_seconds = Histogram(
    "recommendations_sync_duration_seconds",
    "Recommendation sync duration",
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 180),
)

recommendations_feed_neo4j_duration_seconds = Histogram(
    "recommendations_feed_neo4j_duration_seconds",
    "Recommendation feed Neo4j query duration",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)

recommendations_feed_postgres_duration_seconds = Histogram(
    "recommendations_feed_postgres_duration_seconds",
    "Recommendation feed Postgres hydration duration",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)

recommendations_feed_fallback_total = Counter(
    "recommendations_feed_fallback_total",
    "Total recommendation feed fallback usages",
)

recommendation_recompute_duration_seconds = Histogram(
    "recommendation_recompute_duration_seconds",
    "Duration of recommendation recompute operations",
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 180),
)

recommendation_recompute_users_total = Counter(
    "recommendation_recompute_users_total",
    "Total users included in recommendation recompute",
)

recommendation_recompute_edges_total = Counter(
    "recommendation_recompute_edges_total",
    "Total RECOMMENDED_CONTENT edges materialized",
)

cache_requests_total = Counter(
    "cache_requests_total",
    "Total cache get requests by result",
    labelnames=("namespace", "result"),
)

cache_operation_duration_seconds = Histogram(
    "cache_operation_duration_seconds",
    "Cache operation duration",
    labelnames=("operation", "namespace"),
    buckets=(0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1),
)

cache_payload_items = Histogram(
    "cache_payload_items",
    "Number of payload items stored/read from cache entries",
    labelnames=("namespace",),
    buckets=(0, 1, 2, 5, 10, 20, 50, 100, 250, 500),
)


def observe_http_request(*, method: str, path: str, status_code: int, duration_seconds: float) -> None:
    status_code_label = str(status_code)
    http_requests_total.labels(method=method, path=path, status_code=status_code_label).inc()
    http_request_duration_seconds.labels(
        method=method,
        path=path,
        status_code=status_code_label,
    ).observe(duration_seconds)


def observe_recommendations_feed(
    *,
    total_seconds: float,
    neo4j_seconds: float,
    postgres_seconds: float,
    fallback_used: bool,
) -> None:
    recommendations_feed_duration_seconds.observe(total_seconds)
    recommendations_feed_neo4j_duration_seconds.observe(neo4j_seconds)
    recommendations_feed_postgres_duration_seconds.observe(postgres_seconds)
    if fallback_used:
        recommendations_feed_fallback_total.inc()


def observe_recommendations_similar(*, total_seconds: float) -> None:
    recommendations_similar_duration_seconds.observe(total_seconds)


def observe_recommendations_authors(*, total_seconds: float) -> None:
    recommendations_authors_duration_seconds.observe(total_seconds)


def observe_recommendations_sync(*, total_seconds: float) -> None:
    recommendations_sync_duration_seconds.observe(total_seconds)


def observe_recommendation_recompute(
    *,
    duration_seconds: float,
    users_count: int,
    edges_count: int,
) -> None:
    recommendation_recompute_duration_seconds.observe(duration_seconds)
    if users_count > 0:
        recommendation_recompute_users_total.inc(users_count)
    if edges_count > 0:
        recommendation_recompute_edges_total.inc(edges_count)


def observe_cache_request(*, namespace: str, result: str) -> None:
    cache_requests_total.labels(namespace=namespace, result=result).inc()


def observe_cache_operation_duration(*, operation: str, namespace: str, duration_seconds: float) -> None:
    cache_operation_duration_seconds.labels(operation=operation, namespace=namespace).observe(duration_seconds)


def observe_cache_payload_items(*, namespace: str, items: int) -> None:
    cache_payload_items.labels(namespace=namespace).observe(items)
