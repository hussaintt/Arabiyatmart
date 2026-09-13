/**
 * Canonical Search URL State and Parameter Utilities.
 *
 * Implements Phase 1 Section 2.6 and Phase 2 Sections 2.4 & 2.11:
 * - parseSearchParams: Strict, safe parsing from string, URLSearchParams, or Record.
 * - canonicalizeSearchParams: Enforces parameter rules and strips default/empty values.
 * - serializeSearchParams: Deterministic, alphabetically sorted canonical query string.
 * - searchParamsToApiInput: Maps URL search state to backend ListingSearchParams.
 * - applyFilterChange: Resets pagination/cursor and invalid dependent descendants when filters change.
 */

import { z } from 'zod';
import type { ListingSearchParams } from '@/types/search';
import type {
  BodyType,
  CarCondition,
  FuelType,
  ListingSort,
  SellerType,
  Transmission,
  VehicleType,
} from '@/types/listing';
import {
  ListingSearchParamsSchema,
  ListingSearchUrlSchema,
} from '@/lib/api/schemas/search';
import {
  ALLOWED_BODY_TYPES,
  ALLOWED_BOOLEAN_FILTER_KEYS,
  ALLOWED_CONDITIONS,
  ALLOWED_FUEL_TYPES,
  ALLOWED_LIMITS,
  ALLOWED_PANELS,
  ALLOWED_SEARCH_PARAM_KEYS,
  ALLOWED_SELLER_TYPES,
  ALLOWED_SORTS,
  ALLOWED_TRANSMISSIONS,
  ALLOWED_VEHICLE_TYPES,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  DEFAULT_SORT,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
  YEAR_MAX_BOUND,
  YEAR_MIN_BOUND,
  type AllowedLimit,
  type AllowedPanel,
} from './defaults';

export interface ParsedSearchParams {
  q?: string | undefined;
  makeSlug?: string | undefined;
  modelSlug?: string | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  mileageMax?: number | undefined;
  cityId?: number | undefined;
  areaId?: number | undefined;
  condition?: CarCondition | undefined;
  fuelType?: FuelType | undefined;
  transmission?: Transmission | undefined;
  bodyType?: BodyType | undefined;
  sellerType?: SellerType | undefined;
  vehicleType?: VehicleType | undefined;
  hasWarranty?: boolean | undefined;
  isNegotiable?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  exchangeAccepted?: boolean | undefined;
  isVerified?: boolean | undefined;
  sort?: ListingSort | undefined;
  page?: number | undefined;
  limit?: AllowedLimit | undefined;
  panel?: AllowedPanel | undefined;
  filter?: string | undefined;
  countOnly?: boolean | undefined;
  cursor?: string | undefined;
}

export const SearchUrlSchema = ListingSearchUrlSchema.extend({
  panel: z.enum(ALLOWED_PANELS).optional(),
  filter: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
});

function isValidSlug(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (
    trimmed.length >= 1 &&
    trimmed.length <= 160 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)
  );
}

function safeDecode(val: string): string {
  try {
    return decodeURIComponent(val.replace(/\+/g, ' '));
  } catch {
    // Gracefully handle malformed percent encoding without throwing
    return val.replace(/%[0-9a-fA-F]{2}/g, (match) => {
      try {
        return decodeURIComponent(match);
      } catch {
        return match;
      }
    });
  }
}

/**
 * Extracts and normalizes raw key-value pairs from any search input type.
 * Handles strings (with/without leading '?' or path), URLSearchParams, and plain objects.
 * Deduplicates array sets where order is irrelevant and collapses repeated scalar params.
 */
