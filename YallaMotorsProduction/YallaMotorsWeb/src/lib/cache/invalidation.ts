/**
 * Mutation Invalidation Plans and Execution Engine.
 *
 * Implements Phase 1 Section 4.5 and Phase 2 Sections 3.2-3.7:
 * - Deterministic invalidation plans for all mutations.
 * - Exact TanStack Query key prefixes, Next.js cache tags, and locale-aware paths.
 * - Strict enforcement of CACHE-01: favorites do not invalidate shared public tags.
 * - Reconciliation error semantics: invalidation failure after upstream mutation success
 *   instructs the caller to trigger reconciliation/refetch rather than re-executing the mutation.
 */

import { CACHE_TAGS, listingTag } from './tags';

export type SupportedLocale = 'ar' | 'en';
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['ar', 'en'];

/**
 * Normalizes relative path segments across all supported locales.
 * Example: '/search' -> ['/ar/search', '/en/search']
 * '' or '/' -> ['/ar', '/en']
 */
export function getLocalizedPaths(
  paths: readonly string[],
  locales: readonly SupportedLocale[] = SUPPORTED_LOCALES
): string[] {
  const result: string[] = [];

  for (const rawPath of paths) {
    const trimmed = rawPath.trim();
    const cleanPath = trimmed === '/' || trimmed === '' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    for (const locale of locales) {
      const localized = cleanPath === '' ? `/${locale}` : `/${locale}${cleanPath}`;
      if (!result.includes(localized)) {
        result.push(localized);
      }
    }
  }

  return result;
}

export interface MutationInvalidationPlan {
  readonly operation: string;
  readonly queryKeyPrefixes: readonly (readonly unknown[])[];
  readonly tags: readonly string[];
  readonly paths: readonly string[];
  readonly clearPrivateQueries?: boolean;
  readonly clearVendorQueries?: boolean;
}

/**
 * Error raised when cache invalidation fails after upstream mutation has already succeeded.
 * Indicates the client must reconcile and refetch server truth instead of repeating the mutation.
 */
export class InvalidationReconciliationError extends Error {
  readonly operation: string;
  readonly requestId?: string | undefined;
  readonly failedTags: readonly string[];
  readonly failedPaths: readonly string[];
  readonly failedQueryKeys: readonly (readonly unknown[])[];
  readonly shouldRefetch: boolean;

