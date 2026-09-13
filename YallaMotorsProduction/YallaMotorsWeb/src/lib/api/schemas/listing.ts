import { z } from 'zod';
import type {
  BodyType,
  CarCondition,
  ConditionGrade,
  Drivetrain,
  FavoriteMutationResponse,
  FuelType,
  ListingBatchParams,
  ListingBatchResponse,
  ListingCard,
  ListingCardResponse,
  ListingCursorResponse,
  ListingDetail,
  ListingDetailResponse,
  ListingGenerationRef,
  ListingIdentityOverlay,
  ListingImage,
  ListingListResponse,
  ListingLocationRef,
  ListingSlugParams,
  ListingSort,
  ListingStatus,
  ListingTaxonRef,
  ListingTransitionAction,
  ListingTrimRef,
  ListingVendorInfo,
  MyListing,
  MyListingAction,
  MyListingsResponse,
  PromotionTier,
  SellerType,
  SimilarListingsParams,
  Transmission,
  VehicleType,
} from '@/types/listing';
import {
  CurrencySchema,
  CursorMetaSchema,
  IsoDateTimeSchema,
  LocalizedTextSchema,
  MoneyCentsSchema,
  PartialLocalizedTextSchema,
  PublicIdSchema,
  SlugSchema,
} from './common';

export const FuelTypeSchema = z.enum([
  'PETROL',
  'DIESEL',
  'HYBRID',
  'ELECTRIC',
  'GAS',
]) satisfies z.ZodType<FuelType>;

export const TransmissionSchema = z.enum([
  'MANUAL',
  'AUTOMATIC',
  'CVT',
  'DCT',
]) satisfies z.ZodType<Transmission>;

export const DrivetrainSchema = z.enum(['FWD', 'RWD', 'AWD']) satisfies z.ZodType<Drivetrain>;

export const BodyTypeSchema = z.enum([
  'SEDAN',
  'HATCHBACK',
  'SUV',
  'CROSSOVER',
  'COUPE',
  'PICKUP',
  'VAN',
  'MINIVAN',
  'CONVERTIBLE',
  'WAGON',
]) satisfies z.ZodType<BodyType>;

export const VehicleTypeSchema = z.enum([
  'CAR',
  'MOTORCYCLE',
  'TRUCK',
  'VAN',
]) satisfies z.ZodType<VehicleType>;

export const CarConditionSchema = z.enum(['NEW', 'USED']) satisfies z.ZodType<CarCondition>;

export const ConditionGradeSchema = z.enum([
  'EXCELLENT',
  'VERY_GOOD',
  'GOOD',
  'FAIR',
  'NEEDS_WORK',
]) satisfies z.ZodType<ConditionGrade>;

export const SellerTypeSchema = z.enum(['PRIVATE', 'DEALER']) satisfies z.ZodType<SellerType>;

export const ListingStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
  'REJECTED',
  'EXPIRED',
  'SOLD',
  'ARCHIVED',
  'REMOVED',
]) satisfies z.ZodType<ListingStatus>;

export const ListingSortSchema = z.enum([
  'newest',
  'price_asc',
  'price_desc',
  'mileage_asc',
  'year_desc',
  'most_viewed',
]) satisfies z.ZodType<ListingSort>;

export const ListingTransitionActionSchema = z.enum([
  'submit',
  'approve',
  'reject',
  'pause',
  'unpause',
  'mark_sold',
  'archive',
  'remove',
  'resubmit',
  'renew',
]) satisfies z.ZodType<ListingTransitionAction>;

export const MyListingActionSchema = z.enum([
  'publish',
  'promote',
  'pause',
  'unpause',
  'renew',
  'markSold',
  'editPrice',
  'remove',
]) satisfies z.ZodType<MyListingAction>;

export const PromotionTierSchema = z.enum([
  'PREMIUM',
  'EXTRA_PREMIUM',
]) satisfies z.ZodType<PromotionTier>;

