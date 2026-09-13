import 'server-only';

import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { PromotionPackageListResponseSchema, adaptRawPromotionPackageList } from '@/lib/api/schemas/lead';
import { promotionPackagesPolicy } from '@/lib/cache/policy';
import { publicQuery } from './public';
import type { Locale } from '@/types/common';
import type { PromotionPackageListResponse } from '@/types/lead';

export function listPromotionPackages(locale: Locale): Promise<PromotionPackageListResponse> { return publicQuery({ operation: 'listPromotionPackages', endpoint: UPSTREAM_ENDPOINTS.promotionPackages, outputSchema: PromotionPackageListResponseSchema, locale, cachePolicy: promotionPackagesPolicy(), adapter: adaptRawPromotionPackageList }); }

