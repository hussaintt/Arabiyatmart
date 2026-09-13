# Deployment runbook

## Scope and owners

This release deploys the Next.js web app without a database or backend schema migration. Assign one release commander, one backend owner, one web owner, and one incident/rollback contact before starting. Record artifact digests and the `RELEASE` value in the release ticket.

## Ordered deployment

1. Freeze the candidate and run the complete checklist. Confirm TASK-050 is intentionally cancelled: the product supports phone, WhatsApp, and message leads, not in-site price offers.
2. Validate backend readiness first: authentication and listing contract tests, build, lint, health checks, current mobile/admin compatibility, and the shared error/request-ID contract. Confirm the idempotency store is durable and its 24-hour replay behavior is healthy.
3. Deploy the backend only when required for compatible code changes. This web release introduces no database migration. Keep all existing mobile/admin endpoints and session claims backward compatible.
4. Deploy the web artifact to preview with the production-shaped environment. Do not reuse `.env` files from CI. Verify CSP origins, media, secure cookie attributes, OAuth callbacks, BFF connectivity, refresh rotation, and canonical metadata.
5. Run unit, component, contract, Playwright, security headers, accessibility/responsive, bundle-budget, and Lighthouse gates against the candidate. Exercise anonymous, buyer, private seller, and vendor-manager sessions.
6. Deploy the same immutable web artifact to production with its release identifier and observability configuration. Do not rebuild with different source.
7. Shift traffic gradually. Keep one canonical host, redirect legacy hosts and locale roots deliberately, and verify robots/sitemap/canonical URLs before increasing traffic.
8. Monitor request error rate/status, refresh failures, BFF/upstream latency, lead outcomes, listing contact initiation, Core Web Vitals, and CSP reports. Correlate all server hops through `X-Request-Id`; do not inspect raw bodies or contact data.

## Smoke validation

- Open Arabic and English home/search/listing routes; validate RTL/LTR, metadata, robots, sitemap, images, and service-worker freshness.
- Sign in, refresh the page, sign out, and confirm cookies are Secure/HttpOnly/SameSite as designed.
- Add/remove a favorite, create a message lead, reveal phone, open WhatsApp, report a listing, save/restore a sell draft, switch vendor, and change dashboard range.
- Confirm no price-offer controls or operations are present.
- Confirm logs contain only the approved structured fields and analytics waits for consent/DNT.

## Rollback

Stop traffic expansion on any security, session, contract, lead, metadata, or material performance regression. Route traffic back to the immediately previous immutable web artifact. Do not roll back shared backend contracts or session keys unless the backend owner confirms mobile/admin compatibility. Preserve Redis idempotency records and current auth cookies; rotating secrets during a web rollback would invalidate unrelated clients. Clear the new service-worker/cache version only when its cache is incompatible, then verify that old clients can still refresh and call the existing backend. Record the triggering request IDs and release identifiers without copying payloads.

## Completion

The release commander closes the window only after the monitoring interval is stable, backup/rollback references are confirmed, the checklist is attached, and ownership returns to normal on-call rotation.
