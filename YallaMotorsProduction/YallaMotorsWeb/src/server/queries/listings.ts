import 'server-only';

import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ListingBatchParamsSchema, ListingBatchResponseSchema, ListingListResponseSchema, ListingSlugParamsSchema, PublicListingBatchResponseSchema, PublicListingDetailResponseSchema, SimilarListingsParamsSchema } from '@/lib/api/schemas/listing';
import { ListingSearchParamsSchema, PublicListingSearchResponseSchema } from '@/lib/api/schemas/search';
import { VehicleSearchSuggestionParamsSchema, VehicleSearchSuggestionResponseSchema, adaptRawVehicleSearchSuggestionList } from '@/lib/api/schemas/saved-search';
import { listingBatchPolicy, listingDetailPolicy, searchListingsPolicy, searchSuggestionsPolicy, similarListingsPolicy, normalizePublicCachePayload } from '@/lib/cache/policy';
import { publicQuery } from './public';
import { adaptMarketplaceMedia } from './marketplace-media';

const adaptListingResponse = (raw: unknown) => normalizePublicCachePayload(adaptMarketplaceMedia(raw));
import type { Locale } from '@/types/common';
import type { ListingBatchParams, ListingBatchResponse, ListingDetailResponse, ListingListResponse, ListingSlugParams, SimilarListingsParams } from '@/types/listing';
import type { ListingSearchParams, ListingSearchResponse } from '@/types/search';
import type { VehicleSearchSuggestionParams, VehicleSearchSuggestionResponse } from '@/types/saved-search';

export function searchListings(params: ListingSearchParams, locale: Locale): Promise<ListingSearchResponse> {
  const input = ListingSearchParamsSchema.parse(params);
  return publicQuery({ operation: 'searchListings', endpoint: UPSTREAM_ENDPOINTS.listings, outputSchema: PublicListingSearchResponseSchema, locale, cachePolicy: searchListingsPolicy(false), query: input, adapter: adaptListingResponse });
}

export function getListing(params: ListingSlugParams, locale: Locale): Promise<ListingDetailResponse> {
  const { slug } = ListingSlugParamsSchema.parse(params);
  return publicQuery({ operation: 'getListing', endpoint: () => UPSTREAM_ENDPOINTS.listing(slug), outputSchema: PublicListingDetailResponseSchema, locale, cachePolicy: listingDetailPolicy(slug), adapter: adaptListingResponse });
}

export function getSimilarListings(params: SimilarListingsParams, locale: Locale): Promise<ListingListResponse> {
  const { slug } = SimilarListingsParamsSchema.parse(params);
  return publicQuery({ operation: 'getSimilarListings', endpoint: () => UPSTREAM_ENDPOINTS.listingSimilar(slug), outputSchema: ListingListResponseSchema, locale, cachePolicy: similarListingsPolicy(slug), adapter: adaptListingResponse });
}

export async function getListingBatch(params: ListingBatchParams, locale: Locale): Promise<ListingBatchResponse> {
  const { slugs } = ListingBatchParamsSchema.parse(params);
  const response = await publicQuery({ operation: 'getListingBatch', endpoint: UPSTREAM_ENDPOINTS.listingBatch, outputSchema: PublicListingBatchResponseSchema, locale, cachePolicy: listingBatchPolicy(slugs), query: { slugs: slugs.join(',') }, adapter: adaptListingResponse });
  const bySlug = new Map(response.data.map((item) => [item.slug, item]));
  return ListingBatchResponseSchema.parse({ data: slugs.flatMap((slug) => bySlug.get(slug) ? [bySlug.get(slug)!] : []) });
}

export function getVehicleSuggestions(params: VehicleSearchSuggestionParams, locale: Locale = 'ar'): Promise<VehicleSearchSuggestionResponse> {
  const input = VehicleSearchSuggestionParamsSchema.parse(params);
  return publicQuery({ operation: 'getVehicleSuggestions', endpoint: UPSTREAM_ENDPOINTS.searchSuggest, outputSchema: VehicleSearchSuggestionResponseSchema, locale, cachePolicy: searchSuggestionsPolicy(), query: input, adapter: adaptRawVehicleSearchSuggestionList });
}

