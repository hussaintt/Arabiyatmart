# Contract traceability

This is the release inventory for active Phase 1 routes and Phase 2 browser operations. `npm run check:traceability` compares this document with the filesystem and contract matrix so a route or operation cannot silently drift. Every row is implemented and release-gated unless explicitly marked otherwise.

## Product decision

TASK-050 — buyer price-offer creation/accept/reject/withdraw — is **cancelled**, not missing. The active business model exposes seller phone/WhatsApp or creates a message lead. `/best-offer` is a seller promotion-package workflow and does not negotiate buyer prices.

## Localized route inventory

All route render owners are under `src/app/[locale]`; schemas/data access use `src/lib/api/schemas`, `src/lib/api/queries`, and server actions; browser/render coverage is in `tests/e2e`. Public reads use declared public/revalidated cache policies and public metadata. Account/auth/workflow pages are private/no-store/noindex.

| Route | Task/status | Render and cache | Metadata/test |
|---|---|---|---|
| `/[locale]` | Phase 1 / implemented | RSC, public cache | index, OpenGraph / public E2E |
| `/[locale]/search` | Phase 1 / implemented | RSC + client filters, public/optional | index, OpenGraph / search E2E |
| `/[locale]/dealers` | Phase 1 / implemented | RSC, public cache | index, OpenGraph / public E2E |
| `/[locale]/dealers/[slug]` | Phase 1 / implemented | RSC, public cache | index, dynamic OpenGraph / public E2E |
| `/[locale]/listing/[slug]` | Phase 1 / implemented | RSC + contact actions, public/optional | index, dynamic OpenGraph / listing E2E |
| `/[locale]/catalogue/makes` | Phase 1 / implemented | RSC, public cache | index, OpenGraph / catalogue E2E |
| `/[locale]/catalogue/makes/[makeSlug]` | Phase 1 / implemented | RSC, public cache | index, dynamic OpenGraph / catalogue E2E |
| `/[locale]/catalogue/models/[publicId]` | Phase 1 / implemented | RSC, public cache | index, dynamic OpenGraph / catalogue E2E |
| `/[locale]/catalogue/trims/[publicId]` | Phase 1 / implemented | RSC, public cache | index, dynamic OpenGraph / catalogue E2E |
| `/[locale]/news` | Phase 1 / implemented | RSC, public cache | index, OpenGraph / public E2E |
| `/[locale]/privacy` | TASK-058 / implemented | static RSC, public cache | index, OpenGraph / route gate |
| `/[locale]/terms` | Phase 1 / implemented | static RSC, public cache | index, OpenGraph / route gate |
| `/[locale]/compare` | Phase 1 / implemented | client comparison, private/no-store | noindex / protected E2E |
| `/[locale]/best-offer` | Phase 1 / implemented | seller promotion RSC, private/no-store | noindex / protected E2E |
| `/[locale]/best-offer/[slug]` | Phase 1 / implemented | seller promotion RSC, private/no-store | noindex / protected E2E |
| `/[locale]/favorites` | Phase 1 / implemented | authenticated RSC, private/no-store | noindex / favorites E2E |
| `/[locale]/me/dashboard` | Phase 1 / implemented | vendor RSC, private/no-store | noindex / vendor E2E |
| `/[locale]/me/leads` | Phase 1 / implemented | seller RSC, private/no-store | noindex / leads E2E |
| `/[locale]/me/leads/[publicId]` | Phase 1 / implemented | seller RSC, private/no-store | noindex / leads E2E |
| `/[locale]/me/listings` | Phase 1 / implemented | seller RSC, private/no-store | noindex / seller E2E |
| `/[locale]/notifications` | Phase 1 / implemented | authenticated RSC, private/no-store | noindex / protected E2E |
| `/[locale]/profile` | Phase 1 / implemented | authenticated RSC, private/no-store | noindex / profile E2E |
| `/[locale]/profile/edit` | Phase 1 / implemented | authenticated form, private/no-store | noindex / profile E2E |
| `/[locale]/saved-searches` | Phase 1 / implemented | authenticated RSC, private/no-store | noindex / protected E2E |
| `/[locale]/sell` | Phase 1 / implemented | client workflow + actions, private/no-store | noindex / sell E2E |
| `/[locale]/login` | Phase 1 / implemented | auth form, private/no-store | noindex / auth E2E |
| `/[locale]/register` | Phase 1 / implemented | auth form, private/no-store | noindex / auth E2E |
| `/[locale]/register-success` | Phase 1 / implemented | auth result RSC, private/no-store | noindex / auth E2E |
| `/[locale]/forgot-password` | Phase 1 / implemented | auth form, private/no-store | noindex / auth E2E |
| `/[locale]/reset-password` | Phase 1 / implemented | auth form, private/no-store | noindex / auth E2E |
| `/[locale]/verify-email` | Phase 1 / implemented | auth form, private/no-store | noindex / auth E2E |
| `/[locale]/forbidden` | Phase 1 / implemented | authorization result, private/no-store | noindex / protected E2E |

