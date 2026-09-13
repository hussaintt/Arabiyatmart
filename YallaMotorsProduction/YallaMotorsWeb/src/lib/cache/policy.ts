/**
 * Cache Policy Definitions, TTL Constants, and Header Generators.
 *
 * Implements Phase 1 Section 4.3 and Phase 2 Sections 3.1-3.6:
 * - Deterministic TTL policies and cache tag assignments.
 * - Strict separation of public cacheable reads from private/session/vendor no-store operations.
 * - CACHE-01 guest-safe caching policy: public data forced to isFavorited:false, private overlays strictly no-store.
 * - Standardized Cache-Control header generation for BFF and Route Handlers.
 */

import {
  CACHE_TAGS,
  catalogueMakeDealersTag,
  catalogueModelTag,
  catalogueTrimDealersTag,
  catalogueTrimTag,
  cityAreasTag,
  countryLocationsTag,
  dealerListingsTag,
  dealerTag,
  listingTag,
  makeTag,
  similarListingTag,
  taxonomyGenerationTag,
  taxonomyModelTag,
  taxonomyTrimTag,
} from './tags';

/**
 * Standard Cache TTLs in integer seconds.
 */
export const CACHE_TTL = {
  SEARCH_LISTINGS: 30,
  LISTING_DETAIL: 60,
  DEALER_LISTINGS: 60,
  SUGGESTIONS: 60,
  SIMILAR_LISTINGS: 120,
  LISTING_BATCH: 120,
  HOME: 300,
  BANNERS: 300,
  PUBLIC_SETTINGS: 300,
  DEALERS: 300,
  DEALER_PROFILE: 300,
  CATALOGUE_DEALERS: 300,
  PROMOTION_PACKAGES: 300,
  SPOTLIGHT: 900,
  TAXONOMY_MODELS: 3600,
  TAXONOMY_GENERATIONS: 3600,
  TAXONOMY_TRIMS: 3600,
  TAXONOMY_TRIM_DETAIL: 3600,
  CATALOGUE_MODEL: 3600,
  CATALOGUE_TRIM: 3600,
  COUNTRY_CONFIG: 3600,
  CITIES: 3600,
  AREAS: 3600,
  TAXONOMY_MAKES: 86400,
  COUNTRIES: 86400,
} as const;

export type CacheTtlKey = keyof typeof CACHE_TTL;

export interface NextFetchCacheOptions {
  readonly revalidate?: number | false;
  readonly tags?: readonly string[];
}

export interface CachePolicy {
  readonly cache: 'force-cache' | 'no-store';
  readonly next?: NextFetchCacheOptions;
  readonly isPrivate: boolean;
  readonly maxAge?: number;
  readonly staleWhileRevalidate?: number;
}

/**
 * Creates a strict no-store policy for private, authenticated, or sensitive endpoints.
 */
export function createNoStorePolicy(): CachePolicy {
  return {
    cache: 'no-store',
    isPrivate: true,
  };
}

/**
 * Creates a public cache policy with explicit revalidation and cache tags.
 */
export function createPublicCachePolicy(options: {
  ttl: number;
  tags?: readonly string[];
  staleWhileRevalidate?: number;
}): CachePolicy {
  const stale = options.staleWhileRevalidate ?? Math.max(30, Math.floor(options.ttl / 5));
  return {
    cache: 'force-cache',
    next: {
      revalidate: options.ttl,
      ...(options.tags && options.tags.length > 0 ? { tags: options.tags } : {}),
    },
    isPrivate: false,
    maxAge: options.ttl,
    staleWhileRevalidate: stale,
  };
}

// ── CACHE-01 Public Listing Cache Normalizers ────────────────────────────────

/**
 * Normalizes any listing record (ListingCard, ListingDetail, or raw base record)
 * before it can enter the shared public Data Cache.
 * Strictly forces `isFavorited: false` to satisfy CACHE-01, preventing any personalized
 * state from leaking into shared server caches.
 */
export function normalizePublicCachedListing<T extends { isFavorited: boolean }>(
  listing: T
): T & { isFavorited: false } {
  return {
    ...listing,
    isFavorited: false,
  };
}

/**
 * Normalizes an array of listing records for public cache storage.
 */
