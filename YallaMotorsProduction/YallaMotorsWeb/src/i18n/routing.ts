import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter, getPathname, permanentRedirect } =
  createNavigation(routing);

// ── Route Definitions & Canonical Parameter Sets ─────────────────────────────

export const LISTING_SEARCH_QUERY_PARAMS = [
  "makeSlug",
  "modelSlug",
  "condition",
  "yearMin",
  "yearMax",
  "priceMin",
  "priceMax",
  "mileageMax",
  "cityId",
  "areaId",
  "fuelType",
  "transmission",
  "bodyType",
  "vehicleType",
  "sellerType",
  "hasWarranty",
  "isNegotiable",
  "installmentAvailable",
  "exchangeAccepted",
  "isVerified",
  "sort",
  "page",
  "limit",
  "q",
  "panel",
  "filter",
] as const;

export type ListingSearchQueryParam = (typeof LISTING_SEARCH_QUERY_PARAMS)[number];

export const ALLOWED_QUERY_PARAMS = [
  ...LISTING_SEARCH_QUERY_PARAMS,
  "cursor",
  "status",
  "range",
  "step",
  "returnTo",
  "item",
  "unreadOnly",
  "vendor",
] as const;

export type AllowedQueryParam = (typeof ALLOWED_QUERY_PARAMS)[number];

const ALLOWED_QUERY_SET: ReadonlySet<string> = new Set(ALLOWED_QUERY_PARAMS);

export function isAllowedQueryParam(key: string): key is AllowedQueryParam {
  return ALLOWED_QUERY_SET.has(key);
}

export type RouteKey =
  | "home"
  | "search"
  | "catalogue_makes"
  | "dealers"
  | "dealer_detail"
  | "compare"
  | "me_listings"
  | "notifications"
  | "favorites"
  | "me_leads"
  | "me_dashboard"
  | "sell"
  | "auth"
  | "global";

export type RawQueryParams =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | undefined;

/**
 * Resolves a normalized pathname into its logical route key.
 */
export function resolveRouteKey(pathname: string): RouteKey {
  const normalized =
    pathname
      .trim()
      .replace(/^\/(ar|en)($|\/)/, "/")
      .replace(/\/+$/, "") || "/";

  if (normalized === "/") return "home";
  if (normalized === "/search") return "search";
  if (normalized === "/compare") return "compare";
  if (normalized === "/notifications") return "notifications";
  if (normalized === "/favorites") return "favorites";
  if (normalized === "/me/listings") return "me_listings";
  if (normalized === "/me/leads") return "me_leads";
  if (normalized === "/me/dashboard") return "me_dashboard";
  if (normalized === "/sell") return "sell";
  if (normalized === "/dealers") return "dealers";
  if (normalized.startsWith("/dealers/")) return "dealer_detail";
  if (
    normalized === "/catalogue/makes" ||
    normalized.startsWith("/catalogue/makes/")
  ) {
    return "catalogue_makes";
  }
  if (
    normalized === "/login" ||
    normalized === "/register" ||
    normalized === "/forgot-password" ||
    normalized === "/reset-password" ||
    normalized === "/verify-email" ||
    normalized.startsWith("/auth/")
  ) {
    return "auth";
  }

  return "global";
}

// ── Auth returnTo Sanitization ──────────────────────────────────────────────

const AUTH_PATHS: readonly string[] = [
  "/ar/login",
  "/ar/register",
  "/ar/forgot-password",
  "/ar/reset-password",
  "/ar/verify-email",
  "/ar/auth",
  "/en/login",
  "/en/register",
  "/en/forgot-password",
  "/en/reset-password",
  "/en/verify-email",
  "/en/auth",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth",
  "/api/auth",
];

/**
 * Validates that an auth returnTo parameter is a safe, same-origin,
 * relative, localized application path.
 * Strips auth endpoints, URI schemes, protocol-relative paths, and control characters.
 */
