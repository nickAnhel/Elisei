# Nerdex Load Testing

## 1. What this is
REST API load testing for Nerdex with k6.

Socket.IO/WebSocket is **not** tested.

## 2. One-command launch
```bash
docker compose -f docker-compose.yaml -f docker-compose.loadtest.yml up --build
```

## 3. Required prerequisite
- Main demo DB must already be filled.
- `server/src/demo_seed/output/demo_accounts.json` must already exist.
- If missing, run `demo_seed` in the normal application first.

## 4. What happens automatically
- `loadtest_db_prepare` recreates `LOADTEST_DB_NAME` from `DEMO_DB_NAME` via `pg_dump | pg_restore`.
- `demo_accounts.json` is copied to `load-tests/k6/data/demo_accounts.json`.
- `migrate_loadtest` runs `alembic upgrade head` against loadtest DB.
- `server_loadtest` starts on port `8001`.
- `prometheus_loadtest` and `grafana_loadtest` start on `9092` and `3002`.
- `k6_suite` runs the full sequence of tests.
- JSON/HTML/log artifacts are saved to `load-tests/results/`.

## 5. URLs
- Backend docs: http://127.0.0.1:8001/docs
- Grafana: http://127.0.0.1:3002
- Prometheus: http://127.0.0.1:9092
- k6 dashboard: http://127.0.0.1:5665

## 6. What tests run
- `api-read` with `PROFILE=smoke`
- `api-write` with `PROFILE=smoke`
- `api-mixed` with `PROFILE=quick`
- `api-mixed` with `PROFILE=load`

`smoke` profile validates baseline API stability and availability with relaxed thresholds.
For `api-mixed` in `quick`/`load`, thresholds are reliability-focused plus overall latency budget.
Detailed per-endpoint latency thresholds are kept for targeted read/write scenarios.

## 7. Where results are
- `load-tests/results/*.json`
- `load-tests/results/*.html`
- `load-tests/results/*.log`

## 8. How to rerun cleanly
```bash
docker compose -f docker-compose.yaml -f docker-compose.loadtest.yml down
docker compose -f docker-compose.yaml -f docker-compose.loadtest.yml up --build
```

## 9. How to remove loadtest volumes
```bash
docker compose -f docker-compose.yaml -f docker-compose.loadtest.yml down -v
```

## 10. Image versions
Pinned loadtest images:
- `postgres:17` (for `loadtest_db_prepare`)
- `prom/prometheus:v2.53.0`
- `grafana/grafana:11.0.0`
- `grafana/k6:0.52.0`
- `prometheuscommunity/postgres-exporter:v0.16.0`
- `oliver006/redis_exporter:v1.67.0`
- `gcr.io/cadvisor/cadvisor:v0.49.1`

## 11. Troubleshooting
- `demo_accounts.json missing`
  - Error: `demo_accounts.json not found. Run demo_seed in the main application before load testing.`
  - Fix: run demo seed in normal app, ensure `server/src/demo_seed/output/demo_accounts.json` exists, rerun compose.

- `loadtest DB prepare failed`
  - Check `DEMO_DB_NAME`, `LOADTEST_DB_NAME`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
  - Ensure `LOADTEST_DB_NAME` contains `loadtest`, `test`, or `perf` and is not equal to `DEMO_DB_NAME`.

- `server_loadtest unhealthy`
  - Verify `migrate_loadtest` completed successfully.
  - Check `server_loadtest` logs and DB connectivity.

- `k6 thresholds failed`
  - `k6_suite` exits with non-zero code by design.
  - Open `load-tests/results/*.log` and `*.json` for failed run details.

- `Grafana has empty panels`
  - Ensure `prometheus_loadtest` is up and scraping targets.
  - Confirm k6 runs completed and pushed remote-write metrics.
  - If container panels are empty on Docker Desktop, verify `cadvisor_loadtest` access to host Docker metrics (it is primarily Linux-oriented).

- `port conflict`
  - Required ports: `8001`, `3002`, `9092`, `5665` (and optional `8081` for cAdvisor).
  - Stop conflicting processes/containers and rerun.

- `wrong DB settings`
  - `server_loadtest` must use `LOADTEST_DB_NAME`, not main demo DB.
  - Validate effective compose config with `docker compose ... config`.

## Notes
Primary and recommended launch flow is only:
```bash
docker compose -f docker-compose.yaml -f docker-compose.loadtest.yml up --build
```