export function normalizePublicCachedListings<T extends { isFavorited: boolean }>(
  listings: readonly T[]
): (T & { isFavorited: false })[] {
  return listings.map((l) => normalizePublicCachedListing(l));
}

/**
 * Deeply normalizes any public response payload (single item or list response),
 * guaranteeing that any nested `isFavorited` boolean is set to `false`.
 */
export function normalizePublicCachePayload<T>(payload: T): T {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizePublicCachePayload(item)) as unknown as T;
  }

  const record = payload as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...record };

  if ('isFavorited' in copy && typeof copy.isFavorited === 'boolean') {
    copy.isFavorited = false;
  }

  if ('data' in copy && copy.data !== null && typeof copy.data === 'object') {
    copy.data = normalizePublicCachePayload(copy.data);
  }

  return copy as T;
}

export interface PublicCachedListingResponse<T> {
  readonly data: T;
  readonly policy: CachePolicy;
}

/**
 * Creates a normalized public listing detail cache entry.
 * Guarantees that any source data is forced to isFavorited:false before storage.
 */
export function createPublicListingDetailCacheEntry<T extends { isFavorited: boolean }>(
  slug: string,
  rawListing: T
): PublicCachedListingResponse<T & { isFavorited: false }> {
  return {
    data: normalizePublicCachedListing(rawListing),
    policy: listingDetailPolicy(slug, false),
  };
}

/**
 * Creates a normalized public search listings cache entry.
 * Guarantees that all listings in the feed are forced to isFavorited:false before storage.
 */
export function createPublicListingSearchCacheEntry<T extends { isFavorited: boolean }>(
  rawListings: readonly T[]
): PublicCachedListingResponse<(T & { isFavorited: false })[]> {
  return {
    data: normalizePublicCachedListings(rawListings),
    policy: searchListingsPolicy(false),
  };
}

// ── Domain Cache Policies ───────────────────────────────────────────────────

export function homePolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.HOME,
    tags: [
      CACHE_TAGS.HOME,
      CACHE_TAGS.BANNERS,
      CACHE_TAGS.PUBLIC_SETTINGS,
      CACHE_TAGS.CATALOGUE_SPOTLIGHT,
      CACHE_TAGS.LISTINGS,
      CACHE_TAGS.DEALERS,
    ],
  });
}

export function bannersPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.BANNERS,
    tags: [CACHE_TAGS.BANNERS],
  });
}

export function publicSettingsPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.PUBLIC_SETTINGS,
    tags: [CACHE_TAGS.PUBLIC_SETTINGS],
  });
}

export function spotlightPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.SPOTLIGHT,
    tags: [CACHE_TAGS.CATALOGUE_SPOTLIGHT],
  });
}

/**
 * Listing search feed cache policy.
 * Anonymous requests use public short cache (30s).
 * If request contains personalized overlays/sessions, it MUST be no-store (CACHE-01).
 */
export function searchListingsPolicy(isPersonalized = false): CachePolicy {
  if (isPersonalized) {
    return createNoStorePolicy();
  }
  return createPublicCachePolicy({
    ttl: CACHE_TTL.SEARCH_LISTINGS,
    tags: [CACHE_TAGS.LISTINGS, CACHE_TAGS.SEARCH],
  });
}

/**
 * Listing detail cache policy.
 * Base listing content is cached publicly (60s).
 * Identity/favorite overlay is dynamic/no-store (CACHE-01).
 */
export function listingDetailPolicy(slug: string, isPersonalized = false): CachePolicy {
  if (isPersonalized) {
    return createNoStorePolicy();
  }
  return createPublicCachePolicy({
    ttl: CACHE_TTL.LISTING_DETAIL,
    tags: [CACHE_TAGS.LISTINGS, listingTag(slug)],
  });
}

export function similarListingsPolicy(slug: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.SIMILAR_LISTINGS,
    tags: [CACHE_TAGS.LISTINGS, listingTag(slug), similarListingTag(slug)],
  });
}

export function dealersPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.DEALERS,
    tags: [CACHE_TAGS.DEALERS],
  });
}

export function dealerProfilePolicy(slug: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.DEALER_PROFILE,
    tags: [CACHE_TAGS.DEALERS, dealerTag(slug)],
  });
}