function extractRawParamEntries(
  raw: unknown
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!raw) return result;

  if (typeof raw === 'string') {
    let queryStr = raw.trim();
    if (queryStr.includes('?')) {
      queryStr = queryStr.slice(queryStr.indexOf('?') + 1);
    }
    if (queryStr.includes('#')) {
      queryStr = queryStr.slice(0, queryStr.indexOf('#'));
    }
    if (!queryStr) return result;

    const pairs = queryStr.split('&');
    for (const pair of pairs) {
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
      const rawVal = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';

      const key = safeDecode(rawKey).trim();
      const val = safeDecode(rawVal).trim();

      if (!key || !ALLOWED_SEARCH_PARAM_KEYS.has(key)) continue;

      const existing = result.get(key) ?? [];
      existing.push(val);
      result.set(key, existing);
    }
    return collapseAndDeduplicate(result);
  }

  if (raw instanceof URLSearchParams) {
    for (const key of raw.keys()) {
      if (!ALLOWED_SEARCH_PARAM_KEYS.has(key)) continue;
      const values = raw
        .getAll(key)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      if (values.length > 0) {
        result.set(key, values);
      }
    }
    return collapseAndDeduplicate(result);
  }

  if (typeof raw === 'object' && raw !== null) {
    for (const [key, value] of Object.entries(raw)) {
      if (!ALLOWED_SEARCH_PARAM_KEYS.has(key)) continue;
      if (value === undefined || value === null) continue;

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          result.set(key, [trimmed]);
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        result.set(key, [String(value)]);
      } else if (Array.isArray(value)) {
        const valid = value
          .filter((v): v is string | number | boolean => v !== null && v !== undefined)
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0);
        if (valid.length > 0) {
          result.set(key, valid);
        }
      }
    }
    return collapseAndDeduplicate(result);
  }

  return result;
}

/**
 * Collapses repeated scalar parameters and deduplicates unordered sets.
 */
function collapseAndDeduplicate(map: Map<string, string[]>): Map<string, string[]> {
  const normalized = new Map<string, string[]>();

  for (const [key, values] of map.entries()) {
    // Deduplicate identical values while preserving order
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) continue;

    // For all scalar search params, collapse multiple values into a single primary value
    // (taking the first element per Phase 1 Section 2.6 canonical rule)
    normalized.set(key, [uniqueValues[0]!]);
  }

  return normalized;
}

/**
 * Parses raw search parameters into a strictly typed ParsedSearchParams object.
 * Applies bounds, validation rules, cross-field consistency, and ignores unknown parameters.
 */
