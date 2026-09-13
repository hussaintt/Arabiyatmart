/**
 * Pagination encoding, decoding, and metadata normalization helpers.
 *
 * Implements Phase 2 Section 2 and Sections 3.1-3.8 (FAV-01):
 * - Strict URL query parameter encoding and decoding for page and cursor pagination.
 * - Supports explicit allowed-limit sets and Phase 2 Zod schemas.
 * - Forbids repeated scalar parameters (e.g., page=1&page=2).
 * - Forbids silently changing, coercing, or clamping invalid requested limits.
 * - Forbids fabricating missing cursors when hasMore is true.
 */

import type { z } from 'zod';
import type { PageMeta, CursorMeta } from '@/types/common';
import { PageMetaSchema, CursorMetaSchema } from '@/lib/api/schemas/common';

/**
 * Phase 2 explicit allowed limit sets by operation domain:
 * - Listing & Dealer directory/inventory: 12 | 20 | 24 | 40
 * - Notifications & Leads: 20 | 40 | 80
 * - Private listings & Favorites: 20 | 50 | 100
 * - Home spotlight/makes/trims: 1..50
 */
export const ALLOWED_LIMITS = {
  LISTINGS: [12, 20, 24, 40] as const,
  DEALERS: [12, 20, 24, 40] as const,
  NOTIFICATIONS: [20, 40, 80] as const,
  LEADS: [20, 40, 80] as const,
  MY_LISTINGS: [20, 50, 100] as const,
  FAVORITES: [20, 50, 100] as const,
} as const;

export interface PaginationOptions {
  allowedLimits?: readonly number[] | Set<number> | undefined;
  schema?: z.ZodTypeAny | undefined;
  maxLimit?: number | undefined;
}

export type PaginationConfig =
  | PaginationOptions
  | readonly number[]
  | z.ZodTypeAny;

export function resolvePaginationOptions(config?: PaginationConfig): PaginationOptions {
  if (!config) return {};
  if (Array.isArray(config)) {
    return { allowedLimits: config };
  }
  if (typeof config === 'object' && '_def' in config) {
    return { schema: config as z.ZodTypeAny };
  }
  return config as PaginationOptions;
}

/**
 * Normalizes various search param input formats into a URLSearchParams instance.
 */
function toURLSearchParams(
  input: URLSearchParams | string | Record<string, string | string[] | undefined>
): URLSearchParams {
  if (input instanceof URLSearchParams) {
    return input;
  }
  if (typeof input === 'string') {
    const query = input.startsWith('?') ? input.slice(1) : input;
    return new URLSearchParams(query);
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.append(key, value);
    }
  }
  return params;
}

/**
 * Validates that a parameter is not supplied more than once.
 * Rejects repeated scalar query parameters to prevent HTTP parameter pollution.
 */
export function assertNoRepeatedParam(params: URLSearchParams, name: string): void {
  const allValues = params.getAll(name);
  if (allValues.length > 1) {
    throw new Error(`Repeated parameter "${name}" is not permitted`);
  }
}

/**
 * Validates a limit value against explicit allowed limits or bounded range without silent coercion.
 */
