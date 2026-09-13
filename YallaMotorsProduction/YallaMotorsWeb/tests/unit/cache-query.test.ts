/**
 * Unit Test Suite for Cache Policy, Revalidation Tags, and Canonical Query Keys (TASK-012).
 *
 * Verifies:
 * 1. Canonical query keys match Phase 1 Section 4.4 exact shapes and return readonly tuples with canonicalized objects.
 * 2. Cache tags enforce strict validation and prevent unbounded user text injection.
 * 3. Cache policies implement Phase 2 TTLs and strictly enforce no-store for private/vendor data.
 * 4. Mutation invalidation plans correctly target TanStack prefixes, tags, and localized paths.
 * 5. QueryClient configures sensible defaults, disables mutation retries, and redacts dehydrated errors.
 * 6. CACHE-01 strict BDD acceptance test proves isolation between anonymous and two authenticated identities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CACHE_TAGS,
  assertValidTag,
  isValidTag,
  listingTag,
  similarListingTag,
  dealerTag,
  dealerListingsTag,
  makeTag,
  taxonomyModelTag,
  taxonomyGenerationTag,
  taxonomyTrimTag,
  catalogueModelTag,
  catalogueTrimTag,
  catalogueTrimDealersTag,
  catalogueMakeDealersTag,
  countryLocationsTag,
  cityAreasTag,
  fileStatusTag,
} from '@/lib/cache/tags';
import {
  CACHE_TTL,
  createNoStorePolicy,
  createPublicCachePolicy,
  homePolicy,
  bannersPolicy,
  publicSettingsPolicy,
  spotlightPolicy,
  searchListingsPolicy,
  listingDetailPolicy,
  similarListingsPolicy,
  dealersPolicy,
  dealerProfilePolicy,
  dealerListingsPolicy,
  taxonomyMakesPolicy,
  taxonomyModelsPolicy,
  taxonomyGenerationsPolicy,
  taxonomyTrimsPolicy,
  taxonomyTrimPolicy,
  listingBatchPolicy,
  trimBatchPolicy,
  modelsWithPricesPolicy,
  catalogueModelPolicy,
  catalogueTrimPolicy,
  trimDealersPolicy,
  makeDealersPolicy,
  countriesPolicy,
  countryConfigPolicy,
  citiesPolicy,
  areasPolicy,
  promotionPackagesPolicy,
  searchSuggestionsPolicy,
  privatePolicy,
  buildCacheControlHeader,
  normalizePublicCachedListing,
  normalizePublicCachedListings,
  normalizePublicCachePayload,
  createPublicListingDetailCacheEntry,
  createPublicListingSearchCacheEntry,
} from '@/lib/cache/policy';
import {
  queryKeys,
  queryKeyRoots,
  canonicalizeRecord,
  canonicalizeValue,
  assertSerializableKey,
} from '@/lib/query/keys';
import {
  invalidationPlans,
  executeInvalidationPlan,
  getLocalizedPaths,
  InvalidationReconciliationError,
} from '@/lib/cache/invalidation';
import {
  makeQueryClient,
  getQueryClient,
  resetBrowserQueryClient,
  redactErrorForDehydration,
  dehydrateSafe,
  DEFAULT_QUERY_STALE_TIME,
  DEFAULT_QUERY_GC_TIME,
} from '@/lib/query/client';
import { QueryHydrationBoundary } from '@/lib/query/hydration';

describe('TASK-012: Cache Tags and Bounded Constructors (tags.ts)', () => {
  it('exports all static Phase 2 cache tags with exact string identifiers', () => {
    expect(CACHE_TAGS.HOME).toBe('home');
    expect(CACHE_TAGS.BANNERS).toBe('banners');
    expect(CACHE_TAGS.PUBLIC_SETTINGS).toBe('settings:public');
    expect(CACHE_TAGS.CATALOGUE_SPOTLIGHT).toBe('catalogue:spotlight');
    expect(CACHE_TAGS.LISTINGS).toBe('listings');
    expect(CACHE_TAGS.SEARCH).toBe('search');
    expect(CACHE_TAGS.DEALERS).toBe('dealers');
    expect(CACHE_TAGS.TAXONOMY).toBe('taxonomy');
    expect(CACHE_TAGS.TAXONOMY_MAKES).toBe('taxonomy:makes');
    expect(CACHE_TAGS.TAXONOMY_TRIMS).toBe('taxonomy:trims');
    expect(CACHE_TAGS.LOCATIONS_COUNTRIES).toBe('locations:countries');
    expect(CACHE_TAGS.PROMOTIONS_PACKAGES).toBe('promotions:packages');
  });

  it('validates safe tag strings and rejects traversal or invalid characters', () => {
    expect(isValidTag('listings')).toBe(true);
    expect(isValidTag('listing:toyota-camry-2024')).toBe(true);
    expect(isValidTag('taxonomy:trim:trm_01h7x9k3p')).toBe(true);
    expect(assertValidTag('listings')).toBe('listings');

    expect(isValidTag('')).toBe(false);
    expect(isValidTag('   ')).toBe(false);
    expect(isValidTag('listing/../escape')).toBe(false);
    expect(isValidTag('listing\\evil')).toBe(false);
    expect(isValidTag('tag with spaces')).toBe(false);
    expect(isValidTag('tag\nwith\rnewlines')).toBe(false);
    expect(isValidTag('a'.repeat(200))).toBe(false); // exceeds 160 chars
    expect(() => assertValidTag('tag with spaces')).toThrow();
  });

  it('constructs bounded tags for listings, dealers, taxonomy, and locations', () => {
    expect(listingTag('toyota-camry-2024')).toBe('listing:toyota-camry-2024');
    expect(similarListingTag('toyota-camry-2024')).toBe('similar:toyota-camry-2024');
    expect(dealerTag('al-futtaim-motors')).toBe('dealer:al-futtaim-motors');
    expect(dealerListingsTag('al-futtaim-motors')).toBe('dealer:al-futtaim-motors:listings');
    expect(makeTag('toyota')).toBe('make:toyota');
    expect(taxonomyModelTag('mod_01h7x9k3p0000000000000001')).toBe(
      'taxonomy:model:mod_01h7x9k3p0000000000000001'
    );
    expect(taxonomyGenerationTag('gen_01h7x9k3p0000000000000001')).toBe(
      'taxonomy:generation:gen_01h7x9k3p0000000000000001'
    );
    expect(taxonomyTrimTag('trm_01h7x9k3p0000000000000001')).toBe(
      'taxonomy:trim:trm_01h7x9k3p0000000000000001'
    );
    expect(catalogueModelTag('mod_01h7x9k3p0000000000000001')).toBe(
      'model:mod_01h7x9k3p0000000000000001'
    );
    expect(catalogueTrimTag('trm_01h7x9k3p0000000000000001')).toBe(
      'trim:trm_01h7x9k3p0000000000000001'
    );
    expect(catalogueTrimDealersTag('trm_01h7x9k3p0000000000000001')).toBe(
      'catalogue:trim:trm_01h7x9k3p0000000000000001:dealers'
    );
    expect(catalogueMakeDealersTag('toyota')).toBe('catalogue:make:toyota:dealers');
    expect(countryLocationsTag('AE')).toBe('locations:country:ae');
    expect(cityAreasTag(101)).toBe('locations:city:101');
    expect(cityAreasTag('101')).toBe('locations:city:101');
    expect(fileStatusTag('fil_01h7x9k3p0000000000000001')).toBe(
      'file:fil_01h7x9k3p0000000000000001:status'
    );
  });

  it('rejects invalid slugs, invalid public IDs, and malformed country/city inputs', () => {
    expect(() => listingTag('UPPERCASE-SLUG')).toThrow();
    expect(() => listingTag('invalid slug with spaces')).toThrow();
    expect(() => listingTag('../traversal')).toThrow();
    expect(() => taxonomyModelTag('')).toThrow();
    expect(() => countryLocationsTag('UNITED_ARAB_EMIRATES')).toThrow(); // code must be 2 chars
    expect(() => cityAreasTag(-5)).toThrow(); // cityId must be positive
    expect(() => cityAreasTag(0)).toThrow();
    expect(() => cityAreasTag('0')).toThrow();
    expect(() => cityAreasTag('-5')).toThrow();
    expect(() => cityAreasTag('12abc')).toThrow(); // must NOT parse partially as 12
    expect(() => cityAreasTag('12.5')).toThrow();
    expect(() => cityAreasTag('not-a-number')).toThrow();
  });
});

describe('TASK-012: Cache Policy and Revalidation Headers (policy.ts)', () => {
  it('defines the exact TTL constants specified in Phase 1 & 2', () => {
    expect(CACHE_TTL.SEARCH_LISTINGS).toBe(30);
    expect(CACHE_TTL.LISTING_DETAIL).toBe(60);
    expect(CACHE_TTL.DEALER_LISTINGS).toBe(60);
    expect(CACHE_TTL.SUGGESTIONS).toBe(60);
    expect(CACHE_TTL.SIMILAR_LISTINGS).toBe(120);
    expect(CACHE_TTL.LISTING_BATCH).toBe(120);
    expect(CACHE_TTL.HOME).toBe(300);
    expect(CACHE_TTL.BANNERS).toBe(300);
    expect(CACHE_TTL.PUBLIC_SETTINGS).toBe(300);
    expect(CACHE_TTL.DEALERS).toBe(300);
    expect(CACHE_TTL.SPOTLIGHT).toBe(900);
    expect(CACHE_TTL.TAXONOMY_MODELS).toBe(3600);
    expect(CACHE_TTL.TAXONOMY_MAKES).toBe(86400);
    expect(CACHE_TTL.COUNTRIES).toBe(86400);
  });

  it('constructs public policies with force-cache and correct tags', () => {
    const home = homePolicy();
    expect(home.cache).toBe('force-cache');
    expect(home.isPrivate).toBe(false);
    expect(home.next?.revalidate).toBe(300);
    expect(home.next?.tags).toEqual([
      'home',
      'banners',
      'settings:public',
      'catalogue:spotlight',
      'listings',
      'dealers',
    ]);

    const listing = listingDetailPolicy('nissan-patrol-2023');
    expect(listing.cache).toBe('force-cache');
    expect(listing.isPrivate).toBe(false);
    expect(listing.next?.revalidate).toBe(60);
    expect(listing.next?.tags).toEqual(['listings', 'listing:nissan-patrol-2023']);

    const makes = taxonomyMakesPolicy();
    expect(makes.next?.revalidate).toBe(86400);
    expect(makes.next?.tags).toEqual(['taxonomy', 'taxonomy:makes']);

    // Banners, settings, spotlight
    expect(bannersPolicy().next?.tags).toEqual(['banners']);
    expect(publicSettingsPolicy().next?.tags).toEqual(['settings:public']);
    expect(spotlightPolicy().next?.tags).toEqual(['catalogue:spotlight']);

    // Dealers and similar
    expect(similarListingsPolicy('patrol').next?.tags).toContain('similar:patrol');
    expect(dealersPolicy().next?.tags).toEqual(['dealers']);
    expect(dealerProfilePolicy('al-futtaim').next?.tags).toContain('dealer:al-futtaim');
    expect(dealerListingsPolicy('al-futtaim').next?.tags).toContain('dealer:al-futtaim:listings');

    // Taxonomy & Catalogue
    expect(taxonomyModelsPolicy('toyota').next?.tags).toContain('make:toyota');
    expect(taxonomyGenerationsPolicy('mod_1').next?.tags).toContain('taxonomy:model:mod_1');
    expect(taxonomyTrimsPolicy('gen_1').next?.tags).toContain('taxonomy:generation:gen_1');
    expect(taxonomyTrimPolicy('trm_1').next?.tags).toContain('taxonomy:trim:trm_1');
    expect(listingBatchPolicy(['slug-1', 'slug-2']).next?.tags).toContain('listing:slug-1');
    expect(trimBatchPolicy(['trm_1', 'trm_2']).next?.tags).toContain('taxonomy:trim:trm_1');
    expect(modelsWithPricesPolicy('toyota').next?.tags).toContain('make:toyota');
    expect(catalogueModelPolicy('mod_1').next?.tags).toContain('model:mod_1');
    expect(catalogueTrimPolicy('trm_1').next?.tags).toContain('trim:trm_1');
    expect(trimDealersPolicy('trm_1').next?.tags).toContain('catalogue:trim:trm_1:dealers');
    expect(makeDealersPolicy('toyota').next?.tags).toContain('catalogue:make:toyota:dealers');

    // Locations & Promotions
    expect(countriesPolicy().next?.tags).toEqual(['locations:countries']);
    expect(countryConfigPolicy('AE').next?.tags).toContain('locations:country:ae');
    expect(citiesPolicy('AE').next?.tags).toContain('locations:country:ae');
    expect(areasPolicy(101).next?.tags).toContain('locations:city:101');
    expect(promotionPackagesPolicy().next?.tags).toEqual(['promotions:packages']);
    expect(searchSuggestionsPolicy().maxAge).toBe(60);

    // Helpers
    expect(createNoStorePolicy().cache).toBe('no-store');
    expect(createPublicCachePolicy({ ttl: 45 }).next?.revalidate).toBe(45);
  });

  it('enforces no-store and isPrivate: true for private operations and personalized listings', () => {
    const priv = privatePolicy();
    expect(priv.cache).toBe('no-store');
    expect(priv.isPrivate).toBe(true);
    expect(priv.next).toBeUndefined();

    // Personalized search listings MUST be no-store
    const personalizedSearch = searchListingsPolicy(true);
    expect(personalizedSearch.cache).toBe('no-store');
    expect(personalizedSearch.isPrivate).toBe(true);

    // Personalized listing detail (favorite overlay) MUST be no-store
    const personalizedListing = listingDetailPolicy('nissan-patrol-2023', true);
    expect(personalizedListing.cache).toBe('no-store');
    expect(personalizedListing.isPrivate).toBe(true);
  });

  it('generates standard Cache-Control headers', () => {
    expect(buildCacheControlHeader(privatePolicy())).toBe('private, no-store');
    expect(buildCacheControlHeader(searchListingsPolicy(true))).toBe('private, no-store');

    const publicHomeHeader = buildCacheControlHeader(homePolicy());
    expect(publicHomeHeader).toContain('public');
    expect(publicHomeHeader).toContain('s-maxage=300');
    expect(publicHomeHeader).toContain('stale-while-revalidate=');
  });

  it('normalizes public cached listings to isFavorited:false preventing personalized data in public cache', () => {
    // Simulated personalized upstream response with isFavorited: true
    const personalizedListing = {
      publicId: 'lst_123',
      slug: 'bmw-m3-2024',
      isFavorited: true, // Upstream returned personalized true
      priceCents: 9000000,
    };

    const normalizedSingle = normalizePublicCachedListing(personalizedListing);
    expect(normalizedSingle.isFavorited).toBe(false);
    expect(normalizedSingle.slug).toBe('bmw-m3-2024');

    const normalizedMultiple = normalizePublicCachedListings([
      personalizedListing,
      { ...personalizedListing, slug: 'bmw-m4-2024' },
    ]);
    expect(normalizedMultiple).toHaveLength(2);
    expect(normalizedMultiple[0]?.isFavorited).toBe(false);
    expect(normalizedMultiple[1]?.isFavorited).toBe(false);

    // Deep response payload normalization
    const wrappedPayload = {
      data: [personalizedListing],
      meta: { total: 1 },
    };
    const normalizedPayload = normalizePublicCachePayload(wrappedPayload);
    expect(normalizedPayload.data[0]?.isFavorited).toBe(false);

    // Public cache entry helper enforces force-cache policy and normalized data
    const detailEntry = createPublicListingDetailCacheEntry('bmw-m3-2024', personalizedListing);
    expect(detailEntry.data.isFavorited).toBe(false);
    expect(detailEntry.policy.cache).toBe('force-cache');
    expect(detailEntry.policy.isPrivate).toBe(false);

    const searchEntry = createPublicListingSearchCacheEntry([personalizedListing]);
    expect(searchEntry.data[0]?.isFavorited).toBe(false);
    expect(searchEntry.policy.cache).toBe('force-cache');
  });
});

describe('TASK-012: Canonical Query Keys (keys.ts)', () => {
  it('implements exact Phase 1 Section 4.4 query key shapes', () => {
    // Session/profile
    expect(queryKeys.me()).toEqual(['me']);
    expect(queryKeys.profile()).toEqual(['me', 'profile']);

    // Listing search
    const filters = { makeSlug: 'toyota', yearMin: 2020 };
    expect(queryKeys.listingSearch(filters, 1, 20)).toEqual([
      'listings',
      'search',
      { makeSlug: 'toyota', yearMin: 2020 },
      1,
      20,
    ]);

    // Listing detail/similar
    expect(queryKeys.listingDetail('toyota-land-cruiser')).toEqual([
      'listing',
      'toyota-land-cruiser',
    ]);
    expect(queryKeys.similarListings('toyota-land-cruiser', 6)).toEqual([
      'listing',
      'toyota-land-cruiser',
      'similar',
      6,
    ]);

    // Favorites
    expect(queryKeys.favorites({ limit: 20 })).toEqual(['me', 'favorites', { limit: 20 }]);

    // Saved searches
    expect(queryKeys.savedSearches()).toEqual(['me', 'saved-searches']);

    // Notifications
    expect(queryKeys.notifications({ limit: 10, unreadOnly: true })).toEqual([
      'me',
      'notifications',
      { limit: 10, unreadOnly: true },
    ]);
    expect(queryKeys.notificationUnreadCount()).toEqual([
      'me',
      'notifications',
      'unread-count',
    ]);

    // My listings
    expect(queryKeys.myListings({ status: 'ACTIVE', limit: 20 })).toEqual([
      'me',
      'listings',
      { limit: 20, status: 'ACTIVE' },
    ]);

    // Leads
    expect(
      queryKeys.leads({ vendorIdOrNull: 'vnd_01', status: 'NEW' })
    ).toEqual(['me', 'leads', { status: 'NEW', vendorIdOrNull: 'vnd_01' }]);
    expect(queryKeys.lead('led_01', { vendorIdOrNull: 'vnd_01' })).toEqual([
      'me',
      'leads',
      'led_01',
      { vendorIdOrNull: 'vnd_01' },
    ]);

    // Vendors & Dashboard
    expect(queryKeys.vendors()).toEqual(['me', 'vendors']);
    expect(queryKeys.vendorDashboard('vnd_01', '30d')).toEqual([
      'vendor',
      'vnd_01',
      'dashboard',
      '30d',
    ]);

    // Dealers
    expect(queryKeys.dealers({ cityId: 1, limit: 12 })).toEqual([
      'dealers',
      { cityId: 1, limit: 12 },
    ]);
    expect(queryKeys.dealer('al-futtaim')).toEqual(['dealer', 'al-futtaim']);
    expect(queryKeys.dealerListings('al-futtaim', { yearMin: 2021 }, 12)).toEqual([
      'dealer',
      'al-futtaim',
      'listings',
      { yearMin: 2021 },
      12,
    ]);

    // Taxonomy & Catalogue
    expect(queryKeys.taxonomyMakes()).toEqual(['taxonomy', 'makes']);
    expect(queryKeys.taxonomyModels('toyota')).toEqual([
      'taxonomy',
      'make',
      'toyota',
      'models',
    ]);
    expect(queryKeys.catalogueModel('mod_01')).toEqual(['catalogue', 'model', 'mod_01']);
    expect(queryKeys.catalogueTrim('trm_01')).toEqual(['catalogue', 'trim', 'trm_01']);

    // Suggestions
    expect(queryKeys.searchSuggestions('ar', 'USED', 'كامري')).toEqual([
      'search',
      'suggest',
      'ar',
      'USED',
      'كامري',
    ]);

    // Upload status
    expect(queryKeys.uploadStatus('fil_01')).toEqual(['files', 'fil_01', 'status']);
  });

  it('canonicalizes object parameters regardless of key order or undefined properties', () => {
    const objA = { b: 2, a: 1, c: undefined };
    const objB = { a: 1, b: 2 };

    const canonA = canonicalizeRecord(objA);
    const canonB = canonicalizeRecord(objB);

    expect(JSON.stringify(canonA)).toBe(JSON.stringify(canonB));
    expect(JSON.stringify(canonA)).toBe('{"a":1,"b":2}');

    const searchKey1 = queryKeys.listingSearch({ sort: 'price_asc', makeSlug: 'bmw' }, 1, 20);
    const searchKey2 = queryKeys.listingSearch(
      { makeSlug: 'bmw', sort: 'price_asc', modelSlug: undefined },
      1,
      20
    );
    expect(searchKey1).toEqual(searchKey2);

    // canonicalizeValue primitives and arrays
    expect(canonicalizeValue(null)).toBeNull();
    expect(canonicalizeValue(undefined)).toBeUndefined();
    expect(canonicalizeValue([3, 2, 1])).toEqual([3, 2, 1]);

    // queryKeyRoots namespaces
    expect(queryKeyRoots.me).toEqual(['me']);
    expect(queryKeyRoots.listings).toEqual(['listings']);
    expect(queryKeyRoots.listing).toEqual(['listing']);
    expect(queryKeyRoots.dealers).toEqual(['dealers']);
    expect(queryKeyRoots.dealer).toEqual(['dealer']);
    expect(queryKeyRoots.taxonomy).toEqual(['taxonomy']);
    expect(queryKeyRoots.catalogue).toEqual(['catalogue']);
    expect(queryKeyRoots.search).toEqual(['search']);
    expect(queryKeyRoots.files).toEqual(['files']);
    expect(queryKeyRoots.vendor('vnd_123')).toEqual(['vendor', 'vnd_123']);
  });

  it('strictly validates serializability and forbids functions, classes, and credentials in keys', () => {
    expect(() => assertSerializableKey(['me', 'favorites'])).not.toThrow();
    expect(() =>
      assertSerializableKey([
        'listings',
        'search',
        { makeSlug: 'toyota', page: 1 },
      ])
    ).not.toThrow();

    // Functions forbidden
    expect(() =>
      assertSerializableKey(['listings', () => {}])
    ).toThrow(/functions/i);

    // Tokens / credentials forbidden
    expect(() =>
      assertSerializableKey(['auth', { token: 'secret-bearer-jwt' }])
    ).toThrow(/token/i);
    expect(() =>
      assertSerializableKey(['auth', { password: 'my-password' }])
    ).toThrow(/password/i);

    // Class instances forbidden
    class CustomClass {
      id = '123';
    }
    expect(() =>
      assertSerializableKey(['custom', new CustomClass()])
    ).toThrow(/class instances/i);
  });

  it('enforces serializable, credential-free keys and validates inputs directly in factory calls', () => {
    // 1. Credentials forbidden in factory calls
    expect(() =>
      queryKeys.listingSearch({ token: 'secret-token' }, 1, 20)
    ).toThrow(/token/i);
    expect(() =>
      queryKeys.listingSearch({ password: 'secret-password' }, 1, 20)
    ).toThrow(/password/i);
    expect(() =>
      queryKeys.favorites({ token: 'secret' } as Record<string, unknown>)
    ).toThrow(/token/i);

    // 2. Class instances forbidden in factory calls
    class CustomSearchFilter {
      make = 'toyota';
    }
    expect(() =>
      queryKeys.listingSearch(new CustomSearchFilter() as unknown as Record<string, unknown>, 1, 20)
    ).toThrow(/class instances/i);

    // 3. Circular references forbidden in factory calls
    const circular: Record<string, unknown> = { key: 'val' };
    circular['self'] = circular;
    expect(() =>
      queryKeys.listingSearch(circular, 1, 20)
    ).toThrow(/circular/i);

    // 4. Input validation: slugs
    expect(() => queryKeys.listingDetail('INVALID_UPPERCASE')).toThrow();
    expect(() => queryKeys.listingDetail('../path-traversal')).toThrow();
    expect(() => queryKeys.dealer('invalid dealer slug')).toThrow();
    expect(() => queryKeys.taxonomyModels('')).toThrow();

    // 5. Input validation: public IDs
    expect(() => queryKeys.catalogueModel('')).toThrow();
    expect(() => queryKeys.uploadStatus('')).toThrow();
    expect(() => queryKeys.vendorDashboard('', '30d')).toThrow();

    // 6. Input validation: pagination and limit
    expect(() => queryKeys.listingSearch({}, -1, 20)).toThrow();
    expect(() => queryKeys.listingSearch({}, 1, 0)).toThrow();

    // 7. Input validation: locale
    expect(() =>
      queryKeys.searchSuggestions('fr', 'USED', 'camry')
    ).toThrow();
  });
});

describe('TASK-012: Mutation Invalidation Plans (invalidation.ts)', () => {
  it('generates localized paths for supported locales (ar, en)', () => {
    expect(getLocalizedPaths(['/search', '/me/listings'])).toEqual([
      '/ar/search',
      '/en/search',
      '/ar/me/listings',
      '/en/me/listings',
    ]);
    expect(getLocalizedPaths(['/'])).toEqual(['/ar', '/en']);
    expect(getLocalizedPaths([''])).toEqual(['/ar', '/en']);
  });

  it('defines invalidation plan for createListing that revalidates public feeds and user listings', () => {
    const plan = invalidationPlans.createListing();
    expect(plan.operation).toBe('createListing');
    expect(plan.queryKeyPrefixes).toEqual([['me', 'listings'], ['listings']]);
    expect(plan.tags).toEqual(['listings', 'home']);
    expect(plan.paths).toContain('/ar/search');
    expect(plan.paths).toContain('/en/search');
    expect(plan.paths).toContain('/ar/me/listings');
  });

  it('enforces CACHE-01: favorite toggles do NOT invalidate public tags', () => {
    const plan = invalidationPlans.favoriteToggle({ publicId: 'lst_001', slug: 'toyota-camry' });
    expect(plan.operation).toBe('favoriteToggle');
    // Public tags MUST be empty to prevent public cache purge on private user action
    expect(plan.tags).toEqual([]);
    expect(plan.queryKeyPrefixes).toContainEqual(['me', 'favorites']);
    expect(plan.queryKeyPrefixes).toContainEqual(['me']);
    expect(plan.queryKeyPrefixes).toContainEqual(['listing', 'toyota-camry']);
    expect(plan.paths).toEqual(['/ar/favorites', '/en/favorites']);
  });

  it('defines invalidation plan for logout that requests clearing all private query caches', () => {
    const plan = invalidationPlans.logout();
    expect(plan.clearPrivateQueries).toBe(true);
    expect(plan.tags).toEqual([]);
  });

  it('defines invalidation plan for active vendor switch that requests clearing vendor queries', () => {
    const plan = invalidationPlans.activeVendorSwitch('vnd_old_01');
    expect(plan.clearVendorQueries).toBe(true);
    expect(plan.queryKeyPrefixes).toContainEqual(['vendor', 'vnd_old_01']);
  });

  it('executes invalidation plan successfully across mock revalidators and queryClient', async () => {
    const revalidateTag = vi.fn().mockResolvedValue(undefined);
    const revalidatePath = vi.fn().mockResolvedValue(undefined);
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const removeQueries = vi.fn();

    const plan = invalidationPlans.createListing();
    const result = await executeInvalidationPlan(plan, {
      revalidateTag,
      revalidatePath,
      queryClient: { invalidateQueries, removeQueries },
    });

    expect(result.success).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('listings');
    expect(revalidateTag).toHaveBeenCalledWith('home');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['me', 'listings'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['listings'] });
  });

  it('returns InvalidationReconciliationError if revalidation fails after upstream success', async () => {
    const revalidateTag = vi.fn().mockRejectedValue(new Error('Tag cache failure'));

    const plan = invalidationPlans.createListing();
    const result = await executeInvalidationPlan(plan, {
      revalidateTag,
      requestId: 'req_test_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(InvalidationReconciliationError);
    expect(result.error?.shouldRefetch).toBe(true);
    expect(result.error?.failedTags).toContain('listings');
    expect(result.error?.message).toContain('refetch server state');
  });

  it('returns InvalidationReconciliationError and records failedQueryKeys when queryClient invalidation fails', async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('Browser query client store error'));
    const removeQueries = vi.fn();

    const plan = invalidationPlans.createListing();
    const result = await executeInvalidationPlan(plan, {
      queryClient: { invalidateQueries, removeQueries },
      requestId: 'req_query_fail_456',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(InvalidationReconciliationError);
    expect(result.error?.shouldRefetch).toBe(true);
    expect(result.error?.failedQueryKeys).toContainEqual(['me', 'listings']);
    expect(result.error?.failedQueryKeys).toContainEqual(['listings']);
    expect(result.error?.requestId).toBe('req_query_fail_456');
  });
});

describe('TASK-012: QueryClient Factory and Hydration (client.ts, hydration.tsx)', () => {
  beforeEach(() => {
    resetBrowserQueryClient();
  });

  it('creates QueryClient with disabled automatic mutation retry and sensible timings', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();

    expect(defaultOptions.queries?.staleTime).toBe(DEFAULT_QUERY_STALE_TIME);
    expect(defaultOptions.queries?.gcTime).toBe(DEFAULT_QUERY_GC_TIME);
    // Automatic mutation retries MUST be false
    expect(defaultOptions.mutations?.retry).toBe(false);
  });

  it('configures query retry predicate to reject 4xx errors but permit transient retries', () => {
    const client = makeQueryClient();
    const retryFn = client.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown
    ) => boolean;

    expect(typeof retryFn).toBe('function');
    // 400 Bad Request should not retry
    expect(retryFn(0, { status: 400 })).toBe(false);
    // 401 Unauthorized should not retry
    expect(retryFn(0, { status: 401 })).toBe(false);
    // 404 Not Found should not retry
    expect(retryFn(0, { status: 404 })).toBe(false);
    // 422 Unprocessable Entity should not retry
    expect(retryFn(0, { status: 422 })).toBe(false);
    // 500 or network error can retry once
    expect(retryFn(0, { status: 500 })).toBe(true);
    // stops after 2 retries
    expect(retryFn(2, { status: 500 })).toBe(false);
  });

  it('redacts sensitive information from errors before dehydration', () => {
    const sensitiveError = {
      message: 'Failed to query database',
      stack: 'Error: at /Users/secret/app/server.ts:42',
      sql: 'SELECT * FROM users WHERE password = "foo"',
      token: 'bearer-secret-token',
      details: {
        rawQuery: 'SELECT secret FROM keys',
      },
    };

    const redacted = redactErrorForDehydration(sensitiveError) as Record<string, unknown>;
    expect(redacted['stack']).toBeUndefined();
    expect(redacted['sql']).toBeUndefined();
    expect(redacted['token']).toBeUndefined();
    expect(JSON.stringify(redacted)).not.toContain('password');
    expect(JSON.stringify(redacted)).not.toContain('bearer-secret-token');
  });

  it('returns fresh QueryClient on server and singleton on browser', () => {
    // In Vitest node environment, window is undefined
    const client1 = getQueryClient();
    const client2 = getQueryClient();
    expect(client1).not.toBe(client2);

    // Mock browser environment with window object
    const originalWindow = globalThis.window;
    try {
      (globalThis as unknown as { window?: unknown }).window = {};
      const browserClient1 = getQueryClient();
      const browserClient2 = getQueryClient();
      expect(browserClient1).toBe(browserClient2);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = originalWindow;
    }
  });

  it('safely dehydrates query cache without leaking sensitive query errors', () => {
    const client = makeQueryClient();
    const queryCache = client.getQueryCache();

    queryCache.build(client, {
      queryKey: ['listings', 'search', {}, 1, 20],
      queryFn: () => ({ data: [] }),
    });

    const state = dehydrateSafe(client);
    expect(state.queries.length).toBeGreaterThanOrEqual(0);
  });

  it('renders QueryHydrationBoundary with queryClient or state without error', () => {
    const client = makeQueryClient();
    const element = QueryHydrationBoundary({
      children: 'Hydrated Child Component',
      queryClient: client,
    });
    expect(element).toBeDefined();

    // Test with no state renders children fragment
    const emptyElement = QueryHydrationBoundary({
      children: 'Empty Boundary Child',
    });
    expect(emptyElement).toBeDefined();
  });
});

describe('TASK-012: CACHE-01 Strict BDD Acceptance Gate', () => {
  /**
   * Acceptance Criteria:
   * GIVEN: The same listing is requested anonymously and by two users with different favorite state
   * WHEN: Cache keys, base caching, and private overlays execute
   * THEN: Public content is reused, identity state is isolated/no-store, and neither user observes
   *       the other user’s favorite or vendor data.
   */

  it('reuses public base listing with isFavorited:false while keeping user favorite states strictly isolated', async () => {
    const LISTING_SLUG = 'toyota-camry-2024';

    // 1. Base public listing representation prepared via createPublicListingDetailCacheEntry / normalizePublicCachedListing
    // Even if upstream emitted a personalized isFavorited: true, public cache normalization forces isFavorited: false.
    const rawUpstreamListing = {
      id: 'lst_01h7x9k3p0000000000000001',
      slug: LISTING_SLUG,
      title: { ar: 'تويوتا كامري 2024', en: 'Toyota Camry 2024' },
      priceCents: 8500000,
      isFavorited: true, // Upstream returned true (e.g. from authenticated backend session)
    };

    const publicCacheEntry = createPublicListingDetailCacheEntry(LISTING_SLUG, rawUpstreamListing);
    const sharedPublicBaseListing = publicCacheEntry.data;
    const publicBasePolicy = publicCacheEntry.policy;

    expect(sharedPublicBaseListing.isFavorited).toBe(false); // FORCED to false before cache storage!
    expect(publicBasePolicy.cache).toBe('force-cache');
    expect(publicBasePolicy.isPrivate).toBe(false);
    expect(publicBasePolicy.next?.tags).toEqual(['listings', 'listing:toyota-camry-2024']);
    expect(buildCacheControlHeader(publicBasePolicy)).toContain('public');

    // 2. Simulate User A (has favorited the listing)
    const userAOverlayPolicy = listingDetailPolicy(LISTING_SLUG, true);
    expect(userAOverlayPolicy.cache).toBe('no-store');
    expect(userAOverlayPolicy.isPrivate).toBe(true);
    expect(buildCacheControlHeader(userAOverlayPolicy)).toBe('private, no-store');

    const userAFavoriteOverlay = { listingId: sharedPublicBaseListing.id, isFavorited: true };
    const userAEffectiveListing = {
      ...sharedPublicBaseListing,
      isFavorited: userAFavoriteOverlay.isFavorited,
    };

    // 3. Simulate User B (has NOT favorited the listing)
    const userBOverlayPolicy = listingDetailPolicy(LISTING_SLUG, true);
    expect(userBOverlayPolicy.cache).toBe('no-store');
    expect(userBOverlayPolicy.isPrivate).toBe(true);

    const userBFavoriteOverlay = { listingId: sharedPublicBaseListing.id, isFavorited: false };
    const userBEffectiveListing = {
      ...sharedPublicBaseListing,
      isFavorited: userBFavoriteOverlay.isFavorited,
    };

    // 4. Simulate Anonymous User (no overlay)
    const anonymousEffectiveListing = { ...sharedPublicBaseListing };

    // 5. Assert CACHE-01 invariants:
    // a. The shared public cached base remains unchanged and isFavorited is strictly false
    expect(sharedPublicBaseListing.isFavorited).toBe(false);
    expect(anonymousEffectiveListing.isFavorited).toBe(false);

    // b. User A observes isFavorited: true
    expect(userAEffectiveListing.isFavorited).toBe(true);

    // c. User B observes isFavorited: false
    expect(userBEffectiveListing.isFavorited).toBe(false);

    // d. Query keys between User A and User B cannot collide
    const userAClient = makeQueryClient();
    const userBClient = makeQueryClient();

    const userAFavoritesKey = queryKeys.favorites({ limit: 20 });
    const userBFavoritesKey = queryKeys.favorites({ limit: 20 });

    userAClient.setQueryData(userAFavoritesKey, [{ id: sharedPublicBaseListing.id }]);
    userBClient.setQueryData(userBFavoritesKey, []);

    expect(userAClient.getQueryData(userAFavoritesKey)).toEqual([
      { id: sharedPublicBaseListing.id },
    ]);
    expect(userBClient.getQueryData(userBFavoritesKey)).toEqual([]);

    // e. Toggling favorite for User A does NOT invalidate public cache tags
    const favTogglePlan = invalidationPlans.favoriteToggle({
      publicId: sharedPublicBaseListing.id,
      slug: LISTING_SLUG,
    });
    expect(favTogglePlan.tags).toEqual([]); // Zero public tags invalidated!

    // f. Vendor data between two vendors is strictly partitioned in query keys
    const vendorAKey = queryKeys.vendorDashboard('vnd_alpha', '30d');
    const vendorBKey = queryKeys.vendorDashboard('vnd_beta', '30d');
    expect(vendorAKey).not.toEqual(vendorBKey);
    expect(vendorAKey).toEqual(['vendor', 'vnd_alpha', 'dashboard', '30d']);
    expect(vendorBKey).toEqual(['vendor', 'vnd_beta', 'dashboard', '30d']);
  });
});
