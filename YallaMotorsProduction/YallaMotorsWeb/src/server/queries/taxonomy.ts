import 'server-only';

import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { PublicIdSchema } from '@/lib/api/schemas/common';
import { GenerationListResponseSchema, MakeListResponseSchema, SpotlightParamsSchema, SpotlightResponseSchema, TaxonomyGenerationsParamsSchema, TaxonomyModelsParamsSchema, TaxonomyTrimsParamsSchema, TrimListResponseSchema, TrimPathParamsSchema, TrimResponseSchema, VehicleModelListResponseSchema, adaptRawGenerationList, adaptRawMakeList, adaptRawSpotlight, adaptRawTrimDetail, adaptRawTrimList, adaptRawVehicleModelList } from '@/lib/api/schemas/taxonomy';
import { spotlightPolicy, taxonomyGenerationsPolicy, taxonomyMakesPolicy, taxonomyModelsPolicy, taxonomyTrimPolicy, taxonomyTrimsPolicy, trimBatchPolicy } from '@/lib/cache/policy';
import { publicQuery } from './public';
import { adaptMarketplaceMedia } from './marketplace-media';
import type { Locale } from '@/types/common';
import type { GenerationListResponse, MakeListResponse, SpotlightParams, SpotlightResponse, TaxonomyGenerationsParams, TaxonomyModelsParams, TaxonomyTrimsParams, TrimListResponse, TrimPathParams, TrimResponse, VehicleModelListResponse } from '@/types/taxonomy';

const PublicIdBatchParamsSchema = z.object({ publicIds: z.array(PublicIdSchema).min(1).max(4).refine((ids) => new Set(ids).size === ids.length, 'IDs must be unique') });

export function getSpotlight(params: SpotlightParams, locale: Locale): Promise<SpotlightResponse> {
  const input = SpotlightParamsSchema.parse(params);
  return publicQuery({ operation: 'getSpotlight', endpoint: UPSTREAM_ENDPOINTS.spotlight, outputSchema: SpotlightResponseSchema, locale, cachePolicy: spotlightPolicy(), query: input, adapter: (raw) => adaptRawSpotlight(adaptMarketplaceMedia(raw)) });
}
export function listMakes(locale: Locale): Promise<MakeListResponse> {
  return publicQuery({ operation: 'listMakes', endpoint: UPSTREAM_ENDPOINTS.makes, outputSchema: MakeListResponseSchema, locale, cachePolicy: taxonomyMakesPolicy(), adapter: (raw) => adaptRawMakeList(adaptMarketplaceMedia(raw)) });
}
export function listModels(params: TaxonomyModelsParams, locale: Locale): Promise<VehicleModelListResponse> {
  const { makeSlug } = TaxonomyModelsParamsSchema.parse(params);
  return publicQuery({ operation: 'listModels', endpoint: () => UPSTREAM_ENDPOINTS.models(makeSlug), outputSchema: VehicleModelListResponseSchema, locale, cachePolicy: taxonomyModelsPolicy(makeSlug), adapter: adaptRawVehicleModelList });
}
export function listGenerations(params: TaxonomyGenerationsParams, locale: Locale = 'ar'): Promise<GenerationListResponse> {
  const { modelPublicId } = TaxonomyGenerationsParamsSchema.parse(params);
  return publicQuery({ operation: 'listGenerations', endpoint: () => UPSTREAM_ENDPOINTS.generations(modelPublicId), outputSchema: GenerationListResponseSchema, locale, cachePolicy: taxonomyGenerationsPolicy(modelPublicId), adapter: adaptRawGenerationList });
}
export function listTrims(params: TaxonomyTrimsParams, locale: Locale): Promise<TrimListResponse> {
  const { generationPublicId } = TaxonomyTrimsParamsSchema.parse(params);
  return publicQuery({ operation: 'listTrims', endpoint: () => UPSTREAM_ENDPOINTS.trims(generationPublicId), outputSchema: TrimListResponseSchema, locale, cachePolicy: taxonomyTrimsPolicy(generationPublicId), adapter: adaptRawTrimList });
}
export function getTrim(params: TrimPathParams, locale: Locale): Promise<TrimResponse> {
  const { publicId } = TrimPathParamsSchema.parse(params);
  return publicQuery({ operation: 'getTrim', endpoint: () => UPSTREAM_ENDPOINTS.trim(publicId), outputSchema: TrimResponseSchema, locale, cachePolicy: taxonomyTrimPolicy(publicId), adapter: adaptRawTrimDetail });
}
export async function getTrimBatch(params: { publicIds: string[] }, locale: Locale): Promise<TrimListResponse> {
  const { publicIds } = PublicIdBatchParamsSchema.parse(params);
  const response = await publicQuery({ operation: 'getTrimBatch', endpoint: UPSTREAM_ENDPOINTS.trimBatch, outputSchema: TrimListResponseSchema, locale, cachePolicy: trimBatchPolicy(publicIds), query: { publicIds: publicIds.join(',') }, adapter: adaptRawTrimList });
  const byId = new Map(response.data.map((item) => [item.publicId, item]));
  return TrimListResponseSchema.parse({ data: publicIds.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []) });
}
