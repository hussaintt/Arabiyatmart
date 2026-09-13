import { describe, expect, it } from 'vitest';
import {
  AreaListResponseSchema,
  AreaSchema,
  CatalogueTrimDetailSchema,
  CityAreasParamsSchema,
  CityListResponseSchema,
  CitySchema,
  CountryCitiesParamsSchema,
  CountryCodeParamsSchema,
  CountryConfigResponseSchema,
  CountryConfigSchema,
  CountryListResponseSchema,
  CountrySchema,
  GenerationListResponseSchema,
  GenerationSchema,
  GenerationSummarySchema,
  MakeDealersParamsSchema,
  MakeListResponseSchema,
  MakeSchema,
  ModelPageResponseSchema,
  ModelPageSchema,
  ModelPathParamsSchema,
  ModelWithPriceSchema,
  ModelsWithPricesParamsSchema,
  ModelsWithPricesResponseSchema,
  PriceHistoryEntrySchema,
  SpotlightItemSchema,
  SpotlightParamsSchema,
  SpotlightResponseSchema,
  TaxonomyGenerationsParamsSchema,
  TaxonomyModelsParamsSchema,
  TaxonomyTrimsParamsSchema,
  TrimAncestrySchema,
  TrimDealerSchema,
  TrimDealersParamsSchema,
  TrimDealersResponseSchema,
  TrimListResponseSchema,
  TrimPathParamsSchema,
  TrimResponseSchema,
  TrimSchema,
  TrimSummarySchema,
  VehicleModelListResponseSchema,
  VehicleModelSchema,
  adaptRawAreaList,
  adaptRawCatalogueTrimDetail,
  adaptRawCityList,
  adaptRawCountryConfig,
  adaptRawCountryList,
  adaptRawGenerationList,
  adaptRawMake,
  adaptRawMakeList,
  adaptRawModelPage,
  adaptRawModelsWithPrices,
  adaptRawSpotlight,
  adaptRawTrim,
  adaptRawTrimDealers,
  adaptRawTrimDetail,
  adaptRawTrimList,
  adaptRawVehicleModel,
  adaptRawVehicleModelList,
  unwrapDataArray,
  unwrapDataObject,
} from '@/lib/api/schemas/taxonomy';
import {
  ActiveVendorStateSchema,
  BusinessDayHoursSchema,
  DealerBranchSchema,
  DealerDirectoryItemSchema,
  DealerDirectoryResponseSchema,
  DealerInventoryParamsSchema,
  DealerListParamsSchema,
  DealerProfileResponseSchema,
  DealerProfileSchema,
  MyVendorsResponseSchema,
  StoreTypeSchema,
  VendorMembershipSchema,
  VendorMembershipWithVendorSchema,
  VendorRoleSchema,
  VendorSchema,
  VendorStatusSchema,
  WeeklyBusinessHoursSchema,
  adaptRawDealerBranch,
  adaptRawDealerDirectory,
  adaptRawDealerProfile,
  adaptRawMyVendors,
  isOvernightHours,
  resolveActiveVendorState,
} from '@/lib/api/schemas/dealer';
import {
  DEFAULT_FINANCE_CONFIG,
  FinanceConfigSchema,
  PublicSettingSchema,
  PublicSettingsResponseSchema,
  SettingGroupSchema,
  SettingTypeSchema,
  SupportConfigSchema,
  adaptRawPublicSettings,
  deriveFinanceConfig,
  deriveSupportConfig,
} from '@/lib/api/schemas/settings';
import {
  BannerListParamsSchema,
  BannerPositionSchema,
  HomeBannerListResponseSchema,
  HomeBannerSchema,
  HomePageDataSchema,
  adaptRawBanner,
  adaptRawBannerList,
  adaptRawHomePageData,
} from '@/lib/api/schemas/home';
import type { Make, VehicleModel, Generation, Trim } from '@/types/taxonomy';
import type { DealerBranch, DealerProfile, Vendor, VendorMembershipWithVendor } from '@/types/dealer';
import type { PublicSetting } from '@/types/settings';
import type { HomeBanner, HomePageData } from '@/types/home';
import type { ListingCard } from '@/types/listing';

// ── Fixture Helpers ─────────────────────────────────────────────────────────

function createValidMake(overrides: Partial<Make> = {}): Make {
  return {
    publicId: 'mak_toyota_01',
    slug: 'toyota',
    name: { ar: 'تويوتا', en: 'Toyota' },
    logoUrl: 'https://images.unsplash.com/toyota-logo.png',
    countryOfOrigin: 'Japan',
    isActive: true,
    sortOrder: 1,
    activeListingCount: 150,
    ...overrides,
  };
}

function createValidVehicleModel(overrides: Partial<VehicleModel> = {}): VehicleModel {
  return {
    publicId: 'mdl_corolla_01',
    slug: 'corolla',
    name: { ar: 'كورولا', en: 'Corolla' },
    bodyType: 'SEDAN',
    vehicleType: 'CAR',
    isActive: true,
    sortOrder: 1,
    activeListingCount: 85,
    ...overrides,
  };
}

function createValidGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    publicId: 'gen_corolla_e210',
    name: 'E210 (12th Generation)',
    startYear: 2018,
    endYear: 2024,
    ...overrides,
  };
}

function createValidTrim(overrides: Partial<Trim> = {}): Trim {
  return {
    publicId: 'trm_corolla_active_16',
    name: { ar: 'اكتيف 1.6', en: 'Active 1.6L' },
    modelYear: 2023,
    engineCc: 1598,
    powerHp: 120,
    torqueNm: 154,
    fuelType: 'PETROL',
    transmission: 'CVT',
    drivetrain: 'FWD',
    seats: 5,
    fuelEconomyKmL: 14.5,
    warrantyYears: 5,
    warrantyKm: 150000,
    specs: { airConditioning: true, airbags: 6, cruiseControl: true },
    officialPriceCents: 85000000,
    marketPriceCents: 87000000,
    currency: 'EGP',
    brochureUrl: 'https://toyota.com.eg/brochures/corolla-2023.pdf',
    isActive: true,
    ...overrides,
  };
}

function createValidBranch(overrides: Partial<DealerBranch> = {}): DealerBranch {
  return {
    publicId: 'brn_main_cairo',
    name: { ar: 'فرع مدينة نصر', en: 'Nasr City Branch' },
    cityId: 1,
    areaId: 10,
    addressLine: 'شارع عباس العقاد، مدينة نصر',
    phone: '+201012345678',
    hours: {
      monday: { open: '09:00', close: '22:00' },
      friday: { open: '14:00', close: '22:00' },
    },
    lat: 30.0561,
    lng: 31.3412,
    ...overrides,
  };
}

function createValidDealerProfile(overrides: Partial<DealerProfile> = {}): DealerProfile {
  return {
    publicId: 'dlr_auto_star',
    slug: 'auto-star-motors',
    displayName: { ar: 'أوتو ستار للسيارات', en: 'Auto Star Motors' },
    description: { ar: 'أفضل موزع معتمد في مصر', en: 'Premier authorized dealer in Egypt' },
    logoUrl: 'https://images.unsplash.com/dealer-logo.png',
    bannerUrl: 'https://images.unsplash.com/dealer-banner.png',
    storeType: 'COMPANY',
    isVerified: true,
    activeListingCount: 42,
    branchCount: 1,
    ratingAverage: 4.8,
    reviewCount: 128,
    branches: [createValidBranch()],
    ...overrides,
  };
}

function createValidVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    publicId: 'vnd_auto_star_01',
    slug: 'auto-star-motors',
    legalName: 'Auto Star Motors SAE',
    displayName: { ar: 'أوتو ستار للسيارات', en: 'Auto Star Motors' },
    description: { ar: 'أفضل موزع معتمد في مصر', en: 'Premier authorized dealer in Egypt' },
    email: 'info@autostar.com',
    phone: '+201098765432',
    logoUrl: 'https://images.unsplash.com/dealer-logo.png',
    bannerUrl: 'https://images.unsplash.com/dealer-banner.png',
    status: 'APPROVED',
    approvedAt: '2025-01-10T12:00:00.000Z',
    storeType: 'COMPANY',
    businessAddressLine: '12 شارع النصر، المعادي',
    businessCountryId: 1,
    businessCityId: 1,
    businessPostalCode: '11728',
    defaultCurrency: 'EGP',
    createdAt: '2024-12-01T10:00:00.000Z',
    ...overrides,
  };
}

