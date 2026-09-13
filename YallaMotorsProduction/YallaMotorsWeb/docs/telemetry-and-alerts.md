# Production Telemetry, Alerts, and Incident Ownership

## 1. Objectives and Scope

This document specifies the telemetry boundaries, metrics collection, alerting policies, sampling/retention rules, and incident ownership for Arabiyatmart Web (`YallaMotorsWeb`) and its interactions with the upstream Fastify backend (`YallaMotorsBackend`).

---

## 2. Privacy-Safe Boundaries and Data Sanitization

All telemetry follows a strict allowlist:
- **No PII or Secrets**: User email, phone numbers, raw passwords, cookie values, tokens, or query strings with sensitive parameters are **never** logged or emitted.
- **Client Boundary Errors**: Transmitted via `/api/bff/telemetry/boundary-error` (POST, payload < 4KB) with only:
  - `boundary`: name of error boundary (`global`, `locale`, `marketplace`, `auth`, `account`, `sell`, `vendor`, `search`).
  - `digest`: bounded server component or React error digest (max 128 chars).
  - `locale`: current active locale (`ar` | `en`).
  - `timestamp`: ISO timestamp.
  - Raw client error messages and stack traces are dropped at the client boundary.
- **Pseudonymous Correlation**: When tracing user or vendor activity across log events, user and vendor IDs are hashed using **HMAC-SHA-256** keyed with `SESSION_SECRET` (truncated to 16 hex characters). If `SESSION_SECRET` is unset, no correlation identifier is emitted.
- **Upstream & Route Logging**: Emits only operation name, route template, HTTP status, duration in ms, and sanitized schema issue paths.

---

## 3. Metrics and Dashboards

### 3.1 BFF and Upstream Health Dashboard
- **Request Volume & Rate**: Requests per second broken down by route template (`/[locale]`, `/api/bff/[...path]`).
- **Latency Percentiles**: p50, p95, p99 latency per upstream operation (`listBanners`, `searchListings`, `getListingDetail`, `getPublicSettings`).
- **Error Rates**:
  - `502 Bad Gateway`: Schema mismatches or upstream network failures.
  - `503 Service Unavailable`: Upstream backend unreachable or upload concurrency saturated.
  - `504 Gateway Timeout`: Upstream call exceeded operation timeout (default 10s read, 20s mutation, 60s upload).
- **Idempotency Metrics**: Count of acquired locks, cached idempotency replays (200 OK / original status), and 409 conflicts.

### 3.2 Degraded Mode and Client Errors Dashboard
- **Degraded Homepage Renderings**: Monitored via `homepage_degraded_fallback` logs. Tracks upstream partial failures where homepage renders fallback sections.
- **Client Boundary Crashes**: Monitored via `client_boundary_error_*` logs, grouped by boundary (`marketplace`, `sell`, `auth`, `account`).

---

## 4. Alerting Thresholds and Rules

| Alert Name | Condition | Severity | Action |
|---|---|---|---|
| **HighBffErrorRate** | BFF 5xx error rate > 1% over 5m | P1 (Page) | Check backend service health, database pool, and recent deployments. |
| **UpstreamDegradedHome** | `homepage_degraded_fallback` > 5% of requests over 5m | P1 (Page) | Upstream listing/banner service is failing; investigate backend connectivity. |
| **BoundaryErrorSpike** | Client boundary error count > 15 errors in 1m | P2 (High) | Check recent Web deployments for client runtime regressions. |
| **IdempotencyConflictRate** | Idempotency 409 conflict rate > 1% over 10m | P2 (High) | Check for duplicate submission retries or Redis concurrency lock leaks. |
| **UploadFailureSpike** | Upload 4xx/5xx failures > 5% over 5m | P2 (High) | Check upload storage adapter, temp disk space, or mime/size policy mismatches. |

---

## 5. Sampling and Retention Policies

- **Production Access Logs (200 OK)**: Sampled at 10% in high-traffic production environments.
- **Errors and Boundary Crashes (4xx / 5xx)**: 100% unsampled retention.
- **Retention**:
  - Active search / indexing cluster: 14 days.
  - Cold / archive storage (compressed JSON): 90 days.
  - No customer identifiable data is retained in telemetry storage.

---

## 6. Incident Ownership and Escalation Matrix

- **Web Release & Telemetry Lead**: Primary on-call engineer for BFF routes, client error boundaries, and frontend runtime stability.
- **Backend API Owner**: Secondary on-call engineer for upstream 502/503/504 errors, database timeouts, and Redis idempotency failures.
- **Incident Escalation**: If degraded homepage rate exceeds 10% for > 15 minutes, release commander triggers rollback runbook (`docs/deployment-runbook.md`).
