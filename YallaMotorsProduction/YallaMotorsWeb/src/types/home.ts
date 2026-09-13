import type { LocalizedText } from './common';
import type { SpotlightItem } from './taxonomy';
import type { ListingCard } from './listing';
import type { DealerDirectoryItem } from './dealer';
import type { FinanceConfig, SupportConfig } from './settings';

export type BannerPosition =
  | 'HOME_HERO'
  | 'HOME_STRIP'
  | 'CATEGORY_HEADER'
  | 'CATEGORIES_FEATURED';

export interface HomeBanner {
  publicId: string;
  title: LocalizedText;
  subtitle: LocalizedText | null;
  imageUrl: string | null;
  linkTarget: string | null;
}

export interface HomeBannerListResponse {
  data: HomeBanner[];
}

export interface BannerListParams {
  position?: BannerPosition | undefined;
}

export interface HomePageData {
  banners: HomeBanner[];
  spotlight: SpotlightItem[];
  featuredListings: ListingCard[];
  latestListings: ListingCard[];
  featuredDealers: DealerDirectoryItem[];
  settings: {
    finance: FinanceConfig;
    support: SupportConfig;
  };
}
