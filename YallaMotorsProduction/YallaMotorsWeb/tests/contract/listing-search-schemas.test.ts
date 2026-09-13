import { describe, expect, it } from 'vitest';
import {
  CompareItemParamSchema,
  CompareItemRefSchema,
  ComparePageDataSchema,
  CompareParamsSchema,
  ComparisonSpecRowSchema,
  ComparisonItemSchema,
  parseCompareUrlItems,
} from '@/lib/api/schemas/compare';
import {
  ApprovedImageUrlSchema,
  FavoriteMutationResponseSchema,
  ListingBatchParamsSchema,
  ListingBatchResponseSchema,
  ListingCardResponseSchema,
  ListingCardSchema,
  ListingCursorResponseSchema,
  ListingDetailResponseSchema,
  ListingDetailSchema,
  ListingListResponseSchema,
  MyListingSchema,
  MyListingsResponseSchema,
  PublicListingBatchResponseSchema,
  PublicListingCardSchema,
  PublicListingDetailSchema,
  stripIdentityOverlay,
} from '@/lib/api/schemas/listing';
import {
  canonicalizeListingSearchParams,
  ListingSearchParamsSchema,
  ListingSearchResponseSchema,
  ListingSearchUrlSchema,
  PublicListingSearchResponseSchema,
} from '@/lib/api/schemas/search';
import type {
  ListingCard,
  ListingDetail,
} from '@/types/listing';

function createValidListingCard(overrides: Partial<ListingCard> = {}): ListingCard {
  return {
    publicId: 'lst_test_card_01',
    slug: 'toyota-corolla-2023-active',
    title: 'تويوتا كورولا 2023 بحالة الوكالة ممتازة',
    makeName: { ar: 'تويوتا', en: 'Toyota' },
    modelName: { ar: 'كورولا', en: 'Corolla' },
    year: 2023,
    mileageKm: 15000,
    priceCents: 85000000,
    currency: 'EGP',
    isNegotiable: true,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SEDAN',
    condition: 'USED',
    conditionGrade: 'EXCELLENT',
    sellerType: 'DEALER',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    coverImageUrl: 'https://images.unsplash.com/photo-car-01.jpg',
    officialPriceCents: 90000000,
    isFavorited: false,
    isFeatured: true,
    featuredUntil: '2026-10-01T00:00:00.000Z',
    featuredTier: 'PREMIUM',
    publishedAt: '2026-09-01T12:00:00.000Z',
    viewsCount: 412,
    favoritesCount: 28,
    imagesCount: 8,
    isSellerVerified: true,
    ...overrides,
  };
}

function createValidListingDetail(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    publicId: 'lst_detail_valid_01',
    slug: 'toyota-corolla-2023-luxury-cairo',
    title: 'تويوتا كورولا 2023 فئة أولى بحالة الزيرو',
    sellerType: 'DEALER',
    status: 'ACTIVE',
    rejectionReason: null,
    make: {
      publicId: 'mak_toyota',
      slug: 'toyota',
      name: { ar: 'تويوتا', en: 'Toyota' },
    },
    model: {
      publicId: 'mod_corolla',
      slug: 'corolla',
      name: { ar: 'كورولا', en: 'Corolla' },
    },
    generation: {
      publicId: 'gen_e210',
      name: 'E210 (2018-Present)',
    },
    trim: {
      publicId: 'trm_active_plus',
      name: { ar: 'أكتيف بلس', en: 'Active Plus' },
      officialPriceCents: 92000000,
    },
    year: 2023,
    mileageKm: 12000,
    priceCents: 86500000,
    currency: 'EGP',
    isNegotiable: true,
    installmentAvailable: true,
    exchangeAccepted: false,
    condition: 'USED',
    conditionGrade: 'VERY_GOOD',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SEDAN',
    colorExterior: 'Pearl White',
    colorInterior: 'Black Leather',
    engineCc: 1600,
    powerHp: 120,
    seats: 5,
    drivetrain: 'FWD',
    vin: '1HGCR2F83HA000000',
    description: {
      ar: 'سيارة بحالة ممتازة، صيانة توكيل منتظمة، فابريكا بالكامل',
      en: 'Vehicle in excellent condition, full dealer service history',
    },
    features: ['Sunroof', 'Leather Seats', 'Rear Camera', 'Apple CarPlay'],
    city: {
      id: 1,
      name: { ar: 'القاهرة', en: 'Cairo' },
    },
    area: {
      id: 101,
      name: { ar: 'مدينة نصر', en: 'Nasr City' },
    },
    lat: 30.0444,
    lng: 31.2357,
    registrationStatus: 'Valid for 2 years',
    hasWarranty: true,
    hasServiceHistory: true,
    images: [
      {
        url: 'https://images.unsplash.com/car-front.jpg',
        isCover: true,
        sortOrder: 0,
      },
      {
        url: 'https://images.unsplash.com/car-rear.jpg',
        isCover: false,
        sortOrder: 1,
      },
      {
        url: 'https://images.unsplash.com/car-interior.jpg',
        isCover: false,
        sortOrder: 2,
      },
    ],
    contactPhone: '+201000000000',
    whatsappPhone: '+201000000000',
    allowChat: true,
    vendor: {
      publicId: 'vnd_automotive_cairo',
      slug: 'cairo-automotive-hub',
      displayName: { ar: 'مركز القاهرة للسيارات', en: 'Cairo Auto Hub' },
      logoUrl: 'https://images.unsplash.com/vendor-logo.jpg',
      ratingAverage: 4.8,
      reviewCount: 42,
      isVerified: true,
    },
    publishedAt: '2026-09-02T10:00:00.000Z',
    expiresAt: '2026-10-02T10:00:00.000Z',
    createdAt: '2026-09-02T09:00:00.000Z',
    featuredUntil: null,
    viewsCount: 1540,
    favoritesCount: 89,
    leadsCount: 14,
    isFavorited: false,
    ...overrides,
  };
}