function createValidListingCard(): ListingCard {
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
  };
}

// ── 1. Taxonomy & Catalogue Contracts ───────────────────────────────────────

describe('Taxonomy & Catalogue Contracts', () => {
  describe('MakeSchema', () => {
    it('validates a complete valid make', () => {
      const make = createValidMake();
      expect(() => MakeSchema.parse(make)).not.toThrow();
    });

    it('accepts inactive taxonomy items (isActive: false)', () => {
      const inactiveMake = createValidMake({ isActive: false });
      const parsed = MakeSchema.parse(inactiveMake);
      expect(parsed.isActive).toBe(false);
    });

    it('accepts null nullable fields', () => {
      const minimalMake = createValidMake({
        logoUrl: null,
        countryOfOrigin: null,
        activeListingCount: null,
      });
      const parsed = MakeSchema.parse(minimalMake);
      expect(parsed.logoUrl).toBeNull();
      expect(parsed.activeListingCount).toBeNull();
    });

    it('rejects missing translations in name', () => {
      const invalid = {
        ...createValidMake(),
        name: { ar: 'تويوتا' }, // Missing 'en'
      };
      expect(() => MakeSchema.parse(invalid)).toThrow();
    });

    it('rejects malformed media URL', () => {
      const invalid = createValidMake({ logoUrl: 'not-a-valid-url' });
      expect(() => MakeSchema.parse(invalid)).toThrow();
    });
  });

  describe('Make Adapters (OUT-01)', () => {
    it('strips internal numeric ID and handles undefined activeListingCount from raw make', () => {
      const rawMake = {
        id: 1, // internal DB ID
        publicId: 'mak_hyundai_01',
        slug: 'hyundai',
        name: { ar: 'هيونداي', en: 'Hyundai' },
        logoUrl: 'https://example.com/hyundai.png',
        countryOfOrigin: 'South Korea',
        isActive: true,
        sortOrder: 2,
        // activeListingCount omitted by serializer
      };

      const adapted = adaptRawMake(rawMake);
      expect(adapted.publicId).toBe('mak_hyundai_01');
      expect((adapted as unknown as Record<string, unknown>).id).toBeUndefined();
      expect(adapted.activeListingCount).toBeNull();
      expect(() => MakeSchema.parse(adapted)).not.toThrow();
    });

    it('adapts bare array and wrapped { data } upstream responses', () => {
      const rawList = [
        { id: 1, publicId: 'mak_1', slug: 'toyota', name: { ar: 'تويوتا', en: 'Toyota' }, isActive: true, sortOrder: 1 },
        { id: 2, publicId: 'mak_2', slug: 'bmw', name: { ar: 'بي إم دبليو', en: 'BMW' }, isActive: false, sortOrder: 2 },
      ];

      const fromBare = adaptRawMakeList(rawList);
      expect(fromBare.data).toHaveLength(2);
      expect(fromBare.data[0]!.publicId).toBe('mak_1');
      expect((fromBare.data[0] as unknown as Record<string, unknown>).id).toBeUndefined();
      expect(() => MakeListResponseSchema.parse(fromBare)).not.toThrow();

      const fromWrapped = adaptRawMakeList({ data: rawList });
      expect(fromWrapped.data).toHaveLength(2);
    });
  });

  describe('VehicleModelSchema & Adapters', () => {
    it('validates a complete model', () => {
      const model = createValidVehicleModel();
      expect(() => VehicleModelSchema.parse(model)).not.toThrow();
    });

    it('accepts inactive model and null bodyType/vehicleType', () => {
      const model = createValidVehicleModel({
        isActive: false,
        bodyType: null,
        vehicleType: null,
      });
      const parsed = VehicleModelSchema.parse(model);
      expect(parsed.isActive).toBe(false);
      expect(parsed.bodyType).toBeNull();
    });

    it('strips internal IDs and normalizes raw model list', () => {
      const rawModels = [
        { id: 10, makeId: 1, publicId: 'mdl_1', slug: 'corolla', name: { ar: 'كورولا', en: 'Corolla' }, isActive: true, sortOrder: 1 },
      ];
      expect(adaptRawVehicleModel(rawModels[0]!).publicId).toBe('mdl_1');
      const res = adaptRawVehicleModelList(rawModels);
      expect(res.data[0]!.publicId).toBe('mdl_1');
      expect((res.data[0] as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((res.data[0] as unknown as Record<string, unknown>).makeId).toBeUndefined();
      expect(res.data[0]!.activeListingCount).toBeNull();
      expect(() => VehicleModelListResponseSchema.parse(res)).not.toThrow();
    });
  });

  describe('GenerationSchema', () => {
    it('validates a valid generation range', () => {
      const gen = createValidGeneration();
      expect(() => GenerationSchema.parse(gen)).not.toThrow();
    });

    it('accepts null endYear for ongoing generations', () => {
      const gen = createValidGeneration({ endYear: null });
      expect(GenerationSchema.parse(gen).endYear).toBeNull();
    });

    it('rejects endYear preceding startYear', () => {
      const invalid = createValidGeneration({ startYear: 2020, endYear: 2018 });
      expect(() => GenerationSchema.parse(invalid)).toThrow(/endYear must not precede startYear/);
    });

    it('rejects years outside [1900, 2100]', () => {
      const invalid = createValidGeneration({ startYear: 1850 });
      expect(() => GenerationSchema.parse(invalid)).toThrow();
    });

    it('adapts generation list and strips internal IDs', () => {
      const rawGenerations = [
        { id: 100, modelId: 10, publicId: 'gen_1', name: 'Generation 1', startYear: 2015, endYear: 2020 },
      ];
      const res = adaptRawGenerationList(rawGenerations);
      expect(res.data[0]!.publicId).toBe('gen_1');
      expect((res.data[0] as unknown as Record<string, unknown>).id).toBeUndefined();
      expect(() => GenerationListResponseSchema.parse(res)).not.toThrow();
    });
  });

  describe('TrimSchema & Catalogue Detail', () => {
    it('validates a complete trim', () => {
      const trim = createValidTrim();
      expect(() => TrimSchema.parse(trim)).not.toThrow();
    });

    it('validates trim with null specs, prices, and brochureUrl', () => {
      const minimalTrim = createValidTrim({
        specs: null,
        officialPriceCents: null,
        marketPriceCents: null,
        brochureUrl: null,
      });
      const parsed = TrimSchema.parse(minimalTrim);
      expect(parsed.specs).toBeNull();
      expect(parsed.officialPriceCents).toBeNull();
    });

    it('rejects malformed brochure URL', () => {
      const invalid = createValidTrim({ brochureUrl: 'not-a-valid-url' });
      expect(() => TrimSchema.parse(invalid)).toThrow();
    });

    it('adapts raw trim and trims list', () => {
      const rawTrim = {
        id: 50,
        publicId: 'trm_1',
        name: { ar: 'تريم 1', en: 'Trim 1' },
        modelYear: 2022,
        currency: 'EGP',
        isActive: true,
      };
      expect(adaptRawTrim(rawTrim).publicId).toBe('trm_1');
      const single = adaptRawTrimDetail(rawTrim);
      expect(single.data.publicId).toBe('trm_1');
      expect((single.data as unknown as Record<string, unknown>).id).toBeUndefined();
      expect(() => TrimResponseSchema.parse(single)).not.toThrow();

      const list = adaptRawTrimList([rawTrim]);
      expect(list.data).toHaveLength(1);
      expect(() => TrimListResponseSchema.parse(list)).not.toThrow();
    });

    it('validates CatalogueTrimDetail with ancestry and price history', () => {
      const detail = {
        ...createValidTrim(),
        generation: {
          publicId: 'gen_corolla_e210',
          name: 'E210',
          model: {
            publicId: 'mdl_corolla_01',
            slug: 'corolla',
            name: { ar: 'كورولا', en: 'Corolla' },
            make: {
              publicId: 'mak_toyota_01',
              slug: 'toyota',
              name: { ar: 'تويوتا', en: 'Toyota' },
            },
          },
        },
        priceHistory: [
          {
            priceCents: 85000000,
            priceType: 'OFFICIAL',
            effectiveAt: '2023-01-01T00:00:00.000Z',
            source: 'DEALER_BULLETIN',
          },
        ],
      };
      expect(() => CatalogueTrimDetailSchema.parse(detail)).not.toThrow();
      expect(() => PriceHistoryEntrySchema.parse(detail.priceHistory[0]!)).not.toThrow();
      expect(() => TrimAncestrySchema.parse(detail.generation)).not.toThrow();
      expect(adaptRawCatalogueTrimDetail(detail).data.publicId).toBe(detail.publicId);
    });
  });

  describe('Spotlight & Models With Prices', () => {
    it('validates spotlight response and zero active listings', () => {
      const spotlightItem = {
        modelPublicId: 'mdl_1',
        modelSlug: 'corolla',
        modelName: { ar: 'كورولا', en: 'Corolla' },
        makeName: { ar: 'تويوتا', en: 'Toyota' },
        makeSlug: 'toyota',
        makeLogoUrl: 'https://example.com/logo.png',
        bodyType: 'SEDAN',
        startingPriceCents: 85000000,
        currency: 'EGP',
        activeNewListingCount: 0,
      };
      expect(() => SpotlightItemSchema.parse(spotlightItem)).not.toThrow();
      const res = adaptRawSpotlight([spotlightItem]);
      expect(res.data[0]!.activeNewListingCount).toBe(0);
      expect(() => SpotlightResponseSchema.parse(res)).not.toThrow();
    });

    it('validates model with starting price', () => {
      const modelWithPrice = {
        publicId: 'mdl_1',
        slug: 'corolla',
        name: { ar: 'كورولا', en: 'Corolla' },
        bodyType: 'SEDAN',
        vehicleType: 'CAR',
        startingPriceCents: 80000000,
        currency: 'EGP',
        activeListingCount: 15,
      };
      expect(() => ModelWithPriceSchema.parse(modelWithPrice)).not.toThrow();
      const res = adaptRawModelsWithPrices([modelWithPrice]);
      expect(res.data[0]!.startingPriceCents).toBe(80000000);
      expect(() => ModelsWithPricesResponseSchema.parse(res)).not.toThrow();
    });

    it('validates full ModelPageResponse', () => {
      const page = {
        publicId: 'mdl_1',
        slug: 'corolla',
        name: { ar: 'كورولا', en: 'Corolla' },
        bodyType: 'SEDAN',
        vehicleType: 'CAR',
        make: {
          publicId: 'mak_1',
          slug: 'toyota',
          name: { ar: 'تويوتا', en: 'Toyota' },
          logoUrl: 'https://example.com/logo.png',
        },
        startingPriceCents: 85000000,
        currency: 'EGP',
        activeNewListingCount: 5,
        generations: [
          { publicId: 'gen_1', name: 'Gen 12', startYear: 2018, endYear: 2024, trimCount: 3 },
        ],
        trims: [
          {
            publicId: 'trm_1',
            name: { ar: 'اكتيف', en: 'Active' },
            modelYear: 2023,
            engineCc: 1600,
            powerHp: 120,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            officialPriceCents: 85000000,
            marketPriceCents: 87000000,
            currency: 'EGP',
            isActive: true,
          },
        ],
      };
      expect(() => ModelPageSchema.parse(page)).not.toThrow();
      expect(() => GenerationSummarySchema.parse(page.generations[0]!)).not.toThrow();
      expect(() => TrimSummarySchema.parse(page.trims[0]!)).not.toThrow();
      const adaptedPage = adaptRawModelPage(page);
      expect(adaptedPage.data.publicId).toBe('mdl_1');
      expect(() => ModelPageResponseSchema.parse(adaptedPage)).not.toThrow();
    });

    it('validates TrimDealers with zero inventory', () => {
      const dealer = {
        publicId: 'dlr_1',
        slug: 'auto-star',
        displayName: { ar: 'أوتو ستار', en: 'Auto Star' },
        logoUrl: null,
        cityName: { ar: 'القاهرة', en: 'Cairo' },
        isVerified: true,
        listingCount: 0,
        startingPriceCents: null,
        currency: 'EGP',
      };
      expect(() => TrimDealerSchema.parse(dealer)).not.toThrow();
      const res = adaptRawTrimDealers([dealer]);
      expect(res.data[0]!.listingCount).toBe(0);
      expect(() => TrimDealersResponseSchema.parse(res)).not.toThrow();
    });
  });

  describe('Location Schemas & Adapters', () => {
    it('allows numeric identifiers on locations (City, Area, Country)', () => {
      const country = {
        id: 1,
        code: 'EG',
        name: { ar: 'مصر', en: 'Egypt' },
        phoneCode: '+20',
        currency: 'EGP',
        configJson: null,
        isActive: true,
      };
      const city = {
        id: 10,
        countryId: 1,
        name: { ar: 'القاهرة', en: 'Cairo' },
        isActive: true,
      };
      const area = {
        id: 100,
        cityId: 10,
        name: { ar: 'مدينة نصر', en: 'Nasr City' },
        postalCode: '11765',
        isActive: true,
      };

      expect(() => CountrySchema.parse(country)).not.toThrow();
      expect(() => CitySchema.parse(city)).not.toThrow();
      expect(() => AreaSchema.parse(area)).not.toThrow();
    });

    it('adapts bare array responses from Fastify locations routes', () => {
      const rawCountries = [
        { id: 1, code: 'EG', name: { ar: 'مصر', en: 'Egypt' }, phoneCode: '+20', currency: 'EGP', isActive: true },
      ];
      const rawCities = [
        { id: 1, countryId: 1, name: { ar: 'القاهرة', en: 'Cairo' }, isActive: true },
      ];
      const rawAreas = [
        { id: 1, cityId: 1, name: { ar: 'المعادي', en: 'Maadi' }, postalCode: null, isActive: true },
      ];

      const countriesRes = adaptRawCountryList(rawCountries);
      expect(countriesRes.data).toHaveLength(1);
      expect(() => CountryListResponseSchema.parse(countriesRes)).not.toThrow();

      const citiesRes = adaptRawCityList(rawCities);
      expect(citiesRes.data).toHaveLength(1);
      expect(() => CityListResponseSchema.parse(citiesRes)).not.toThrow();

      const areasRes = adaptRawAreaList(rawAreas);
      expect(areasRes.data).toHaveLength(1);
      expect(() => AreaListResponseSchema.parse(areasRes)).not.toThrow();
    });

    it('adapts CountryConfig nested configuration object', () => {
      const rawBackendConfig = {
        code: 'EG',
        currency: 'EGP',
        config: {
          currencySymbol: 'ج.م',
          phoneFormat: '+20 ## #### ####',
          legalDisclaimer: { ar: 'الشروط سارية', en: 'Terms apply' },
          defaultInterestRate: 0.12,
        },
      };

      const adapted = adaptRawCountryConfig(rawBackendConfig);
      expect(adapted.data.code).toBe('EG');
      expect(adapted.data.currencySymbol).toBe('ج.م');
      expect(adapted.data.defaultInterestRate).toBe(0.12);
      expect(adapted.data.legalDisclaimer?.en).toBe('Terms apply');
      expect(() => CountryConfigSchema.parse(adapted.data)).not.toThrow();
      expect(() => CountryConfigResponseSchema.parse(adapted)).not.toThrow();
    });

    it('rejects invalid country code (not 2 uppercase letters)', () => {
      const invalid = {
        id: 1,
        code: 'egypt', // must be 2 uppercase characters
        name: { ar: 'مصر', en: 'Egypt' },
        phoneCode: '+20',
        currency: 'EGP',
        configJson: null,
        isActive: true,
      };
      expect(() => CountrySchema.parse(invalid)).toThrow();
    });
  });

  describe('Taxonomy Params Schemas', () => {
    it('validates SpotlightParams limit bounds [1, 50]', () => {
      expect(() => SpotlightParamsSchema.parse({ limit: 10 })).not.toThrow();
      expect(() => SpotlightParamsSchema.parse({ limit: 0 })).toThrow();
      expect(() => SpotlightParamsSchema.parse({ limit: 51 })).toThrow();
    });

    it('validates ModelsWithPricesParams and MakeDealersParams', () => {
      expect(() => ModelsWithPricesParamsSchema.parse({ makeSlug: 'toyota', condition: 'NEW' })).not.toThrow();
      expect(() => MakeDealersParamsSchema.parse({ makeSlug: 'toyota', limit: 20 })).not.toThrow();
      expect(() => TrimDealersParamsSchema.parse({ publicId: 'trm_1' })).not.toThrow();
      expect(() => TrimPathParamsSchema.parse({ publicId: 'trm_1' })).not.toThrow();
      expect(() => TaxonomyModelsParamsSchema.parse({ makeSlug: 'toyota' })).not.toThrow();
      expect(() => TaxonomyGenerationsParamsSchema.parse({ modelPublicId: 'mdl_1' })).not.toThrow();
      expect(() => TaxonomyTrimsParamsSchema.parse({ generationPublicId: 'gen_1' })).not.toThrow();
    });

    it('validates path parameter schemas', () => {
      expect(() => ModelPathParamsSchema.parse({ publicId: 'mdl_corolla' })).not.toThrow();
      expect(() => CountryCodeParamsSchema.parse({ code: 'EG' })).not.toThrow();
      expect(CountryCodeParamsSchema.parse({ code: 'eg' }).code).toBe('EG');
      expect(() => CountryCodeParamsSchema.parse({ code: 'EGY' })).toThrow();
      expect(() => CountryCodeParamsSchema.parse({ code: 'E' })).toThrow();
      expect(() => CountryCitiesParamsSchema.parse({ code: 'EG' })).not.toThrow();
      expect(() => CityAreasParamsSchema.parse({ cityId: 1 })).not.toThrow();
      expect(() => CityAreasParamsSchema.parse({ cityId: -1 })).toThrow();
    });
  });
});

// ── 2. Dealer Directory, Profile & Vendor Contracts ─────────────────────────

describe('Dealer Directory, Profile & Vendor Contracts', () => {
  describe('DealerDirectoryItemSchema & Directory Response', () => {
    it('validates directory item and zero inventory dealer', () => {
      const item = {
        publicId: 'dlr_cairo_motors',
        slug: 'cairo-motors',
        displayName: { ar: 'كايرو موتورز', en: 'Cairo Motors' },
        logoUrl: 'https://example.com/logo.png',
        cityName: { ar: 'القاهرة', en: 'Cairo' },
        activeListingCount: 0,
        isVerified: true,
      };
      expect(() => DealerDirectoryItemSchema.parse(item)).not.toThrow();
    });

    it('adapts raw directory list, strips internal IDs, and maps cursor meta', () => {
      const rawDirectory = {
        data: [
          {
            id: 42,
            vendorId: 99,
            publicId: 'dlr_cairo_motors',
            slug: 'cairo-motors',
            displayName: { ar: 'كايرو موتورز', en: 'Cairo Motors' },
            logoUrl: null,
            cityName: null,
            activeListingCount: 5,
            isVerified: false,
          },
        ],
        meta: {
          hasMore: true,
          nextCursor: 'cursor_token_123',
        },
      };

      const res = adaptRawDealerDirectory(rawDirectory);
      expect(res.data[0]!.publicId).toBe('dlr_cairo_motors');
      expect((res.data[0] as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((res.data[0] as unknown as Record<string, unknown>).vendorId).toBeUndefined();
      expect(res.meta.nextCursor).toBe('cursor_token_123');
      expect(res.meta.hasMore).toBe(true);
      expect(() => DealerDirectoryResponseSchema.parse(res)).not.toThrow();
    });
  });

  describe('DealerBranchSchema, Coordinates & Business Hours', () => {
    it('validates branch with valid coordinates and business hours', () => {
      const branch = createValidBranch();
      expect(() => DealerBranchSchema.parse(branch)).not.toThrow();
    });

    it('validates boundary coordinates [-90..90, -180..180]', () => {
      const branchMax = createValidBranch({ lat: 90, lng: 180 });
      const branchMin = createValidBranch({ lat: -90, lng: -180 });
      expect(() => DealerBranchSchema.parse(branchMax)).not.toThrow();
      expect(() => DealerBranchSchema.parse(branchMin)).not.toThrow();
    });

    it('rejects invalid coordinates outside bounds', () => {
      const invalidLat = createValidBranch({ lat: 91 });
      const invalidLng = createValidBranch({ lng: -181 });
      expect(() => DealerBranchSchema.parse(invalidLat)).toThrow();
      expect(() => DealerBranchSchema.parse(invalidLng)).toThrow();
    });

    it('correctly identifies and validates overnight business hours', () => {
      // Overnight hours: open at 21:00, close at 03:00 next day
      expect(isOvernightHours('21:00', '03:00')).toBe(true);
      expect(isOvernightHours('09:00', '18:00')).toBe(false);

      const overnightDay = {
        open: '20:00',
        close: '04:00',
        isOvernight: true,
      };
      expect(() => BusinessDayHoursSchema.parse(overnightDay)).not.toThrow();

      const weekly = {
        monday: { open: '09:00', close: '22:00' },
        thursday: { open: '20:00', close: '02:00', isOvernight: true },
        friday: { open: '14:00', close: '23:00' },
      };
      expect(() => WeeklyBusinessHoursSchema.parse(weekly)).not.toThrow();
    });

    it('rejects malformed business hours time string', () => {
      const invalidTime = { open: '25:00', close: '18:00' };
      expect(() => BusinessDayHoursSchema.parse(invalidTime)).toThrow();
    });

    it('adapts raw branch mapping hoursJson to hours and stripping internal IDs', () => {
      const rawBranch = {
        id: 77,
        vendorId: 12,
        publicId: 'brn_1',
        name: { ar: 'الفرع الرئيسي', en: 'Main Branch' },
        cityId: 1,
        areaId: null,
        addressLine: null,
        phone: null,
        hoursJson: { monday: { open: '09:00', close: '18:00' } },
        lat: '30.05',
        lng: '31.30',
      };

      const adapted = adaptRawDealerBranch(rawBranch);
      expect(adapted.publicId).toBe('brn_1');
      expect((adapted as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((adapted as unknown as Record<string, unknown>).hoursJson).toBeUndefined();
      expect(adapted.hours).toEqual({ monday: { open: '09:00', close: '18:00' } });
      expect(adapted.lat).toBe(30.05);
      expect(adapted.lng).toBe(31.30);
    });
  });

  describe('DealerProfileSchema', () => {
    it('validates a complete dealer profile', () => {
      const profile = createValidDealerProfile();
      expect(() => DealerProfileSchema.parse(profile)).not.toThrow();
    });

    it('rejects ratingAverage > 5 or negative', () => {
      const invalidHigh = createValidDealerProfile({ ratingAverage: 5.5 });
      const invalidLow = createValidDealerProfile({ ratingAverage: -1 });
      expect(() => DealerProfileSchema.parse(invalidHigh)).toThrow();
      expect(() => DealerProfileSchema.parse(invalidLow)).toThrow();
    });

    it('adapts raw dealer profile wrapping into { data }', () => {
      const rawProfile = {
        publicId: 'dlr_test',
        slug: 'test-dealer',
        displayName: { ar: 'موزع تجريبي', en: 'Test Dealer' },
        description: null,
        logoUrl: null,
        bannerUrl: null,
        storeType: 'INDIVIDUAL',
        isVerified: false,
        activeListingCount: 3,
        branchCount: 0,
        ratingAverage: '4.5',
        reviewCount: 10,
        branches: [],
      };

      const res = adaptRawDealerProfile(rawProfile);
      expect(res.data.publicId).toBe('dlr_test');
      expect(res.data.ratingAverage).toBe(4.5);
      expect(res.data.branches).toEqual([]);
      expect(() => DealerProfileResponseSchema.parse(res)).not.toThrow();
    });
  });

  describe('Vendor & Memberships (OUT-01 Permissive Responses)', () => {
    it('validates VendorSchema and VendorMembership', () => {
      const vendor = createValidVendor();
      expect(() => VendorSchema.parse(vendor)).not.toThrow();
      expect(StoreTypeSchema.parse('COMPANY')).toBe('COMPANY');
      expect(VendorRoleSchema.parse('OWNER')).toBe('OWNER');
      expect(VendorStatusSchema.parse('APPROVED')).toBe('APPROVED');

      const membership = {
        vendorPublicId: vendor.publicId,
        role: 'OWNER' as const,
        invitedAt: '2024-12-01T10:00:00.000Z',
        acceptedAt: '2024-12-01T10:05:00.000Z',
      };
      expect(() => VendorMembershipSchema.parse(membership)).not.toThrow();
      expect(() => VendorMembershipWithVendorSchema.parse({ vendor, membership })).not.toThrow();
    });

    it('rejects VendorMembershipWithVendor when vendorPublicId does not match vendor.publicId', () => {
      const vendor = createValidVendor({ publicId: 'vnd_first' });
      const membership = {
        vendorPublicId: 'vnd_mismatched',
        role: 'STAFF' as const,
        invitedAt: '2024-12-01T10:00:00.000Z',
        acceptedAt: null,
      };
      expect(() => VendorMembershipWithVendorSchema.parse({ vendor, membership })).toThrow(/Membership vendor does not match/);
    });

    it('adapts permissive Type.Any upstream vendor response and strips internal IDs', () => {
      const rawUpstreamMine = [
        {
          role: 'OWNER',
          invitedAt: '2024-12-01T10:00:00.000Z',
          acceptedAt: '2024-12-01T10:05:00.000Z',
          vendor: {
            id: 123, // internal DB ID
            publicId: 'vnd_upstream_01',
            slug: 'upstream-motors',
            legalName: 'Upstream Motors Co',
            displayName: { ar: 'أبستريم موتورز', en: 'Upstream Motors' },
            description: null,
            email: 'vendor@upstream.com',
            phone: '+201011112222',
            logoUrl: 'https://example.com/logo.png',
            logoImageFileId: 456, // internal file ID
            bannerUrl: null,
            bannerImageFileId: 789, // internal file ID
            status: 'APPROVED',
            approvedAt: '2024-12-02T10:00:00.000Z',
            storeCategoryId: 5, // obsolete numeric ID
            storeType: 'COMPANY',
            businessAddressLine: null,
            businessCountryId: 1,
            businessCityId: 2,
            businessPostalCode: null,
            defaultCurrency: 'EGP',
            createdAt: '2024-12-01T09:00:00.000Z',
          },
        },
      ];

      const res = adaptRawMyVendors(rawUpstreamMine);
      expect(res.data).toHaveLength(1);
      const item = res.data[0]!;
      expect(item.vendor.publicId).toBe('vnd_upstream_01');
      expect((item.vendor as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((item.vendor as unknown as Record<string, unknown>).logoImageFileId).toBeUndefined();
      expect((item.vendor as unknown as Record<string, unknown>).bannerImageFileId).toBeUndefined();
      expect((item.vendor as unknown as Record<string, unknown>).storeCategoryId).toBeUndefined();
      expect(item.membership.vendorPublicId).toBe('vnd_upstream_01');
      expect(item.membership.role).toBe('OWNER');
      expect(() => MyVendorsResponseSchema.parse(res)).not.toThrow();
    });

    it('resolves active vendor state correctly', () => {
      const vendor1 = createValidVendor({ publicId: 'vnd_1' });
      const vendor2 = createValidVendor({ publicId: 'vnd_2' });
      const memberships: VendorMembershipWithVendor[] = [
        { vendor: vendor1, membership: { vendorPublicId: 'vnd_1', role: 'OWNER', invitedAt: '2024-01-01T00:00:00Z', acceptedAt: '2024-01-01T00:00:00Z' } },
        { vendor: vendor2, membership: { vendorPublicId: 'vnd_2', role: 'MANAGER', invitedAt: '2024-01-01T00:00:00Z', acceptedAt: '2024-01-01T00:00:00Z' } },
      ];

      // Default selection (first membership)
      const defaultState = resolveActiveVendorState(memberships);
      expect(defaultState.activeVendorPublicId).toBe('vnd_1');
      expect(defaultState.resolutionError).toBeNull();

      // Specific selection
      const specificState = resolveActiveVendorState(memberships, 'vnd_2');
      expect(specificState.activeVendorPublicId).toBe('vnd_2');
      expect(specificState.resolutionError).toBeNull();

      // Non-member selection returns error
      const nonMemberState = resolveActiveVendorState(memberships, 'vnd_unknown');
      expect(nonMemberState.activeVendorPublicId).toBeNull();
      expect(nonMemberState.resolutionError?.error.status).toBe(403);
    });

    it('rejects ActiveVendorStateSchema if activeVendorPublicId is not in memberships', () => {
      const vendor = createValidVendor({ publicId: 'vnd_valid' });
      const memberships: VendorMembershipWithVendor[] = [
        { vendor, membership: { vendorPublicId: 'vnd_valid', role: 'OWNER', invitedAt: '2024-01-01T00:00:00Z', acceptedAt: '2024-01-01T00:00:00Z' } },
      ];

      const invalidState = {
        memberships,
        activeVendorPublicId: 'vnd_not_in_list',
        resolutionError: null,
      };

      expect(() => ActiveVendorStateSchema.parse(invalidState)).toThrow(/Active vendor must be one of the resolved memberships/);
    });
  });

  describe('Dealer Params Schemas', () => {
    it('validates DealerListParams limits allowlist [12, 20, 24, 40]', () => {
      expect(() => DealerListParamsSchema.parse({ limit: 12 })).not.toThrow();
      expect(() => DealerListParamsSchema.parse({ limit: 20 })).not.toThrow();
      expect(() => DealerListParamsSchema.parse({ limit: 24 })).not.toThrow();
      expect(() => DealerListParamsSchema.parse({ limit: 40 })).not.toThrow();
      expect(() => DealerListParamsSchema.parse({ limit: 10 as unknown as 12 })).toThrow();
      expect(() => DealerListParamsSchema.parse({ limit: 50 as unknown as 12 })).toThrow();
    });

    it('DealerInventoryParamsSchema: modelSlug requires makeSlug', () => {
      expect(() => DealerInventoryParamsSchema.parse({ modelSlug: 'corolla' })).toThrow(/modelSlug requires makeSlug/);
      expect(() => DealerInventoryParamsSchema.parse({ makeSlug: 'toyota', modelSlug: 'corolla' })).not.toThrow();
    });

    it('DealerInventoryParamsSchema: validates yearMin <= yearMax', () => {
      expect(() => DealerInventoryParamsSchema.parse({ yearMin: 2020, yearMax: 2024 })).not.toThrow();
      expect(() => DealerInventoryParamsSchema.parse({ yearMin: 2024, yearMax: 2020 })).toThrow(/Invalid year range/);
    });

    it('DealerInventoryParamsSchema: validates priceMin <= priceMax', () => {
      expect(() => DealerInventoryParamsSchema.parse({ priceMin: 100000, priceMax: 200000 })).not.toThrow();
      expect(() => DealerInventoryParamsSchema.parse({ priceMin: 300000, priceMax: 200000 })).toThrow(/Invalid price range/);
    });
  });
});

// ── 3. Public Settings Contracts ────────────────────────────────────────────

describe('Public Settings Contracts', () => {
  describe('PublicSettingSchema & Enums', () => {
    it('validates setting group and type enums', () => {
      expect(SettingGroupSchema.parse('APP')).toBe('APP');
      expect(SettingGroupSchema.parse('BUSINESS')).toBe('BUSINESS');
      expect(SettingTypeSchema.parse('NUMBER')).toBe('NUMBER');
      expect(SettingTypeSchema.parse('STRING')).toBe('STRING');
    });

    it('validates PublicSetting row', () => {
      const setting: PublicSetting = {
        key: 'finance.default_annual_rate_pct',
        group: 'APP',
        value: '14',
        type: 'NUMBER',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      expect(() => PublicSettingSchema.parse(setting)).not.toThrow();
    });
  });

  describe('FinanceConfigSchema & Derivations', () => {
    it('validates FinanceConfig bounds (annualRate <= 1, tenor <= 360)', () => {
      const valid = { annualRate: 0.14, downPaymentFraction: 0.20, tenorMonths: 60 };
      expect(() => FinanceConfigSchema.parse(valid)).not.toThrow();

      // annualRate must be fraction <= 1, not percentage 14
      expect(() => FinanceConfigSchema.parse({ annualRate: 14, downPaymentFraction: 0.20, tenorMonths: 60 })).toThrow();
      expect(() => FinanceConfigSchema.parse({ annualRate: -0.1, downPaymentFraction: 0.20, tenorMonths: 60 })).toThrow();
      expect(() => FinanceConfigSchema.parse({ annualRate: 0.14, downPaymentFraction: 0.20, tenorMonths: 400 })).toThrow();
    });

    it('derives FinanceConfig from settings rows with fallback handling', () => {
      const rows: PublicSetting[] = [
        { key: 'finance.default_annual_rate_pct', group: 'APP', value: '18', type: 'NUMBER', updatedAt: '2026-01-01T00:00:00Z' },
        { key: 'finance.min_down_payment_pct', group: 'APP', value: '25', type: 'NUMBER', updatedAt: '2026-01-01T00:00:00Z' },
        { key: 'finance.default_tenor_months', group: 'APP', value: '48', type: 'NUMBER', updatedAt: '2026-01-01T00:00:00Z' },
      ];

      const config = deriveFinanceConfig(rows);
      expect(config.annualRate).toBe(0.18);
      expect(config.downPaymentFraction).toBe(0.25);
      expect(config.tenorMonths).toBe(48);

      // When rows are empty, returns exact fallback constants
      const fallbackConfig = deriveFinanceConfig([]);
      expect(fallbackConfig).toEqual(DEFAULT_FINANCE_CONFIG);
    });
  });

  describe('SupportConfigSchema & Derivations', () => {
    it('validates SupportConfig and nullable fields', () => {
      const config = {
        termsUrl: 'https://arabiyatmart.com/terms',
        privacyUrl: 'https://arabiyatmart.com/privacy',
        supportEmail: 'support@arabiyatmart.com',
        supportPhone: '+201012345678',
      };
      expect(() => SupportConfigSchema.parse(config)).not.toThrow();

      const nullConfig = {
        termsUrl: null,
        privacyUrl: null,
        supportEmail: null,
        supportPhone: null,
      };
      expect(() => SupportConfigSchema.parse(nullConfig)).not.toThrow();
    });

    it('rejects malformed email or url', () => {
      expect(() => SupportConfigSchema.parse({ termsUrl: 'not-url', privacyUrl: null, supportEmail: null, supportPhone: null })).toThrow();
      expect(() => SupportConfigSchema.parse({ termsUrl: null, privacyUrl: null, supportEmail: 'not-an-email', supportPhone: null })).toThrow();
    });

    it('derives SupportConfig and treats empty or blank strings as null', () => {
      const rows: PublicSetting[] = [
        { key: 'legal.terms_url', group: 'APP', value: 'https://arabiyatmart.com/terms', type: 'STRING', updatedAt: '2026-01-01T00:00:00Z' },
        { key: 'legal.privacy_url', group: 'APP', value: '   ', type: 'STRING', updatedAt: '2026-01-01T00:00:00Z' }, // blank -> null
        { key: 'support.email', group: 'APP', value: '', type: 'STRING', updatedAt: '2026-01-01T00:00:00Z' }, // empty -> null
        { key: 'support.phone', group: 'APP', value: '+201000000000', type: 'STRING', updatedAt: '2026-01-01T00:00:00Z' },
      ];

      const config = deriveSupportConfig(rows);
      expect(config.termsUrl).toBe('https://arabiyatmart.com/terms');
      expect(config.privacyUrl).toBeNull();
      expect(config.supportEmail).toBeNull();
      expect(config.supportPhone).toBe('+201000000000');
    });
  });

  describe('adaptRawPublicSettings (OUT-01 Permissive Settings)', () => {
    it('adapts upstream raw bare array and derives complete response with finance and support', () => {
      const rawSettingsList = [
        { id: 1, key: 'finance.default_annual_rate_pct', group: 'APP', value: '15', type: 'NUMBER', isPublic: true, updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, key: 'support.email', group: 'APP', value: 'help@cars.eg', type: 'STRING', isPublic: true, updatedAt: '2026-01-01T00:00:00Z' },
      ];

      const res = adaptRawPublicSettings(rawSettingsList);
      expect(res.data.rows).toHaveLength(2);
      expect((res.data.rows[0] as unknown as Record<string, unknown>).id).toBeUndefined();
      expect(res.data.finance.annualRate).toBe(0.15);
      expect(res.data.support.supportEmail).toBe('help@cars.eg');
      expect(() => PublicSettingsResponseSchema.parse(res)).not.toThrow();
    });
  });
});

// ── 4. Home Banner & Home Page Contracts ────────────────────────────────────

describe('Home Banner & Home Page Contracts', () => {
  describe('HomeBannerSchema & Adapters (OUT-01)', () => {
    it('validates a complete banner and null nullable fields', () => {
      const banner: HomeBanner = {
        publicId: 'bnr_hero_01',
        title: { ar: 'عروض رمضان للسيارات', en: 'Ramadan Car Offers' },
        subtitle: { ar: 'خصومات تصل إلى 10%', en: 'Up to 10% discounts' },
        imageUrl: 'https://images.unsplash.com/banner-hero.jpg',
        linkTarget: '/ar/catalogue/makes/toyota',
      };
      expect(() => HomeBannerSchema.parse(banner)).not.toThrow();

      const minimalBanner: HomeBanner = {
        publicId: 'bnr_hero_02',
        title: { ar: 'سوق السيارات الأكبر', en: 'The Largest Car Marketplace' },
        subtitle: null,
        imageUrl: null,
        linkTarget: null,
      };
      expect(() => HomeBannerSchema.parse(minimalBanner)).not.toThrow();
    });

    it('rejects malformed banner image URL', () => {
      const invalid = {
        publicId: 'bnr_bad',
        title: { ar: 'عنوان', en: 'Title' },
        subtitle: null,
        imageUrl: 'not-a-valid-url',
        linkTarget: null,
      };
      expect(() => HomeBannerSchema.parse(invalid)).toThrow();
    });

    it('adapts upstream raw banner list, strips internal IDs and admin metadata', () => {
      const rawBanners = [
        {
          id: 10, // DB ID
          publicId: 'bnr_1',
          title: { ar: 'بانر 1', en: 'Banner 1' },
          subtitle: null,
          imageFileId: 55, // internal file ID
          imageUrl: 'https://example.com/banner.jpg',
          linkTarget: '/search',
          position: 'HOME_HERO',
          sortOrder: 1,
          isActive: true,
          displayFrom: '2026-01-01T00:00:00Z',
          displayUntil: null,
          createdById: 3,
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-01T00:00:00Z',
          visibilityStatus: 'VISIBLE',
        },
      ];

      const res = adaptRawBannerList(rawBanners);
      expect(res.data).toHaveLength(1);
      const b = res.data[0]!;
      expect(b.publicId).toBe('bnr_1');
      expect((b as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((b as unknown as Record<string, unknown>).imageFileId).toBeUndefined();
      expect((b as unknown as Record<string, unknown>).createdById).toBeUndefined();
      expect((b as unknown as Record<string, unknown>).visibilityStatus).toBeUndefined();
      expect(adaptRawBanner(rawBanners[0]!).publicId).toBe('bnr_1');
      expect(() => HomeBannerListResponseSchema.parse(res)).not.toThrow();
    });

    it('validates BannerListParams position enum', () => {
      expect(BannerPositionSchema.parse('HOME_HERO')).toBe('HOME_HERO');
      expect(() => BannerListParamsSchema.parse({ position: 'HOME_HERO' })).not.toThrow();
      expect(() => BannerListParamsSchema.parse({ position: 'HOME_STRIP' })).not.toThrow();
      expect(() => BannerListParamsSchema.parse({ position: 'INVALID' as unknown as 'HOME_HERO' })).toThrow();
    });
  });

  describe('HomePageDataSchema & Adapter', () => {
    it('validates full HomePageData composite structure', () => {
      const homePageData: HomePageData = {
        banners: [
          {
            publicId: 'bnr_1',
            title: { ar: 'بانر', en: 'Banner' },
            subtitle: null,
            imageUrl: 'https://example.com/banner.jpg',
            linkTarget: null,
          },
        ],
        spotlight: [
          {
            modelPublicId: 'mdl_1',
            modelSlug: 'corolla',
            modelName: { ar: 'كورولا', en: 'Corolla' },
            makeName: { ar: 'تويوتا', en: 'Toyota' },
            makeSlug: 'toyota',
            makeLogoUrl: null,
            bodyType: 'SEDAN',
            startingPriceCents: 85000000,
            currency: 'EGP',
            activeNewListingCount: 3,
          },
        ],
        featuredListings: [createValidListingCard()],
        latestListings: [createValidListingCard()],
        featuredDealers: [
          {
            publicId: 'dlr_1',
            slug: 'auto-star',
            displayName: { ar: 'أوتو ستار', en: 'Auto Star' },
            logoUrl: null,
            cityName: { ar: 'القاهرة', en: 'Cairo' },
            activeListingCount: 12,
            isVerified: true,
          },
        ],
        settings: {
          finance: { annualRate: 0.14, downPaymentFraction: 0.20, tenorMonths: 60 },
          support: { termsUrl: null, privacyUrl: null, supportEmail: null, supportPhone: null },
        },
      };

      expect(() => HomePageDataSchema.parse(homePageData)).not.toThrow();
      const adapted = adaptRawHomePageData(homePageData);
      expect(adapted.banners).toHaveLength(1);
      expect(adapted.featuredListings).toHaveLength(1);
    });
  });
});

// ── 5. Raw Adapter Validation & Typed Contract Mismatches ──────────────────

describe('Raw Adapter Validation & Typed Contract Mismatches (OUT-01 Anti-Corruption)', () => {
  describe('unwrapDataArray & unwrapDataObject strict validation', () => {
    it('unwrapDataArray: accepts array and { data: array }', () => {
      expect(unwrapDataArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(unwrapDataArray({ data: [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('unwrapDataArray: throws typed ZodError on non-array inputs (never silently empty)', () => {
      expect(() => unwrapDataArray(null)).toThrow();
      expect(() => unwrapDataArray(undefined)).toThrow();
      expect(() => unwrapDataArray('not-an-array')).toThrow();
      expect(() => unwrapDataArray(123)).toThrow();
      expect(() => unwrapDataArray({})).toThrow();
      expect(() => unwrapDataArray({ data: null })).toThrow();
      expect(() => unwrapDataArray({ data: 'not-an-array' })).toThrow();
      expect(() => unwrapDataArray({ data: {} })).toThrow();
    });

    it('unwrapDataObject: accepts object and { data: object }', () => {
      expect(unwrapDataObject({ a: 1 })).toEqual({ a: 1 });
      expect(unwrapDataObject({ data: { a: 1 } })).toEqual({ a: 1 });
    });

    it('unwrapDataObject: throws typed ZodError on non-object inputs (never silently empty)', () => {
      expect(() => unwrapDataObject(null)).toThrow();
      expect(() => unwrapDataObject(undefined)).toThrow();
      expect(() => unwrapDataObject('not-an-object')).toThrow();
      expect(() => unwrapDataObject(123)).toThrow();
      expect(() => unwrapDataObject([])).toThrow();
      expect(() => unwrapDataObject({ data: null })).toThrow();
      expect(() => unwrapDataObject({ data: 'not-an-object' })).toThrow();
      expect(() => unwrapDataObject({ data: [] })).toThrow();
    });
  });

  describe('Taxonomy raw adapters typed mismatches', () => {
    it('adaptRawMake: rejects string "false" for isActive without coercing to true', () => {
      const raw = {
        publicId: 'mak_1',
        slug: 'toyota',
        name: { ar: 'تويوتا', en: 'Toyota' },
        isActive: 'false',
        sortOrder: 1,
      };
      expect(() => adaptRawMake(raw)).toThrow();
    });

    it('adaptRawMake: rejects missing sortOrder (never defaults to 0)', () => {
      const raw = {
        publicId: 'mak_1',
        slug: 'toyota',
        name: { ar: 'تويوتا', en: 'Toyota' },
        isActive: true,
      };
      expect(() => adaptRawMake(raw)).toThrow();
    });

    it('adaptRawMake: rejects non-object input', () => {
      expect(() => adaptRawMake(null)).toThrow();
      expect(() => adaptRawMake('not-an-object')).toThrow();
      expect(() => adaptRawMake(42)).toThrow();
    });

    it('adaptRawMakeList: rejects non-array input', () => {
      expect(() => adaptRawMakeList(null)).toThrow();
      expect(() => adaptRawMakeList('not-a-list')).toThrow();
      expect(() => adaptRawMakeList({})).toThrow();
      expect(() => adaptRawMakeList({ data: 'not-an-array' })).toThrow();
    });

    it('adaptRawVehicleModel: rejects string "false" for isActive and missing sortOrder', () => {
      const rawBadActive = {
        publicId: 'mdl_1',
        slug: 'corolla',
        name: { ar: 'كورولا', en: 'Corolla' },
        isActive: 'false',
        sortOrder: 1,
      };
      expect(() => adaptRawVehicleModel(rawBadActive)).toThrow();

      const rawMissingSort = {
        publicId: 'mdl_1',
        slug: 'corolla',
        name: { ar: 'كورولا', en: 'Corolla' },
        isActive: true,
      };
      expect(() => adaptRawVehicleModel(rawMissingSort)).toThrow();
    });

    it('adaptRawSpotlight: rejects missing activeNewListingCount (never defaults to 0)', () => {
      const raw = {
        modelPublicId: 'mdl_1',
        modelSlug: 'corolla',
        modelName: { ar: 'كورولا', en: 'Corolla' },
        makeName: { ar: 'تويوتا', en: 'Toyota' },
        makeSlug: 'toyota',
        currency: 'EGP',
      };
      expect(() => adaptRawSpotlight([raw])).toThrow();
    });

    it('adaptRawModelsWithPrices: rejects missing activeListingCount (never defaults to 0)', () => {
      const raw = {
        publicId: 'mdl_1',
        slug: 'corolla',
        name: { ar: 'كورولا', en: 'Corolla' },
        currency: 'EGP',
      };
      expect(() => adaptRawModelsWithPrices([raw])).toThrow();
    });

    it('adaptRawTrimDealers: rejects missing listingCount and string isVerified', () => {
      const rawMissingCount = {
        publicId: 'dlr_1',
        slug: 'auto-star',
        displayName: { ar: 'أوتو ستار', en: 'Auto Star' },
        isVerified: true,
        currency: 'EGP',
      };
      expect(() => adaptRawTrimDealers([rawMissingCount])).toThrow();

      const rawStringVerified = {
        publicId: 'dlr_1',
        slug: 'auto-star',
        displayName: { ar: 'أوتو ستار', en: 'Auto Star' },
        isVerified: 'false',
        listingCount: 5,
        currency: 'EGP',
      };
      expect(() => adaptRawTrimDealers([rawStringVerified])).toThrow();
    });
  });

  describe('Settings raw adapters typed mismatches', () => {
    it('adaptRawPublicSettings: rejects non-array and non-object inputs', () => {
      expect(() => adaptRawPublicSettings(null)).toThrow();
      expect(() => adaptRawPublicSettings('not-settings')).toThrow();
      expect(() => adaptRawPublicSettings(123)).toThrow();
      expect(() => adaptRawPublicSettings({ data: 'not-array' })).toThrow();
      expect(() => adaptRawPublicSettings({ data: { rows: 'not-array' } })).toThrow();
    });

    it('adaptRawPublicSettings: rejects missing or invalid updatedAt (never fabricates current time)', () => {
      const rawMissingUpdatedAt = [
        { key: 'finance.default_annual_rate_pct', group: 'APP', value: '15', type: 'NUMBER' },
      ];
      expect(() => adaptRawPublicSettings(rawMissingUpdatedAt)).toThrow();

      const rawInvalidUpdatedAt = [
        { key: 'finance.default_annual_rate_pct', group: 'APP', value: '15', type: 'NUMBER', updatedAt: 'not-a-date' },
      ];
      expect(() => adaptRawPublicSettings(rawInvalidUpdatedAt)).toThrow();
    });

    it('adaptRawPublicSettings: rejects row with missing required fields', () => {
      const rawMissingKey = [
        { group: 'APP', value: '15', type: 'NUMBER', updatedAt: '2026-01-01T00:00:00Z' },
      ];
      expect(() => adaptRawPublicSettings(rawMissingKey)).toThrow();

      const rawMissingGroup = [
        { key: 'finance.rate', value: '15', type: 'NUMBER', updatedAt: '2026-01-01T00:00:00Z' },
      ];
      expect(() => adaptRawPublicSettings(rawMissingGroup)).toThrow();
    });
  });

  describe('Home raw adapters typed mismatches', () => {
    it('adaptRawBanner: rejects non-object input', () => {
      expect(() => adaptRawBanner(null)).toThrow();
      expect(() => adaptRawBanner('not-a-banner')).toThrow();
      expect(() => adaptRawBanner(123)).toThrow();
      expect(() => adaptRawBanner([])).toThrow();
    });

    it('adaptRawBanner: rejects missing title or publicId', () => {
      expect(() => adaptRawBanner({ title: { ar: 'عنوان', en: 'Title' } })).toThrow();
      expect(() => adaptRawBanner({ publicId: 'bnr_1' })).toThrow();
    });

    it('adaptRawBannerList: rejects non-array inputs (never silently empty)', () => {
      expect(() => adaptRawBannerList(null)).toThrow();
      expect(() => adaptRawBannerList(undefined)).toThrow();
      expect(() => adaptRawBannerList('not-banners')).toThrow();
      expect(() => adaptRawBannerList({})).toThrow();
      expect(() => adaptRawBannerList({ data: 'not-an-array' })).toThrow();
    });

    it('adaptRawHomePageData: rejects non-object input and missing data', () => {
      expect(() => adaptRawHomePageData(null)).toThrow();
      expect(() => adaptRawHomePageData('not-home-page')).toThrow();
      expect(() => adaptRawHomePageData({ data: null })).toThrow();
      expect(() => adaptRawHomePageData({ banners: [] })).toThrow();
    });
  });

  describe('Dealer raw adapters typed mismatches', () => {
    it('adaptRawDealerBranch: rejects non-object input and invalid coordinates', () => {
      expect(() => adaptRawDealerBranch(null)).toThrow();
      expect(() => adaptRawDealerBranch('not-a-branch')).toThrow();

      const invalidCoords = {
        publicId: 'brn_1',
        name: { ar: 'فرع', en: 'Branch' },
        cityId: 1,
        lat: 120,
        lng: 31.0,
      };
      expect(() => adaptRawDealerBranch(invalidCoords)).toThrow();
    });

    it('adaptRawDealerDirectory: rejects non-array inputs (never silently empty)', () => {
      expect(() => adaptRawDealerDirectory(null)).toThrow();
      expect(() => adaptRawDealerDirectory('not-directory')).toThrow();
      expect(() => adaptRawDealerDirectory({})).toThrow();
    });

    it('adaptRawDealerDirectory: rejects missing activeListingCount and string isVerified', () => {
      const rawMissingCount = {
        publicId: 'dlr_1',
        slug: 'auto-star',
        displayName: { ar: 'أوتو ستار', en: 'Auto Star' },
        isVerified: true,
      };
      expect(() => adaptRawDealerDirectory([rawMissingCount])).toThrow();

      const rawStringVerified = {
        publicId: 'dlr_1',
        slug: 'auto-star',
        displayName: { ar: 'أوتو ستار', en: 'Auto Star' },
        isVerified: 'false',
        activeListingCount: 10,
      };
      expect(() => adaptRawDealerDirectory([rawStringVerified])).toThrow();
    });

    it('adaptRawDealerProfile: rejects non-object input or missing branches array', () => {
      expect(() => adaptRawDealerProfile(null)).toThrow();
      expect(() => adaptRawDealerProfile('not-profile')).toThrow();

      const profileMissingBranches = {
        ...createValidDealerProfile(),
        branches: 'not-an-array',
      };
      expect(() => adaptRawDealerProfile(profileMissingBranches)).toThrow();
    });

    it('adaptRawDealerProfile: rejects missing counts, rating, or string isVerified', () => {
      const rawMissingRating = {
        ...createValidDealerProfile(),
        ratingAverage: undefined,
      };
      expect(() => adaptRawDealerProfile(rawMissingRating)).toThrow();

      const rawMissingReviews = {
        ...createValidDealerProfile(),
        reviewCount: undefined,
      };
      expect(() => adaptRawDealerProfile(rawMissingReviews)).toThrow();

      const rawStringVerified = {
        ...createValidDealerProfile(),
        isVerified: 'false',
      };
      expect(() => adaptRawDealerProfile(rawStringVerified)).toThrow();
    });

    it('adaptRawMyVendors: rejects non-array inputs (never silently empty)', () => {
      expect(() => adaptRawMyVendors(null)).toThrow();
      expect(() => adaptRawMyVendors('not-vendors')).toThrow();
      expect(() => adaptRawMyVendors({})).toThrow();
    });

    it('adaptRawMyVendors: rejects vendor missing createdAt, status, or currency (never fabricates defaults)', () => {
      const baseValid = {
        role: 'OWNER',
        invitedAt: '2024-12-01T10:00:00.000Z',
        vendor: {
          publicId: 'vnd_1',
          slug: 'v-1',
          legalName: 'V Co',
          displayName: { ar: 'شركة', en: 'Co' },
          email: 'test@v.com',
          status: 'APPROVED',
          storeType: 'COMPANY',
          defaultCurrency: 'EGP',
          createdAt: '2024-12-01T00:00:00.000Z',
        },
      };

      const missingCreatedAt = {
        ...baseValid,
        vendor: { ...baseValid.vendor, createdAt: undefined },
      };
      expect(() => adaptRawMyVendors([missingCreatedAt])).toThrow();

      const missingStatus = {
        ...baseValid,
        vendor: { ...baseValid.vendor, status: undefined },
      };
      expect(() => adaptRawMyVendors([missingStatus])).toThrow();

      const missingStoreType = {
        ...baseValid,
        vendor: { ...baseValid.vendor, storeType: undefined },
      };
      expect(() => adaptRawMyVendors([missingStoreType])).toThrow();

      const missingCurrency = {
        ...baseValid,
        vendor: { ...baseValid.vendor, defaultCurrency: undefined },
      };
      expect(() => adaptRawMyVendors([missingCurrency])).toThrow();

      const missingInvitedAt = {
        ...baseValid,
        invitedAt: undefined,
      };
      expect(() => adaptRawMyVendors([missingInvitedAt])).toThrow();
    });
  });
});
