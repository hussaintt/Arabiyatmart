/**
 * Canonical TanStack Query Keys.
 *
 * Implements Phase 1 Section 4.4 and Phase 2 Sections 3.1-3.6:
 * - Exact key shapes for all domain operations.
 * - Deterministic canonicalization for object parameters (sorted keys, stripped undefined).
 * - Readonly tuples returned from all factory functions.
 * - Strict prohibition of tokens, passwords, mutable class instances, or functions in keys.
 */

import { z } from 'zod';
import { PublicIdSchema, SlugSchema, LocaleSchema } from '@/lib/api/schemas/common';

/**
 * Recursively canonicalizes a value for stable query key comparison.
 * Plain objects have their keys sorted alphabetically and undefined properties omitted.
 * Arrays are recursively mapped.
 * Rejects circular references, non-plain class instances, functions, and credentials.
 */
export function canonicalizeValue<T>(val: T, seen = new WeakSet<object>()): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  const type = typeof val;
  if (type === 'function' || type === 'symbol') {
    throw new Error(`Query keys cannot contain ${type}s or ${type} values`);
  }
  if (typeof val === 'object' && val !== null) {
    if (seen.has(val)) {
      throw new Error('Query key contains circular reference');
    }
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map((item) => canonicalizeValue(item, seen));
    }

    if (val.constructor !== Object) {
      throw new Error('Query keys cannot contain class instances; use plain serializable records');
    }

    const record = val as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      if (/^(token|secret|password|bearer|authorization)$/i.test(key)) {
        throw new Error(`Query keys must not contain sensitive credential field "${key}"`);
      }
      const v = record[key];
      if (v !== undefined) {
        result[key] = canonicalizeValue(v, seen);
      }
    }
    return result;
  }
  return val;
}

/**
 * Normalizes an input record into a deterministic, sorted, undefined-free plain record.
 */
export function canonicalizeRecord<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return canonicalizeValue(record) as Record<string, unknown>;
}

/**
 * Verifies that a query key contains only JSON-serializable primitives and safe records.
 * Throws if functions, circular references, or forbidden credential patterns are present.
 */
export function assertSerializableKey(key: readonly unknown[]): void {
  const seen = new WeakSet<object>();

  function validate(val: unknown, depth = 0): void {
    if (depth > 10) {
      throw new Error('Query key nesting depth exceeded maximum limit');
    }
    if (val === null || val === undefined) {
      return;
    }
    const type = typeof val;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return;
    }
    if (type === 'function' || type === 'symbol') {
      throw new Error(`Query keys cannot contain ${type}s or ${type} values`);
    }
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        throw new Error('Query key contains circular reference');
      }
      seen.add(val);

      if (Array.isArray(val)) {
        for (const item of val) {
          validate(item, depth + 1);
        }
        return;
      }

      if (val.constructor !== Object) {
        throw new Error('Query keys cannot contain class instances; use plain serializable records');
      }

      const obj = val as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (/^(token|secret|password|bearer|authorization)$/i.test(k)) {
          throw new Error(`Query keys must not contain sensitive credential field "${k}"`);
        }
        validate(v, depth + 1);
      }
    }
  }

  validate(key);
}

/**
 * Helper that enforces serialization and credential-free constraints on a query key tuple.
 */
function enforceKey<T extends readonly unknown[]>(key: T): T {
  assertSerializableKey(key);
  return key;
}

// ── Canonical Query Key Factory ─────────────────────────────────────────────