export function parseSearchParams(raw: unknown): ParsedSearchParams {
  const map = extractRawParamEntries(raw);
  const out: ParsedSearchParams = {};

  // Free text query: q (2..120 trimmed characters)
  const rawQ = map.get('q')?.[0];
  if (rawQ) {
    const trimmed = rawQ.trim();
    if (
      trimmed.length >= SEARCH_QUERY_MIN_LENGTH &&
      trimmed.length <= SEARCH_QUERY_MAX_LENGTH
    ) {
      out.q = trimmed;
    }
  }

  // makeSlug & modelSlug (modelSlug requires valid makeSlug)
  const rawMakeSlug = map.get('makeSlug')?.[0];
  const rawModelSlug = map.get('modelSlug')?.[0];
  if (rawMakeSlug && isValidSlug(rawMakeSlug)) {
    out.makeSlug = rawMakeSlug;
    if (rawModelSlug && isValidSlug(rawModelSlug)) {
      out.modelSlug = rawModelSlug;
    }
  }

  // condition: NEW | USED
  const rawCondition = map.get('condition')?.[0];
  if (rawCondition && (ALLOWED_CONDITIONS as readonly string[]).includes(rawCondition)) {
    out.condition = rawCondition as CarCondition;
  }

  // yearMin & yearMax: 1900..2100; yearMin <= yearMax
  const rawYearMin = map.get('yearMin')?.[0];
  const rawYearMax = map.get('yearMax')?.[0];
  let yearMinNum: number | undefined;
  let yearMaxNum: number | undefined;

  if (rawYearMin && /^\d{4}$/.test(rawYearMin)) {
    const parsed = Number(rawYearMin);
    if (Number.isInteger(parsed) && parsed >= YEAR_MIN_BOUND && parsed <= YEAR_MAX_BOUND) {
      yearMinNum = parsed;
    }
  }
  if (rawYearMax && /^\d{4}$/.test(rawYearMax)) {
    const parsed = Number(rawYearMax);
    if (Number.isInteger(parsed) && parsed >= YEAR_MIN_BOUND && parsed <= YEAR_MAX_BOUND) {
      yearMaxNum = parsed;
    }
  }

  if (yearMinNum !== undefined && yearMaxNum !== undefined) {
    if (yearMinNum <= yearMaxNum) {
      out.yearMin = yearMinNum;
      out.yearMax = yearMaxNum;
    } else {
      // Drop invalid upper bound
      out.yearMin = yearMinNum;
    }
  } else if (yearMinNum !== undefined) {
    out.yearMin = yearMinNum;
  } else if (yearMaxNum !== undefined) {
    out.yearMax = yearMaxNum;
  }

  // priceMin & priceMax: safe non-negative integer cents; priceMin <= priceMax
  const rawPriceMin = map.get('priceMin')?.[0];
  const rawPriceMax = map.get('priceMax')?.[0];
  let priceMinNum: number | undefined;
  let priceMaxNum: number | undefined;

  if (rawPriceMin && /^\d+$/.test(rawPriceMin)) {
    const parsed = Number(rawPriceMin);
    if (Number.isSafeInteger(parsed) && parsed >= 0) {
      priceMinNum = parsed;
    }
  }
  if (rawPriceMax && /^\d+$/.test(rawPriceMax)) {
    const parsed = Number(rawPriceMax);
    if (Number.isSafeInteger(parsed) && parsed >= 0) {
      priceMaxNum = parsed;
    }
  }

  if (priceMinNum !== undefined && priceMaxNum !== undefined) {
    if (priceMinNum <= priceMaxNum) {
      out.priceMin = priceMinNum;
      out.priceMax = priceMaxNum;
    } else {
      // Drop invalid upper bound
      out.priceMin = priceMinNum;
    }
  } else if (priceMinNum !== undefined) {
    out.priceMin = priceMinNum;
  } else if (priceMaxNum !== undefined) {
    out.priceMax = priceMaxNum;
  }

  // mileageMax: non-negative integer
  const rawMileageMax = map.get('mileageMax')?.[0];
  if (rawMileageMax && /^\d+$/.test(rawMileageMax)) {
    const parsed = Number(rawMileageMax);
    if (Number.isSafeInteger(parsed) && parsed >= 0) {
      out.mileageMax = parsed;
    }
  }

  // cityId & areaId: positive integers; areaId requires cityId
  const rawCityId = map.get('cityId')?.[0];
  const rawAreaId = map.get('areaId')?.[0];
  if (rawCityId && /^[1-9]\d*$/.test(rawCityId)) {
    const parsedCity = Number(rawCityId);
    if (Number.isSafeInteger(parsedCity) && parsedCity > 0) {
      out.cityId = parsedCity;
      if (rawAreaId && /^[1-9]\d*$/.test(rawAreaId)) {
        const parsedArea = Number(rawAreaId);
        if (Number.isSafeInteger(parsedArea) && parsedArea > 0) {
          out.areaId = parsedArea;
        }
      }
    }
  }

  // Taxonomy Enums
  const rawFuelType = map.get('fuelType')?.[0];
  if (rawFuelType && (ALLOWED_FUEL_TYPES as readonly string[]).includes(rawFuelType)) {
    out.fuelType = rawFuelType as FuelType;
  }

  const rawTransmission = map.get('transmission')?.[0];
  if (rawTransmission && (ALLOWED_TRANSMISSIONS as readonly string[]).includes(rawTransmission)) {
    out.transmission = rawTransmission as Transmission;
  }

  const rawBodyType = map.get('bodyType')?.[0];
  if (rawBodyType && (ALLOWED_BODY_TYPES as readonly string[]).includes(rawBodyType)) {
    out.bodyType = rawBodyType as BodyType;
  }

  const rawVehicleType = map.get('vehicleType')?.[0];
  if (rawVehicleType && (ALLOWED_VEHICLE_TYPES as readonly string[]).includes(rawVehicleType)) {
    out.vehicleType = rawVehicleType as VehicleType;
  }

  const rawSellerType = map.get('sellerType')?.[0];
  if (rawSellerType && (ALLOWED_SELLER_TYPES as readonly string[]).includes(rawSellerType)) {
    out.sellerType = rawSellerType as SellerType;
  }

  // Booleans: literal true or false only (omit for any)
  for (const boolKey of ALLOWED_BOOLEAN_FILTER_KEYS) {
    const val = map.get(boolKey)?.[0];
    if (val === 'true') {
      out[boolKey] = true;
    } else if (val === 'false') {
      out[boolKey] = false;
    }
  }

  // Sort
  const rawSort = map.get('sort')?.[0];
  if (rawSort && (ALLOWED_SORTS as readonly string[]).includes(rawSort)) {
    out.sort = rawSort as ListingSort;
  }

  // Page: positive integer
  const rawPage = map.get('page')?.[0];
  if (rawPage && /^[1-9]\d*$/.test(rawPage)) {
    const pageNum = Number(rawPage);
    if (Number.isSafeInteger(pageNum) && pageNum > 0 && pageNum <= 10000) {
      out.page = pageNum;
    }
  }

  // Limit: 12 | 20 | 24 | 40
  const rawLimit = map.get('limit')?.[0];
  if (rawLimit && /^\d+$/.test(rawLimit)) {
    const limitNum = Number(rawLimit);
    if ((ALLOWED_LIMITS as readonly number[]).includes(limitNum)) {
      out.limit = limitNum as AllowedLimit;
    }
  }

  // Panel & filter: UI overlay state
  const rawPanel = map.get('panel')?.[0];
  if (rawPanel && (ALLOWED_PANELS as readonly string[]).includes(rawPanel)) {
    out.panel = rawPanel as AllowedPanel;
    const rawFilter = map.get('filter')?.[0];
    if (rawFilter && out.panel === 'filters') {
      out.filter = rawFilter.trim();
    }
  }

  // Count only
  const rawCountOnly = map.get('countOnly')?.[0];
  if (rawCountOnly === 'true') {
    out.countOnly = true;
  }

  // Cursor: optional pagination token
  const rawCursor = map.get('cursor')?.[0];
  if (rawCursor && rawCursor.length >= 1) {
    out.cursor = rawCursor;
  }

  return out;
}

