/**
 * Canonical Search URL Defaults and Allowlist Constants.
 *
 * Implements Phase 1 Section 2.6 and Phase 2 Section 2.4:
 * - Deterministic defaults for marketplace discovery (page 1, limit 20, sort newest).
 * - Fixed allowlists for limits, sorts, conditions, enums, and UI panels.
 * - Integer boundaries for model years and query length limits.
 */

import type {
  BodyType,
  FuelType,
  ListingSort,
  SellerType,
  Transmission,
  VehicleType,
} from '@/types/listing';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const DEFAULT_SORT: ListingSort = 'newest';

export const ALLOWED_LIMITS = [12, 20, 24, 40] as const;
export type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

export const ALLOWED_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'mileage_asc',
  'year_desc',
  'most_viewed',
] as const;

export const ALLOWED_CONDITIONS = ['NEW', 'USED'] as const;

export const ALLOWED_FUEL_TYPES: readonly FuelType[] = [
  'PETROL',
  'DIESEL',
  'HYBRID',
  'ELECTRIC',
  'GAS',
] as const;

export const ALLOWED_TRANSMISSIONS: readonly Transmission[] = [
  'MANUAL',
  'AUTOMATIC',
  'CVT',
  'DCT',
] as const;

export const ALLOWED_BODY_TYPES: readonly BodyType[] = [
  'SEDAN',
  'HATCHBACK',
  'SUV',
  'CROSSOVER',
  'COUPE',
  'PICKUP',
  'VAN',
  'MINIVAN',
  'CONVERTIBLE',
  'WAGON',
] as const;

export const ALLOWED_VEHICLE_TYPES: readonly VehicleType[] = [
  'CAR',
  'MOTORCYCLE',
  'TRUCK',
  'VAN',
] as const;

export const ALLOWED_SELLER_TYPES: readonly SellerType[] = [
  'PRIVATE',
  'DEALER',
] as const;

export const ALLOWED_BOOLEAN_FILTER_KEYS = [
  'hasWarranty',
  'isNegotiable',
  'installmentAvailable',
  'exchangeAccepted',
  'isVerified',
] as const;

export const ALLOWED_PANELS = [
  'filters',
  'sort',
  'save-search',
  'contact',
  'report',
  'photos',
  'specs',
  'promote',
  'edit-price',
  'delete',
] as const;
export type AllowedPanel = (typeof ALLOWED_PANELS)[number];

export const YEAR_MIN_BOUND = 1900;
export const YEAR_MAX_BOUND = 2100;

export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 120;

/**
 * All allowed search parameter keys matching Phase 1 Section 2.6.
 * Any key outside this allowlist is stripped during canonicalization.
 */
export const ALLOWED_SEARCH_PARAM_KEYS = new Set<string>([
  'q',
  'makeSlug',
  'modelSlug',
  'condition',
  'yearMin',
  'yearMax',
  'priceMin',
  'priceMax',
  'mileageMax',
  'cityId',
  'areaId',
  'fuelType',
  'transmission',
  'bodyType',
  'vehicleType',
  'sellerType',
  'hasWarranty',
  'isNegotiable',
  'installmentAvailable',
  'exchangeAccepted',
  'isVerified',
  'sort',
  'page',
  'limit',
  'panel',
  'filter',
  'countOnly',
]);
