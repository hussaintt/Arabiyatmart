import type {
  CursorMeta,
  LocalizedText,
  PartialLocalizedText,
} from './common';

export type FuelType = 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC' | 'GAS';
export type Transmission = 'MANUAL' | 'AUTOMATIC' | 'CVT' | 'DCT';
export type Drivetrain = 'FWD' | 'RWD' | 'AWD';
export type BodyType =
  | 'SEDAN'
  | 'HATCHBACK'
  | 'SUV'
  | 'CROSSOVER'
  | 'COUPE'
  | 'PICKUP'
  | 'VAN'
  | 'MINIVAN'
  | 'CONVERTIBLE'
  | 'WAGON';
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'TRUCK' | 'VAN';
export type CarCondition = 'NEW' | 'USED';
export type ConditionGrade = 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'FAIR' | 'NEEDS_WORK';
export type SellerType = 'PRIVATE' | 'DEALER';
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SOLD'
  | 'ARCHIVED'
  | 'REMOVED';
export type ListingSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'mileage_asc'
  | 'year_desc'
  | 'most_viewed';
export type ListingTransitionAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'pause'
  | 'unpause'
  | 'mark_sold'
  | 'archive'
  | 'remove'
  | 'resubmit'
  | 'renew';
export type MyListingAction =
  | 'publish'
  | 'promote'
  | 'pause'
  | 'unpause'
  | 'renew'
  | 'markSold'
  | 'editPrice'
  | 'remove';
export type PromotionTier = 'PREMIUM' | 'EXTRA_PREMIUM';

export interface ListingTaxonRef {
  publicId: string;
  slug: string;
  name: LocalizedText;
}

export interface ListingGenerationRef {
  publicId: string;
  name: string;
}

export interface ListingTrimRef {
  publicId: string;
  name: LocalizedText;
  officialPriceCents: number | null;
}

export interface ListingLocationRef {
  id: number;
  name: LocalizedText;
}

export interface ListingImage {
  url: string;
  thumbnailUrl?: string | null | undefined;
  mediumUrl?: string | null | undefined;
  largeUrl?: string | null | undefined;
  isCover: boolean;
  sortOrder: number;
}

export interface ListingVendorInfo {
  publicId: string;
  slug: string;
  displayName: LocalizedText;
  logoUrl: string | null;
  ratingAverage: number;
  reviewCount: number;
  isVerified: boolean;
}

export interface ListingCard {
  publicId: string;
  slug: string;
  title: string;
  makeName: LocalizedText;
  modelName: LocalizedText;
  year: number;
  mileageKm: number;
  priceCents: number;
  currency: string;
  isNegotiable: boolean;
  fuelType: FuelType;
  transmission: Transmission;
  bodyType: BodyType;
  condition: CarCondition;
  conditionGrade: ConditionGrade | null;
  sellerType: SellerType;
  cityName: LocalizedText;
  coverImageUrl: string | null;
  coverThumbnailUrl?: string | null | undefined;
  coverMediumUrl?: string | null | undefined;
  officialPriceCents: number | null;
  isFavorited: boolean;
  isFeatured: boolean;
  featuredUntil: string | null;
  featuredTier: PromotionTier | null;
  publishedAt: string | null;
  viewsCount: number;
  favoritesCount: number;
  imagesCount: number;
  isSellerVerified: boolean;
}

export interface ListingDetail {
  publicId: string;
  slug: string;
  title: string;
  sellerType: SellerType;
  status: ListingStatus;
  rejectionReason: string | null;
  make: ListingTaxonRef;
  model: ListingTaxonRef;
  generation: ListingGenerationRef | null;
  trim: ListingTrimRef | null;
  year: number;
  mileageKm: number;
  priceCents: number;
  currency: string;
  isNegotiable: boolean;
  installmentAvailable: boolean;
  exchangeAccepted: boolean;
  condition: CarCondition;
  conditionGrade: ConditionGrade | null;
  fuelType: FuelType;
  transmission: Transmission;
  bodyType: BodyType;
  colorExterior: string | null;
  colorInterior: string | null;
  engineCc: number | null;
  powerHp: number | null;
  seats: number | null;
  drivetrain: Drivetrain | null;
  vin: string | null;
  description: PartialLocalizedText | null;
  features: string[] | null;
  city: ListingLocationRef;
  area: ListingLocationRef | null;
  lat: number | null;
  lng: number | null;
  registrationStatus: string | null;
  hasWarranty: boolean;
  hasServiceHistory: boolean;
  images: ListingImage[];
  contactPhone: string | null;
  whatsappPhone: string | null;
  allowChat: boolean;
  vendor: ListingVendorInfo | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  featuredUntil: string | null;
  viewsCount: number;
  favoritesCount: number;
  leadsCount: number;
  isFavorited: boolean;
}

export interface ListingCardResponse {
  data: ListingCard;
}

export interface ListingDetailResponse {
  data: ListingDetail;
}

export interface ListingListResponse {
  data: ListingCard[];
}

export interface ListingCursorResponse {
  data: ListingCard[];
  meta: CursorMeta;
}

export interface ListingBatchResponse {
  data: ListingCard[];
}

export interface ListingBatchParams {
  slugs: string[];
}

export interface ListingSlugParams {
  slug: string;
}

export interface SimilarListingsParams {
  slug: string;
}

export interface MyListing extends ListingCard {
  status: ListingStatus;
  rejectionReason: string | null;
  leadsCount: number | null;
}

export interface MyListingsResponse {
  data: MyListing[];
  meta: CursorMeta;
}

export interface FavoriteMutationResponse {
  data: {
    favorited: boolean;
  };
}

export interface ListingIdentityOverlay {
  listingPublicId: string;
  isFavorited: boolean;
}