function validateLimit(limit: number, options: PaginationOptions): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid limit parameter: "${limit}". Must be a positive integer.`);
  }

  if (options.allowedLimits) {
    const allowedSet =
      options.allowedLimits instanceof Set
        ? options.allowedLimits
        : new Set(options.allowedLimits);
    if (!allowedSet.has(limit)) {
      throw new Error(
        `Unsupported limit value ${limit}. Allowed limits: [${Array.from(allowedSet).join(', ')}].`
      );
    }
  } else {
    const maxLimit = options.maxLimit ?? 100;
    if (limit > maxLimit) {
      throw new Error(
        `Requested limit ${limit} exceeds maximum allowed value of ${maxLimit}.`
      );
    }
  }
}

export interface PagePaginationParams {
  page?: number | undefined;
  limit?: number | undefined;
}

/**
 * Encodes page pagination parameters into URLSearchParams.
 * Rejects invalid page or limit values according to config without silent coercion.
 */
export function encodePageParams(
  params: PagePaginationParams,
  config?: PaginationConfig
): URLSearchParams {
  const options = resolvePaginationOptions(config);
  const searchParams = new URLSearchParams();

  if (options.schema) {
    options.schema.parse(params);
  }

  if (params.page !== undefined) {
    if (!Number.isInteger(params.page) || params.page < 1) {
      throw new Error(`Invalid page parameter: "${params.page}". Must be a positive integer.`);
    }
    searchParams.set('page', params.page.toString());
  }

  if (params.limit !== undefined) {
    validateLimit(params.limit, options);
    searchParams.set('limit', params.limit.toString());
  }

  return searchParams;
}

/**
 * Decodes and validates page pagination parameters from URL search parameters.
 * Rejects repeated scalar parameters and invalid limits/pages instead of silently mutating them.
 */
export function decodePageParams(
  input: URLSearchParams | string | Record<string, string | string[] | undefined>,
  config?: PaginationConfig
): PagePaginationParams {
  const options = resolvePaginationOptions(config);
  const params = toURLSearchParams(input);

  assertNoRepeatedParam(params, 'page');
  assertNoRepeatedParam(params, 'limit');

  const result: PagePaginationParams = {};

  const pageRaw = params.get('page');
  if (pageRaw !== null) {
    const trimmed = pageRaw.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
      throw new Error(`Invalid page query value "${pageRaw}". Must be a positive integer.`);
    }
    const parsedPage = Number.parseInt(trimmed, 10);
    result.page = parsedPage;
  }

  const limitRaw = params.get('limit');
  if (limitRaw !== null) {
    const trimmed = limitRaw.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
      throw new Error(`Invalid limit query value "${limitRaw}". Must be an integer.`);
    }
    const parsedLimit = Number.parseInt(trimmed, 10);
    validateLimit(parsedLimit, options);
    result.limit = parsedLimit;
  }

  if (options.schema) {
    options.schema.parse(result);
  }

  return result;
}

export interface CursorPaginationParams {
  cursor?: string | undefined;
  limit?: number | undefined;
}

/**
 * Encodes cursor pagination parameters into URLSearchParams.
 * Never fabricates a missing or empty cursor.
 */
export function encodeCursorParams(
  params: CursorPaginationParams,
  config?: PaginationConfig
): URLSearchParams {
  const options = resolvePaginationOptions(config);
  const searchParams = new URLSearchParams();

  if (options.schema) {
    options.schema.parse(params);
  }

  if (params.cursor !== undefined && params.cursor !== null) {
    const trimmed = params.cursor.trim();
    if (trimmed.length > 0) {
      searchParams.set('cursor', trimmed);
    }
  }

  if (params.limit !== undefined) {
    validateLimit(params.limit, options);
    searchParams.set('limit', params.limit.toString());
  }

  return searchParams;
}

/**
 * Decodes and validates cursor pagination parameters from URL search parameters.
 * Rejects repeated parameters and refuses to fabricate a missing cursor.
 */
export function decodeCursorParams(
  input: URLSearchParams | string | Record<string, string | string[] | undefined>,
  config?: PaginationConfig
): CursorPaginationParams {
  const options = resolvePaginationOptions(config);
  const params = toURLSearchParams(input);

  assertNoRepeatedParam(params, 'cursor');
  assertNoRepeatedParam(params, 'limit');

  const result: CursorPaginationParams = {};

  const cursorRaw = params.get('cursor');
  if (cursorRaw !== null) {
    const trimmed = cursorRaw.trim();
    if (trimmed.length === 0) {
      throw new Error('Cursor parameter cannot be empty');
    }
    result.cursor = trimmed;
  }

  const limitRaw = params.get('limit');
  if (limitRaw !== null) {
    const trimmed = limitRaw.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
      throw new Error(`Invalid limit query value "${limitRaw}". Must be an integer.`);
    }
    const parsedLimit = Number.parseInt(trimmed, 10);
    validateLimit(parsedLimit, options);
    result.limit = parsedLimit;
  }

  if (options.schema) {
    options.schema.parse(result);
  }

  return result;
}

/**
 * Validates raw page metadata against PageMetaSchema.
 */
export function normalizePageMeta(raw: unknown): PageMeta {
  return PageMetaSchema.parse(raw);
}

/**
 * Validates raw cursor metadata against CursorMetaSchema.
 * Enforces FAV-01 invariant: when hasMore is true, nextCursor MUST NOT be missing or null.
 * Fabricating a synthetic cursor is strictly forbidden.
 */
export function normalizeCursorMeta(raw: unknown): CursorMeta {
  const parsed = CursorMetaSchema.parse(raw);

  if (parsed.hasMore && (!parsed.nextCursor || parsed.nextCursor.trim() === '')) {
    throw new Error(
      'Upstream contract mismatch (FAV-01): hasMore is true but nextCursor is missing or null.'
    );
  }

  return parsed;
}
