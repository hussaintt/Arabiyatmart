# Arabiyatmart Web

Arabic-first, bilingual Next.js marketplace for vehicle discovery, seller leads, listings, favorites, and dealer workflows. Buyers contact sellers by phone, WhatsApp, or message; the website does not create, accept, reject, or withdraw price offers.

## Local setup

Use Node.js 22.12+ and npm 10.9+. Copy `.env.example` to `.env.local`, replace local origins as needed, then run:

```bash
npm ci
npm run dev
```

The web app runs on `http://localhost:3001`. Start the Fastify backend separately and set `BACKEND_API_ORIGIN` to its server-only origin. For deterministic browser tests, Playwright starts `tests/e2e/mock-backend.mjs` on port 3200 and a production Next server on port 3100.

## Runtime topology and environment ownership

The browser talks only to same-origin Next routes and server actions. `src/app/api/bff/[...path]/route.ts` validates an explicit operation allowlist, CSRF, idempotency, authentication, inputs, and outputs before the server-only client calls Fastify. Never import `src/lib/env/server.ts`, database code, Fastify clients, bearer tokens, or backend URLs into a Client Component.

- Platform/deployment owns `SITE_ORIGIN`, `BACKEND_API_ORIGIN`, CDN/CSP origins, Redis, release, and observability variables.
- Public build configuration owns only `NEXT_PUBLIC_*` values. These are never secrets.
- Authentication cookies are HttpOnly. Secure cookies require HTTPS in production. Local HTTP development uses the documented development cookie behavior; validate the production cookie domain and HTTPS path before cutover.
- Browser analytics remains disabled unless both public analytics variables are configured and the user grants consent. Its endpoint must be a same-origin `/api/` path.

## Commands

```bash
npm run type-check
npm run lint
npm run test:unit
npm run test:component
npm run test:contract
npm run test:e2e
npm run build
npm run test:lighthouse
npm run check:release
```

`check:release` validates focused/disabled tests, route inventory, contract traceability, client/server boundaries, TypeScript, and zero-warning lint. E2E uses committed fixtures in `tests/e2e`; unit and contract network fixtures live under `tests/setup` and MSW handlers. Never point automated tests at production data.

## Locale workflow

Routes are always locale-prefixed (`/ar` and `/en`). Add UI copy to both message catalogs, keep route construction in `src/i18n`, test RTL and LTR layouts, and run the locale and route-inventory checks before merging. Analytics records canonical route templates only—never query strings or private dynamic values.

## Release documentation

- [Deployment runbook](docs/deployment-runbook.md)
- [Contract traceability](docs/contract-traceability.md)
- [Release checklist](docs/release-checklist.md)

Direct browser-to-database access, direct browser-to-Fastify calls, client-side secrets, raw contact/lead analytics, and buyer price-offer workflows are prohibited.
