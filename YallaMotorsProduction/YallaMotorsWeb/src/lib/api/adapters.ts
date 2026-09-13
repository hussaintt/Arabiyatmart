/**
 * Raw-to-Normalized API Adapters.
 *
 * Implements Phase 1 Section 2.6 and Phase 2 Section 3.8 (OUT-01):
 * - Adapts upstream permissive responses (bare arrays, wrapped rows, Type.Any, no output schema).
 * - Strips sensitive device tokens and internal numeric database IDs.
 * - Normalizes nullable totals, cursor metadata, and rejection/status reasons.
 * - Normalizes 202/204 empty acknowledgements into typed mutation acknowledgements.
 * - Centralizes re-exports of domain-specific schema adapters.
 */

import { z } from 'zod';
import {
  MutationAckResponseSchema,
} from '@/lib/api/schemas/common';
import {
  unwrapDataArray,
  unwrapDataObject,
  ensureNonArrayObject,
  adaptRawMake,
  adaptRawMakeList,
  adaptRawVehicleModel,
  adaptRawVehicleModelList,
  adaptRawGeneration,
  adaptRawGenerationList,
  adaptRawTrim,
  adaptRawTrimList,
  adaptRawTrimDetail,
  adaptRawSpotlight,
  adaptRawModelsWithPrices,
  adaptRawModelPage,
  adaptRawCatalogueTrimDetail,
  adaptRawTrimDealers,
  adaptRawCityList,
  adaptRawAreaList,
  adaptRawCountryList,
  adaptRawCountryConfig,
  CountryConfigSchema,
  CountryConfigResponseSchema,
} from '@/lib/api/schemas/taxonomy';
import {
  adaptRawDealerBranch,
  adaptRawDealerDirectory,
  adaptRawDealerProfile,
  adaptRawMyVendors,
} from '@/lib/api/schemas/dealer';
import {
  adaptRawPublicSettings,
  deriveFinanceConfig,
  deriveSupportConfig,
} from '@/lib/api/schemas/settings';
import {
  adaptRawBanner,
  adaptRawBannerList,
  adaptRawHomePageData,
} from '@/lib/api/schemas/home';
import {
  adaptRawLead,
  adaptRawLeadDetail,
  adaptRawLeadList,
  adaptRawListingReport,
  adaptRawListingPromotion,
  adaptRawPromotionList,
  adaptRawPromotionPackageList,
} from '@/lib/api/schemas/lead';
import { adaptRawDashboardOverview } from '@/lib/api/schemas/dashboard';
import {
  adaptRawNotification,
  adaptRawNotificationList,
  adaptRawDeviceRegistration,
  adaptRawDeviceRegistrationList,
} from '@/lib/api/schemas/notification';
import {
  adaptRawUploadedFile,
  adaptRawUploadedFileList,
  adaptRawFileStatus,
} from '@/lib/api/schemas/upload';
import {
  adaptRawSavedSearch,
  adaptRawSavedSearchList,
  adaptRawVehicleSearchSuggestionList,
} from '@/lib/api/schemas/saved-search';
import {
  adaptRawDealerEntitlements,
  adaptRawSubscriptionPlans,
  adaptRawVendorSubscription,
  adaptRawVendorBillingSummary,
} from '@/lib/api/schemas/billing';

// Re-export existing domain schema adapters for unified access
export {
  adaptRawDealerEntitlements,
  adaptRawSubscriptionPlans,
  adaptRawVendorSubscription,
  adaptRawVendorBillingSummary,
  unwrapDataArray,
  unwrapDataObject,
  ensureNonArrayObject,
  adaptRawMake,
  adaptRawMakeList,
  adaptRawVehicleModel,
  adaptRawVehicleModelList,
  adaptRawGeneration,
  adaptRawGenerationList,
  adaptRawTrim,
  adaptRawTrimList,
  adaptRawTrimDetail,
  adaptRawSpotlight,
  adaptRawModelsWithPrices,
  adaptRawModelPage,
  adaptRawCatalogueTrimDetail,
  adaptRawTrimDealers,
  adaptRawCityList,
  adaptRawAreaList,
  adaptRawCountryList,
  adaptRawCountryConfig,
  adaptRawDealerBranch,
  adaptRawDealerDirectory,
  adaptRawDealerProfile,
  adaptRawMyVendors,
  adaptRawPublicSettings,
  deriveFinanceConfig,
  deriveSupportConfig,
  adaptRawBanner,
  adaptRawBannerList,
  adaptRawHomePageData,
  adaptRawLead,
  adaptRawLeadDetail,
  adaptRawLeadList,
  adaptRawListingReport,
  adaptRawListingPromotion,
  adaptRawPromotionList,
  adaptRawPromotionPackageList,
  adaptRawDashboardOverview,
  adaptRawNotification,
  adaptRawNotificationList,
  adaptRawDeviceRegistration,
  adaptRawDeviceRegistrationList,
  adaptRawUploadedFile,
  adaptRawUploadedFileList,
  adaptRawFileStatus,
  adaptRawSavedSearch,
  adaptRawSavedSearchList,
  adaptRawVehicleSearchSuggestionList,
};

