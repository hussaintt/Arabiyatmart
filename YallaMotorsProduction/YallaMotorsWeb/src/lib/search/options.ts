/**
 * Dependent Option Loaders and Taxonomy Hierarchy Helpers.
 *
 * Implements Phase 1 Section 2.6 and Phase 2 Section 3.3:
 * - Dependent vehicle hierarchy: make → model → generation → trim.
 * - Dependent location hierarchy: country → city → area.
 * - AbortSignal cancellation and canonical TanStack query keys.
 * - Automatic clearing and pruning of invalid descendants when parent selections change.
 */

import { z } from 'zod';
import { BFF_ENDPOINTS } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/keys';
import { PublicIdSchema } from '@/lib/api/schemas/common';
import {
  AreaListResponseSchema,
  CityAreasParamsSchema,
  CityListResponseSchema,
  CountryCitiesParamsSchema,
  CountryListResponseSchema,
  GenerationListResponseSchema,
  MakeListResponseSchema,
  TaxonomyGenerationsParamsSchema,
  TaxonomyModelsParamsSchema,
  TaxonomyTrimsParamsSchema,
  TrimListResponseSchema,
  VehicleModelListResponseSchema,
} from '@/lib/api/schemas/taxonomy';
import type {
  Area,
  City,
  Country,
  Generation,
  Make,
  Trim,
  VehicleModel,
} from '@/types/taxonomy';
import type { ParsedSearchParams } from './params';

/**
 * Canonical TanStack query keys for discovery option loaders.
 */
export const optionQueryKeys = {
  makes: () => queryKeys.taxonomyMakes(),
  models: (makeSlug: string) => queryKeys.taxonomyModels(makeSlug),
  generations: (modelPublicId: string) => {
    const validId = PublicIdSchema.parse(modelPublicId);
    return ['taxonomy', 'model', validId, 'generations'] as const;
  },
  trims: (generationPublicId: string) => {
    const validId = PublicIdSchema.parse(generationPublicId);
    return ['taxonomy', 'generation', validId, 'trims'] as const;
  },
  countries: () => ['locations', 'countries'] as const,
  cities: (countryCode: string) => {
    const validCode = CountryCitiesParamsSchema.parse({ code: countryCode }).code.toLowerCase();
    return ['locations', 'country', validCode, 'cities'] as const;
  },
  areas: (cityId: number) => {
    const validCityId = CityAreasParamsSchema.parse({ cityId }).cityId;
    return ['locations', 'city', validCityId, 'areas'] as const;
  },
} as const;

export interface FetchOptions {
  signal?: AbortSignal | undefined;
}

async function fetchOptionEndpoint<T>(
  url: string,
  schema: z.ZodType<{ data: T }>,
  signal?: AbortSignal
): Promise<T> {
  const init: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    ...(signal ? { signal } : {}),
  };

  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Failed to load option data from "${url}": HTTP ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = schema.parse(json);
  return parsed.data;
}

// ── Vehicle Taxonomy Option Loaders ──────────────────────────────────────────

/**
 * Loads all active vehicle makes for discovery filters.
 */
export async function fetchMakes(options?: FetchOptions): Promise<Make[]> {
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.taxonomyMakes(),
    MakeListResponseSchema,
    options?.signal
  );
}

/**
 * Loads vehicle models belonging to a specific make slug.
 */
export async function fetchModels(
  makeSlug: string,
  options?: FetchOptions
): Promise<VehicleModel[]> {
  const { makeSlug: validSlug } = TaxonomyModelsParamsSchema.parse({ makeSlug });
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.taxonomyModels(validSlug),
    VehicleModelListResponseSchema,
    options?.signal
  );
}

/**
 * Loads generations belonging to a specific vehicle model public ID.
 */
export async function fetchGenerations(
  modelPublicId: string,
  options?: FetchOptions
): Promise<Generation[]> {
  const { modelPublicId: validId } = TaxonomyGenerationsParamsSchema.parse({
    modelPublicId,
  });
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.taxonomyGenerations(validId),
    GenerationListResponseSchema,
    options?.signal
  );
}

/**
 * Loads trims belonging to a specific vehicle generation public ID.
 */