/**
 * Normalizes search parameters to their canonical URL representation:
 * - Omit default page (page=1)
 * - Omit default limit (limit=20)
 * - Omit default sort (sort=newest)
 * - Omit cursor from search page URL
 * - Omit undefined, null, or empty string values
 * - Enforce cross-field constraints
 */
export function canonicalizeSearchParams(input: unknown): ParsedSearchParams {
  const parsed = parseSearchParams(input);
  const canonical: ParsedSearchParams = {};

  if (parsed.q) canonical.q = parsed.q;
  if (parsed.makeSlug) canonical.makeSlug = parsed.makeSlug;
  if (parsed.modelSlug && parsed.makeSlug) canonical.modelSlug = parsed.modelSlug;
  if (parsed.condition) canonical.condition = parsed.condition;
  if (parsed.yearMin !== undefined) canonical.yearMin = parsed.yearMin;
  if (parsed.yearMax !== undefined) canonical.yearMax = parsed.yearMax;
  if (parsed.priceMin !== undefined) canonical.priceMin = parsed.priceMin;
  if (parsed.priceMax !== undefined) canonical.priceMax = parsed.priceMax;
  if (parsed.mileageMax !== undefined) canonical.mileageMax = parsed.mileageMax;
  if (parsed.cityId !== undefined) canonical.cityId = parsed.cityId;
  if (parsed.areaId !== undefined && parsed.cityId !== undefined) canonical.areaId = parsed.areaId;
  if (parsed.fuelType) canonical.fuelType = parsed.fuelType;
  if (parsed.transmission) canonical.transmission = parsed.transmission;
  if (parsed.bodyType) canonical.bodyType = parsed.bodyType;
  if (parsed.sellerType) canonical.sellerType = parsed.sellerType;
  if (parsed.vehicleType) canonical.vehicleType = parsed.vehicleType;

  for (const boolKey of ALLOWED_BOOLEAN_FILTER_KEYS) {
    if (parsed[boolKey] !== undefined) {
      canonical[boolKey] = parsed[boolKey];
    }
  }

  // sort: omit newest from canonical URLs
  if (parsed.sort && parsed.sort !== DEFAULT_SORT) {
    canonical.sort = parsed.sort;
  }

  // page: omit page=1 from canonical URLs
  if (parsed.page && parsed.page !== DEFAULT_PAGE) {
    canonical.page = parsed.page;
  }

  // limit: omit limit=20 from canonical URLs
  if (parsed.limit && parsed.limit !== DEFAULT_LIMIT) {
    canonical.limit = parsed.limit;
  }

  // panel & filter: UI overlay state
  if (parsed.panel) {
    canonical.panel = parsed.panel;
    if (parsed.filter && parsed.panel === 'filters') {
      canonical.filter = parsed.filter;
    }
  }

  if (parsed.countOnly) {
    canonical.countOnly = true;
  }

  return canonical;
}

/**
 * Serializes search parameters into a stable, deterministic, alphabetically sorted query string.
 * Omits defaults, empty values, and leading '?'.
 */
export function serializeSearchParams(input: unknown): string {
  const canonical = canonicalizeSearchParams(input);
  const keys = Object.keys(canonical).sort() as (keyof ParsedSearchParams)[];
  const pairs: string[] = [];

  for (const key of keys) {
    const value = canonical[key];
    if (value === undefined || value === null) continue;

    const encodedKey = encodeURIComponent(key);
    let encodedVal: string;

    if (typeof value === 'boolean') {
      encodedVal = value ? 'true' : 'false';
    } else if (typeof value === 'number') {
      encodedVal = String(value);
    } else {
      encodedVal = encodeURIComponent(String(value));
    }

    pairs.push(`${encodedKey}=${encodedVal}`);
  }

  return pairs.join('&');
}