export function isSafeReturnTo(returnTo: unknown): boolean {
  if (typeof returnTo !== "string") return false;
  const trimmed = returnTo.trim();
  if (!trimmed) return false;

  // Reject ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;

  // Reject backslashes and protocol-relative prefixes
  if (trimmed.includes("\\") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Must start with exactly one forward slash
  if (!trimmed.startsWith("/")) return false;

  // Reject URI schemes (e.g. http:, https:, javascript:, data:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;

  // Decode URI encoding to catch obfuscated bypasses
  try {
    const decoded = decodeURIComponent(trimmed);
    if (/[\x00-\x1F\x7F]/.test(decoded)) return false;
    if (decoded.includes("\\") || decoded.startsWith("//") || decoded.startsWith("/\\")) {
      return false;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) return false;
  } catch {
    return false;
  }

  // Must be localized: /ar or /en prefix (or exact /ar, /en)
  const isLocalized = /^\/(ar|en)($|\/|\?)/.test(trimmed);
  if (!isLocalized) return false;

  // Strip/reject auth endpoints to prevent loops
  const pathWithoutQuery = trimmed.split("?")[0]!.toLowerCase();
  for (const authPath of AUTH_PATHS) {
    if (pathWithoutQuery === authPath || pathWithoutQuery.startsWith(authPath + "/")) {
      return false;
    }
  }

  return true;
}

export function sanitizeReturnTo(returnTo: unknown): string | undefined {
  if (isSafeReturnTo(returnTo)) {
    return (returnTo as string).trim();
  }
  return undefined;
}

// ── Raw Query Param Normalization ───────────────────────────────────────────

function extractRawParamMap(raw: RawQueryParams): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!raw) return result;

  if (raw instanceof URLSearchParams) {
    for (const key of raw.keys()) {
      const all = raw
        .getAll(key)
        .map((v) => v.trim())
        .filter((v) => v !== "");
      if (all.length > 0) {
        result.set(key, all);
      }
    }
    return result;
  }

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "") {
        result.set(key, [trimmed]);
      }
    } else if (Array.isArray(value)) {
      const valid = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item !== "");
      if (valid.length > 0) {
        result.set(key, valid);
      }
    }
  }

  return result;
}

function singleOrArray(values: string[]): string | string[] {
  return values.length === 1 ? values[0]! : values;
}

// ── Target Route Filter Implementations ──────────────────────────────────────

// ── Target Route Filter Implementations ──────────────────────────────────────

export const VALID_CONDITIONS = new Set(["NEW", "USED"]);

export const VALID_FUEL_TYPES = new Set([
  "PETROL",
  "DIESEL",
  "HYBRID",
  "ELECTRIC",
  "GAS",
]);

export const VALID_TRANSMISSIONS = new Set([
  "MANUAL",
  "AUTOMATIC",
  "CVT",
  "DCT",
]);

export const VALID_BODY_TYPES = new Set([
  "SEDAN",
  "HATCHBACK",
  "SUV",
  "CROSSOVER",
  "COUPE",
  "PICKUP",
  "VAN",
  "MINIVAN",
  "CONVERTIBLE",
  "WAGON",
]);

export const VALID_VEHICLE_TYPES = new Set([
  "CAR",
  "MOTORCYCLE",
  "TRUCK",
  "VAN",
]);

export const VALID_SELLER_TYPES = new Set(["PRIVATE", "DEALER"]);

export const VALID_LISTING_SORTS = new Set([
  "newest",
  "price_asc",
  "price_desc",
  "mileage_asc",
  "year_desc",
  "most_viewed",
]);

export const VALID_DEALER_INVENTORY_SORTS = new Set([
  "newest",
  "price_asc",
  "price_desc",
]);

export const VALID_BOOLEANS = new Set(["true", "false"]);

export const VALID_PANELS = new Set([
  "filters",
  "sort",
  "save-search",
  "contact",
  "report",
  "photos",
  "specs",
  "promote",
  "edit-price",
  "delete",
]);

export const VALID_LEAD_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "WON",
  "LOST",
  "SPAM",
]);