export async function fetchTrims(
  generationPublicId: string,
  options?: FetchOptions
): Promise<Trim[]> {
  const { generationPublicId: validId } = TaxonomyTrimsParamsSchema.parse({
    generationPublicId,
  });
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.taxonomyTrims(validId),
    TrimListResponseSchema,
    options?.signal
  );
}

// ── Location Taxonomy Option Loaders ─────────────────────────────────────────

/**
 * Loads all active countries for marketplace location filtering.
 */
export async function fetchCountries(options?: FetchOptions): Promise<Country[]> {
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.locationsCountries(),
    CountryListResponseSchema,
    options?.signal
  );
}

/**
 * Loads cities belonging to a specific country code (e.g. "AE", "SA").
 */
export async function fetchCities(
  countryCode: string,
  options?: FetchOptions
): Promise<City[]> {
  const { code: validCode } = CountryCitiesParamsSchema.parse({ code: countryCode });
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.locationsCities(validCode),
    CityListResponseSchema,
    options?.signal
  );
}

/**
 * Loads areas belonging to a specific city ID.
 */
export async function fetchAreas(
  cityId: number,
  options?: FetchOptions
): Promise<Area[]> {
  const { cityId: validCityId } = CityAreasParamsSchema.parse({ cityId });
  return fetchOptionEndpoint(
    BFF_ENDPOINTS.locationsAreas(validCityId),
    AreaListResponseSchema,
    options?.signal
  );
}

// ── Descendant Clearing & Validation Helpers ─────────────────────────────────

/**
 * Clears descendant vehicle parameters when an ancestor selection changes:
 * - When make changes: clear modelSlug, generationPublicId, trimPublicId.
 * - When model changes: clear generationPublicId, trimPublicId.
 * - When generation changes: clear trimPublicId.
 */
export function clearVehicleDescendants<T extends Record<string, unknown>>(
  params: T,
  changedLevel: 'make' | 'model' | 'generation'
): T {
  const next = { ...params };

  if (changedLevel === 'make') {
    delete next['modelSlug'];
    delete next['generationPublicId'];
    delete next['trimPublicId'];
  } else if (changedLevel === 'model') {
    delete next['generationPublicId'];
    delete next['trimPublicId'];
  } else if (changedLevel === 'generation') {
    delete next['trimPublicId'];
  }

  return next;
}

/**
 * Clears descendant location parameters when an ancestor selection changes:
 * - When country changes: clear cityId, areaId.
 * - When city changes: clear areaId.
 */
export function clearLocationDescendants<T extends Record<string, unknown>>(
  params: T,
  changedLevel: 'country' | 'city'
): T {
  const next = { ...params };

  if (changedLevel === 'country') {
    delete next['cityId'];
    delete next['areaId'];
  } else if (changedLevel === 'city') {
    delete next['areaId'];
  }

  return next;
}

/**
 * Checks whether a given model slug exists in the provided list of loaded vehicle models.
 */
export function isModelValidForMake(
  modelSlug: string,
  availableModels: readonly VehicleModel[]
): boolean {
  return availableModels.some((m) => m.slug === modelSlug && m.isActive);
}

/**
 * Checks whether a given area ID exists in the provided list of loaded areas.
 */
export function isAreaValidForCity(
  areaId: number,
  availableAreas: readonly Area[]
): boolean {
  return availableAreas.some((a) => a.id === areaId && a.isActive);
}

/**
 * Prunes invalid descendants from search parameters against verified parent lists.
 * E.g., if modelSlug is not in availableModels, removes modelSlug.
 * If areaId is not in availableAreas, removes areaId.
 */
export function pruneInvalidDescendants(
  params: ParsedSearchParams,
  context?: {
    models?: readonly VehicleModel[] | undefined;
    areas?: readonly Area[] | undefined;
  }
): ParsedSearchParams {
  const next: ParsedSearchParams = { ...params };

  if (next.modelSlug && context?.models && !isModelValidForMake(next.modelSlug, context.models)) {
    delete next.modelSlug;
  }

  if (next.areaId && context?.areas && !isAreaValidForCity(next.areaId, context.areas)) {
    delete next.areaId;
  }

  return next;
}