  constructor(options: {
    operation: string;
    requestId?: string | undefined;
    failedTags?: readonly string[] | undefined;
    failedPaths?: readonly string[] | undefined;
    failedQueryKeys?: readonly (readonly unknown[])[] | undefined;
    cause?: unknown;
  }) {
    super(
      `Cache invalidation failed after upstream success for operation "${options.operation}". Do not retry mutation; refetch server state.`
    );
    this.name = 'InvalidationReconciliationError';
    this.operation = options.operation;
    this.requestId = options.requestId;
    this.failedTags = options.failedTags ?? [];
    this.failedPaths = options.failedPaths ?? [];
    this.failedQueryKeys = options.failedQueryKeys ?? [];
    this.shouldRefetch = true;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

// ── Concrete Mutation Invalidation Plans ─────────────────────────────────────

export const invalidationPlans = {
  // Listing Mutations
  createListing: (): MutationInvalidationPlan => ({
    operation: 'createListing',
    queryKeyPrefixes: [['me', 'listings'], ['listings']],
    tags: [CACHE_TAGS.LISTINGS, CACHE_TAGS.HOME],
    paths: getLocalizedPaths(['', '/search', '/me/listings']),
  }),

  updateListing: (params: { slug: string; vendorPublicId?: string }): MutationInvalidationPlan => ({
    operation: 'updateListing',
    queryKeyPrefixes: [
      ['me', 'listings'],
      ['listings'],
      ['listing', params.slug],
      ...(params.vendorPublicId ? [['vendor', params.vendorPublicId, 'dashboard'] as const] : []),
    ],
    tags: [CACHE_TAGS.LISTINGS, listingTag(params.slug)],
    paths: getLocalizedPaths(['/search', '/me/listings', `/listing/${params.slug}`]),
  }),

  updateListingPrice: (params: { slug: string; vendorPublicId?: string }): MutationInvalidationPlan => ({
    operation: 'updateListingPrice',
    queryKeyPrefixes: [
      ['me', 'listings'],
      ['listings'],
      ['listing', params.slug],
      ...(params.vendorPublicId ? [['vendor', params.vendorPublicId, 'dashboard'] as const] : []),
    ],
    tags: [CACHE_TAGS.LISTINGS, listingTag(params.slug)],
    paths: getLocalizedPaths(['/search', '/me/listings', `/listing/${params.slug}`]),
  }),

  transitionListing: (params: { slug: string; vendorPublicId?: string }): MutationInvalidationPlan => ({
    operation: 'transitionListing',
    queryKeyPrefixes: [
      ['me', 'listings'],
      ['listings'],
      ['listing', params.slug],
      ...(params.vendorPublicId ? [['vendor', params.vendorPublicId, 'dashboard'] as const] : []),
    ],
    tags: [CACHE_TAGS.LISTINGS, CACHE_TAGS.HOME, listingTag(params.slug)],
    paths: getLocalizedPaths(['', '/search', '/me/listings', `/listing/${params.slug}`]),
  }),

  /**
   * CACHE-01 Favorite Invalidation Plan:
   * Only invalidates user-scoped favorites and session-summary keys.
   * DOES NOT invalidate public listing tags or search feeds.
   */
  favoriteToggle: (params: { slug?: string; publicId: string }): MutationInvalidationPlan => ({
    operation: 'favoriteToggle',
    queryKeyPrefixes: [
      ['me', 'favorites'],
      ['me'],
      ...(params.slug ? [['listing', params.slug] as const] : []),
    ],
    tags: [], // STRICT: No public tags invalidated on favorite toggle
    paths: getLocalizedPaths(['/favorites']),
  }),

  purchasePromotion: (params: { slug: string }): MutationInvalidationPlan => ({
    operation: 'purchasePromotion',
    queryKeyPrefixes: [['me', 'promotions'], ['me', 'listings']],
    tags: [CACHE_TAGS.PROMOTIONS_PACKAGES, CACHE_TAGS.LISTINGS, CACHE_TAGS.HOME, listingTag(params.slug)],
    paths: getLocalizedPaths(['/me/listings', `/listing/${params.slug}`]),
  }),

  // Auth & Session Mutations
  login: (): MutationInvalidationPlan => ({
    operation: 'login',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me']),
  }),

  register: (): MutationInvalidationPlan => ({
    operation: 'register',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me']),
  }),

  refreshSession: (): MutationInvalidationPlan => ({
    operation: 'refreshSession',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: [],
  }),

  logout: (): MutationInvalidationPlan => ({
    operation: 'logout',
    queryKeyPrefixes: [['me']],
    clearPrivateQueries: true,
    tags: [],
    paths: getLocalizedPaths(['/profile', '/login', '/me']),
  }),

  logoutAll: (): MutationInvalidationPlan => ({
    operation: 'logoutAll',
    queryKeyPrefixes: [['me']],
    clearPrivateQueries: true,
    tags: [],
    paths: getLocalizedPaths(['/profile', '/login', '/me']),
  }),

  deleteAccount: (): MutationInvalidationPlan => ({
    operation: 'deleteAccount',
    queryKeyPrefixes: [['me']],
    clearPrivateQueries: true,
    tags: [],
    paths: getLocalizedPaths(['/profile', '/login', '/me']),
  }),

  updateProfile: (): MutationInvalidationPlan => ({
    operation: 'updateProfile',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me']),
  }),

  verifyOtp: (): MutationInvalidationPlan => ({
    operation: 'verifyOtp',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me']),
  }),

  setPhone: (): MutationInvalidationPlan => ({
    operation: 'setPhone',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me']),
  }),

  changePassword: (): MutationInvalidationPlan => ({
    operation: 'changePassword',
    queryKeyPrefixes: [['me']],
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me']),
  }),

  setLocale: (currentPath: string): MutationInvalidationPlan => ({
    operation: 'setLocale',
    queryKeyPrefixes: [['search', 'suggest']],
    tags: [],
    paths: [currentPath],
  }),

  // Saved Searches
  savedSearchMutation: (): MutationInvalidationPlan => ({
    operation: 'savedSearchMutation',
    queryKeyPrefixes: [['me', 'saved-searches']],
    tags: [],
    paths: getLocalizedPaths(['/saved-searches']),
  }),

  // Notifications
  notificationRead: (): MutationInvalidationPlan => ({
    operation: 'notificationRead',
    queryKeyPrefixes: [['me', 'notifications']],
    tags: [],
    paths: [],
  }),

  notificationDevice: (): MutationInvalidationPlan => ({
    operation: 'notificationDevice',
    queryKeyPrefixes: [['me', 'notifications', 'devices']],
    tags: [],
    paths: [],
  }),

  // Contact leads
  leadMutation: (params: { vendorPublicId?: string } = {}): MutationInvalidationPlan => ({
    operation: 'leadMutation',
    queryKeyPrefixes: [
      ['me', 'leads'],
      ...(params.vendorPublicId ? [['vendor', params.vendorPublicId, 'dashboard'] as const] : []),
    ],
    tags: [],
    paths: getLocalizedPaths(['/me/leads']),
  }),

  // Vendor Scope
  activeVendorSwitch: (oldVendorPublicId?: string): MutationInvalidationPlan => ({
    operation: 'activeVendorSwitch',
    queryKeyPrefixes: oldVendorPublicId ? [['vendor', oldVendorPublicId]] : [],
    clearVendorQueries: true,
    tags: [],
    paths: getLocalizedPaths(['/profile', '/me/dashboard']),
  }),

  // Files
  deleteFile: (publicId: string): MutationInvalidationPlan => ({
    operation: 'deleteFile',
    queryKeyPrefixes: [['files', publicId, 'status']],
    tags: [],
    paths: [],
  }),
};

// ── Invalidation Execution Engine ───────────────────────────────────────────

export interface InvalidationExecutorContext {
  revalidateTag?: (tag: string) => void | Promise<void>;
  revalidatePath?: (path: string) => void | Promise<void>;
  queryClient?: {
    invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<void>;
    removeQueries: (filters: { queryKey: readonly unknown[] }) => void;
  };
  requestId?: string;
}

export interface InvalidationExecutionResult {
  success: boolean;
  error?: InvalidationReconciliationError;
}

/**
 * Executes an invalidation plan across Next.js tags, paths, and TanStack query caches.
 * Any caught invalidation failure after successful mutation returns an InvalidationReconciliationError.
 */
export async function executeInvalidationPlan(
  plan: MutationInvalidationPlan,
  context: InvalidationExecutorContext
): Promise<InvalidationExecutionResult> {
  const failedTags: string[] = [];
  const failedPaths: string[] = [];
  const failedQueryKeys: (readonly unknown[])[] = [];

  // 1. Revalidate Next.js Cache Tags
  if (context.revalidateTag && plan.tags.length > 0) {
    for (const tag of plan.tags) {
      try {
        await context.revalidateTag(tag);
      } catch {
        failedTags.push(tag);
      }
    }
  }

  // 2. Revalidate Next.js Paths
  if (context.revalidatePath && plan.paths.length > 0) {
    for (const path of plan.paths) {
      try {
        await context.revalidatePath(path);
      } catch {
        failedPaths.push(path);
      }
    }
  }

  // 3. Invalidate TanStack Query Keys
  if (context.queryClient) {
    // Handle clearing private scopes if requested
    if (plan.clearPrivateQueries) {
      const privateScopes: (readonly unknown[])[] = [
        ['me'],
        ['vendor'],
        ['favorites'],
        ['saved-searches'],
        ['leads'],
        ['dashboard'],
        ['notifications'],
      ];
      for (const scope of privateScopes) {
        try {
          context.queryClient.removeQueries({ queryKey: scope });
        } catch {
          failedQueryKeys.push(scope);
        }
      }
    }
    if (plan.clearVendorQueries) {
      try {
        context.queryClient.removeQueries({ queryKey: ['vendor'] });
      } catch {
        failedQueryKeys.push(['vendor']);
      }
    }

    // Invalidate specified query key prefixes
    for (const queryKey of plan.queryKeyPrefixes) {
      try {
        await context.queryClient.invalidateQueries({ queryKey });
      } catch {
        failedQueryKeys.push(queryKey);
      }
    }
  }

  if (failedTags.length > 0 || failedPaths.length > 0 || failedQueryKeys.length > 0) {
    return {
      success: false,
      error: new InvalidationReconciliationError({
        operation: plan.operation,
        requestId: context.requestId,
        failedTags,
        failedPaths,
        failedQueryKeys,
      }),
    };
  }

  return { success: true };
}