export const ApprovedImageUrlSchema = z
  .string()
  .url()
  .refine((val) => {
    try {
      const parsed = new URL(val);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Image URL must use http or https protocol');

export const ListingTaxonRefSchema: z.ZodType<ListingTaxonRef> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  name: LocalizedTextSchema,
});

export const ListingGenerationRefSchema: z.ZodType<ListingGenerationRef> = z.object({
  publicId: PublicIdSchema,
  name: z.string().trim().min(1),
});

export const ListingTrimRefSchema: z.ZodType<ListingTrimRef> = z.object({
  publicId: PublicIdSchema,
  name: LocalizedTextSchema,
  officialPriceCents: MoneyCentsSchema.nullable(),
});

export const ListingLocationRefSchema: z.ZodType<ListingLocationRef> = z.object({
  id: z.number().int().positive(),
  name: LocalizedTextSchema,
});

export const ListingImageSchema: z.ZodType<ListingImage> = z.object({
  url: ApprovedImageUrlSchema,
  thumbnailUrl: ApprovedImageUrlSchema.nullish(),
  mediumUrl: ApprovedImageUrlSchema.nullish(),
  largeUrl: ApprovedImageUrlSchema.nullish(),
  isCover: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const ListingVendorInfoSchema: z.ZodType<ListingVendorInfo> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  displayName: LocalizedTextSchema,
  logoUrl: ApprovedImageUrlSchema.nullable(),
  ratingAverage: z.number().nonnegative().max(5),
  reviewCount: z.number().int().nonnegative(),
  isVerified: z.boolean(),
});

export const ListingCardSchema = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  title: z.string().trim().min(1),
  makeName: LocalizedTextSchema,
  modelName: LocalizedTextSchema,
  year: z.number().int().min(1900).max(2100),
  mileageKm: z.number().int().nonnegative(),
  priceCents: MoneyCentsSchema,
  currency: CurrencySchema,
  isNegotiable: z.boolean(),
  fuelType: FuelTypeSchema,
  transmission: TransmissionSchema,
  bodyType: BodyTypeSchema,
  condition: CarConditionSchema,
  conditionGrade: ConditionGradeSchema.nullable(),
  sellerType: SellerTypeSchema,
  cityName: LocalizedTextSchema,
  coverImageUrl: ApprovedImageUrlSchema.nullable(),
  coverThumbnailUrl: ApprovedImageUrlSchema.nullish(),
  coverMediumUrl: ApprovedImageUrlSchema.nullish(),
  officialPriceCents: MoneyCentsSchema.nullable(),
  isFavorited: z.boolean(),
  isFeatured: z.boolean(),
  featuredUntil: IsoDateTimeSchema.nullable(),
  featuredTier: PromotionTierSchema.nullable(),
  publishedAt: IsoDateTimeSchema.nullable(),
  viewsCount: z.number().int().nonnegative(),
  favoritesCount: z.number().int().nonnegative(),
  imagesCount: z.number().int().nonnegative(),
  isSellerVerified: z.boolean(),
}) satisfies z.ZodType<ListingCard>;

export const ListingDetailSchema: z.ZodType<ListingDetail> = z
  .object({
    publicId: PublicIdSchema,
    slug: SlugSchema,
    title: z.string().trim().min(1),
    sellerType: SellerTypeSchema,
    status: ListingStatusSchema,
    rejectionReason: z.string().nullable(),
    make: ListingTaxonRefSchema,
    model: ListingTaxonRefSchema,
    generation: ListingGenerationRefSchema.nullable(),
    trim: ListingTrimRefSchema.nullable(),
    year: z.number().int().min(1900).max(2100),
    mileageKm: z.number().int().nonnegative(),
    priceCents: MoneyCentsSchema,
    currency: CurrencySchema,
    isNegotiable: z.boolean(),
    installmentAvailable: z.boolean(),
    exchangeAccepted: z.boolean(),
    condition: CarConditionSchema,
    conditionGrade: ConditionGradeSchema.nullable(),
    fuelType: FuelTypeSchema,
    transmission: TransmissionSchema,
    bodyType: BodyTypeSchema,
    colorExterior: z.string().nullable(),
    colorInterior: z.string().nullable(),
    engineCc: z.number().int().positive().nullable(),
    powerHp: z.number().int().positive().nullable(),
    seats: z.number().int().positive().max(100).nullable(),
    drivetrain: DrivetrainSchema.nullable(),
    vin: z
      .string()
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN must be exactly 17 standard characters')
      .nullable(),
    description: PartialLocalizedTextSchema.nullable(),
    features: z.array(z.string()).nullable(),
    city: ListingLocationRefSchema,
    area: ListingLocationRefSchema.nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    registrationStatus: z.string().nullable(),
    hasWarranty: z.boolean(),
    hasServiceHistory: z.boolean(),
    images: z.array(ListingImageSchema).max(20),
    contactPhone: z.string().nullable(),
    whatsappPhone: z.string().nullable(),
    allowChat: z.boolean(),
    vendor: ListingVendorInfoSchema.nullable(),
    publishedAt: IsoDateTimeSchema.nullable(),
    expiresAt: IsoDateTimeSchema.nullable(),
    createdAt: IsoDateTimeSchema.nullable(),
    featuredUntil: IsoDateTimeSchema.nullable(),
    viewsCount: z.number().int().nonnegative(),
    favoritesCount: z.number().int().nonnegative(),
    leadsCount: z.number().int().nonnegative(),
    isFavorited: z.boolean(),
  })
  .superRefine((val, ctx) => {
    const urls = new Set<string>();
    const seenSortOrders = new Set<number>();
    let coverCount = 0;

    for (let i = 0; i < val.images.length; i++) {
      const img = val.images[i]!;

      // 1. Media URLs must be unique
      if (urls.has(img.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['images', i, 'url'],
          message: 'Media URLs must be unique',
        });
      }
      urls.add(img.url);

      // 2. Media sortOrder values must be unique
      if (seenSortOrders.has(img.sortOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['images', i, 'sortOrder'],
          message: 'Media sortOrder values must be unique',
        });
      }
      seenSortOrders.add(img.sortOrder);

      // 3. Media images must be ordered by strictly ascending sortOrder
      if (i > 0 && img.sortOrder <= val.images[i - 1]!.sortOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['images', i, 'sortOrder'],
          message: 'Media images must be ordered by strictly ascending sortOrder',
        });
      }

      if (img.isCover) {
        coverCount++;
      }
    }

    // 4. Cover consistency: at most one cover image, and if present it must be the first image in sequence
    if (coverCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: 'At most one image may be designated as cover',
      });
    }

    if (coverCount === 1 && !val.images[0]?.isCover) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: 'Cover image must be the first image in ordered media sequence',
      });
    }
  });