## Phase 2 operation inventory

The executable source is `tests/contract/operation-matrix.ts`. Every operation maps to the BFF allowlist (`src/lib/security/bff-allowlist.ts`), endpoint builder (`src/lib/api/endpoints.ts`), input/output Zod schema (`src/lib/api/schemas`), server query/action call site, and a domain contract suite. Status is implemented and release-gated for all entries below.

| Domain and contract test | Operations | Auth/cache/status |
|---|---|---|
| Session/auth — `credential-session`, `auth-operations`, `social-auth`, `verification-recovery` | `getSession`, `loginWithGoogle`, `loginWithApple`, `refreshSession`, `verifyFirebasePhone`, `getProfile` | S/O/M; private no-store; implemented |
| Marketplace discovery — `public-operations`, `public-queries` | `listBanners`, `getPublicSettings`, `getSpotlight`, `getListingBatch`, `searchListings`, `getSimilarListings`, `getListing`, `getVehicleSuggestions` | P/O; public normalization/cache; implemented |
| Favorites — `account-operations`, `security-gates` | `addFavorite`, `removeFavorite`, `getFavorites` | M/S; private no-store and idempotent mutations; implemented |
| Dealers — `public-operations`, `public-queries` | `listDealers`, `getDealerListings`, `getDealer` | P; public cache; implemented |
| Taxonomy/catalogue — `public-reference-schemas`, `public-queries` | `listMakes`, `listModels`, `listGenerations`, `listTrims`, `getTrimBatch`, `getTrim`, `getModelsWithPrices`, `getCatalogueModel`, `getCatalogueTrim`, `getTrimDealers`, `getMakeDealers` | P; public cache; implemented |
| Locations — `public-reference-schemas`, `public-queries` | `listCountries`, `getCountryConfig`, `listCities`, `listAreas` | P; public cache; implemented |
| Promotions — `seller-operations` | `listPromotionPackages`, `listMyPromotions` | P/S; public packages and private account data; implemented |
| Seller/account — `account-operations`, `seller-operations` | `getMyVendors`, `getMyListings`, `listSavedSearches` | S; private no-store; implemented |
| Files — `seller-operations`, `special-handlers` | `uploadFile`, `getFileStatus` | U/O; upload mutation/private status; implemented |
| Notifications — `account-operations` | `listNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `listNotificationDevices`, `registerNotificationDevice`, `unregisterNotificationDevice` | S/M; private no-store/idempotent; implemented |
| Leads/reports — `seller-operations`, `workflow-schemas` | `createLead`, `listSellerLeads`, `getSellerLead`, `updateSellerLeadStatus`, `createListingReport` | O/S/M; contact-only, private seller reads, idempotent writes; implemented |
| Vendor dashboard — `seller-operations` | `getDashboardOverview` | S with active vendor scope; private no-store; implemented |
| Vendor quotas & billing — `seller-operations` | `getVendorBillingSummary`, `getVendorEntitlements`, `getVendorSubscription`, `listSubscriptionPlans` | S/P with active vendor scope; private no-store and public plans; implemented |

## Readiness gates

| Gate | Evidence/status |
|---|---|
| `FAV-01` | optimistic favorite reconciliation plus private cache invalidation; contract/component/E2E — passed |
| `ERR-01` | normalized error code/status/request ID without stack or payload; contract tests — passed |
| `OUT-01` | adapters plus Zod output validation and safe 502 mismatch; contract tests — passed |
| `IDEM-01` | required keys, canonical request hash, replay/conflict, durable production store; security gates — passed |
| `AUTH-01` | server cookies, refresh rotation, retry-once, CSRF; credential/session tests — passed |
| `CACHE-01` | public personalization stripping and private no-store isolation; security gates — passed |
| `FLOW-01` | seller draft/upload/publish/promotion workflow boundaries; workflow/E2E — passed |
| `OBS-01` | `X-Request-Id` validation/propagation and allowlisted correlated logs; observability tests — passed |