// ── 1. Bare Arrays Adapter ───────────────────────────────────────────────────

/**
 * Normalizes an upstream response that may be a bare array into `{ data: array }`.
 * If already wrapped as `{ data: [...] }`, preserves the data array.
 */
export function adaptBareArray<T = unknown>(input: unknown): { data: T[] } {
  if (Array.isArray(input)) {
    return { data: input as T[] };
  }
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if ('data' in obj && Array.isArray(obj.data)) {
      return { data: obj.data as T[] };
    }
  }
  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      path: ['data'],
      message: 'Expected bare array or { data: array } response',
    },
  ]);
}

// ── 2. Wrapped Rows Adapter ──────────────────────────────────────────────────

export interface WrappedRowsResult<T = unknown> {
  data: T[];
  meta?: {
    total: number | null;
    hasMore?: boolean | undefined;
    nextCursor?: string | null | undefined;
  } | undefined;
}

/**
 * Normalizes upstream responses returned as database/ORM wrapped rows
 * e.g., `{ rows: [...], count?: number }` or `{ data: { rows: [...], count?: number } }`
 * into `{ data: [...], meta?: { total: ... } }`.
 */
export function adaptWrappedRows<T = unknown>(input: unknown): WrappedRowsResult<T> {
  if (typeof input !== 'object' || input === null) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected object containing wrapped rows',
      },
    ]);
  }

  const record = input as Record<string, unknown>;

  // Check if rows are directly on the object or nested under `data`
  let target = record;
  if ('data' in record && typeof record.data === 'object' && record.data !== null && !Array.isArray(record.data)) {
    target = record.data as Record<string, unknown>;
  }

  let items: unknown[];
  if (Array.isArray(target.rows)) {
    items = target.rows;
  } else if (Array.isArray(target.items)) {
    items = target.items;
  } else if (Array.isArray(target.data)) {
    items = target.data;
  } else if (Array.isArray(input)) {
    items = input;
  } else {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message: 'Expected rows or items array in wrapped response',
      },
    ]);
  }

  const rawCount = target.count ?? target.total ?? record.count ?? record.total;
  const total = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : null;

  return {
    data: items as T[],
    meta: {
      total,
      hasMore: typeof target.hasMore === 'boolean' ? target.hasMore : undefined,
      nextCursor: typeof target.nextCursor === 'string' ? target.nextCursor : null,
    },
  };
}

// ── 3. 202 / 204 Acknowledgements Adapter ────────────────────────────────────

/**
 * Normalizes 204 No Content (empty body/null) or 202 Accepted acknowledgements
 * into `{ ok: true }` conforming to `MutationAckResponseSchema`.
 */
export function adapt204Acknowledgement(input?: unknown, status?: number): { ok: true } {
  if (status === 204 || input === null || input === undefined || input === '') {
    return { ok: true };
  }
  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    if (record.ok === true) {
      return { ok: true };
    }
  }
  return MutationAckResponseSchema.parse({ ok: true });
}

// ── 4. Nullable Totals & Status Reasons Adapter ───────────────────────────────

/**
 * Normalizes nullable totals in page metadata (undefined -> null) and
 * nullable rejection/status reasons on entity records (undefined -> null).
 */
export function adaptNullableTotalsAndReasons<T extends Record<string, unknown>>(input: T): T {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  const result = { ...input } as Record<string, unknown>;

  // Normalize pagination meta if present
  if (result.meta && typeof result.meta === 'object' && !Array.isArray(result.meta)) {
    const meta = { ...(result.meta as Record<string, unknown>) };
    if (meta.total === undefined) {
      meta.total = null;
    }
    if (meta.nextCursor === undefined) {
      meta.nextCursor = null;
    }
    result.meta = meta;
  }

  // Normalize rejection reasons
  if (result.rejectionReason === undefined) {
    result.rejectionReason = null;
  }
  if (result.kycRejectionReason === undefined) {
    result.kycRejectionReason = null;
  }
  if (result.leadsCount === undefined) {
    result.leadsCount = null;
  }

  // If input has data array, recursively normalize each item
  if (Array.isArray(result.data)) {
    result.data = result.data.map((item) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return adaptNullableTotalsAndReasons(item as Record<string, unknown>);
      }
      return item;
    });
  } else if (result.data && typeof result.data === 'object') {
    result.data = adaptNullableTotalsAndReasons(result.data as Record<string, unknown>);
  }

  return result as T;
}

