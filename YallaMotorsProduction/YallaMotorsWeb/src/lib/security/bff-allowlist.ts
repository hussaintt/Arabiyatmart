import 'server-only';

/**
 * Strict BFF Route Handler Allowlist and Default-Deny Security Gateway.
 *
 * Implements Phase 1 Section 1.4/2.6 and Phase 2 Sections 3.1-3.8:
 * - Default-deny table translating all Phase 2 browser Route Handler operations.
 * - Enforces method, exact path pattern, auth mode, input/output schemas, upstream builder,
 *   timeout, maximum body size, rate class, cache policy, adapter, and idempotency requirements.
 * - Rejects admin, testing, scraper, import, metrics, Swagger, worker, arbitrary proxy, or undocumented paths.
 * - Rejects method mismatches, traversal sequences, and encoded path smuggling before upstream I/O.
 */

import { z } from 'zod';
import { adaptMarketplaceMedia } from '@/server/queries/marketplace-media';
import {
  UPSTREAM_ENDPOINTS,
  isAllowedBffPath,
} from '@/lib/api/endpoints';
import type { HttpMethod, AuthMode } from '@/lib/api/server';
import type { CachePolicy } from '@/lib/cache/policy';
import {
  createNoStorePolicy,
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
} from '@/lib/cache/policy';
import {
  adapt204Acknowledgement,
  adaptRawBannerList,
  adaptRawPublicSettings,
  adaptRawSpotlight,
  adaptRawDealerDirectory,
  adaptRawDealerProfile,
  adaptRawMakeList,
  adaptRawVehicleModelList,
  adaptRawGenerationList,
  adaptRawTrimList,
  adaptRawTrimDetail,
  adaptRawModelsWithPrices,
  adaptRawModelPage,
  adaptRawCatalogueTrimDetail,
  adaptRawTrimDealers,
  adaptRawCountryList,
  adaptRawCountryConfig,
  adaptRawCityList,
  adaptRawAreaList,
  adaptRawPromotionPackageList,
  adaptRawMyVendors,
  adaptRawUploadedFile,
  adaptRawFileStatus,
  adaptRawSavedSearchList,
  adaptRawPromotionList,
  adaptRawNotification,
  adaptRawNotificationList,
  adaptRawDeviceRegistration,
  adaptRawDeviceRegistrationList,
  adaptRawLead,
  adaptRawLeadDetail,
  adaptRawLeadList,
  adaptRawListingReport,
  adaptRawDashboardOverview,
  adaptRawVehicleSearchSuggestionList,
  adaptRawDealerEntitlements,
  adaptRawSubscriptionPlans,
  adaptRawVendorSubscription,
  adaptRawVendorBillingSummary,
} from '@/lib/api/adapters';
import {
  PublicIdSchema,
  SlugSchema,
  CountResponseSchema,
  MutationAckResponseSchema,
} from '@/lib/api/schemas/common';
import {
  BannerListParamsSchema,
  HomeBannerListResponseSchema,
} from '@/lib/api/schemas/home';
import { PublicSettingsResponseSchema } from '@/lib/api/schemas/settings';
import {
  SpotlightParamsSchema,
  SpotlightResponseSchema,
  MakeListResponseSchema,
  TaxonomyModelsParamsSchema,
  VehicleModelListResponseSchema,
  TaxonomyGenerationsParamsSchema,
  GenerationListResponseSchema,
  TaxonomyTrimsParamsSchema,
  TrimListResponseSchema,
  TrimPathParamsSchema,
  TrimResponseSchema,
  TrimDealersResponseSchema,
  ModelsWithPricesResponseSchema,
  ModelPathParamsSchema,
  ModelPageResponseSchema,
  CatalogueTrimDetailResponseSchema,
  CountryListResponseSchema,
  CountryCodeParamsSchema,
  CountryConfigResponseSchema,
  CountryCitiesParamsSchema,
  CityListResponseSchema,
  AreaListResponseSchema,
} from '@/lib/api/schemas/taxonomy';
import {
  CarConditionSchema,
  ListingStatusSchema,
  ListingBatchParamsSchema,
  ListingBatchResponseSchema,
  ListingSlugParamsSchema,
  ListingDetailResponseSchema,
  SimilarListingsParamsSchema,
  ListingListResponseSchema,
  FavoriteMutationResponseSchema,
  ListingCursorResponseSchema,
  MyListingsResponseSchema,
} from '@/lib/api/schemas/listing';
import {
  DealerListParamsSchema,
  DealerDirectoryResponseSchema,
  DealerProfileResponseSchema,
  DealerInventoryParamsSchema,
  MyVendorsResponseSchema,
} from '@/lib/api/schemas/dealer';
import {
  PromotionPackageListResponseSchema,
  PromotionListResponseSchema,
  CreateLeadInputSchema,
  LeadResponseSchema,
  LeadListParamsSchema,
  LeadListResponseSchema,
  LeadPublicIdParamsSchema,
  LeadDetailResponseSchema,
  UpdateLeadStatusInputSchema,
  CreateReportInputSchema,
  ListingReportResponseSchema,
} from '@/lib/api/schemas/lead';
import {
  UploadPurposeSchema,
  UploadedFileResponseSchema,
  FilePublicIdParamsSchema,
  FileStatusResponseSchema,
} from '@/lib/api/schemas/upload';
import {
  SavedSearchListResponseSchema,
  VehicleSearchSuggestionParamsSchema,
  VehicleSearchSuggestionResponseSchema,
} from '@/lib/api/schemas/saved-search';
import {
  NotificationListParamsSchema,
  NotificationListResponseSchema,
  NotificationPublicIdParamsSchema,
  NotificationResponseSchema,
  DeviceRegistrationListResponseSchema,
  RegisterDeviceInputSchema,
  DeviceRegistrationResponseSchema,
  UnregisterDeviceInputSchema,
} from '@/lib/api/schemas/notification';
import {
  ListingSearchParamsSchema,
  ListingSearchResponseSchema,
} from '@/lib/api/schemas/search';
import {
  DashboardRangeSchema,
  DashboardOverviewResponseSchema,
  dashboardRangeToDays,
} from '@/lib/api/schemas/dashboard';
import {
  GoogleLoginInputSchema,
  AppleLoginInputSchema,
  SessionResponseSchema,
} from '@/lib/api/schemas/auth';
import {
  UserProfileResponseSchema,
  VerifyFirebasePhoneInputSchema,
  VerifiedPhoneUserResponseSchema,
} from '@/lib/api/schemas/profile';
import {
  DealerEntitlementsResponseSchema,
  VendorBillingSummaryResponseSchema,
  VendorSubscriptionResponseSchema,
  SubscriptionPlansResponseSchema,
} from '@/lib/api/schemas/billing';