export const queryKeys = {
  // Session & Profile (Phase 1 Section 4.4 line 350)
  me: () => enforceKey(['me'] as const),
  profile: () => enforceKey(['me', 'profile'] as const),

  // Listing search & detail (Phase 1 Section 4.4 lines 351-352)
  listingSearch: (
    normalizedFilters: Record<string, unknown>,
    page: number,
    limit: number
  ) => {
    const validPage = z.number().int().positive().parse(page);
    const validLimit = z.number().int().positive().parse(limit);
    return enforceKey(['listings', 'search', canonicalizeRecord(normalizedFilters), validPage, validLimit] as const);
  },

  listingDetail: (slug: string) => {
    const validSlug = SlugSchema.parse(slug);
    return enforceKey(['listing', validSlug] as const);
  },

  similarListings: (slug: string, limit: number) => {
    const validSlug = SlugSchema.parse(slug);
    const validLimit = z.number().int().positive().parse(limit);
    return enforceKey(['listing', validSlug, 'similar', validLimit] as const);
  },

  // Favorites (Phase 1 Section 4.4 line 353)
  favorites: (params: { limit?: number } = {}) => {
    return enforceKey(['me', 'favorites', canonicalizeRecord(params as Record<string, unknown>)] as const);
  },

  // Saved searches (Phase 1 Section 4.4 line 354)
  savedSearches: () => enforceKey(['me', 'saved-searches'] as const),

  // Notifications (Phase 1 Section 4.4 line 355)
  notifications: (params: { limit?: number; unreadOnly?: boolean } = {}) => {
    return enforceKey(['me', 'notifications', canonicalizeRecord(params as Record<string, unknown>)] as const);
  },

  notificationUnreadCount: () => enforceKey(['me', 'notifications', 'unread-count'] as const),

  notificationDevices: () => enforceKey(['me', 'notifications', 'devices'] as const),

  // My listings (Phase 1 Section 4.4 line 356)
  myListings: (params: { status?: string; limit?: number } = {}) => {
    return enforceKey(['me', 'listings', canonicalizeRecord(params as Record<string, unknown>)] as const);
  },

  // Contact leads (Phase 1 Section 4.4 line 358)
  leads: (
    params: { vendorIdOrNull: string | null; status?: string } = { vendorIdOrNull: null }
  ) => {
    if (params.vendorIdOrNull !== null && params.vendorIdOrNull !== undefined) {
      PublicIdSchema.parse(params.vendorIdOrNull);
    }
    return enforceKey(['me', 'leads', canonicalizeRecord(params as Record<string, unknown>)] as const);
  },

  lead: (publicId: string, params: { vendorIdOrNull?: string | null } = {}) => {
    const validId = PublicIdSchema.parse(publicId);
    if (params.vendorIdOrNull !== null && params.vendorIdOrNull !== undefined) {
      PublicIdSchema.parse(params.vendorIdOrNull);
    }
    return enforceKey(['me', 'leads', validId, canonicalizeRecord(params as Record<string, unknown>)] as const);
  },

  // Vendor selection & dashboard (Phase 1 Section 4.4 lines 359-360)
  vendors: () => enforceKey(['me', 'vendors'] as const),
  vendorDashboard: (vendorPublicId: string, range: string | number) => {
    const validId = PublicIdSchema.parse(vendorPublicId);
    return enforceKey(['vendor', validId, 'dashboard', range] as const);
  },

  // Dealers (Phase 1 Section 4.4 line 361)
  dealers: (params: { cityId?: number; limit?: number } = {}) => {
    return enforceKey(['dealers', canonicalizeRecord(params as Record<string, unknown>)] as const);
  },

  dealer: (slug: string) => {
    const validSlug = SlugSchema.parse(slug);
    return enforceKey(['dealer', validSlug] as const);
  },

  dealerListings: (
    slug: string,
    normalizedSupportedFilters: Record<string, unknown>,
    limit: number
  ) => {
    const validSlug = SlugSchema.parse(slug);
    const validLimit = z.number().int().positive().parse(limit);
    return enforceKey(['dealer', validSlug, 'listings', canonicalizeRecord(normalizedSupportedFilters), validLimit] as const);
  },

  // Taxonomy & Catalogue (Phase 1 Section 4.4 line 362)
  taxonomyMakes: () => enforceKey(['taxonomy', 'makes'] as const),
  taxonomyModels: (slug: string) => {
    const validSlug = SlugSchema.parse(slug);
    return enforceKey(['taxonomy', 'make', validSlug, 'models'] as const);
  },
  catalogueModel: (publicId: string) => {
    const validId = PublicIdSchema.parse(publicId);
    return enforceKey(['catalogue', 'model', validId] as const);
  },
  catalogueTrim: (publicId: string) => {
    const validId = PublicIdSchema.parse(publicId);
    return enforceKey(['catalogue', 'trim', validId] as const);
  },

  // Search suggestions (Phase 1 Section 4.4 line 363)
  searchSuggestions: (
    locale: string,
    condition: string | null | undefined,
    trimmedQuery: string
  ) => {
    const validLocale = LocaleSchema.parse(locale);
    const cleanQuery = trimmedQuery.trim();
    return enforceKey(['search', 'suggest', validLocale, condition ?? null, cleanQuery] as const);
  },

  // Upload status (Phase 1 Section 4.4 line 364)
  uploadStatus: (publicId: string) => {
    const validId = PublicIdSchema.parse(publicId);
    return enforceKey(['files', validId, 'status'] as const);
  },

  // Promotions (Phase 2 Section 3.4 line 2888)
  myPromotions: () => enforceKey(['me', 'promotions'] as const),
} as const;

/**
 * Root query key namespaces useful for invalidation prefixes.
 */
export const queryKeyRoots = {
  me: ['me'] as const,
  listings: ['listings'] as const,
  listing: ['listing'] as const,
  dealers: ['dealers'] as const,
  dealer: ['dealer'] as const,
  taxonomy: ['taxonomy'] as const,
  catalogue: ['catalogue'] as const,
  search: ['search'] as const,
  files: ['files'] as const,
  vendor: (vendorPublicId: string) => {
    const validId = PublicIdSchema.parse(vendorPublicId);
    return ['vendor', validId] as const;
  },
} as const;