export function dealerListingsPolicy(slug: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.DEALER_LISTINGS,
    tags: [CACHE_TAGS.LISTINGS, dealerListingsTag(slug)],
  });
}

export function taxonomyMakesPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_MAKES,
    tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.TAXONOMY_MAKES],
  });
}

export function taxonomyModelsPolicy(makeSlug: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_MODELS,
    tags: [CACHE_TAGS.TAXONOMY, makeTag(makeSlug)],
  });
}

export function taxonomyGenerationsPolicy(modelPublicId: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_GENERATIONS,
    tags: [taxonomyModelTag(modelPublicId)],
  });
}

export function taxonomyTrimsPolicy(generationPublicId: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_TRIMS,
    tags: [taxonomyGenerationTag(generationPublicId)],
  });
}

export function taxonomyTrimPolicy(publicId: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_TRIM_DETAIL,
    tags: [taxonomyTrimTag(publicId)],
  });
}

export function listingBatchPolicy(slugs: readonly string[]): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.LISTING_BATCH,
    tags: [CACHE_TAGS.LISTINGS, ...slugs.map((slug) => listingTag(slug))],
  });
}

export function trimBatchPolicy(publicIds: readonly string[]): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_TRIM_DETAIL,
    tags: [CACHE_TAGS.TAXONOMY_TRIMS, ...publicIds.map((id) => taxonomyTrimTag(id))],
  });
}

export function modelsWithPricesPolicy(makeSlug: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.TAXONOMY_MODELS,
    tags: [CACHE_TAGS.TAXONOMY, makeTag(makeSlug), CACHE_TAGS.LISTINGS],
  });
}

export function catalogueModelPolicy(publicId: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.CATALOGUE_MODEL,
    tags: [CACHE_TAGS.TAXONOMY, catalogueModelTag(publicId), CACHE_TAGS.LISTINGS],
  });
}

export function catalogueTrimPolicy(publicId: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.CATALOGUE_TRIM,
    tags: [CACHE_TAGS.TAXONOMY, catalogueTrimTag(publicId)],
  });
}

export function trimDealersPolicy(publicId: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.CATALOGUE_DEALERS,
    tags: [CACHE_TAGS.DEALERS, catalogueTrimDealersTag(publicId)],
  });
}

export function makeDealersPolicy(makeSlug: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.CATALOGUE_DEALERS,
    tags: [CACHE_TAGS.DEALERS, catalogueMakeDealersTag(makeSlug)],
  });
}

export function countriesPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.COUNTRIES,
    tags: [CACHE_TAGS.LOCATIONS_COUNTRIES],
  });
}

export function countryConfigPolicy(code: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.COUNTRY_CONFIG,
    tags: [countryLocationsTag(code)],
  });
}

export function citiesPolicy(code: string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.CITIES,
    tags: [countryLocationsTag(code)],
  });
}

export function areasPolicy(cityId: number | string): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.AREAS,
    tags: [cityAreasTag(cityId)],
  });
}

export function promotionPackagesPolicy(): CachePolicy {
  return createPublicCachePolicy({
    ttl: CACHE_TTL.PROMOTION_PACKAGES,
    tags: [CACHE_TAGS.PROMOTIONS_PACKAGES],
  });
}

export function searchSuggestionsPolicy(): CachePolicy {
  return {
    cache: 'force-cache',
    isPrivate: false,
    maxAge: CACHE_TTL.SUGGESTIONS,
    staleWhileRevalidate: 30,
  };
}

/**
 * Universal policy for all private authenticated reads, mutations, and user-scoped data.
 */
export function privatePolicy(): CachePolicy {
  return createNoStorePolicy();
}

// ── Header Generator ────────────────────────────────────────────────────────

/**
 * Builds standard Cache-Control header string from a CachePolicy.
 */
export function buildCacheControlHeader(policy: CachePolicy): string {
  if (policy.isPrivate || policy.cache === 'no-store') {
    return 'private, no-store';
  }

  const maxAge = policy.maxAge ?? 0;
  const staleWhileRevalidate = policy.staleWhileRevalidate ?? 60;
  return `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}