/**
 * Validates a slug against Phase 2 SlugSchema (lowercase letters, digits, hyphen separators, 1-160 chars).
 */
export function isValidSlug(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  return trimmed.length >= 1 && trimmed.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed);
}

/**
 * Route limit filter for listing search, dealers, and dealer inventory.
 * Contract: 12 | 20 | 24 | 40. Default 20 is omitted from canonical URLs.
 */
export function filterMarketplaceLimit(limitStr: string | undefined): string | undefined {
  if (!limitStr) return undefined;
  if (limitStr === "20") return undefined; // omit canonical default
  if (limitStr === "12" || limitStr === "24" || limitStr === "40") {
    return limitStr;
  }
  return undefined; // reject arbitrary positive limits
}

/**
 * Route limit filter for notifications matching Phase 2 NotificationListParamsSchema (limit: 20 | 40 | 80).
 * Canonical default 20 is omitted from URLs.
 * Rejects 12, 24, and arbitrary values.
 */
export function filterNotificationsLimit(limitStr: string | undefined): string | undefined {
  if (!limitStr) return undefined;
  if (limitStr === "20") return undefined; // omit canonical default
  if (limitStr === "40" || limitStr === "80") {
    return limitStr;
  }
  return undefined; // reject 12, 24, and arbitrary values
}

/**
 * Route limit filter for favorites and me/listings.
 * Contract: 20 | 50 | 100. Default 20 is omitted from canonical URLs.
 */
export function filterAccountLimit(limitStr: string | undefined): string | undefined {
  if (!limitStr) return undefined;
  if (limitStr === "20") return undefined; // omit canonical default
  if (limitStr === "50" || limitStr === "100") {
    return limitStr;
  }
  return undefined; // reject arbitrary positive limits
}

/**
 * Validates integer year within bounds 1900..2100.
 */
export function parseAndValidateYear(val: string | undefined): number | undefined {
  if (!val || !/^\d{4}$/.test(val)) return undefined;
  const num = Number(val);
  if (Number.isInteger(num) && num >= 1900 && num <= 2100) {
    return num;
  }
  return undefined;
}

/**
 * Validates non-negative safe integer money cents adhering to Phase 2 MoneyCentsSchema
 * (z.number().int().safe().nonnegative()).
 * Rejects values > Number.MAX_SAFE_INTEGER (e.g. 9007199254740992), negative, non-integer, or non-digit strings.
 */
