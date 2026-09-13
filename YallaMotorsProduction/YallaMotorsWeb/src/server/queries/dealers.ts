import 'server-only';

import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { DealerDirectoryResponseSchema, DealerInventoryParamsSchema, DealerListParamsSchema, DealerProfileResponseSchema, adaptRawDealerDirectory, adaptRawDealerProfile } from '@/lib/api/schemas/dealer';
import { ListingCursorResponseSchema } from '@/lib/api/schemas/listing';
import { SlugSchema } from '@/lib/api/schemas/common';
import { dealerListingsPolicy, dealerProfilePolicy, dealersPolicy, normalizePublicCachePayload } from '@/lib/cache/policy';
import { publicQuery } from './public';
import { adaptMarketplaceMedia } from './marketplace-media';
import type { Locale } from '@/types/common';
import type { DealerDirectoryResponse, DealerInventoryParams, DealerListParams, DealerProfileResponse } from '@/types/dealer';
import type { ListingCursorResponse } from '@/types/listing';

export function listDealers(params: DealerListParams, locale: Locale): Promise<DealerDirectoryResponse> {
  const input = DealerListParamsSchema.parse(params);
  return publicQuery({ operation: 'listDealers', endpoint: UPSTREAM_ENDPOINTS.dealers, outputSchema: DealerDirectoryResponseSchema, locale, cachePolicy: dealersPolicy(), query: input, adapter: adaptRawDealerDirectory });
}

export function getDealer(slugInput: string, locale: Locale): Promise<DealerProfileResponse> {
  const slug = SlugSchema.parse(slugInput);
  return publicQuery({ operation: 'getDealer', endpoint: () => UPSTREAM_ENDPOINTS.dealer(slug), outputSchema: DealerProfileResponseSchema, locale, cachePolicy: dealerProfilePolicy(slug), adapter: adaptRawDealerProfile });
}

export function getDealerListings(slugInput: string, params: DealerInventoryParams, locale: Locale): Promise<ListingCursorResponse> {
  const slug = SlugSchema.parse(slugInput);
  const input = DealerInventoryParamsSchema.parse(params);
  return publicQuery({ operation: 'getDealerListings', endpoint: () => UPSTREAM_ENDPOINTS.dealerListings(slug), outputSchema: ListingCursorResponseSchema, locale, cachePolicy: dealerListingsPolicy(slug), query: input, adapter: (raw) => normalizePublicCachePayload(adaptMarketplaceMedia(raw)) });
}

export const DealerSlugParamsSchema = z.object({ slug: SlugSchema });

