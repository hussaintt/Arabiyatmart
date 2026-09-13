/**
 * Bounded Cache Tag Definitions and Constructors for Next.js Data Cache.
 *
 * Implements Phase 1 Section 4.3 and Phase 2 Sections 3.1-3.6:
 * - Constants for all Phase 2 static cache tags.
 * - Strict, bounded tag constructors that validate slugs, public IDs, and parameters before interpolation.
 * - Prevention of arbitrary/unbounded user text from entering cache tags.
 */

import { z } from 'zod';
import { PublicIdSchema, SlugSchema } from '@/lib/api/schemas/common';

/**
 * Static cache tags representing domain entity boundaries.
 */
export const CACHE_TAGS = {
  HOME: 'home',
  BANNERS: 'banners',
  PUBLIC_SETTINGS: 'settings:public',
  CATALOGUE_SPOTLIGHT: 'catalogue:spotlight',
  LISTINGS: 'listings',
  SEARCH: 'search',
  DEALERS: 'dealers',
  TAXONOMY: 'taxonomy',
  TAXONOMY_MAKES: 'taxonomy:makes',
  TAXONOMY_TRIMS: 'taxonomy:trims',
  LOCATIONS_COUNTRIES: 'locations:countries',
  PROMOTIONS_PACKAGES: 'promotions:packages',
} as const;

export type StaticCacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Tag validation schema: safe alphanumeric characters plus colon, hyphen, and underscore.
 * Maximum length 160 characters to prevent header bloat and memory denial-of-service.
 */
const TagFormatSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9_:\-]+$/, 'Tag contains invalid characters; only lowercase alphanumeric, colon, hyphen, and underscore are permitted');

/**
 * Asserts that a tag string adheres to strict character and length constraints.
 */
export function assertValidTag(tag: string): string {
  return TagFormatSchema.parse(tag);
}

/**
 * Checks whether a tag string is valid without throwing.
 */
export function isValidTag(tag: string): boolean {
  return TagFormatSchema.safeParse(tag).success;
}

// ── Bounded Parameter Tag Constructors ──────────────────────────────────────

/**
 * Bounded tag for a specific listing by its validated slug.
 */
export function listingTag(slug: string): string {
  const validSlug = SlugSchema.parse(slug);
  return assertValidTag(`listing:${validSlug}`);
}

/**
 * Bounded tag for similar listings recommendation rail of a listing.
 */
export function similarListingTag(slug: string): string {
  const validSlug = SlugSchema.parse(slug);
  return assertValidTag(`similar:${validSlug}`);
}

/**
 * Bounded tag for a dealer showroom/profile by slug.
 */
export function dealerTag(slug: string): string {
  const validSlug = SlugSchema.parse(slug);
  return assertValidTag(`dealer:${validSlug}`);
}

/**
 * Bounded tag for a dealer's inventory listing feed.
 */
export function dealerListingsTag(slug: string): string {
  const validSlug = SlugSchema.parse(slug);
  return assertValidTag(`dealer:${validSlug}:listings`);
}

/**
 * Bounded tag for a vehicle make taxonomy entry by slug.
 */
export function makeTag(makeSlug: string): string {
  const validSlug = SlugSchema.parse(makeSlug);
  return assertValidTag(`make:${validSlug}`);
}

/**
 * Bounded tag for taxonomy models belonging to a vehicle model publicId.
 */
export function taxonomyModelTag(modelPublicId: string): string {
  const validId = PublicIdSchema.parse(modelPublicId);
  return assertValidTag(`taxonomy:model:${validId}`);
}

/**
 * Bounded tag for taxonomy generations belonging to a vehicle generation publicId.
 */
export function taxonomyGenerationTag(generationPublicId: string): string {
  const validId = PublicIdSchema.parse(generationPublicId);
  return assertValidTag(`taxonomy:generation:${validId}`);
}

/**
 * Bounded tag for taxonomy trims belonging to a vehicle trim publicId.
 */
export function taxonomyTrimTag(trimPublicId: string): string {
  const validId = PublicIdSchema.parse(trimPublicId);
  return assertValidTag(`taxonomy:trim:${validId}`);
}

/**
 * Bounded tag for a catalogue model page.
 */
export function catalogueModelTag(modelPublicId: string): string {
  const validId = PublicIdSchema.parse(modelPublicId);
  return assertValidTag(`model:${validId}`);
}

/**
 * Bounded tag for a catalogue trim detail page.
 */
export function catalogueTrimTag(trimPublicId: string): string {
  const validId = PublicIdSchema.parse(trimPublicId);
  return assertValidTag(`trim:${validId}`);
}

/**
 * Bounded tag for dealers offering a specific trim.
 */
export function catalogueTrimDealersTag(trimPublicId: string): string {
  const validId = PublicIdSchema.parse(trimPublicId);
  return assertValidTag(`catalogue:trim:${validId}:dealers`);
}

/**
 * Bounded tag for dealers offering a specific make.
 */
export function catalogueMakeDealersTag(makeSlug: string): string {
  const validSlug = SlugSchema.parse(makeSlug);
  return assertValidTag(`catalogue:make:${validSlug}:dealers`);
}

/**
 * Bounded tag for a country and its cities.
 */
export function countryLocationsTag(code: string): string {
  const validCode = z.string().trim().length(2).toUpperCase().parse(code).toLowerCase();
  return assertValidTag(`locations:country:${validCode}`);
}

const ExactPositiveIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, 'City ID string must be an exact positive integer without letters, symbols, or decimals');

const CityIdSchema = z.union([
  z.number().int().positive('City ID must be a positive integer'),
  ExactPositiveIntegerStringSchema.transform((val) => Number(val)),
]);

/**
 * Bounded tag for areas within a specific city.
 * Strictly requires an exact positive integer number or string.
 */
export function cityAreasTag(cityId: number | string): string {
  const validId = CityIdSchema.parse(cityId);
  return assertValidTag(`locations:city:${validId}`);
}

/**
 * Bounded tag for upload processing status.
 */
export function fileStatusTag(publicId: string): string {
  const validId = PublicIdSchema.parse(publicId);
  return assertValidTag(`file:${validId}:status`);
}