export function parseAndValidateSafeMoneyCents(val: string | undefined): number | undefined {
  if (!val || !/^\d+$/.test(val)) return undefined;
  try {
    const bi = BigInt(val);
    if (bi < 0n || bi > BigInt(Number.MAX_SAFE_INTEGER)) {
      return undefined;
    }
    const num = Number(val);
    if (Number.isSafeInteger(num) && num >= 0) {
      return num;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Filters and validates listing search query parameters strictly conforming
 * to Phase 1 Section 2.6 Listing Search Parameters.
 * NEVER forwards returnTo, cursor, status, range, step, unreadOnly, vendor, item,
 * or unknown keys.
 */
export function filterListingSearchQueryParams(
  rawParams: RawQueryParams
): Record<string, string | string[]> {
  const map = extractRawParamMap(rawParams);
  const out: Record<string, string | string[]> = {};

  // makeSlug & modelSlug: modelSlug rejected unless a valid makeSlug is also retained
  const rawMakeSlug = map.get("makeSlug")?.[0];
  const rawModelSlug = map.get("modelSlug")?.[0];
  if (rawMakeSlug && isValidSlug(rawMakeSlug)) {
    out.makeSlug = rawMakeSlug;
    if (rawModelSlug && isValidSlug(rawModelSlug)) {
      out.modelSlug = rawModelSlug;
    }
  }

  // condition: NEW | USED only
  const condition = map.get("condition")?.[0];
  if (condition && VALID_CONDITIONS.has(condition)) {
    out.condition = condition;
  }

  // sort: omit "newest" from canonical URLs, validate others against exact allowlist
  const sort = map.get("sort")?.[0];
  if (sort && VALID_LISTING_SORTS.has(sort) && sort !== "newest") {
    out.sort = sort;
  }

  // q: trimmed 2-120 characters
  const q = map.get("q")?.[0];
  if (q && q.length >= 2 && q.length <= 120) {
    out.q = q;
  }

  // yearMin, yearMax: integer bounds 1900..2100, remove invalid upper bound if min > max
  const yearMinNum = parseAndValidateYear(map.get("yearMin")?.[0]);
  const yearMaxNum = parseAndValidateYear(map.get("yearMax")?.[0]);

  if (yearMinNum !== undefined && yearMaxNum !== undefined) {
    if (yearMinNum <= yearMaxNum) {
      out.yearMin = String(yearMinNum);
      out.yearMax = String(yearMaxNum);
    } else {
      out.yearMin = String(yearMinNum); // drop invalid upper bound
    }
  } else if (yearMinNum !== undefined) {
    out.yearMin = String(yearMinNum);
  } else if (yearMaxNum !== undefined) {
    out.yearMax = String(yearMaxNum);
  }

  // priceMin, priceMax: safe non-negative integer minor units (MoneyCentsSchema: safe nonnegative integer)
  const priceMinNum = parseAndValidateSafeMoneyCents(map.get("priceMin")?.[0]);
  const priceMaxNum = parseAndValidateSafeMoneyCents(map.get("priceMax")?.[0]);

  if (priceMinNum !== undefined && priceMaxNum !== undefined) {
    if (priceMinNum <= priceMaxNum) {
      out.priceMin = String(priceMinNum);
      out.priceMax = String(priceMaxNum);
    } else {
      out.priceMin = String(priceMinNum); // drop invalid upper bound
    }
  } else if (priceMinNum !== undefined) {
    out.priceMin = String(priceMinNum);
  } else if (priceMaxNum !== undefined) {
    out.priceMax = String(priceMaxNum);
  }

  // mileageMax: non-negative integer
  const mileageMaxStr = map.get("mileageMax")?.[0];
  if (mileageMaxStr && /^\d+$/.test(mileageMaxStr)) {
    out.mileageMax = mileageMaxStr;
  }

  // cityId, areaId: positive integers
  const cityIdStr = map.get("cityId")?.[0];
  if (cityIdStr && /^[1-9]\d*$/.test(cityIdStr)) {
    out.cityId = cityIdStr;
  }

  const areaIdStr = map.get("areaId")?.[0];
  if (areaIdStr && /^[1-9]\d*$/.test(areaIdStr)) {
    out.areaId = areaIdStr;
  }

  // Exact backend enums only (no regex fallback)
  const fuelType = map.get("fuelType")?.[0];
  if (fuelType && VALID_FUEL_TYPES.has(fuelType)) {
    out.fuelType = fuelType;
  }

  const transmission = map.get("transmission")?.[0];
  if (transmission && VALID_TRANSMISSIONS.has(transmission)) {
    out.transmission = transmission;
  }

  const bodyType = map.get("bodyType")?.[0];
  if (bodyType && VALID_BODY_TYPES.has(bodyType)) {
    out.bodyType = bodyType;
  }

  const vehicleType = map.get("vehicleType")?.[0];
  if (vehicleType && VALID_VEHICLE_TYPES.has(vehicleType)) {
    out.vehicleType = vehicleType;
  }

  const sellerType = map.get("sellerType")?.[0];
  if (sellerType && VALID_SELLER_TYPES.has(sellerType)) {
    out.sellerType = sellerType;
  }

  // Booleans: literal true or false only
  for (const boolKey of [
    "hasWarranty",
    "isNegotiable",
    "installmentAvailable",
    "exchangeAccepted",
    "isVerified",
  ] as const) {
    const val = map.get(boolKey)?.[0];
    if (val && VALID_BOOLEANS.has(val)) {
      out[boolKey] = val;
    }
  }

  // page: positive integer, default 1 and omit from canonical page-one URL
  const pageStr = map.get("page")?.[0];
  if (pageStr && /^[1-9]\d*$/.test(pageStr) && pageStr !== "1") {
    out.page = pageStr;
  }

  // limit: 12 | 20 | 24 | 40 (omit default 20, reject arbitrary limits)
  const limit = filterMarketplaceLimit(map.get("limit")?.[0]);
  if (limit) {
    out.limit = limit;
  }

  // panel, filter
  const panel = map.get("panel")?.[0];
  if (panel && VALID_PANELS.has(panel)) {
    out.panel = panel;
    const filter = map.get("filter")?.[0];
    if (filter) out.filter = filter;
  }

  return out;
}

/**
 * Filters and validates dealer inventory query parameters matching
 * Phase 2 DealerInventoryParamsSchema exactly.
 * NEVER forwards q, areaId, sellerType, isVerified, isNegotiable, exchangeAccepted,
 * page, panel, filter, or unsupported sorts.
 */
export function filterDealerInventoryQueryParams(
  rawParams: RawQueryParams
): Record<string, string | string[]> {
  const map = extractRawParamMap(rawParams);
  const out: Record<string, string | string[]> = {};

  // cursor: opaque string, min length 1
  const cursor = map.get("cursor")?.[0];
  if (cursor && cursor.length >= 1) {
    out.cursor = cursor;
  }

  // limit: 12 | 20 | 24 | 40 (omit default 20)
  const limit = filterMarketplaceLimit(map.get("limit")?.[0]);
  if (limit) {
    out.limit = limit;
  }

  // makeSlug & modelSlug: modelSlug requires makeSlug
  const rawMakeSlug = map.get("makeSlug")?.[0];
  const rawModelSlug = map.get("modelSlug")?.[0];
  if (rawMakeSlug && isValidSlug(rawMakeSlug)) {
    out.makeSlug = rawMakeSlug;
    if (rawModelSlug && isValidSlug(rawModelSlug)) {
      out.modelSlug = rawModelSlug;
    }
  }

  // yearMin, yearMax: 1900..2100, remove invalid upper bound if min > max
  const yearMinNum = parseAndValidateYear(map.get("yearMin")?.[0]);
  const yearMaxNum = parseAndValidateYear(map.get("yearMax")?.[0]);

  if (yearMinNum !== undefined && yearMaxNum !== undefined) {
    if (yearMinNum <= yearMaxNum) {
      out.yearMin = String(yearMinNum);
      out.yearMax = String(yearMaxNum);
    } else {
      out.yearMin = String(yearMinNum); // drop invalid upper bound
    }
  } else if (yearMinNum !== undefined) {
    out.yearMin = String(yearMinNum);
  } else if (yearMaxNum !== undefined) {
    out.yearMax = String(yearMaxNum);
  }

  // priceMin, priceMax: safe non-negative integer minor units (MoneyCentsSchema: safe nonnegative integer)
  const priceMinNum = parseAndValidateSafeMoneyCents(map.get("priceMin")?.[0]);
  const priceMaxNum = parseAndValidateSafeMoneyCents(map.get("priceMax")?.[0]);

  if (priceMinNum !== undefined && priceMaxNum !== undefined) {
    if (priceMinNum <= priceMaxNum) {
      out.priceMin = String(priceMinNum);
      out.priceMax = String(priceMaxNum);
    } else {
      out.priceMin = String(priceMinNum); // drop invalid upper bound
    }
  } else if (priceMinNum !== undefined) {
    out.priceMin = String(priceMinNum);
  } else if (priceMaxNum !== undefined) {
    out.priceMax = String(priceMaxNum);
  }

  // mileageMax: non-negative integer
  const mileageMaxStr = map.get("mileageMax")?.[0];
  if (mileageMaxStr && /^\d+$/.test(mileageMaxStr)) {
    out.mileageMax = mileageMaxStr;
  }

  // cityId: positive integer
  const cityIdStr = map.get("cityId")?.[0];
  if (cityIdStr && /^[1-9]\d*$/.test(cityIdStr)) {
    out.cityId = cityIdStr;
  }

  // condition: NEW | USED only
  const condition = map.get("condition")?.[0];
  if (condition && VALID_CONDITIONS.has(condition)) {
    out.condition = condition;
  }

  // Exact enums only:
  const fuelType = map.get("fuelType")?.[0];
  if (fuelType && VALID_FUEL_TYPES.has(fuelType)) {
    out.fuelType = fuelType;
  }

  const transmission = map.get("transmission")?.[0];
  if (transmission && VALID_TRANSMISSIONS.has(transmission)) {
    out.transmission = transmission;
  }

  const bodyType = map.get("bodyType")?.[0];
  if (bodyType && VALID_BODY_TYPES.has(bodyType)) {
    out.bodyType = bodyType;
  }

  const vehicleType = map.get("vehicleType")?.[0];
  if (vehicleType && VALID_VEHICLE_TYPES.has(vehicleType)) {
    out.vehicleType = vehicleType;
  }

  // hasWarranty, installmentAvailable: boolean literals only
  const hasWarranty = map.get("hasWarranty")?.[0];
  if (hasWarranty === "true" || hasWarranty === "false") {
    out.hasWarranty = hasWarranty;
  }

  const installmentAvailable = map.get("installmentAvailable")?.[0];
  if (installmentAvailable === "true" || installmentAvailable === "false") {
    out.installmentAvailable = installmentAvailable;
  }

  // sort: newest | price_asc | price_desc only (omit default newest)
  // Unsupported sorts (mileage_asc, year_desc, most_viewed) are stripped!
  const sort = map.get("sort")?.[0];
  if (sort && VALID_DEALER_INVENTORY_SORTS.has(sort) && sort !== "newest") {
    out.sort = sort;
  }

  // Explicitly NEVER forward:
  // q, areaId, sellerType, isVerified, isNegotiable, exchangeAccepted, page, panel, filter,
  // or unsupported sorts (mileage_asc, year_desc, most_viewed).

  return out;
}

/**
 * Filters query parameters according to the specific contract of targetRoute.
 */
export function filterRouteQueryParams(
  routeOrPathname: RouteKey | string,
  rawParams: RawQueryParams
): Record<string, string | string[]> {
  const routeKey: RouteKey =
    routeOrPathname.startsWith("/") || routeOrPathname.includes("/")
      ? resolveRouteKey(routeOrPathname)
      : (routeOrPathname as RouteKey);

  const map = extractRawParamMap(rawParams);
  const out: Record<string, string | string[]> = {};

  switch (routeKey) {
    case "search":
      return filterListingSearchQueryParams(rawParams);

    case "compare": {
      // Repeated item values, maximum four, formatted as listing:<slug> or trim:<publicId>
      const rawItems = map.get("item") ?? [];
      const validItems: string[] = [];
      const seen = new Set<string>();

      for (const it of rawItems) {
        if (/^(listing:[a-zA-Z0-9_-]+|trim:[a-zA-Z0-9_-]+)$/.test(it) && !seen.has(it)) {
          seen.add(it);
          validItems.push(it);
          if (validItems.length === 4) break;
        }
      }

      if (validItems.length > 0) {
        out.item = singleOrArray(validItems);
      }
      return out;
    }

    case "notifications": {
      const cursor = map.get("cursor")?.[0];
      if (cursor && cursor.length >= 1) out.cursor = cursor;

      const limit = filterNotificationsLimit(map.get("limit")?.[0]);
      if (limit) out.limit = limit;

      const unreadOnly = map.get("unreadOnly")?.[0];
      if (unreadOnly === "true") out.unreadOnly = "true";

      return out;
    }

    case "me_dashboard": {
      const range = map.get("range")?.[0];
      if (range && ["7d", "30d", "90d"].includes(range)) {
        out.range = range;
      }

      const vendor = map.get("vendor")?.[0];
      if (vendor && /^[a-zA-Z0-9_-]+$/.test(vendor)) {
        out.vendor = vendor;
      }
      return out;
    }

    case "sell": {
      const step = map.get("step")?.[0];
      const validSteps = [
        "condition",
        "vehicle",
        "details",
        "pricing",
        "photos",
        "location",
        "review",
      ];
      if (step && validSteps.includes(step)) {
        out.step = step;
      }
      return out;
    }

    case "me_listings": {
      const status = map.get("status")?.[0];
      // Omit ALL from canonical URL
      if (status && ["ACTIVE", "DRAFT", "PENDING_REVIEW"].includes(status)) {
        out.status = status;
      }

      const cursor = map.get("cursor")?.[0];
      if (cursor && cursor.length >= 1) out.cursor = cursor;

      const limit = filterAccountLimit(map.get("limit")?.[0]);
      if (limit) out.limit = limit;

      return out;
    }

    case "dealers": {
      const cityId = map.get("cityId")?.[0];
      if (cityId && /^[1-9]\d*$/.test(cityId)) out.cityId = cityId;

      const cursor = map.get("cursor")?.[0];
      if (cursor && cursor.length >= 1) out.cursor = cursor;

      const limit = filterMarketplaceLimit(map.get("limit")?.[0]);
      if (limit) out.limit = limit;

      // Notice: q is explicitly unsupported on dealers and is discarded!
      return out;
    }

    case "dealer_detail":
      return filterDealerInventoryQueryParams(rawParams);

    case "catalogue_makes": {
      const condition = map.get("condition")?.[0];
      if (condition && VALID_CONDITIONS.has(condition)) {
        out.condition = condition;
      }
      const q = map.get("q")?.[0];
      if (q && q.length >= 1) out.q = q;
      return out;
    }

    case "auth": {
      const returnTo = map.get("returnTo")?.[0];
      const sanitized = sanitizeReturnTo(returnTo);
      if (sanitized) {
        out.returnTo = sanitized;
      }
      return out;
    }

    case "favorites": {
      const cursor = map.get("cursor")?.[0];
      if (cursor && cursor.length >= 1) out.cursor = cursor;

      const limit = filterAccountLimit(map.get("limit")?.[0]);
      if (limit) out.limit = limit;

      return out;
    }

    case "me_leads": {
      const status = map.get("status")?.[0];
      if (status && VALID_LEAD_STATUSES.has(status)) {
        out.status = status;
      }

      const cursor = map.get("cursor")?.[0];
      if (cursor && cursor.length >= 1) out.cursor = cursor;

      return out;
    }

    case "home":
    default: {
      // Home route preserves top-level discovery search filters (condition, q, make, model, panel)
      // and strictly strips route-specific keys (returnTo, cursor, status, range, step, etc.)
      const condition = map.get("condition")?.[0];
      if (condition && VALID_CONDITIONS.has(condition)) {
        out.condition = condition;
      }

      const q = map.get("q")?.[0];
      if (q && q.length >= 2 && q.length <= 120) {
        out.q = q;
      }

      const rawMakeSlug = map.get("makeSlug")?.[0];
      const rawModelSlug = map.get("modelSlug")?.[0];
      if (rawMakeSlug && isValidSlug(rawMakeSlug)) {
        out.makeSlug = rawMakeSlug;
        if (rawModelSlug && isValidSlug(rawModelSlug)) {
          out.modelSlug = rawModelSlug;
        }
      }

      const panel = map.get("panel")?.[0];
      if (panel && VALID_PANELS.has(panel)) {
        out.panel = panel;
      }

      return out;
    }
  }
}

/**
 * Filter query parameters for navigation. Defaults to current/home route preservation.
 */
export function filterAllowedQueryParams(
  searchParams?: RawQueryParams,
  targetRoute: RouteKey | string = "home"
): Record<string, string | string[]> {
  return filterRouteQueryParams(targetRoute, searchParams);
}