describe('Listing, Search, and Compare Contracts Suite (TASK-008)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. ListingCardSchema Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('ListingCardSchema Contract', () => {
    it('successfully parses a complete valid listing card with Arabic/bidi fields', () => {
      const card = createValidListingCard();
      const parsed = ListingCardSchema.parse(card);

      expect(parsed).toEqual(card);
      expect(parsed.makeName.ar).toBe('تويوتا');
      expect(parsed.title).toContain('تويوتا');
      expect(parsed.priceCents).toBe(85000000);
      expect(parsed.currency).toBe('EGP');
    });

    it('rejects internal numeric IDs in place of public string identifiers', () => {
      const raw = {
        ...createValidListingCard(),
        publicId: 10425, // numeric ID forbidden
      };
      const res = ListingCardSchema.safeParse(raw);
      expect(res.success).toBe(false);
    });

    it('rejects floating-point price cents', () => {
      const raw = {
        ...createValidListingCard(),
        priceCents: 85000.5,
      };
      const res = ListingCardSchema.safeParse(raw);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.path).toContain('priceCents');
      }
    });

    it('rejects negative mileage or negative counts', () => {
      const rawNegMileage = { ...createValidListingCard(), mileageKm: -100 };
      expect(ListingCardSchema.safeParse(rawNegMileage).success).toBe(false);

      const rawNegViews = { ...createValidListingCard(), viewsCount: -1 };
      expect(ListingCardSchema.safeParse(rawNegViews).success).toBe(false);

      const rawNegFavorites = { ...createValidListingCard(), favoritesCount: -5 };
      expect(ListingCardSchema.safeParse(rawNegFavorites).success).toBe(false);
    });

    it('rejects out-of-bound years (<1900 or >2100)', () => {
      expect(ListingCardSchema.safeParse(createValidListingCard({ year: 1899 })).success).toBe(false);
      expect(ListingCardSchema.safeParse(createValidListingCard({ year: 2101 })).success).toBe(false);
      expect(ListingCardSchema.safeParse(createValidListingCard({ year: 2024 })).success).toBe(true);
    });

    it('rejects invalid currency codes', () => {
      expect(ListingCardSchema.safeParse(createValidListingCard({ currency: 'EG' })).success).toBe(false);
      expect(ListingCardSchema.safeParse(createValidListingCard({ currency: 'egp' })).success).toBe(false);
      expect(ListingCardSchema.safeParse(createValidListingCard({ currency: 'EGYPT' })).success).toBe(false);
      expect(ListingCardSchema.safeParse(createValidListingCard({ currency: 'USD' })).success).toBe(true);
    });

    it('rejects invalid enums (fuel, transmission, condition, seller, status)', () => {
      // @ts-expect-error test invalid enum
      expect(ListingCardSchema.safeParse(createValidListingCard({ fuelType: 'WATER' })).success).toBe(false);
      // @ts-expect-error test invalid enum
      expect(ListingCardSchema.safeParse(createValidListingCard({ transmission: 'SEMIAUTO' })).success).toBe(false);
      // @ts-expect-error test invalid enum
      expect(ListingCardSchema.safeParse(createValidListingCard({ condition: 'REFURBISHED' })).success).toBe(false);
      // @ts-expect-error test invalid enum
      expect(ListingCardSchema.safeParse(createValidListingCard({ sellerType: 'COMPANY' })).success).toBe(false);
    });

    it('rejects unapproved image URL schemes (javascript:, data:, file:)', () => {
      expect(ApprovedImageUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
      expect(ApprovedImageUrlSchema.safeParse('data:image/png;base64,iVBORw0KGgo=').success).toBe(false);
      expect(ApprovedImageUrlSchema.safeParse('file:///etc/passwd').success).toBe(false);
      expect(ApprovedImageUrlSchema.safeParse('https://cdn.arabiyatmart.com/car.webp').success).toBe(true);
      expect(ApprovedImageUrlSchema.safeParse('http://localhost:3000/car.webp').success).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ListingDetailSchema Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('ListingDetailSchema Contract', () => {
    it('successfully parses full vehicle detail retaining all 43 fields', () => {
      const detail = createValidListingDetail();
      const parsed = ListingDetailSchema.parse(detail);

      expect(parsed.publicId).toBe(detail.publicId);
      expect(parsed.make.publicId).toBe('mak_toyota');
      expect(parsed.model.slug).toBe('corolla');
      expect(parsed.generation?.name).toBe('E210 (2018-Present)');
      expect(parsed.trim?.officialPriceCents).toBe(92000000);
      expect(parsed.images).toHaveLength(3);
      expect(parsed.vendor?.displayName.ar).toBe('مركز القاهرة للسيارات');
      expect(parsed.lat).toBe(30.0444);
      expect(parsed.lng).toBe(31.2357);
    });

    it('rejects duplicate image URLs within the media array', () => {
      const duplicateMediaDetail = createValidListingDetail({
        images: [
          { url: 'https://images.unsplash.com/front.jpg', isCover: true, sortOrder: 0 },
          { url: 'https://images.unsplash.com/front.jpg', isCover: false, sortOrder: 1 }, // duplicate URL
        ],
      });

      const res = ListingDetailSchema.safeParse(duplicateMediaDetail);
      expect(res.success).toBe(false);
      if (!res.success) {
        const urlIssue = res.error.issues.find((issue) =>
          issue.message.includes('Media URLs must be unique')
        );
        expect(urlIssue).toBeDefined();
      }
    });

    it('rejects unordered sortOrder values (for example sortOrder 1 followed by 0)', () => {
      const unorderedMediaDetail = createValidListingDetail({
        images: [
          { url: 'https://images.unsplash.com/car-01.jpg', isCover: true, sortOrder: 1 },
          { url: 'https://images.unsplash.com/car-02.jpg', isCover: false, sortOrder: 0 }, // unordered: 1 followed by 0
        ],
      });

      const res = ListingDetailSchema.safeParse(unorderedMediaDetail);
      expect(res.success).toBe(false);
      if (!res.success) {
        const orderIssue = res.error.issues.find((issue) =>
          issue.message.includes('strictly ascending sortOrder')
        );
        expect(orderIssue).toBeDefined();
      }
    });

    it('rejects duplicate sortOrder values (for example sortOrder 0 followed by 0)', () => {
      const duplicateSortDetail = createValidListingDetail({
        images: [
          { url: 'https://images.unsplash.com/car-01.jpg', isCover: true, sortOrder: 0 },
          { url: 'https://images.unsplash.com/car-02.jpg', isCover: false, sortOrder: 0 }, // duplicate sortOrder 0
        ],
      });

      const res = ListingDetailSchema.safeParse(duplicateSortDetail);
      expect(res.success).toBe(false);
      if (!res.success) {
        const dupIssue = res.error.issues.find((issue) =>
          issue.message.includes('sortOrder values must be unique')
        );
        expect(dupIssue).toBeDefined();
      }
    });

    it('rejects multiple images designated as cover', () => {
      const multipleCoversDetail = createValidListingDetail({
        images: [
          { url: 'https://images.unsplash.com/car-01.jpg', isCover: true, sortOrder: 0 },
          { url: 'https://images.unsplash.com/car-02.jpg', isCover: true, sortOrder: 1 }, // multiple covers
        ],
      });

      const res = ListingDetailSchema.safeParse(multipleCoversDetail);
      expect(res.success).toBe(false);
      if (!res.success) {
        const coverIssue = res.error.issues.find((issue) =>
          issue.message.includes('At most one image may be designated as cover')
        );
        expect(coverIssue).toBeDefined();
      }
    });

    it('rejects cover image positioned after a non-cover image in ordered sequence', () => {
      const lateCoverDetail = createValidListingDetail({
        images: [
          { url: 'https://images.unsplash.com/car-01.jpg', isCover: false, sortOrder: 0 },
          { url: 'https://images.unsplash.com/car-02.jpg', isCover: true, sortOrder: 1 }, // cover image not first
        ],
      });

      const res = ListingDetailSchema.safeParse(lateCoverDetail);
      expect(res.success).toBe(false);
      if (!res.success) {
        const posIssue = res.error.issues.find((issue) =>
          issue.message.includes('Cover image must be the first image')
        );
        expect(posIssue).toBeDefined();
      }
    });

    it('rejects more than 20 images', () => {
      const tooManyImages = Array.from({ length: 21 }, (_, i) => ({
        url: `https://images.unsplash.com/car-${i}.jpg`,
        isCover: i === 0,
        sortOrder: i,
      }));

      const res = ListingDetailSchema.safeParse(createValidListingDetail({ images: tooManyImages }));
      expect(res.success).toBe(false);
    });

    it('strictly validates VIN to 17 standard characters (excluding I, O, Q)', () => {
      expect(
        ListingDetailSchema.safeParse(createValidListingDetail({ vin: '1HGCR2F83HA000000' })).success
      ).toBe(true);
      expect(
        ListingDetailSchema.safeParse(createValidListingDetail({ vin: 'INVALID_VIN' })).success
      ).toBe(false);
      // Contains prohibited character 'I'
      expect(
        ListingDetailSchema.safeParse(createValidListingDetail({ vin: '1HGCR2F83IA000000' })).success
      ).toBe(false);
      // Nullable VIN allowed
      expect(ListingDetailSchema.safeParse(createValidListingDetail({ vin: null })).success).toBe(
        true
      );
    });

    it('enforces latitude (-90..90) and longitude (-180..180) coordinate bounds', () => {
      expect(ListingDetailSchema.safeParse(createValidListingDetail({ lat: 91 })).success).toBe(
        false
      );
      expect(ListingDetailSchema.safeParse(createValidListingDetail({ lat: -91 })).success).toBe(
        false
      );
      expect(ListingDetailSchema.safeParse(createValidListingDetail({ lng: 181 })).success).toBe(
        false
      );
      expect(ListingDetailSchema.safeParse(createValidListingDetail({ lng: -181 })).success).toBe(
        false
      );
      expect(
        ListingDetailSchema.safeParse(createValidListingDetail({ lat: null, lng: null })).success
      ).toBe(true);
    });

    it('validates vendor rating between 0 and 5', () => {
      const validDetail = createValidListingDetail();
      const invalidRatingDetail = {
        ...validDetail,
        vendor: {
          ...validDetail.vendor!,
          ratingAverage: 5.5,
        },
      };
      expect(ListingDetailSchema.safeParse(invalidRatingDetail).success).toBe(false);
    });

    it('handles missing media safely (null cover image, empty images array, null vendor logo)', () => {
      const missingMediaCard = createValidListingCard({ coverImageUrl: null });
      expect(ListingCardSchema.parse(missingMediaCard).coverImageUrl).toBeNull();

      const missingMediaDetail = createValidListingDetail({
        images: [],
        vendor: {
          ...createValidListingDetail().vendor!,
          logoUrl: null,
        },
      });
      const parsed = ListingDetailSchema.parse(missingMediaDetail);
      expect(parsed.images).toHaveLength(0);
      expect(parsed.vendor?.logoUrl).toBeNull();
    });

    it('correctly validates unavailable listing statuses (SOLD, ARCHIVED, REMOVED, EXPIRED, PAUSED, REJECTED)', () => {
      const soldDetail = createValidListingDetail({ status: 'SOLD' });
      expect(ListingDetailSchema.parse(soldDetail).status).toBe('SOLD');

      const archivedDetail = createValidListingDetail({ status: 'ARCHIVED' });
      expect(ListingDetailSchema.parse(archivedDetail).status).toBe('ARCHIVED');

      const removedDetail = createValidListingDetail({ status: 'REMOVED' });
      expect(ListingDetailSchema.parse(removedDetail).status).toBe('REMOVED');

      const expiredDetail = createValidListingDetail({ status: 'EXPIRED' });
      expect(ListingDetailSchema.parse(expiredDetail).status).toBe('EXPIRED');

      const pausedDetail = createValidListingDetail({ status: 'PAUSED' });
      expect(ListingDetailSchema.parse(pausedDetail).status).toBe('PAUSED');

      const rejectedDetail = createValidListingDetail({
        status: 'REJECTED',
        rejectionReason: 'Vehicle documentation does not match ownership records',
      });
      const parsedRejected = ListingDetailSchema.parse(rejectedDetail);
      expect(parsedRejected.status).toBe('REJECTED');
      expect(parsedRejected.rejectionReason).toBe(
        'Vehicle documentation does not match ownership records'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Public Cache Separation (CACHE-01)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Public Cache Separation (CACHE-01)', () => {
    it('rejects isFavorited: true in PublicListingCardSchema', () => {
      const favoritedCard = createValidListingCard({ isFavorited: true });
      const res = PublicListingCardSchema.safeParse(favoritedCard);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain('isFavorited: false');
      }
    });

    it('accepts isFavorited: false in PublicListingCardSchema', () => {
      const publicCard = createValidListingCard({ isFavorited: false });
      expect(PublicListingCardSchema.safeParse(publicCard).success).toBe(true);
    });

    it('rejects isFavorited: true in PublicListingDetailSchema', () => {
      const favoritedDetail = createValidListingDetail({ isFavorited: true });
      const res = PublicListingDetailSchema.safeParse(favoritedDetail);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain('isFavorited: false');
      }
    });

    it('accepts isFavorited: false in PublicListingDetailSchema', () => {
      const publicDetail = createValidListingDetail({ isFavorited: false });
      expect(PublicListingDetailSchema.safeParse(publicDetail).success).toBe(true);
    });

    it('stripIdentityOverlay helper resets isFavorited to false', () => {
      const card = createValidListingCard({ isFavorited: true });
      const stripped = stripIdentityOverlay(card);

      expect(stripped.isFavorited).toBe(false);
      expect(PublicListingCardSchema.safeParse(stripped).success).toBe(true);
    });

    it('PublicListingSearchResponseSchema rejects response with favorited card', () => {
      const response = {
        data: [createValidListingCard({ isFavorited: true })],
        meta: { total: 1, page: 1, limit: 20, hasMore: false },
      };
      expect(PublicListingSearchResponseSchema.safeParse(response).success).toBe(false);

      const publicResponse = {
        data: [createValidListingCard({ isFavorited: false })],
        meta: { total: 1, page: 1, limit: 20, hasMore: false },
      };
      expect(PublicListingSearchResponseSchema.safeParse(publicResponse).success).toBe(true);
    });

    it('ListingSearchResponseSchema accepts response with optional identity state', () => {
      const response = {
        data: [createValidListingCard({ isFavorited: true })],
        meta: { total: 1, page: 1, limit: 20, hasMore: false },
      };
      expect(ListingSearchResponseSchema.parse(response)).toEqual(response);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ListingSearchParamsSchema Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('ListingSearchParamsSchema Contract', () => {
    it('successfully parses valid search filters', () => {
      const valid = {
        q: 'تويوتا كورولا',
        makeSlug: 'toyota',
        modelSlug: 'corolla',
        yearMin: 2020,
        yearMax: 2024,
        priceMin: 50000000,
        priceMax: 90000000,
        condition: 'USED' as const,
        fuelType: 'PETROL' as const,
        transmission: 'AUTOMATIC' as const,
        sort: 'newest' as const,
        page: 1,
        limit: 20 as const,
      };

      const parsed = ListingSearchParamsSchema.parse(valid);
      expect(parsed).toEqual(valid);
    });

    it('rejects modelSlug when makeSlug is omitted', () => {
      const res = ListingSearchParamsSchema.safeParse({
        modelSlug: 'corolla',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('modelSlug'));
        expect(issue?.message).toBe('modelSlug requires makeSlug');
      }
    });

    it('rejects yearMax less than yearMin', () => {
      const res = ListingSearchParamsSchema.safeParse({
        yearMin: 2024,
        yearMax: 2020,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('yearMax'));
        expect(issue?.message).toBe('yearMax must be greater than or equal to yearMin');
      }
    });

    it('rejects priceMax less than priceMin', () => {
      const res = ListingSearchParamsSchema.safeParse({
        priceMin: 90000000,
        priceMax: 50000000,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.includes('priceMax'));
        expect(issue?.message).toBe('priceMax must be greater than or equal to priceMin');
      }
    });

    it('strictly enforces discrete limits: 12, 20, 24, 40', () => {
      expect(ListingSearchParamsSchema.safeParse({ limit: 12 }).success).toBe(true);
      expect(ListingSearchParamsSchema.safeParse({ limit: 20 }).success).toBe(true);
      expect(ListingSearchParamsSchema.safeParse({ limit: 24 }).success).toBe(true);
      expect(ListingSearchParamsSchema.safeParse({ limit: 40 }).success).toBe(true);

      expect(ListingSearchParamsSchema.safeParse({ limit: 10 }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ limit: 30 }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ limit: 50 }).success).toBe(false);
    });

    it('rejects oversized page values and non-positive pages', () => {
      expect(ListingSearchParamsSchema.safeParse({ page: 0 }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ page: -1 }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ page: 10001 }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ page: 5 }).success).toBe(true);
    });

    it('rejects unknown sort options', () => {
      expect(ListingSearchParamsSchema.safeParse({ sort: 'cheapest' }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ sort: 'random' }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ sort: 'price_asc' }).success).toBe(true);
      expect(ListingSearchParamsSchema.safeParse({ sort: 'newest' }).success).toBe(true);
    });

    it('validates query term length (min 2, max 120 chars)', () => {
      expect(ListingSearchParamsSchema.safeParse({ q: 'a' }).success).toBe(false);
      expect(ListingSearchParamsSchema.safeParse({ q: 'ab' }).success).toBe(true);
      expect(ListingSearchParamsSchema.safeParse({ q: 'a'.repeat(121) }).success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. ListingSearchUrlSchema & Canonicalization
  // ───────────────────────────────────────────────────────────────────────────
  describe('ListingSearchUrlSchema and Canonicalization', () => {
    it('coerces string numbers and boolean strings from URL parameters', () => {
      const urlParams = {
        q: '  مرسيدس بنز  ',
        makeSlug: 'mercedes-benz',
        yearMin: '2021',
        yearMax: '2024',
        priceMin: '100000000',
        priceMax: '250000000',
        hasWarranty: 'true',
        isNegotiable: 'false',
        sort: 'price_desc',
        page: '2',
        limit: '24',
      };

      const canonical = canonicalizeListingSearchParams(urlParams);
      expect(canonical.q).toBe('مرسيدس بنز');
      expect(canonical.yearMin).toBe(2021);
      expect(canonical.yearMax).toBe(2024);
      expect(canonical.priceMin).toBe(100000000);
      expect(canonical.priceMax).toBe(250000000);
      expect(canonical.hasWarranty).toBe(true);
      expect(canonical.isNegotiable).toBe(false);
      expect(canonical.sort).toBe('price_desc');
      expect(canonical.page).toBe(2);
      expect(canonical.limit).toBe(24);
    });

    it('rejects repeated scalar parameters in URL query inputs', () => {
      const duplicateParams = {
        makeSlug: ['toyota', 'bmw'], // Repeated scalar parameter
      };

      const res = ListingSearchUrlSchema.safeParse(duplicateParams);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain('Repeated scalar parameters are forbidden');
      }
    });

    it('normalizes single-element arrays into scalar values', () => {
      const singleElementArray = {
        makeSlug: ['toyota'],
        sort: ['newest'],
      };

      const parsed = ListingSearchUrlSchema.parse(singleElementArray);
      expect(parsed.makeSlug).toBe('toyota');
      expect(parsed.sort).toBe('newest');
    });

    it('strips empty string query values during preprocessing', () => {
      const emptyParams = {
        q: '   ',
        makeSlug: '',
      };

      const parsed = ListingSearchUrlSchema.parse(emptyParams);
      expect(parsed.q).toBeUndefined();
      expect(parsed.makeSlug).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Compare Item and Compare Selection Schemas
  // ───────────────────────────────────────────────────────────────────────────
  describe('CompareItemRefSchema and Compare Selection Contracts', () => {
    it('parses discriminated union on kind: listing (slug) and trim (publicId)', () => {
      const listingRef = { kind: 'listing' as const, id: 'hyundai-tucson-2023' };
      expect(CompareItemRefSchema.parse(listingRef)).toEqual(listingRef);

      const trimRef = { kind: 'trim' as const, id: 'trm_active_plus_01' };
      expect(CompareItemRefSchema.parse(trimRef)).toEqual(trimRef);

      // Invalid slug for listing
      expect(CompareItemRefSchema.safeParse({ kind: 'listing', id: 'HYUNDAI TUCSON' }).success).toBe(
        false
      );

      // Unknown kind
      expect(
        CompareItemRefSchema.safeParse({ kind: 'car', id: 'hyundai-tucson' }).success
      ).toBe(false);
    });

    it('parses valid compare item URL strings via CompareItemParamSchema', () => {
      expect(CompareItemParamSchema.parse('listing:toyota-corolla-2023')).toEqual({
        kind: 'listing',
        id: 'toyota-corolla-2023',
      });

      expect(CompareItemParamSchema.parse('trim:trm_e210_01')).toEqual({
        kind: 'trim',
        id: 'trm_e210_01',
      });

      // Malformed inputs
      expect(CompareItemParamSchema.safeParse('corolla-2023').success).toBe(false);
      expect(CompareItemParamSchema.safeParse('unknown:corolla').success).toBe(false);
      expect(CompareItemParamSchema.safeParse('listing:').success).toBe(false);
    });

    it('enforces maximum 3 items in compare selection (TASK-008 step 3 & TASK-044)', () => {
      const threeItems = [
        { kind: 'listing' as const, id: 'toyota-corolla' },
        { kind: 'listing' as const, id: 'honda-civic' },
        { kind: 'listing' as const, id: 'hyundai-elantra' },
      ];
      expect(CompareParamsSchema.safeParse({ items: threeItems }).success).toBe(true);

      const fourItems = [
        ...threeItems,
        { kind: 'listing' as const, id: 'nissan-sentra' },
      ];
      const res = CompareParamsSchema.safeParse({ items: fourItems });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain('At most three items');
      }
    });

    it('rejects duplicate compare items in selection', () => {
      const duplicateItems = [
        { kind: 'listing' as const, id: 'toyota-corolla' },
        { kind: 'listing' as const, id: 'toyota-corolla' },
      ];
      const res = CompareParamsSchema.safeParse({ items: duplicateItems });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) =>
          i.message.includes('Duplicate compare items are not allowed')
        );
        expect(issue).toBeDefined();
      }
    });

    it('parseCompareUrlItems extracts, deduplicates, and caps at 3 items', () => {
      const rawParams = [
        'listing:toyota-corolla',
        'listing:toyota-corolla', // duplicate
        'listing:honda-civic',
        'trim:trm_hyundai_01',
        'listing:kia-cerato', // 4th item - should be capped at 3
      ];

      const parsed = parseCompareUrlItems(rawParams);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ kind: 'listing', id: 'toyota-corolla' });
      expect(parsed[1]).toEqual({ kind: 'listing', id: 'honda-civic' });
      expect(parsed[2]).toEqual({ kind: 'trim', id: 'trm_hyundai_01' });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Comparison Workspace View Contracts
  // ───────────────────────────────────────────────────────────────────────────
  describe('Comparison Workspace View Contracts (Section 2.11)', () => {
    it('validates ComparisonItem and rejects invalid detail routes or power values', () => {
      const item = {
        id: 'cmp_item_01',
        title: 'تويوتا كورولا 2023',
        subtitle: 'فئة ثانية أكتيف بلس',
        detailRoute: '/ar/listing/toyota-corolla-2023',
        imageUrl: 'https://images.unsplash.com/car.jpg',
        priceCents: 85000000,
        powerHp: 120,
        warrantyYears: 3,
        engineCc: 1600,
        mileageKm: 15000,
        seats: 5,
        transmission: 'AUTOMATIC' as const,
        fuelType: 'PETROL' as const,
        bodyType: 'SEDAN' as const,
      };

      expect(ComparisonItemSchema.parse(item)).toEqual(item);

      // Relative path starting with / required
      expect(
        ComparisonItemSchema.safeParse({ ...item, detailRoute: 'https://external.com' }).success
      ).toBe(false);

      // Negative power rejected
      expect(ComparisonItemSchema.safeParse({ ...item, powerHp: -50 }).success).toBe(false);
    });

    it('enforces column alignment between display and numeric arrays in ComparisonSpecRow', () => {
      const alignedRow = {
        label: 'قوة المحرك (حصان)',
        display: ['120 حصان', '140 حصان'],
        numeric: [120, 140],
        better: 'higher' as const,
      };
      expect(ComparisonSpecRowSchema.parse(alignedRow)).toEqual(alignedRow);

      const misalignedRow = {
        label: 'قوة المحرك (حصان)',
        display: ['120 حصان', '140 حصان'],
        numeric: [120], // length 1 vs display length 2
        better: 'higher' as const,
      };
      const res = ComparisonSpecRowSchema.safeParse(misalignedRow);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe('display and numeric columns must align');
      }
    });

    it('validates full ComparePageData up to 4 items and rejects >4 items', () => {
      const item = {
        id: 'cmp_01',
        title: 'تويوتا كورولا',
        subtitle: null,
        detailRoute: '/ar/listing/corolla',
        imageUrl: null,
        priceCents: 85000000,
        powerHp: 120,
        warrantyYears: 3,
        engineCc: 1600,
        mileageKm: 15000,
        seats: 5,
        transmission: 'AUTOMATIC' as const,
        fuelType: 'PETROL' as const,
        bodyType: 'SEDAN' as const,
      };

      const validPageData = {
        items: [item, { ...item, id: 'cmp_02' }],
        rows: [
          {
            label: 'السعر',
            display: ['850,000 ج.م', '900,000 ج.م'],
            numeric: [85000000, 90000000],
            better: 'lower' as const,
          },
        ],
      };
      expect(ComparePageDataSchema.parse(validPageData)).toEqual(validPageData);

      const fiveItems = Array.from({ length: 5 }, (_, i) => ({
        ...item,
        id: `cmp_0${i + 1}`,
      }));
      expect(
        ComparePageDataSchema.safeParse({ items: fiveItems, rows: [] }).success
      ).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Operation, Cursor, Batch, and Mutation Responses
  // ───────────────────────────────────────────────────────────────────────────
  describe('Batch, Cursor, and Mutation Responses', () => {
    it('validates ListingBatchParamsSchema: requires 1..4 unique slugs', () => {
      expect(ListingBatchParamsSchema.parse({ slugs: ['toyota-corolla', 'honda-civic'] })).toEqual({
        slugs: ['toyota-corolla', 'honda-civic'],
      });

      // Duplicate slugs rejected
      expect(
        ListingBatchParamsSchema.safeParse({ slugs: ['toyota-corolla', 'toyota-corolla'] }).success
      ).toBe(false);

      // Empty slugs rejected
      expect(ListingBatchParamsSchema.safeParse({ slugs: [] }).success).toBe(false);

      // > 4 slugs rejected
      expect(
        ListingBatchParamsSchema.safeParse({
          slugs: ['slug-1', 'slug-2', 'slug-3', 'slug-4', 'slug-5'],
        }).success
      ).toBe(false);
    });

    it('validates ListingBatchResponseSchema and PublicListingBatchResponseSchema (max 4)', () => {
      const cards = [createValidListingCard({ isFavorited: false })];
      expect(ListingBatchResponseSchema.parse({ data: cards })).toBeDefined();
      expect(PublicListingBatchResponseSchema.parse({ data: cards })).toBeDefined();

      const favoritedCards = [createValidListingCard({ isFavorited: true })];
      expect(PublicListingBatchResponseSchema.safeParse({ data: favoritedCards }).success).toBe(
        false
      );
    });

    it('validates FavoriteMutationResponseSchema', () => {
      expect(FavoriteMutationResponseSchema.parse({ data: { favorited: true } })).toEqual({
        data: { favorited: true },
      });
      expect(FavoriteMutationResponseSchema.parse({ data: { favorited: false } })).toEqual({
        data: { favorited: false },
      });
    });

    it('validates MyListingSchema extending ListingCard with status, rejectionReason, and leadsCount', () => {
      const myListing = {
        ...createValidListingCard(),
        status: 'PENDING_REVIEW' as const,
        rejectionReason: null,
        leadsCount: 12,
      };

      const parsed = MyListingSchema.parse(myListing);
      expect(parsed.status).toBe('PENDING_REVIEW');
      expect(parsed.leadsCount).toBe(12);
    });

    it('validates MyListingsResponseSchema and ListingCursorResponseSchema', () => {
      const myListing = {
        ...createValidListingCard(),
        status: 'ACTIVE' as const,
        rejectionReason: null,
        leadsCount: 5,
      };

      const cursorResp = {
        data: [createValidListingCard()],
        meta: { hasMore: true, nextCursor: 'cur_next_abc' },
      };
      expect(ListingCursorResponseSchema.parse(cursorResp)).toBeDefined();

      const myListingsResp = {
        data: [myListing],
        meta: { hasMore: false, nextCursor: null },
      };
      expect(MyListingsResponseSchema.parse(myListingsResp)).toBeDefined();
    });

    it('validates ListingCardResponseSchema, ListingDetailResponseSchema, and ListingListResponseSchema', () => {
      expect(ListingCardResponseSchema.parse({ data: createValidListingCard() })).toBeDefined();
      expect(ListingDetailResponseSchema.parse({ data: createValidListingDetail() })).toBeDefined();
      expect(ListingListResponseSchema.parse({ data: [createValidListingCard()] })).toBeDefined();
    });
  });
});