// ── 5. Device Token Stripping ────────────────────────────────────────────────

const SENSITIVE_TOKEN_KEYS = new Set([
  'token',
  'deviceToken',
  'fcmToken',
  'apnsToken',
  'registrationToken',
  'id',
  'userId',
]);

/**
 * Strips device push tokens and internal numeric IDs from device registration responses.
 * Guarantees that neither push tokens nor numeric keys leak to the browser or client components.
 */
export function stripDeviceToken(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(stripDeviceToken);
  }

  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;

    // Handle { data: ... } wrapped responses
    if ('data' in record) {
      return {
        ...record,
        data: stripDeviceToken(record.data),
      };
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (SENSITIVE_TOKEN_KEYS.has(key)) {
        continue;
      }
      cleaned[key] = typeof value === 'object' && value !== null ? stripDeviceToken(value) : value;
    }

    // Default platform to WEB if omitted
    if (!cleaned.platform) {
      cleaned.platform = 'WEB';
    }

    return cleaned;
  }

  return input;
}

// ── 6. Numeric Database IDs Stripping ────────────────────────────────────────

const INTERNAL_NUMERIC_ID_KEYS = new Set([
  'id',
  'userId',
  'buyerUserId',
  'sellerUserId',
  'vendorId',
  'listingId',
  'dealerId',
  'conversationId',
  'branchId',
]);

/**
 * Recursively strips internal database primary/foreign keys from upstream payloads.
 * Only publicIds and slugs should cross into Next.js.
 */
export function stripNumericIds<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => stripNumericIds(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      // If key is an internal numeric ID and value is number, strip it
      if (INTERNAL_NUMERIC_ID_KEYS.has(key) && typeof value === 'number') {
        continue;
      }
      cleaned[key] = typeof value === 'object' && value !== null ? stripNumericIds(value) : value;
    }

    return cleaned as T;
  }

  return input;
}

// ── 7. Type.Any Notification Normalization ───────────────────────────────────

/**
 * Normalizes upstream Fastify Type.Any notification fields (title, body, data)
 * into validated PartialLocalizedText and safe nulls, stripping numeric IDs.
 */
export function adaptTypeAnyNotification(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected notification object input',
      },
    ]);
  }

  const record = raw as Record<string, unknown>;

  // Handle list wrapper if input is `{ data: [...] }`
  if (Array.isArray(record.data)) {
    return adaptRawNotificationList(raw);
  }

  // Handle single notification wrapper `{ data: { ... } }` or flat `{ publicId: ... }`
  const target = ('data' in record && typeof record.data === 'object' && record.data !== null && !Array.isArray(record.data))
    ? (record.data as Record<string, unknown>)
    : record;

  let title: unknown = target.title;
  if (typeof target.title === 'string') {
    title = { ar: target.title, en: target.title };
  }

  let body: unknown = null;
  if (target.body !== undefined && target.body !== null) {
    if (typeof target.body === 'string') {
      body = { ar: target.body, en: target.body };
    } else {
      body = target.body;
    }
  }

  return {
    publicId: target.publicId,
    type: target.type,
    title,
    body,
    data: target.data === undefined ? null : target.data,
    readAt: target.readAt === undefined ? null : target.readAt,
    createdAt: target.createdAt,
  };
}

// ── 8. Type.Any Dashboard Normalization ──────────────────────────────────────

/**
 * Normalizes upstream Type.Any vendor analytics dashboard overview into
 * structured `{ window, summary }` response.
 */
export function adaptTypeAnyDashboard(raw: unknown): unknown {
  return adaptRawDashboardOverview(raw);
}

/**
 * Normalizes upstream country configuration into validated `{ data: CountryConfig }`.
 */
export function adaptCountryConfig(raw: unknown): unknown {
  const obj = unwrapDataObject(raw);
  const nestedConfig =
    typeof obj.config === 'object' && obj.config !== null && !Array.isArray(obj.config)
      ? (obj.config as Record<string, unknown>)
      : {};

  let legalDisclaimer = obj.legalDisclaimer ?? nestedConfig.legalDisclaimer ?? null;
  if (typeof legalDisclaimer === 'string') {
    legalDisclaimer = { ar: legalDisclaimer, en: legalDisclaimer };
  }

  const cleaned = {
    code: obj.code,
    currency: obj.currency,
    currencySymbol: obj.currencySymbol ?? nestedConfig.currencySymbol ?? null,
    phoneFormat: obj.phoneFormat ?? nestedConfig.phoneFormat ?? null,
    legalDisclaimer,
    defaultInterestRate: obj.defaultInterestRate ?? nestedConfig.defaultInterestRate ?? null,
  };

  const data = CountryConfigSchema.parse(cleaned);
  return CountryConfigResponseSchema.parse({ data });
}