/**
 * Maps search parameters to the backend Fastify API ListingSearchParams format.
 * Automatically injects default sort ('newest'), default page (1), and default limit (20),
 * strips UI overlay states (panel, filter), and validates via ListingSearchParamsSchema.
 */
export function searchParamsToApiInput(input: unknown): ListingSearchParams {
  const parsed = parseSearchParams(input);

  const apiInput: ListingSearchParams = {
    sort: parsed.sort ?? DEFAULT_SORT,
    page: parsed.page ?? DEFAULT_PAGE,
    limit: parsed.limit ?? DEFAULT_LIMIT,
  };

  if (parsed.q) apiInput.q = parsed.q;
  if (parsed.makeSlug) apiInput.makeSlug = parsed.makeSlug;
  if (parsed.modelSlug && parsed.makeSlug) apiInput.modelSlug = parsed.modelSlug;
  if (parsed.condition) apiInput.condition = parsed.condition;
  if (parsed.yearMin !== undefined) apiInput.yearMin = parsed.yearMin;
  if (parsed.yearMax !== undefined) apiInput.yearMax = parsed.yearMax;
  if (parsed.priceMin !== undefined) apiInput.priceMin = parsed.priceMin;
  if (parsed.priceMax !== undefined) apiInput.priceMax = parsed.priceMax;
  if (parsed.mileageMax !== undefined) apiInput.mileageMax = parsed.mileageMax;
  if (parsed.cityId !== undefined) apiInput.cityId = parsed.cityId;
  if (parsed.areaId !== undefined && parsed.cityId !== undefined) apiInput.areaId = parsed.areaId;
  if (parsed.fuelType) apiInput.fuelType = parsed.fuelType;
  if (parsed.transmission) apiInput.transmission = parsed.transmission;
  if (parsed.bodyType) apiInput.bodyType = parsed.bodyType;
  if (parsed.sellerType) apiInput.sellerType = parsed.sellerType;
  if (parsed.vehicleType) apiInput.vehicleType = parsed.vehicleType;

  for (const boolKey of ALLOWED_BOOLEAN_FILTER_KEYS) {
    if (parsed[boolKey] !== undefined) {
      apiInput[boolKey] = parsed[boolKey];
    }
  }

  if (parsed.countOnly !== undefined) {
    apiInput.countOnly = parsed.countOnly;
  }

  return ListingSearchParamsSchema.parse(apiInput);
}

/**
 * Applies changes to current search parameters while strictly enforcing:
 * 1. Resetting page and clearing cursor when any filter, query, or sort changes.
 * 2. Clearing invalid descendants (model when make changes, area when city changes).
 * 3. Preserving page only when pagination alone is updated.
 */
export function applyFilterChange(
  current: unknown,
  changes: Partial<ParsedSearchParams>
): ParsedSearchParams {
  const base = parseSearchParams(current);
  const next: ParsedSearchParams = { ...base };

  let filterChanged = false;

  for (const [key, value] of Object.entries(changes)) {
    const k = key as keyof ParsedSearchParams;

    // Check if the value actually changed
    if (next[k] !== value) {
      if (k !== 'page' && k !== 'panel' && k !== 'filter') {
        filterChanged = true;
      }
      if (value === undefined || value === null) {
        delete next[k];
      } else {
        (next as Record<string, unknown>)[k] = value;
      }
    }
  }

  // If make changed, clear dependent model
  if ('makeSlug' in changes && changes.makeSlug !== base.makeSlug) {
    delete next.modelSlug;
  }

  // If city changed, clear dependent area
  if ('cityId' in changes && changes.cityId !== base.cityId) {
    delete next.areaId;
  }

  // Any explicit filter, query, or sort change resets page to 1 and clears cursor
  if (filterChanged) {
    delete next.page;
    delete next.cursor;
  }

  return canonicalizeSearchParams(next);
}

/**
 * Builds a complete localized search URL given a base pathname and search parameters.
 */
export function buildSearchUrl(pathname: string, params: unknown): string {
  const queryStr = serializeSearchParams(params);
  if (!queryStr) return pathname;
  return `${pathname}?${queryStr}`;
}