export type RateClass = 'public_read' | 'auth' | 'mutation' | 'upload' | 'search';

export const PublicIdBatchParamsSchema = z.object({
  publicIds: z
    .array(PublicIdSchema)
    .min(1)
    .max(4)
    .refine((ids) => new Set(ids).size === ids.length, 'IDs must be unique'),
});

export const ListingPublicIdParamsSchema = z.object({
  publicId: PublicIdSchema,
});

export const FavoriteListParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.union([z.literal(20), z.literal(50), z.literal(100)]).optional(),
});

export const MyListingsParamsSchema = z.object({
  status: ListingStatusSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.union([z.literal(20), z.literal(50), z.literal(100)]).optional(),
});

export interface BffPathContext {
  pathParams: Record<string, string>;
  query: Record<string, unknown>;
  body?: unknown;
  vendorPublicId?: string | null;
  isPersonalized?: boolean;
}

export interface BffOperationDefinition {
  readonly operation: string;
  readonly method: HttpMethod;
  readonly pathTemplate: string;
  readonly pathPattern: RegExp;
  readonly pathParamNames: readonly string[];
  readonly authMode: AuthMode;
  readonly rateClass: RateClass;
  readonly timeoutMs: number;
  readonly maxBodySizeBytes: number;
  readonly requiresIdempotency: boolean;
  readonly successStatus?: number;
  readonly pathParamsSchema?: z.ZodTypeAny;
  readonly querySchema?: z.ZodTypeAny;
  readonly bodySchema?: z.ZodTypeAny;
  readonly outputSchema: z.ZodTypeAny;
  readonly cachePolicy: CachePolicy | ((ctx: BffPathContext) => CachePolicy);
  readonly adapter?: (raw: unknown) => unknown;
  readonly buildUpstreamQuery?: (ctx: BffPathContext) => Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>>;
  readonly buildUpstreamPath: (ctx: BffPathContext) => string;
}

function getParam(ctx: BffPathContext, name: string): string {
  const val = ctx.pathParams[name];
  if (!val) {
    throw new Error(`Missing required path parameter "${name}"`);
  }
  return val;
}

/**
 * Explicit disallowed keywords matching admin, testing, scrapers, metrics, swagger, and worker tools.
 */
export const BLOCKED_PATH_KEYWORDS: readonly string[] = [
  'admin',
  'testing',
  'test',
  'scraper',
  'import',
  'metrics',
  'swagger',
  'worker',
  'internal',
  'health',
  'debug',
  'private_api',
];

/**
 * Validates path security against encoding attacks, directory traversal, null bytes,
 * forbidden keywords, and unallowlisted routes.
 */
export function validateBffPathSecurity(pathname: string): {
  valid: boolean;
  reason?: string;
  status: 400 | 404;
} {
  if (!pathname || typeof pathname !== 'string') {
    return { valid: false, status: 400, reason: 'Invalid or missing pathname' };
  }

  // Reject leading/trailing whitespace
  if (/^\s|\s$/.test(pathname)) {
    return { valid: false, status: 400, reason: 'Whitespace in path is strictly forbidden' };
  }

  // Reject control characters, query strings, URL fragments, or null bytes
  if (/[\x00-\x20\x7F#?]/.test(pathname)) {
    return { valid: false, status: 400, reason: 'Control characters, query, or fragments forbidden in pathname' };
  }

  // Reject raw backslashes and directory traversal
  if (pathname.includes('\\') || pathname.includes('..')) {
    return { valid: false, status: 400, reason: 'Directory traversal or backslashes strictly forbidden' };
  }

  // Reject percent-encoded separators (%2f, %5c), dots (%2e), null bytes (%00), hash (%23), or query (%3f)
  if (/%(?:2f|5c|2e|00|23|3f)/i.test(pathname)) {
    return { valid: false, status: 400, reason: 'Encoded path separators or traversal sequences strictly forbidden' };
  }

  // Bounded iterative decoding to catch nested encoding attacks (e.g. %252f)
  let current = pathname;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      if (
        next.includes('\\') ||
        next.includes('..') ||
        next.includes('\0') ||
        /[\x00-\x1F\x7F#?]/.test(next) ||
        /%(?:2f|5c|2e|00|23|3f)/i.test(next)
      ) {
        return { valid: false, status: 400, reason: 'Nested encoded path traversal or smuggling strictly forbidden' };
      }
      current = next;
    } catch {
      return { valid: false, status: 400, reason: 'Malformed URI encoding in pathname' };
    }
  }

  // Must begin with /api/bff
  if (!pathname.startsWith('/api/bff')) {
    return { valid: false, status: 404, reason: 'Path does not target /api/bff' };
  }

  // Strictly block keywords like admin, testing, metrics, swagger, worker, scraper
  const lowerPath = pathname.toLowerCase();
  for (const keyword of BLOCKED_PATH_KEYWORDS) {
    if (
      lowerPath.includes(`/${keyword}/`) ||
      lowerPath.endsWith(`/${keyword}`) ||
      lowerPath.includes(`/${keyword}`)
    ) {
      return { valid: false, status: 404, reason: `Access to "${keyword}" endpoints is strictly forbidden` };
    }
  }

  // Enforce against explicit Phase 1 / Phase 2 allowlist
  if (!isAllowedBffPath(pathname)) {
    return { valid: false, status: 404, reason: 'Endpoint is not registered in the BFF allowlist' };
  }

  return { valid: true, status: 404 };
}

