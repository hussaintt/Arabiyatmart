# Release checklist

## Candidate and configuration

- [ ] Node 22.12+ and npm 10.9+; clean `npm ci` completed from `package-lock.json`.
- [ ] Immutable release identifier, artifact digest, owners, incident contacts, and rollback artifact recorded.
- [ ] Production secrets/config validated by the platform; no secret exists in a `NEXT_PUBLIC_*` value or browser bundle.
- [ ] No web-driven database/backend migration is planned; mobile, admin, and existing session compatibility is confirmed.
- [ ] Backend/site/media/analytics/CSP origins are exact HTTPS origins. Cookie domain, Secure, HttpOnly, SameSite, OAuth callbacks, and proxy headers are verified.
- [ ] Redis-backed idempotency and retention are healthy for production mutations.

## Automated evidence

- [ ] `npm run check:release`, unit, component, contract, production build, bundle budgets, Playwright, and Lighthouse pass with no warnings promoted from errors.
- [ ] `npm audit --omit=dev --audit-level=high` and backend production audit pass or have an explicitly approved, time-bound exception.
- [ ] Backend auth/listing tests, build, and lint pass.
- [ ] No `.only`, `.skip`, `.todo`, unresolved fixture placeholder, unexpected route, traceability gap, or generated artifact diff exists.
- [ ] Accessibility evidence covers keyboard/focus, Arabic RTL, English LTR, desktop/tablet/mobile, reduced motion, and axe checks.

## Product and privacy

- [ ] TASK-050 price offers remain cancelled; only phone, WhatsApp, and message lead paths are present.
- [ ] Structured logs are allowlisted/redacted and correlate RSC/BFF/refresh/upstream hops with `X-Request-Id`.
- [ ] Analytics requires consent/config, honors DNT, emits canonical route templates and safe enums/opaque IDs only, and never sends contact/search/lead text.
- [ ] CSP reports, observability release/environment, alert routing, and retention are configured without exposing DSNs or tokens.

## Search and cutover

- [ ] `robots.txt`, sitemap URLs, canonical host, hreflang, OpenGraph, and private-route `noindex` behavior are verified.
- [ ] Service-worker/cache version is advanced where needed and old caches are cleared without stranding active sessions.
- [ ] Backup references, prior web artifact, traffic controls, rollback commands, and monitoring dashboards are accessible to the release commander.
- [ ] Production smoke tests and the stability window complete before release closure.
