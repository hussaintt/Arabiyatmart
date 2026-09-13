/**
 * Typed Endpoint Registry and Path Builders for Upstream Fastify API and BFF Route Handlers.
 *
 * Implements Phase 1 Section 1.4/2.6 and Phase 2 Sections 3.1-3.8:
 * - Safe path segment encoding and directory-traversal prevention.
 * - Complete upstream Fastify `/v1` endpoint registry.
 * - Allowed Next.js BFF `/api/bff` endpoint registry and path verification.
 */

/**
 * Encodes an individual URL path segment, strictly forbidding empty segments,
 * directory traversal sequences, or unencoded path separators.
 */
export function encodePathSegment(segment: string | number): string {
  if (segment === null || segment === undefined) {
    throw new Error('Path segment cannot be null or undefined');
  }

  const str = String(segment).trim();
  if (str.length === 0) {
    throw new Error('Path segment cannot be empty');
  }

  // Prevent directory traversal attacks, raw or encoded separators, and fragment/query injection
  if (
    str === '.' ||
    str === '..' ||
    str.includes('/') ||
    str.includes('\\') ||
    str.includes('\0') ||
    str.includes('#') ||
    str.includes('?') ||
    /[\x00-\x1F\x7F]/.test(str) ||
    /%(?:2f|5c|2e|00|23|3f)/i.test(str)
  ) {
    throw new Error(`Invalid path segment: "${str}"`);
  }

  return encodeURIComponent(str);
}

/**
 * Registry of upstream Fastify /v1 endpoints.
 */