/**
 * Complete default-deny table translating all Phase 2 browser Route Handler operations.
 */
export const BFF_ALLOWLIST: readonly BffOperationDefinition[] = [
  // ── 1. Authentication & Session ───────────────────────────────────────────
  {
    operation: 'getSession',
    method: 'GET',
    pathTemplate: '/api/bff/session',
    pathPattern: /^\/api\/bff\/session$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'auth',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: SessionResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.me(),
  },
  {
    operation: 'loginWithGoogle',
    method: 'POST',
    pathTemplate: '/api/bff/auth/google',
    pathPattern: /^\/api\/bff\/auth\/google$/,
    pathParamNames: [],
    authMode: 'O',
    rateClass: 'auth',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: false,
    bodySchema: GoogleLoginInputSchema,
    outputSchema: SessionResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.loginWithGoogle(),
  },
  {
    operation: 'loginWithApple',
    method: 'POST',
    pathTemplate: '/api/bff/auth/apple',
    pathPattern: /^\/api\/bff\/auth\/apple$/,
    pathParamNames: [],
    authMode: 'M',
    rateClass: 'auth',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: false,
    bodySchema: AppleLoginInputSchema,
    outputSchema: SessionResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.loginWithApple(),
  },
  {
    operation: 'refreshSession',
    method: 'POST',
    pathTemplate: '/api/bff/auth/refresh',
    pathPattern: /^\/api\/bff\/auth\/refresh$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'auth',
    timeoutMs: 20_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: SessionResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.refreshSession(),
  },
  {
    operation: 'verifyFirebasePhone',
    method: 'POST',
    pathTemplate: '/api/bff/auth/phone/verify',
    pathPattern: /^\/api\/bff\/auth\/phone\/verify$/,
    pathParamNames: [],
    authMode: 'M',
    rateClass: 'auth',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: false,
    bodySchema: VerifyFirebasePhoneInputSchema,
    outputSchema: VerifiedPhoneUserResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.verifyFirebasePhone(),
  },
  {
    operation: 'getProfile',
    method: 'GET',
    pathTemplate: '/api/bff/me',
    pathPattern: /^\/api\/bff\/me$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: UserProfileResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.me(),
  },

  // ── 2. Public Marketplace & Catalogue ─────────────────────────────────────
  {
    operation: 'listBanners',
    method: 'GET',
    pathTemplate: '/api/bff/banners',
    pathPattern: /^\/api\/bff\/banners$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: BannerListParamsSchema,
    outputSchema: HomeBannerListResponseSchema,
    cachePolicy: bannersPolicy(),
    adapter: adaptRawBannerList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.banners(),
  },
  {
    operation: 'getPublicSettings',
    method: 'GET',
    pathTemplate: '/api/bff/settings/public',
    pathPattern: /^\/api\/bff\/settings\/public$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: PublicSettingsResponseSchema,
    cachePolicy: publicSettingsPolicy(),
    adapter: adaptRawPublicSettings,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.publicSettings(),
  },
  {
    operation: 'getSpotlight',
    method: 'GET',
    pathTemplate: '/api/bff/catalogue/spotlight',
    pathPattern: /^\/api\/bff\/catalogue\/spotlight$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: SpotlightParamsSchema,
    outputSchema: SpotlightResponseSchema,
    cachePolicy: spotlightPolicy(),
    adapter: (raw) => adaptRawSpotlight(adaptMarketplaceMedia(raw)),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.spotlight(),
  },
  {
    operation: 'getListingBatch',
    adapter: adaptMarketplaceMedia,
    method: 'GET',
    pathTemplate: '/api/bff/listings/batch',
    pathPattern: /^\/api\/bff\/listings\/batch$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: ListingBatchParamsSchema,
    outputSchema: ListingBatchResponseSchema,
    cachePolicy: (ctx) => listingBatchPolicy((ctx.query?.slugs as string[]) ?? []),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.listingBatch(),
  },
  {
    operation: 'searchListings',
    adapter: adaptMarketplaceMedia,
    method: 'GET',
    pathTemplate: '/api/bff/listings',
    pathPattern: /^\/api\/bff\/listings$/,
    pathParamNames: [],
    authMode: 'O',
    rateClass: 'search',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: ListingSearchParamsSchema,
    outputSchema: ListingSearchResponseSchema,
    cachePolicy: (ctx) => searchListingsPolicy(Boolean(ctx.isPersonalized)),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.listings(),
  },
  {
    operation: 'getSimilarListings',
    adapter: adaptMarketplaceMedia,
    method: 'GET',
    pathTemplate: '/api/bff/listings/:slug/similar',
    pathPattern: /^\/api\/bff\/listings\/([^/]+)\/similar$/,
    pathParamNames: ['slug'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: SimilarListingsParamsSchema,
    outputSchema: ListingListResponseSchema,
    cachePolicy: (ctx) => similarListingsPolicy(getParam(ctx, 'slug')),
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.listingSimilar(getParam(ctx, 'slug')),
  },
  {
    operation: 'addFavorite',
    method: 'POST',
    pathTemplate: '/api/bff/listings/:publicId/favorite',
    pathPattern: /^\/api\/bff\/listings\/([^/]+)\/favorite$/,
    pathParamNames: ['publicId'],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: true,
    pathParamsSchema: ListingPublicIdParamsSchema,
    outputSchema: FavoriteMutationResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.addFavorite(getParam(ctx, 'publicId')),
  },
  {
    operation: 'removeFavorite',
    method: 'DELETE',
    pathTemplate: '/api/bff/listings/:publicId/favorite',
    pathPattern: /^\/api\/bff\/listings\/([^/]+)\/favorite$/,
    pathParamNames: ['publicId'],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: true,
    pathParamsSchema: ListingPublicIdParamsSchema,
    outputSchema: FavoriteMutationResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: () => ({ data: { favorited: false } }),
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.removeFavorite(getParam(ctx, 'publicId')),
  },
  {
    operation: 'getListing',
    adapter: adaptMarketplaceMedia,
    method: 'GET',
    pathTemplate: '/api/bff/listings/:slug',
    pathPattern: /^\/api\/bff\/listings\/([^/]+)$/,
    pathParamNames: ['slug'],
    authMode: 'O',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: ListingSlugParamsSchema,
    outputSchema: ListingDetailResponseSchema,
    cachePolicy: (ctx) => listingDetailPolicy(getParam(ctx, 'slug'), Boolean(ctx.isPersonalized)),
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.listing(getParam(ctx, 'slug')),
  },
  {
    operation: 'getVehicleSuggestions',
    method: 'GET',
    pathTemplate: '/api/bff/search/suggest',
    pathPattern: /^\/api\/bff\/search\/suggest$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'search',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: VehicleSearchSuggestionParamsSchema,
    outputSchema: VehicleSearchSuggestionResponseSchema,
    cachePolicy: searchSuggestionsPolicy(),
    adapter: adaptRawVehicleSearchSuggestionList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.searchSuggest(),
  },
  {
    operation: 'listDealers',
    method: 'GET',
    pathTemplate: '/api/bff/dealers',
    pathPattern: /^\/api\/bff\/dealers$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: DealerListParamsSchema,
    outputSchema: DealerDirectoryResponseSchema,
    cachePolicy: dealersPolicy(),
    adapter: adaptRawDealerDirectory,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.dealers(),
  },
  {
    operation: 'getDealerListings',
    adapter: adaptMarketplaceMedia,
    method: 'GET',
    pathTemplate: '/api/bff/dealers/:slug/listings',
    pathPattern: /^\/api\/bff\/dealers\/([^/]+)\/listings$/,
    pathParamNames: ['slug'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ slug: SlugSchema }),
    querySchema: DealerInventoryParamsSchema,
    outputSchema: ListingCursorResponseSchema,
    cachePolicy: (ctx) => dealerListingsPolicy(getParam(ctx, 'slug')),
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.dealerListings(getParam(ctx, 'slug')),
  },
  {
    operation: 'getDealer',
    method: 'GET',
    pathTemplate: '/api/bff/dealers/:slug',
    pathPattern: /^\/api\/bff\/dealers\/([^/]+)$/,
    pathParamNames: ['slug'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ slug: SlugSchema }),
    outputSchema: DealerProfileResponseSchema,
    cachePolicy: (ctx) => dealerProfilePolicy(getParam(ctx, 'slug')),
    adapter: adaptRawDealerProfile,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.dealer(getParam(ctx, 'slug')),
  },

  // ── 3. Taxonomy & Specifications ──────────────────────────────────────────
  {
    operation: 'listMakes',
    method: 'GET',
    pathTemplate: '/api/bff/taxonomy/makes',
    pathPattern: /^\/api\/bff\/taxonomy\/makes$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: MakeListResponseSchema,
    cachePolicy: taxonomyMakesPolicy(),
    adapter: (raw) => adaptRawMakeList(adaptMarketplaceMedia(raw)),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.makes(),
  },
  {
    operation: 'listModels',
    method: 'GET',
    pathTemplate: '/api/bff/taxonomy/makes/:makeSlug/models',
    pathPattern: /^\/api\/bff\/taxonomy\/makes\/([^/]+)\/models$/,
    pathParamNames: ['makeSlug'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: TaxonomyModelsParamsSchema,
    outputSchema: VehicleModelListResponseSchema,
    cachePolicy: (ctx) => taxonomyModelsPolicy(getParam(ctx, 'makeSlug')),
    adapter: adaptRawVehicleModelList,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.models(getParam(ctx, 'makeSlug')),
  },
  {
    operation: 'listGenerations',
    method: 'GET',
    pathTemplate: '/api/bff/taxonomy/models/:modelPublicId/generations',
    pathPattern: /^\/api\/bff\/taxonomy\/models\/([^/]+)\/generations$/,
    pathParamNames: ['modelPublicId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: TaxonomyGenerationsParamsSchema,
    outputSchema: GenerationListResponseSchema,
    cachePolicy: (ctx) => taxonomyGenerationsPolicy(getParam(ctx, 'modelPublicId')),
    adapter: adaptRawGenerationList,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.generations(getParam(ctx, 'modelPublicId')),
  },
  {
    operation: 'listTrims',
    method: 'GET',
    pathTemplate: '/api/bff/taxonomy/generations/:generationPublicId/trims',
    pathPattern: /^\/api\/bff\/taxonomy\/generations\/([^/]+)\/trims$/,
    pathParamNames: ['generationPublicId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: TaxonomyTrimsParamsSchema,
    outputSchema: TrimListResponseSchema,
    cachePolicy: (ctx) => taxonomyTrimsPolicy(getParam(ctx, 'generationPublicId')),
    adapter: adaptRawTrimList,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.trims(getParam(ctx, 'generationPublicId')),
  },
  {
    operation: 'getTrimBatch',
    method: 'GET',
    pathTemplate: '/api/bff/taxonomy/trims/batch',
    pathPattern: /^\/api\/bff\/taxonomy\/trims\/batch$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: PublicIdBatchParamsSchema,
    outputSchema: TrimListResponseSchema,
    cachePolicy: (ctx) => trimBatchPolicy((ctx.query?.publicIds as string[]) ?? []),
    adapter: adaptRawTrimList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.trimBatch(),
  },
  {
    operation: 'getTrim',
    method: 'GET',
    pathTemplate: '/api/bff/taxonomy/trims/:publicId',
    pathPattern: /^\/api\/bff\/taxonomy\/trims\/([^/]+)$/,
    pathParamNames: ['publicId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: TrimPathParamsSchema,
    outputSchema: TrimResponseSchema,
    cachePolicy: (ctx) => taxonomyTrimPolicy(getParam(ctx, 'publicId')),
    adapter: adaptRawTrimDetail,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.trim(getParam(ctx, 'publicId')),
  },
  {
    operation: 'getModelsWithPrices',
    method: 'GET',
    pathTemplate: '/api/bff/catalogue/makes/:makeSlug/models-with-prices',
    pathPattern: /^\/api\/bff\/catalogue\/makes\/([^/]+)\/models-with-prices$/,
    pathParamNames: ['makeSlug'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ makeSlug: SlugSchema }),
    querySchema: z.object({ condition: CarConditionSchema.optional() }),
    outputSchema: ModelsWithPricesResponseSchema,
    cachePolicy: (ctx) => modelsWithPricesPolicy(getParam(ctx, 'makeSlug')),
    adapter: adaptRawModelsWithPrices,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.modelsWithPrices(getParam(ctx, 'makeSlug')),
  },
  {
    operation: 'getCatalogueModel',
    method: 'GET',
    pathTemplate: '/api/bff/catalogue/models/:publicId',
    pathPattern: /^\/api\/bff\/catalogue\/models\/([^/]+)$/,
    pathParamNames: ['publicId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: ModelPathParamsSchema,
    outputSchema: ModelPageResponseSchema,
    cachePolicy: (ctx) => catalogueModelPolicy(getParam(ctx, 'publicId')),
    adapter: adaptRawModelPage,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.catalogueModel(getParam(ctx, 'publicId')),
  },
  {
    operation: 'getCatalogueTrim',
    method: 'GET',
    pathTemplate: '/api/bff/catalogue/trims/:publicId',
    pathPattern: /^\/api\/bff\/catalogue\/trims\/([^/]+)$/,
    pathParamNames: ['publicId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: TrimPathParamsSchema,
    outputSchema: CatalogueTrimDetailResponseSchema,
    cachePolicy: (ctx) => catalogueTrimPolicy(getParam(ctx, 'publicId')),
    adapter: adaptRawCatalogueTrimDetail,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.catalogueTrim(getParam(ctx, 'publicId')),
  },
  {
    operation: 'getTrimDealers',
    method: 'GET',
    pathTemplate: '/api/bff/catalogue/trims/:publicId/dealers',
    pathPattern: /^\/api\/bff\/catalogue\/trims\/([^/]+)\/dealers$/,
    pathParamNames: ['publicId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ publicId: PublicIdSchema }),
    querySchema: z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }),
    outputSchema: TrimDealersResponseSchema,
    cachePolicy: (ctx) => trimDealersPolicy(getParam(ctx, 'publicId')),
    adapter: adaptRawTrimDealers,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.trimDealers(getParam(ctx, 'publicId')),
  },
  {
    operation: 'getMakeDealers',
    method: 'GET',
    pathTemplate: '/api/bff/catalogue/makes/:makeSlug/dealers',
    pathPattern: /^\/api\/bff\/catalogue\/makes\/([^/]+)\/dealers$/,
    pathParamNames: ['makeSlug'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ makeSlug: SlugSchema }),
    querySchema: z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }),
    outputSchema: TrimDealersResponseSchema,
    cachePolicy: (ctx) => makeDealersPolicy(getParam(ctx, 'makeSlug')),
    adapter: adaptRawTrimDealers,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.makeDealers(getParam(ctx, 'makeSlug')),
  },

  // ── 4. Locations & Configuration ──────────────────────────────────────────
  {
    operation: 'listCountries',
    method: 'GET',
    pathTemplate: '/api/bff/locations/countries',
    pathPattern: /^\/api\/bff\/locations\/countries$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: CountryListResponseSchema,
    cachePolicy: countriesPolicy(),
    adapter: adaptRawCountryList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.countries(),
  },
  {
    operation: 'getCountryConfig',
    method: 'GET',
    pathTemplate: '/api/bff/locations/countries/:code/config',
    pathPattern: /^\/api\/bff\/locations\/countries\/([^/]+)\/config$/,
    pathParamNames: ['code'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: CountryCodeParamsSchema,
    outputSchema: CountryConfigResponseSchema,
    cachePolicy: (ctx) => countryConfigPolicy(getParam(ctx, 'code')),
    adapter: adaptRawCountryConfig,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.countryConfig(getParam(ctx, 'code')),
  },
  {
    operation: 'listCities',
    method: 'GET',
    pathTemplate: '/api/bff/locations/countries/:code/cities',
    pathPattern: /^\/api\/bff\/locations\/countries\/([^/]+)\/cities$/,
    pathParamNames: ['code'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: CountryCitiesParamsSchema,
    outputSchema: CityListResponseSchema,
    cachePolicy: (ctx) => citiesPolicy(getParam(ctx, 'code')),
    adapter: adaptRawCityList,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.cities(getParam(ctx, 'code')),
  },
  {
    operation: 'listAreas',
    method: 'GET',
    pathTemplate: '/api/bff/locations/cities/:cityId/areas',
    pathPattern: /^\/api\/bff\/locations\/cities\/([^/]+)\/areas$/,
    pathParamNames: ['cityId'],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ cityId: z.coerce.number().int().positive() }),
    outputSchema: AreaListResponseSchema,
    cachePolicy: (ctx) => areasPolicy(getParam(ctx, 'cityId')),
    adapter: adaptRawAreaList,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.areas(getParam(ctx, 'cityId')),
  },
  {
    operation: 'listPromotionPackages',
    method: 'GET',
    pathTemplate: '/api/bff/promotions/packages',
    pathPattern: /^\/api\/bff\/promotions\/packages$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: PromotionPackageListResponseSchema,
    cachePolicy: promotionPackagesPolicy(),
    adapter: adaptRawPromotionPackageList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.promotionPackages(),
  },

  // ── 5. Private Account, Listings, Favorites, Uploads & Saved Searches ──────
  {
    operation: 'getMyVendors',
    method: 'GET',
    pathTemplate: '/api/bff/me/vendors',
    pathPattern: /^\/api\/bff\/me\/vendors$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: MyVendorsResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawMyVendors,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.myVendors(),
  },
  {
    operation: 'getMyListings',
    method: 'GET',
    pathTemplate: '/api/bff/me/listings',
    pathPattern: /^\/api\/bff\/me\/listings$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: MyListingsParamsSchema,
    outputSchema: MyListingsResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.myListings(),
  },
  {
    operation: 'getFavorites',
    method: 'GET',
    pathTemplate: '/api/bff/me/favorites',
    pathPattern: /^\/api\/bff\/me\/favorites$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: FavoriteListParamsSchema,
    outputSchema: ListingCursorResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.favorites(),
  },
  {
    operation: 'uploadFile',
    method: 'POST',
    pathTemplate: '/api/bff/files',
    pathPattern: /^\/api\/bff\/files$/,
    pathParamNames: [],
    authMode: 'U',
    rateClass: 'upload',
    timeoutMs: 60_000,
    maxBodySizeBytes: 104_857_600, // 100 MiB limit
    requiresIdempotency: true,
    successStatus: 201,
    querySchema: z.object({ purpose: UploadPurposeSchema }),
    outputSchema: UploadedFileResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawUploadedFile,
    buildUpstreamPath: (ctx) => {
      const purpose = ctx.query?.purpose as string | undefined;
      return purpose
        ? `${UPSTREAM_ENDPOINTS.uploadFile()}?purpose=${encodeURIComponent(purpose)}`
        : UPSTREAM_ENDPOINTS.uploadFile();
    },
  },
  {
    operation: 'getFileStatus',
    method: 'GET',
    pathTemplate: '/api/bff/files/:publicId/status',
    pathPattern: /^\/api\/bff\/files\/([^/]+)\/status$/,
    pathParamNames: ['publicId'],
    authMode: 'O',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: FilePublicIdParamsSchema,
    outputSchema: FileStatusResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawFileStatus,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.fileStatus(getParam(ctx, 'publicId')),
  },
  {
    operation: 'listSavedSearches',
    method: 'GET',
    pathTemplate: '/api/bff/me/saved-searches',
    pathPattern: /^\/api\/bff\/me\/saved-searches$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: SavedSearchListResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawSavedSearchList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.savedSearches(),
  },
  {
    operation: 'listMyPromotions',
    method: 'GET',
    pathTemplate: '/api/bff/me/promotions',
    pathPattern: /^\/api\/bff\/me\/promotions$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: PromotionListResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawPromotionList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.myPromotions(),
  },

  // ── 6. Notifications & Push Devices ───────────────────────────────────────
  {
    operation: 'listNotifications',
    method: 'GET',
    pathTemplate: '/api/bff/notifications',
    pathPattern: /^\/api\/bff\/notifications$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: NotificationListParamsSchema,
    outputSchema: NotificationListResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawNotificationList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.notifications(),
  },
  {
    operation: 'getUnreadNotificationCount',
    method: 'GET',
    pathTemplate: '/api/bff/notifications/unread-count',
    pathPattern: /^\/api\/bff\/notifications\/unread-count$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: CountResponseSchema,
    cachePolicy: createNoStorePolicy(),
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.unreadNotificationCount(),
  },
  {
    operation: 'markNotificationRead',
    method: 'PATCH',
    pathTemplate: '/api/bff/notifications/:publicId/read',
    pathPattern: /^\/api\/bff\/notifications\/([^/]+)\/read$/,
    pathParamNames: ['publicId'],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: true,
    pathParamsSchema: NotificationPublicIdParamsSchema,
    outputSchema: NotificationResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawNotification,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.markNotificationRead(getParam(ctx, 'publicId')),
  },
  {
    operation: 'listNotificationDevices',
    method: 'GET',
    pathTemplate: '/api/bff/notifications/devices',
    pathPattern: /^\/api\/bff\/notifications\/devices$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: DeviceRegistrationListResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawDeviceRegistrationList,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.notificationDevices(),
  },
  {
    operation: 'registerNotificationDevice',
    method: 'POST',
    pathTemplate: '/api/bff/notifications/devices',
    pathPattern: /^\/api\/bff\/notifications\/devices$/,
    pathParamNames: [],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: true,
    successStatus: 201,
    bodySchema: RegisterDeviceInputSchema,
    outputSchema: DeviceRegistrationResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawDeviceRegistration,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.notificationDevices(),
  },
  {
    operation: 'unregisterNotificationDevice',
    method: 'DELETE',
    pathTemplate: '/api/bff/notifications/devices',
    pathPattern: /^\/api\/bff\/notifications\/devices$/,
    pathParamNames: [],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: true,
    bodySchema: UnregisterDeviceInputSchema,
    outputSchema: MutationAckResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: () => adapt204Acknowledgement(null, 204),
    buildUpstreamPath: (ctx) => {
      const body = ctx.body as { token: string };
      return UPSTREAM_ENDPOINTS.unregisterNotificationDevice(body.token);
    },
  },

  // ── 7. Contact Leads ──────────────────────────────────────────────────────
  {
    operation: 'createLead',
    method: 'POST',
    pathTemplate: '/api/bff/leads',
    pathPattern: /^\/api\/bff\/leads$/,
    pathParamNames: [],
    // A buyer may contact a seller without an account. When a session exists,
    // the BFF still forwards it so the upstream service can associate the lead.
    authMode: 'O',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: true,
    successStatus: 201,
    bodySchema: CreateLeadInputSchema,
    outputSchema: LeadResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawLead,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.createLead(),
  },
  {
    operation: 'listSellerLeads',
    method: 'GET',
    pathTemplate: '/api/bff/me/leads',
    pathPattern: /^\/api\/bff\/me\/leads$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: LeadListParamsSchema,
    outputSchema: LeadListResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawLeadList,
    buildUpstreamPath: (ctx) =>
      ctx.vendorPublicId
        ? UPSTREAM_ENDPOINTS.leadsVendor(ctx.vendorPublicId)
        : UPSTREAM_ENDPOINTS.leadsPrivate(),
  },
  {
    operation: 'getSellerLead',
    method: 'GET',
    pathTemplate: '/api/bff/me/leads/:publicId',
    pathPattern: /^\/api\/bff\/me\/leads\/([^/]+)$/,
    pathParamNames: ['publicId'],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: LeadPublicIdParamsSchema,
    outputSchema: LeadDetailResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawLeadDetail,
    buildUpstreamPath: (ctx) =>
      ctx.vendorPublicId
        ? UPSTREAM_ENDPOINTS.leadVendor(ctx.vendorPublicId, getParam(ctx, 'publicId'))
        : UPSTREAM_ENDPOINTS.leadPrivate(getParam(ctx, 'publicId')),
  },
  {
    operation: 'updateSellerLeadStatus',
    method: 'PATCH',
    pathTemplate: '/api/bff/me/leads/:publicId/status',
    pathPattern: /^\/api\/bff\/me\/leads\/([^/]+)\/status$/,
    pathParamNames: ['publicId'],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: true,
    pathParamsSchema: LeadPublicIdParamsSchema,
    bodySchema: UpdateLeadStatusInputSchema,
    outputSchema: LeadResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawLead,
    buildUpstreamPath: (ctx) =>
      ctx.vendorPublicId
        ? UPSTREAM_ENDPOINTS.leadStatusVendor(ctx.vendorPublicId, getParam(ctx, 'publicId'))
        : UPSTREAM_ENDPOINTS.leadStatusPrivate(getParam(ctx, 'publicId')),
  },
  {
    operation: 'createListingReport',
    method: 'POST',
    pathTemplate: '/api/bff/reports',
    pathPattern: /^\/api\/bff\/reports$/,
    pathParamNames: [],
    authMode: 'M',
    rateClass: 'mutation',
    timeoutMs: 20_000,
    maxBodySizeBytes: 1_048_576,
    requiresIdempotency: true,
    successStatus: 201,
    bodySchema: CreateReportInputSchema,
    outputSchema: ListingReportResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawListingReport,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.createReport(),
  },
  {
    operation: 'getDashboardOverview',
    method: 'GET',
    pathTemplate: '/api/bff/me/dashboard',
    pathPattern: /^\/api\/bff\/me\/dashboard$/,
    pathParamNames: [],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    querySchema: z.object({ range: DashboardRangeSchema.default('30d') }),
    outputSchema: DashboardOverviewResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawDashboardOverview,
    buildUpstreamQuery: (ctx) => ({ days: dashboardRangeToDays(DashboardRangeSchema.parse(ctx.query.range ?? '30d')) }),
    buildUpstreamPath: (ctx) => {
      if (!ctx.vendorPublicId) {
        throw new Error('Active vendor required for dashboard overview');
      }
      return UPSTREAM_ENDPOINTS.dashboardOverview(ctx.vendorPublicId);
    },
  },
  {
    operation: 'getVendorBillingSummary',
    method: 'GET',
    pathTemplate: '/api/bff/vendors/:vendorPublicId/billing/summary',
    pathPattern: /^\/api\/bff\/vendors\/([^/]+)\/billing\/summary$/,
    pathParamNames: ['vendorPublicId'],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ vendorPublicId: PublicIdSchema }),
    outputSchema: VendorBillingSummaryResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawVendorBillingSummary,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.vendorBillingSummary(getParam(ctx, 'vendorPublicId')),
  },
  {
    operation: 'getVendorEntitlements',
    method: 'GET',
    pathTemplate: '/api/bff/vendors/:vendorPublicId/entitlements',
    pathPattern: /^\/api\/bff\/vendors\/([^/]+)\/entitlements$/,
    pathParamNames: ['vendorPublicId'],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ vendorPublicId: PublicIdSchema }),
    outputSchema: DealerEntitlementsResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawDealerEntitlements,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.vendorEntitlements(getParam(ctx, 'vendorPublicId')),
  },
  {
    operation: 'getVendorSubscription',
    method: 'GET',
    pathTemplate: '/api/bff/vendors/:vendorPublicId/subscription',
    pathPattern: /^\/api\/bff\/vendors\/([^/]+)\/subscription$/,
    pathParamNames: ['vendorPublicId'],
    authMode: 'S',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    pathParamsSchema: z.object({ vendorPublicId: PublicIdSchema }),
    outputSchema: VendorSubscriptionResponseSchema,
    cachePolicy: createNoStorePolicy(),
    adapter: adaptRawVendorSubscription,
    buildUpstreamPath: (ctx) => UPSTREAM_ENDPOINTS.vendorSubscription(getParam(ctx, 'vendorPublicId')),
  },
  {
    operation: 'listSubscriptionPlans',
    method: 'GET',
    pathTemplate: '/api/bff/subscription-plans',
    pathPattern: /^\/api\/bff\/subscription-plans$/,
    pathParamNames: [],
    authMode: 'P',
    rateClass: 'public_read',
    timeoutMs: 10_000,
    maxBodySizeBytes: 0,
    requiresIdempotency: false,
    outputSchema: SubscriptionPlansResponseSchema,
    cachePolicy: promotionPackagesPolicy(),
    adapter: adaptRawSubscriptionPlans,
    buildUpstreamPath: () => UPSTREAM_ENDPOINTS.subscriptionPlans(),
  },
];

