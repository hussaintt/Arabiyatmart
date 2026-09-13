import { z } from 'zod';
import type {
  BannerListParams,
  BannerPosition,
  HomeBanner,
  HomeBannerListResponse,
  HomePageData,
} from '@/types/home';
import {
  LocalizedTextSchema,
  PublicIdSchema,
} from './common';
import {
  SpotlightItemSchema,
  unwrapDataArray,
  unwrapDataObject,
} from './taxonomy';
import { ListingCardSchema } from './listing';
import { DealerDirectoryItemSchema } from './dealer';
import {
  FinanceConfigSchema,
  SupportConfigSchema,
} from './settings';

export const BannerPositionSchema = z.enum([
  'HOME_HERO',
  'HOME_STRIP',
  'CATEGORY_HEADER',
  'CATEGORIES_FEATURED',
]) satisfies z.ZodType<BannerPosition>;

export const BannerListParamsSchema: z.ZodType<BannerListParams> = z.object({
  position: BannerPositionSchema.optional(),
});

export const HomeBannerSchema: z.ZodType<HomeBanner> = z.object({
  publicId: PublicIdSchema,
  title: LocalizedTextSchema,
  subtitle: LocalizedTextSchema.nullable(),
  imageUrl: z.string().url().nullable(),
  linkTarget: z.string().nullable(),
});

export const HomeBannerListResponseSchema: z.ZodType<HomeBannerListResponse> = z.object({
  data: z.array(HomeBannerSchema),
});

export const HomePageDataSchema: z.ZodType<HomePageData> = z.object({
  banners: z.array(HomeBannerSchema),
  spotlight: z.array(SpotlightItemSchema),
  featuredListings: z.array(ListingCardSchema),
  latestListings: z.array(ListingCardSchema),
  featuredDealers: z.array(DealerDirectoryItemSchema),
  settings: z.object({
    finance: FinanceConfigSchema,
    support: SupportConfigSchema,
  }),
});

// ── Adapters ─────────────────────────────────────────────────────────────────

export function adaptRawBanner(raw: unknown): HomeBanner {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected object input for banner',
      },
    ]);
  }
  const item = raw as Record<string, unknown>;

  const cleaned = {
    publicId: item.publicId,
    title: item.title,
    subtitle: item.subtitle ?? null,
    imageUrl: item.imageUrl ?? null,
    linkTarget: item.linkTarget ?? null,
  };

  return HomeBannerSchema.parse(cleaned);
}

export function adaptRawBannerList(input: unknown): HomeBannerListResponse {
  const rawList = unwrapDataArray(input);
  const data = rawList.map(adaptRawBanner);
  return HomeBannerListResponseSchema.parse({ data });
}

export function adaptRawHomePageData(input: unknown): HomePageData {
  const obj = unwrapDataObject(input);
  return HomePageDataSchema.parse(obj);
}