export const UPSTREAM_ENDPOINTS = {
  // Authentication & Session
  login: () => '/v1/auth/login',
  register: () => '/v1/auth/register',
  loginWithGoogle: () => '/v1/auth/login-with-google',
  loginWithApple: () => '/v1/auth/login-with-apple',
  refreshSession: () => '/v1/auth/refresh',
  logout: () => '/v1/auth/logout',
  logoutAll: () => '/v1/auth/logout-all',
  forgotPassword: () => '/v1/auth/forgot-password',
  verifyResetCode: () => '/v1/auth/verify-reset-code',
  resetPassword: () => '/v1/auth/reset-password',
  resendVerification: () => '/v1/auth/resend-verification',
  sendOtp: () => '/v1/otp/send',
  verifyOtp: () => '/v1/otp/verify',
  changePassword: () => '/v1/auth/change-password',
  setPhone: () => '/v1/auth/phone',
  verifyFirebasePhone: () => '/v1/auth/phone/verify-firebase',

  // Profile & User
  me: () => '/v1/me',

  // Public Marketplace & Catalogue
  banners: () => '/v1/banners',
  publicSettings: () => '/v1/settings/public',
  spotlight: () => '/v1/catalogue/spotlight',
  listings: () => '/v1/listings',
  listing: (slug: string) => `/v1/listings/${encodePathSegment(slug)}`,
  listingSimilar: (slug: string) => `/v1/listings/${encodePathSegment(slug)}/similar`,
  searchSuggest: () => '/v1/search/suggest',
  dealers: () => '/v1/dealers',
  dealer: (slug: string) => `/v1/dealers/${encodePathSegment(slug)}`,
  dealerListings: (slug: string) => `/v1/dealers/${encodePathSegment(slug)}/listings`,
  listingBatch: () => '/v1/listings/batch',

  // Taxonomy & Specifications
  makes: () => '/v1/taxonomy/makes',
  models: (makeSlug: string) => `/v1/taxonomy/makes/${encodePathSegment(makeSlug)}/models`,
  generations: (modelPublicId: string) =>
    `/v1/taxonomy/models/${encodePathSegment(modelPublicId)}/generations`,
  trims: (generationPublicId: string) =>
    `/v1/taxonomy/generations/${encodePathSegment(generationPublicId)}/trims`,
  trim: (publicId: string) => `/v1/taxonomy/trims/${encodePathSegment(publicId)}`,
  trimBatch: () => '/v1/taxonomy/trims/batch',
  modelsWithPrices: (makeSlug: string) =>
    `/v1/catalogue/makes/${encodePathSegment(makeSlug)}/models-with-prices`,
  catalogueModel: (publicId: string) => `/v1/catalogue/models/${encodePathSegment(publicId)}`,
  catalogueTrim: (publicId: string) => `/v1/catalogue/trims/${encodePathSegment(publicId)}`,
  trimDealers: (publicId: string) => `/v1/catalogue/trims/${encodePathSegment(publicId)}/dealers`,
  makeDealers: (makeSlug: string) => `/v1/catalogue/makes/${encodePathSegment(makeSlug)}/dealers`,

  // Locations Taxonomy
  countries: () => '/v1/locations/countries',
  countryConfig: (code: string) => `/v1/locations/countries/${encodePathSegment(code)}/config`,
  cities: (code: string) => `/v1/locations/countries/${encodePathSegment(code)}/cities`,
  areas: (cityId: number | string) => `/v1/locations/cities/${encodePathSegment(cityId)}/areas`,

  // Promotions
  promotionPackages: () => '/v1/promotions/packages',
  myPromotions: () => '/v1/me/promotions',
  purchasePromotion: () => '/v1/me/promotions',

  // Private Seller & User Listings
  myVendors: () => '/v1/vendors/mine',
  myListings: () => '/v1/me/listings',
  createListing: () => '/v1/me/listings',
  createVendorListing: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/listings`,
  updateListing: (publicId: string) => `/v1/me/listings/${encodePathSegment(publicId)}`,
  transitionListing: (publicId: string) =>
    `/v1/me/listings/${encodePathSegment(publicId)}/transition`,
  favorites: () => '/v1/me/listings/favorites',
  addFavorite: (publicId: string) => `/v1/listings/${encodePathSegment(publicId)}/favorite`,
  removeFavorite: (publicId: string) => `/v1/listings/${encodePathSegment(publicId)}/favorite`,

  // Files
  uploadFile: () => '/v1/files/upload',
  fileStatus: (publicId: string) => `/v1/files/${encodePathSegment(publicId)}/status`,
  deleteFile: (publicId: string) => `/v1/files/${encodePathSegment(publicId)}`,

  // Saved Searches
  savedSearches: () => '/v1/me/saved-searches',
  savedSearch: (publicId: string) => `/v1/me/saved-searches/${encodePathSegment(publicId)}`,

  // Notifications
  notifications: () => '/v1/notifications',
  unreadNotificationCount: () => '/v1/notifications/unread-count',
  markNotificationRead: (publicId: string) =>
    `/v1/notifications/${encodePathSegment(publicId)}/read`,
  markAllNotificationsRead: () => '/v1/notifications/read-all',
  notificationDevices: () => '/v1/notifications/devices',
  unregisterNotificationDevice: (token: string) =>
    `/v1/notifications/devices/${encodePathSegment(token)}`,

  // Leads
  createLead: () => '/v1/leads',
  leadsPrivate: () => '/v1/leads/me',
  leadPrivate: (publicId: string) => `/v1/leads/me/${encodePathSegment(publicId)}`,
  leadStatusPrivate: (publicId: string) =>
    `/v1/leads/me/${encodePathSegment(publicId)}/status`,
  leadsVendor: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/leads`,
  leadVendor: (vendorPublicId: string, publicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/leads/${encodePathSegment(publicId)}`,
  leadStatusVendor: (vendorPublicId: string, publicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/leads/${encodePathSegment(publicId)}/status`,

  // Reports
  createReport: () => '/v1/reports',

  // Dashboard Overview
  dashboardOverview: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/analytics/overview`,

  // Vendor Entitlements & Billing
  vendorEntitlements: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/entitlements`,
  vendorSubscription: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/subscription`,
  vendorBillingSummary: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/billing/summary`,
  vendorBillingInvoice: (vendorPublicId: string, invoiceId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/billing/invoices/${encodePathSegment(invoiceId)}`,
  vendorBillingTransactions: (vendorPublicId: string) =>
    `/v1/vendors/${encodePathSegment(vendorPublicId)}/billing/transactions`,
  subscriptionPlans: () => '/v1/vendors/subscription-plans',
} as const;

/**
 * Registry of allowed same-origin BFF endpoints under /api/bff.
 */
export const BFF_ENDPOINTS = {
  session: () => '/api/bff/session',
  authGoogle: () => '/api/bff/auth/google',
  authApple: () => '/api/bff/auth/apple',
  authRefresh: () => '/api/bff/auth/refresh',
  authPhoneVerify: () => '/api/bff/auth/phone/verify',
  locale: () => '/api/bff/locale',
  me: () => '/api/bff/me',
  banners: () => '/api/bff/banners',
  settingsPublic: () => '/api/bff/settings/public',
  catalogueSpotlight: () => '/api/bff/catalogue/spotlight',
  listings: () => '/api/bff/listings',
  listing: (slug: string) => `/api/bff/listings/${encodePathSegment(slug)}`,
  listingSimilar: (slug: string) => `/api/bff/listings/${encodePathSegment(slug)}/similar`,
  searchSuggest: () => '/api/bff/search/suggest',
  dealers: () => '/api/bff/dealers',
  dealer: (slug: string) => `/api/bff/dealers/${encodePathSegment(slug)}`,
  dealerListings: (slug: string) => `/api/bff/dealers/${encodePathSegment(slug)}/listings`,
  taxonomyMakes: () => '/api/bff/taxonomy/makes',
  taxonomyModels: (makeSlug: string) =>
    `/api/bff/taxonomy/makes/${encodePathSegment(makeSlug)}/models`,
  taxonomyGenerations: (modelPublicId: string) =>
    `/api/bff/taxonomy/models/${encodePathSegment(modelPublicId)}/generations`,
  taxonomyTrims: (generationPublicId: string) =>
    `/api/bff/taxonomy/generations/${encodePathSegment(generationPublicId)}/trims`,
  taxonomyTrim: (publicId: string) =>
    `/api/bff/taxonomy/trims/${encodePathSegment(publicId)}`,
  listingBatch: () => '/api/bff/listings/batch',
  taxonomyTrimBatch: () => '/api/bff/taxonomy/trims/batch',
  catalogueModelsWithPrices: (makeSlug: string) =>
    `/api/bff/catalogue/makes/${encodePathSegment(makeSlug)}/models-with-prices`,
  catalogueModel: (publicId: string) =>
    `/api/bff/catalogue/models/${encodePathSegment(publicId)}`,
  catalogueTrim: (publicId: string) =>
    `/api/bff/catalogue/trims/${encodePathSegment(publicId)}`,
  catalogueTrimDealers: (publicId: string) =>
    `/api/bff/catalogue/trims/${encodePathSegment(publicId)}/dealers`,
  catalogueMakeDealers: (makeSlug: string) =>
    `/api/bff/catalogue/makes/${encodePathSegment(makeSlug)}/dealers`,
  locationsCountries: () => '/api/bff/locations/countries',
  locationsCountryConfig: (code: string) =>
    `/api/bff/locations/countries/${encodePathSegment(code)}/config`,
  locationsCities: (code: string) =>
    `/api/bff/locations/countries/${encodePathSegment(code)}/cities`,
  locationsAreas: (cityId: number | string) =>
    `/api/bff/locations/cities/${encodePathSegment(cityId)}/areas`,
  promotionsPackages: () => '/api/bff/promotions/packages',
  meVendors: () => '/api/bff/me/vendors',
  meListings: () => '/api/bff/me/listings',
  meFavorites: () => '/api/bff/me/favorites',
  favoriteListing: (publicId: string) =>
    `/api/bff/listings/${encodePathSegment(publicId)}/favorite`,
  files: () => '/api/bff/files',
  fileStatus: (publicId: string) => `/api/bff/files/${encodePathSegment(publicId)}/status`,
  meSavedSearches: () => '/api/bff/me/saved-searches',
  mePromotions: () => '/api/bff/me/promotions',
  notifications: () => '/api/bff/notifications',
  notificationUnreadCount: () => '/api/bff/notifications/unread-count',
  notificationRead: (publicId: string) =>
    `/api/bff/notifications/${encodePathSegment(publicId)}/read`,
  notificationDevices: () => '/api/bff/notifications/devices',
  leads: () => '/api/bff/leads',
  meLeads: () => '/api/bff/me/leads',
  meLead: (publicId: string) => `/api/bff/me/leads/${encodePathSegment(publicId)}`,
  meLeadStatus: (publicId: string) => `/api/bff/me/leads/${encodePathSegment(publicId)}/status`,
  reports: () => '/api/bff/reports',
  meDashboard: () => '/api/bff/me/dashboard',
  vendorBillingSummary: (vendorPublicId: string) =>
    `/api/bff/vendors/${encodePathSegment(vendorPublicId)}/billing/summary`,
  vendorEntitlements: (vendorPublicId: string) =>
    `/api/bff/vendors/${encodePathSegment(vendorPublicId)}/entitlements`,
  vendorSubscription: (vendorPublicId: string) =>
    `/api/bff/vendors/${encodePathSegment(vendorPublicId)}/subscription`,
  subscriptionPlans: () => '/api/bff/subscription-plans',
} as const;

/**
 * List of RegExp patterns matching all authorized BFF route paths.
 */
const ALLOWED_BFF_PATTERNS: readonly RegExp[] = [
  /^\/api\/bff\/session$/,
  /^\/api\/bff\/auth\/(?:google|apple|refresh)$/,
  /^\/api\/bff\/auth\/phone\/verify$/,
  /^\/api\/bff\/locale$/,
  /^\/api\/bff\/me$/,
  /^\/api\/bff\/banners$/,
  /^\/api\/bff\/settings\/public$/,
  /^\/api\/bff\/catalogue\/spotlight$/,
  /^\/api\/bff\/listings$/,
  /^\/api\/bff\/listings\/[^/]+$/,
  /^\/api\/bff\/listings\/[^/]+\/similar$/,
  /^\/api\/bff\/listings\/[^/]+\/favorite$/,
  /^\/api\/bff\/listings\/batch$/,
  /^\/api\/bff\/search\/suggest$/,
  /^\/api\/bff\/dealers$/,
  /^\/api\/bff\/dealers\/[^/]+$/,
  /^\/api\/bff\/dealers\/[^/]+\/listings$/,
  /^\/api\/bff\/taxonomy\/makes$/,
  /^\/api\/bff\/taxonomy\/makes\/[^/]+\/models$/,
  /^\/api\/bff\/taxonomy\/models\/[^/]+\/generations$/,
  /^\/api\/bff\/taxonomy\/generations\/[^/]+\/trims$/,
  /^\/api\/bff\/taxonomy\/trims\/[^/]+$/,
  /^\/api\/bff\/taxonomy\/trims\/batch$/,
  /^\/api\/bff\/catalogue\/makes\/[^/]+\/models-with-prices$/,
  /^\/api\/bff\/catalogue\/models\/[^/]+$/,
  /^\/api\/bff\/catalogue\/trims\/[^/]+$/,
  /^\/api\/bff\/catalogue\/trims\/[^/]+\/dealers$/,
  /^\/api\/bff\/catalogue\/makes\/[^/]+\/dealers$/,
  /^\/api\/bff\/locations\/countries$/,
  /^\/api\/bff\/locations\/countries\/[^/]+\/config$/,
  /^\/api\/bff\/locations\/countries\/[^/]+\/cities$/,
  /^\/api\/bff\/locations\/cities\/[^/]+\/areas$/,
  /^\/api\/bff\/promotions\/packages$/,
  /^\/api\/bff\/me\/vendors$/,
  /^\/api\/bff\/me\/listings$/,
  /^\/api\/bff\/me\/favorites$/,
  /^\/api\/bff\/files$/,
  /^\/api\/bff\/files\/[^/]+\/status$/,
  /^\/api\/bff\/me\/saved-searches$/,
  /^\/api\/bff\/me\/promotions$/,
  /^\/api\/bff\/notifications$/,
  /^\/api\/bff\/notifications\/unread-count$/,
  /^\/api\/bff\/notifications\/[^/]+\/read$/,
  /^\/api\/bff\/notifications\/devices$/,
  /^\/api\/bff\/leads$/,
  /^\/api\/bff\/me\/leads$/,
  /^\/api\/bff\/me\/leads\/[^/]+$/,
  /^\/api\/bff\/me\/leads\/[^/]+\/status$/,
  /^\/api\/bff\/reports$/,
  /^\/api\/bff\/me\/dashboard$/,
  /^\/api\/bff\/vendors\/[^/]+\/billing\/summary$/,
  /^\/api\/bff\/vendors\/[^/]+\/entitlements$/,
  /^\/api\/bff\/vendors\/[^/]+\/subscription$/,
  /^\/api\/bff\/subscription-plans$/,
];

/**
 * Checks whether a requested pathname is on the explicit BFF allowlist.
 * Strictly rejects:
 * - Leading or trailing whitespace (never silently accepted/trimmed)
 * - Query strings (?) or URL fragments (#)
 * - Raw or single/double/iteratively percent-encoded path separators (/ or \) within segments (%2f, %5c)
 * - Raw or single/double/iteratively percent-encoded directory traversal (%2e, ..)
 * - Control characters or whitespace
 * - Non-allowlisted paths
 */
export function isAllowedBffPath(pathname: string): boolean {
  if (!pathname || typeof pathname !== 'string') return false;

  // Strictly reject leading or trailing whitespace (never silently accepted or trimmed)
  if (/^\s|\s$/.test(pathname)) {
    return false;
  }

  if (!pathname.startsWith('/api/bff')) return false;

  // Reject control characters, whitespace, query strings (?), or URL fragments (#)
  if (/[\x00-\x20\x7F#?]/.test(pathname)) {
    return false;
  }

  // Reject raw backslashes or directory traversal
  if (pathname.includes('\\') || pathname.includes('..')) {
    return false;
  }

  // Reject initial percent-encoded separators (/ \), dot traversal (.), null bytes, or query/hash
  if (/%(?:2f|5c|2e|00|23|3f)/i.test(pathname)) {
    return false;
  }

  // Perform bounded iterative decoding until stable to catch double/nested encoding
  let current = pathname;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      // If decoding reveals any encoded/raw separators, traversal, null bytes, or fragments
      if (
        next.includes('\\') ||
        next.includes('..') ||
        next.includes('\0') ||
        /[\x00-\x1F\x7F#?]/.test(next) ||
        /%(?:2f|5c|2e|00|23|3f)/i.test(next)
      ) {
        return false;
      }
      current = next;
    } catch {
      return false;
    }
  }

  // Decoded string must not contain backslashes, control characters, query/fragments, or traversal
  if (
    current.includes('\\') ||
    current.includes('..') ||
    current.includes('\0') ||
    /[\x00-\x1F\x7F#?]/.test(current) ||
    /%(?:2f|5c|2e|00|23|3f)/i.test(current)
  ) {
    return false;
  }

  // Verify no path segment in raw or decoded form is '.' or '..'
  const rawSegments = pathname.split('/');
  for (const seg of rawSegments) {
    if (seg === '.' || seg === '..') return false;
  }
  const decodedSegments = current.split('/');
  for (const seg of decodedSegments) {
    if (seg === '.' || seg === '..') return false;
  }

  return ALLOWED_BFF_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * List of RegExp patterns matching all authorized upstream Fastify API endpoints.
 */
export const ALLOWED_UPSTREAM_PATTERNS: readonly RegExp[] = [
  // Authentication & Session
  /^\/v1\/auth\/(?:login|register|login-with-google|login-with-apple|refresh|logout|logout-all|forgot-password|verify-reset-code|reset-password|resend-verification|change-password|phone|phone\/verify-firebase)$/,
  /^\/v1\/otp\/(?:send|verify)$/,

  // Profile & User
  /^\/v1\/me$/,

  // Public Marketplace & Catalogue
  /^\/v1\/banners$/,
  /^\/v1\/settings\/public$/,
  /^\/v1\/catalogue\/spotlight$/,
  /^\/v1\/listings$/,
  /^\/v1\/listings\/[^/]+$/,
  /^\/v1\/listings\/[^/]+\/similar$/,
  /^\/v1\/listings\/[^/]+\/favorite$/,
  /^\/v1\/listings\/batch$/,
  /^\/v1\/search\/suggest$/,
  /^\/v1\/dealers$/,
  /^\/v1\/dealers\/[^/]+$/,
  /^\/v1\/dealers\/[^/]+\/listings$/,

  // Taxonomy & Specifications
  /^\/v1\/taxonomy\/makes$/,
  /^\/v1\/taxonomy\/makes\/[^/]+\/models$/,
  /^\/v1\/taxonomy\/models\/[^/]+\/generations$/,
  /^\/v1\/taxonomy\/generations\/[^/]+\/trims$/,
  /^\/v1\/taxonomy\/trims\/[^/]+$/,
  /^\/v1\/taxonomy\/trims\/batch$/,
  /^\/v1\/catalogue\/makes\/[^/]+\/models-with-prices$/,
  /^\/v1\/catalogue\/models\/[^/]+$/,
  /^\/v1\/catalogue\/trims\/[^/]+$/,
  /^\/v1\/catalogue\/trims\/[^/]+\/dealers$/,
  /^\/v1\/catalogue\/makes\/[^/]+\/dealers$/,

  // Locations Taxonomy
  /^\/v1\/locations\/countries$/,
  /^\/v1\/locations\/countries\/[^/]+\/config$/,
  /^\/v1\/locations\/countries\/[^/]+\/cities$/,
  /^\/v1\/locations\/cities\/[^/]+\/areas$/,

  // Promotions
  /^\/v1\/promotions\/packages$/,
  /^\/v1\/me\/promotions$/,

  // Private Seller & User Listings
  /^\/v1\/vendors\/mine$/,
  /^\/v1\/vendors\/[^/]+\/listings$/,
  /^\/v1\/me\/listings$/,
  /^\/v1\/me\/listings\/[^/]+$/,
  /^\/v1\/me\/listings\/[^/]+\/transition$/,
  /^\/v1\/me\/listings\/favorites$/,

  // Files
  /^\/v1\/files\/upload$/,
  /^\/v1\/files\/[^/]+\/status$/,
  /^\/v1\/files\/[^/]+$/,

  // Saved Searches
  /^\/v1\/me\/saved-searches$/,
  /^\/v1\/me\/saved-searches\/[^/]+$/,

  // Notifications
  /^\/v1\/notifications$/,
  /^\/v1\/notifications\/unread-count$/,
  /^\/v1\/notifications\/[^/]+\/read$/,
  /^\/v1\/notifications\/read-all$/,
  /^\/v1\/notifications\/devices$/,
  /^\/v1\/notifications\/devices\/[^/]+$/,

  // Leads
  /^\/v1\/leads$/,
  /^\/v1\/leads\/me$/,
  /^\/v1\/leads\/me\/[^/]+$/,
  /^\/v1\/leads\/me\/[^/]+\/status$/,
  /^\/v1\/vendors\/[^/]+\/leads$/,
  /^\/v1\/vendors\/[^/]+\/leads\/[^/]+$/,
  /^\/v1\/vendors\/[^/]+\/leads\/[^/]+\/status$/,

  // Reports
  /^\/v1\/reports$/,

  // Dashboard Overview
  /^\/v1\/vendors\/[^/]+\/analytics\/overview$/,

  // Vendor Entitlements & Billing
  /^\/v1\/vendors\/[^/]+\/entitlements$/,
  /^\/v1\/vendors\/[^/]+\/subscription$/,
  /^\/v1\/vendors\/[^/]+\/billing\/summary$/,
  /^\/v1\/vendors\/[^/]+\/billing\/invoices\/[^/]+$/,
  /^\/v1\/vendors\/[^/]+\/billing\/transactions$/,
  /^\/v1\/vendors\/subscription-plans$/,
];

/**
 * Checks whether an upstream endpoint pathname is on the explicit UPSTREAM_ENDPOINTS allowlist.
 * Strictly rejects:
 * - Protocol-relative paths (//) or absolute URLs (://)
 * - Leading or trailing whitespace
 * - Query strings (?) or URL fragments (#)
 * - Raw or single/double/iteratively percent-encoded path separators (/ or \) within segments (%2f, %5c)
 * - Raw or single/double/iteratively percent-encoded directory traversal (%2e, ..)
 * - Control characters or whitespace
 * - Non-allowlisted paths
 */
export function isAllowedUpstreamEndpoint(pathname: string): boolean {
  if (!pathname || typeof pathname !== 'string') return false;

  // Strictly reject leading or trailing whitespace
  if (/^\s|\s$/.test(pathname)) {
    return false;
  }

  // Strictly reject protocol-relative paths or scheme/protocol URLs
  if (pathname.startsWith('//') || pathname.includes('://')) {
    return false;
  }

  if (!pathname.startsWith('/v1/')) return false;

  // Reject control characters, whitespace, query strings (?), or URL fragments (#)
  if (/[\x00-\x20\x7F#?]/.test(pathname)) {
    return false;
  }

  // Reject raw backslashes or directory traversal
  if (pathname.includes('\\') || pathname.includes('..')) {
    return false;
  }

  // Reject initial percent-encoded separators (/ \), dot traversal (.), null bytes, or query/hash
  if (/%(?:2f|5c|2e|00|23|3f)/i.test(pathname)) {
    return false;
  }

  // Perform bounded iterative decoding until stable to catch double/nested encoding
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
        return false;
      }
      current = next;
    } catch {
      return false;
    }
  }

  if (
    current.includes('\\') ||
    current.includes('..') ||
    current.includes('\0') ||
    /[\x00-\x1F\x7F#?]/.test(current) ||
    /%(?:2f|5c|2e|00|23|3f)/i.test(current)
  ) {
    return false;
  }

  const rawSegments = pathname.split('/');
  for (const seg of rawSegments) {
    if (seg === '.' || seg === '..') return false;
  }
  const decodedSegments = current.split('/');
  for (const seg of decodedSegments) {
    if (seg === '.' || seg === '..') return false;
  }

  return ALLOWED_UPSTREAM_PATTERNS.some((pattern) => pattern.test(pathname));
}