// ── Public Cache Isolation (CACHE-01) ─────────────────────────────────────────

export const PublicListingCardSchema: z.ZodType<ListingCard> = ListingCardSchema.refine(
  (card) => card.isFavorited === false,
  {
    message: 'Public cached listing card must have isFavorited: false',
    path: ['isFavorited'],
  }
);

export const PublicListingDetailSchema: z.ZodType<ListingDetail> = ListingDetailSchema.refine(
  (detail) => detail.isFavorited === false,
  {
    message: 'Public cached listing detail must have isFavorited: false',
    path: ['isFavorited'],
  }
);

export function stripIdentityOverlay<T extends { isFavorited: boolean }>(listing: T): T {
  return {
    ...listing,
    isFavorited: false,
  };
}

// ── Operation & Response Schemas ──────────────────────────────────────────────

export const ListingCardResponseSchema: z.ZodType<ListingCardResponse> = z.object({
  data: ListingCardSchema,
});

export const ListingDetailResponseSchema: z.ZodType<ListingDetailResponse> = z.object({
  data: ListingDetailSchema,
});

export const ListingListResponseSchema: z.ZodType<ListingListResponse> = z.object({
  data: z.array(ListingCardSchema),
});

export const ListingCursorResponseSchema: z.ZodType<ListingCursorResponse> = z.object({
  data: z.array(ListingCardSchema),
  meta: CursorMetaSchema,
});

export const ListingBatchParamsSchema: z.ZodType<ListingBatchParams> = z.object({
  slugs: z
    .array(SlugSchema)
    .min(1)
    .max(4)
    .refine((slugs) => new Set(slugs).size === slugs.length, 'Slugs must be unique'),
});

export const ListingBatchResponseSchema: z.ZodType<ListingBatchResponse> = z.object({
  data: z.array(ListingCardSchema).max(4),
});

export const PublicListingCardResponseSchema: z.ZodType<ListingCardResponse> = z.object({
  data: PublicListingCardSchema,
});

export const PublicListingDetailResponseSchema: z.ZodType<ListingDetailResponse> = z.object({
  data: PublicListingDetailSchema,
});

export const PublicListingBatchResponseSchema: z.ZodType<ListingBatchResponse> = z.object({
  data: z.array(PublicListingCardSchema).max(4),
});

export const ListingSlugParamsSchema: z.ZodType<ListingSlugParams> = z.object({
  slug: SlugSchema,
});

export const SimilarListingsParamsSchema: z.ZodType<SimilarListingsParams> = z.object({
  slug: SlugSchema,
});

export const MyListingSchema: z.ZodType<MyListing> = ListingCardSchema.extend({
  status: ListingStatusSchema,
  rejectionReason: z.string().nullable(),
  leadsCount: z.number().int().nonnegative().nullable(),
});

export const MyListingsResponseSchema: z.ZodType<MyListingsResponse> = z.object({
  data: z.array(MyListingSchema),
  meta: CursorMetaSchema,
});

export const FavoriteMutationResponseSchema: z.ZodType<FavoriteMutationResponse> = z.object({
  data: z.object({
    favorited: z.boolean(),
  }),
});

export const ListingIdentityOverlaySchema: z.ZodType<ListingIdentityOverlay> = z.object({
  listingPublicId: PublicIdSchema,
  isFavorited: z.boolean(),
});