export type BffMatchResult =
  | { type: 'matched'; operation: BffOperationDefinition; pathParams: Record<string, string> }
  | { type: 'method_not_allowed'; allowedMethods: readonly HttpMethod[] }
  | { type: 'not_found'; reason: string }
  | { type: 'security_violation'; status: 400 | 404; reason: string };

/**
 * Matches a request method and path against the strict BFF allowlist.
 * Rejects illegal paths, encoding traversal, method mismatches, and unrecognized paths.
 */
export function matchBffOperation(method: string, pathname: string): BffMatchResult {
  // 1. Path format and security validation
  const security = validateBffPathSecurity(pathname);
  if (!security.valid) {
    return {
      type: 'security_violation',
      status: security.status,
      reason: security.reason || 'Security validation failed',
    };
  }

  const normalizedMethod = method.toUpperCase() as HttpMethod;

  // 2. Find all operations matching the path pattern
  const matchingByPath = BFF_ALLOWLIST.filter((op) => op.pathPattern.test(pathname));

  if (matchingByPath.length === 0) {
    return {
      type: 'not_found',
      reason: `No allowlisted BFF endpoint matches path "${pathname}"`,
    };
  }

  // 3. Match by HTTP method
  const matchedOp = matchingByPath.find((op) => op.method === normalizedMethod);

  if (!matchedOp) {
    const allowedMethods = Array.from(new Set(matchingByPath.map((op) => op.method)));
    return {
      type: 'method_not_allowed',
      allowedMethods,
    };
  }

  // 4. Extract path parameters
  const execResult = matchedOp.pathPattern.exec(pathname);
  const pathParams: Record<string, string> = {};

  if (execResult && matchedOp.pathParamNames.length > 0) {
    matchedOp.pathParamNames.forEach((paramName, idx) => {
      const rawVal = execResult[idx + 1] ?? '';
      pathParams[paramName] = decodeURIComponent(rawVal);
    });
  }

  return {
    type: 'matched',
    operation: matchedOp,
    pathParams,
  };
}
