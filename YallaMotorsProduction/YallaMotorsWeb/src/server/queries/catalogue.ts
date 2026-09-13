import 'server-only';

import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { CatalogueTrimDetailResponseSchema, MakeDealersParamsSchema, ModelPageResponseSchema, ModelPathParamsSchema, ModelsWithPricesParamsSchema, ModelsWithPricesResponseSchema, TrimDealersParamsSchema, TrimDealersResponseSchema, TrimPathParamsSchema, adaptRawCatalogueTrimDetail, adaptRawModelPage, adaptRawModelsWithPrices, adaptRawTrimDealers } from '@/lib/api/schemas/taxonomy';
import { catalogueModelPolicy, catalogueTrimPolicy, makeDealersPolicy, modelsWithPricesPolicy, trimDealersPolicy } from '@/lib/cache/policy';
import { publicQuery } from './public';
import type { Locale } from '@/types/common';
import type { CatalogueTrimDetailResponse, MakeDealersParams, ModelPageResponse, ModelPathParams, ModelsWithPricesParams, ModelsWithPricesResponse, TrimDealersParams, TrimDealersResponse, TrimPathParams } from '@/types/taxonomy';

export function getModelsWithPrices(params: ModelsWithPricesParams, locale: Locale): Promise<ModelsWithPricesResponse> {
  const input = ModelsWithPricesParamsSchema.parse(params);
  return publicQuery({ operation: 'getModelsWithPrices', endpoint: () => UPSTREAM_ENDPOINTS.modelsWithPrices(input.makeSlug), outputSchema: ModelsWithPricesResponseSchema, locale, cachePolicy: modelsWithPricesPolicy(input.makeSlug), query: { condition: input.condition }, adapter: adaptRawModelsWithPrices });
}
export function getCatalogueModel(params: ModelPathParams, locale: Locale): Promise<ModelPageResponse> {
  const { publicId } = ModelPathParamsSchema.parse(params);
  return publicQuery({ operation: 'getCatalogueModel', endpoint: () => UPSTREAM_ENDPOINTS.catalogueModel(publicId), outputSchema: ModelPageResponseSchema, locale, cachePolicy: catalogueModelPolicy(publicId), adapter: adaptRawModelPage });
}
export function getCatalogueTrim(params: TrimPathParams, locale: Locale): Promise<CatalogueTrimDetailResponse> {
  const { publicId } = TrimPathParamsSchema.parse(params);
  return publicQuery({ operation: 'getCatalogueTrim', endpoint: () => UPSTREAM_ENDPOINTS.catalogueTrim(publicId), outputSchema: CatalogueTrimDetailResponseSchema, locale, cachePolicy: catalogueTrimPolicy(publicId), adapter: adaptRawCatalogueTrimDetail });
}
export function getTrimDealers(params: TrimDealersParams, locale: Locale): Promise<TrimDealersResponse> {
  const input = TrimDealersParamsSchema.parse(params);
  return publicQuery({ operation: 'getTrimDealers', endpoint: () => UPSTREAM_ENDPOINTS.trimDealers(input.publicId), outputSchema: TrimDealersResponseSchema, locale, cachePolicy: trimDealersPolicy(input.publicId), query: { limit: input.limit }, adapter: adaptRawTrimDealers });
}
export function getMakeDealers(params: MakeDealersParams, locale: Locale): Promise<TrimDealersResponse> {
  const input = MakeDealersParamsSchema.parse(params);
  return publicQuery({ operation: 'getMakeDealers', endpoint: () => UPSTREAM_ENDPOINTS.makeDealers(input.makeSlug), outputSchema: TrimDealersResponseSchema, locale, cachePolicy: makeDealersPolicy(input.makeSlug), query: { limit: input.limit }, adapter: adaptRawTrimDealers });
}

