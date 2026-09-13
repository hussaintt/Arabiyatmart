import 'server-only';

import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { BannerListParamsSchema, HomeBannerListResponseSchema, HomePageDataSchema, adaptRawBannerList } from '@/lib/api/schemas/home';
import { PublicSettingsResponseSchema, DEFAULT_FINANCE_CONFIG, adaptRawPublicSettings } from '@/lib/api/schemas/settings';
import { bannersPolicy, publicSettingsPolicy } from '@/lib/cache/policy';
import { publicQuery } from './public';
import { getSpotlight } from './taxonomy';
import { searchListings } from './listings';
import { listDealers } from './dealers';
import type { Locale } from '@/types/common';
import type { BannerListParams, HomeBannerListResponse, HomePageData } from '@/types/home';
import type { PublicSettingsResponse } from '@/types/settings';

export function listBanners(params: BannerListParams, locale: Locale): Promise<HomeBannerListResponse> {
  const input = BannerListParamsSchema.parse(params);
  return publicQuery({ operation: 'listBanners', endpoint: UPSTREAM_ENDPOINTS.banners, outputSchema: HomeBannerListResponseSchema, locale, cachePolicy: bannersPolicy(), query: input, adapter: adaptRawBannerList });
}
export function getPublicSettings(locale: Locale): Promise<PublicSettingsResponse> {
  return publicQuery({ operation: 'getPublicSettings', endpoint: UPSTREAM_ENDPOINTS.publicSettings, outputSchema: PublicSettingsResponseSchema, locale, cachePolicy: publicSettingsPolicy(), adapter: adaptRawPublicSettings });
}

import { logSafeEvent } from '@/lib/observability/logger';

export interface HomePageResult {
  data: HomePageData;
  isDegraded: boolean;
  degradedReasons?: string[];
}

export async function getHomePageDataWithStatus(locale: Locale): Promise<HomePageResult> {
  const degradedReasons: string[] = [];

  const safeOptional = async <T>(promise: Promise<T>, fallback: T, name: string): Promise<T> => {
    try {
      return await promise;
    } catch {
      degradedReasons.push(name);
      return fallback;
    }
  };

  const [banners, spotlight, featured, latest, dealers, settings] = await Promise.all([
    safeOptional(listBanners({ position: 'HOME_HERO' }, locale), { data: [] }, 'banners'),
    safeOptional(getSpotlight({ limit: 10 }, locale), { data: [] }, 'spotlight'),
    safeOptional(searchListings({ sort: 'most_viewed', page: 1, limit: 12 }, locale), { data: [], meta: { total: 0, page: 1, limit: 12, hasMore: false } }, 'featured'),
    safeOptional(searchListings({ sort: 'newest', page: 1, limit: 12 }, locale), { data: [], meta: { total: 0, page: 1, limit: 12, hasMore: false } }, 'latest'),
    safeOptional(listDealers({ limit: 12 }, locale), { data: [], meta: { hasMore: false, nextCursor: null } }, 'dealers'),
    safeOptional(getPublicSettings(locale), { data: { rows: [], finance: DEFAULT_FINANCE_CONFIG, support: { termsUrl: null, privacyUrl: null, supportEmail: null, supportPhone: null } } }, 'settings'),
  ]);

  const parsed = HomePageDataSchema.parse({
    banners: banners.data,
    spotlight: spotlight.data,
    featuredListings: featured.data.slice(0, 8),
    latestListings: latest.data.slice(0, 12),
    featuredDealers: dealers.data.slice(0, 8),
    settings: { finance: settings.data.finance, support: settings.data.support },
  });

  const isDegraded = degradedReasons.length > 0;
  if (isDegraded) {
    logSafeEvent({
      level: 'warn',
      operation: 'homepage_degraded_fallback',
      routeTemplate: '/[locale]',
      status: 200,
      schemaIssuePaths: degradedReasons,
    });
  }

  return { data: parsed, isDegraded, degradedReasons };
}

export async function getHomePageData(locale: Locale): Promise<HomePageData> {
  const result = await getHomePageDataWithStatus(locale);
  return result.data;
}

