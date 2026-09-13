import { z } from 'zod';
import type {
  Area,
  AreaListResponse,
  CatalogueTrimDetail,
  CatalogueTrimDetailResponse,
  City,
  CityAreasParams,
  CityListResponse,
  Country,
  CountryCitiesParams,
  CountryCodeParams,
  CountryConfig,
  CountryConfigResponse,
  CountryListResponse,
  Generation,
  GenerationListResponse,
  GenerationSummary,
  Make,
  MakeDealersParams,
  MakeDealersResponse,
  MakeListResponse,
  ModelPage,
  ModelPageResponse,
  ModelPathParams,
  ModelWithPrice,
  ModelsWithPricesParams,
  ModelsWithPricesResponse,
  PriceHistoryEntry,
  SpotlightItem,
  SpotlightParams,
  SpotlightResponse,
  TaxonomyGenerationsParams,
  TaxonomyModelsParams,
  TaxonomyTrimsParams,
  Trim,
  TrimAncestry,
  TrimDealer,
  TrimDealersParams,
  TrimDealersResponse,
  TrimListResponse,
  TrimPathParams,
  TrimResponse,
  TrimSummary,
  VehicleModel,
  VehicleModelListResponse,
} from '@/types/taxonomy';
import {
  CurrencySchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  LocalizedTextSchema,
  MoneyCentsSchema,
  PartialLocalizedTextSchema,
  PublicIdSchema,
  SlugSchema,
} from './common';
import {
  BodyTypeSchema,
  CarConditionSchema,
  DrivetrainSchema,
  FuelTypeSchema,
  TransmissionSchema,
  VehicleTypeSchema,
} from './listing';

// ── Strict Taxonomy Entities ──────────────────────────────────────────────────

export const MakeSchema: z.ZodType<Make> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  name: LocalizedTextSchema,
  logoUrl: z.string().url().nullable(),
  countryOfOrigin: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  activeListingCount: z.number().int().nonnegative().nullable(),
});

export const VehicleModelSchema: z.ZodType<VehicleModel> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  name: LocalizedTextSchema,
  bodyType: BodyTypeSchema.nullable(),
  vehicleType: VehicleTypeSchema.nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  activeListingCount: z.number().int().nonnegative().nullable(),
});

export const GenerationSchema: z.ZodType<Generation> = z
  .object({
    publicId: PublicIdSchema,
    name: z.string().trim().min(1),
    startYear: z.number().int().min(1900).max(2100),
    endYear: z.number().int().min(1900).max(2100).nullable(),
  })
  .refine(
    (value) => value.endYear === null || value.endYear >= value.startYear,
    { path: ['endYear'], message: 'endYear must not precede startYear' }
  );

export const TrimSchema = z.object({
  publicId: PublicIdSchema,
  name: LocalizedTextSchema,
  modelYear: z.number().int().min(1900).max(2100),
  engineCc: z.number().int().positive().nullable(),
  powerHp: z.number().int().positive().nullable(),
  torqueNm: z.number().int().positive().nullable(),
  fuelType: FuelTypeSchema.nullable(),
  transmission: TransmissionSchema.nullable(),
  drivetrain: DrivetrainSchema.nullable(),
  seats: z.number().int().positive().max(100).nullable(),
  fuelEconomyKmL: z.number().nonnegative().nullable(),
  warrantyYears: z.number().int().nonnegative().nullable(),
  warrantyKm: z.number().int().nonnegative().nullable(),
  specs: JsonValueSchema.nullable(),
  officialPriceCents: MoneyCentsSchema.nullable(),
  marketPriceCents: MoneyCentsSchema.nullable(),
  currency: CurrencySchema,
  brochureUrl: z.string().url().nullable(),
  isActive: z.boolean(),
}) satisfies z.ZodType<Trim>;

export const SpotlightItemSchema: z.ZodType<SpotlightItem> = z.object({
  modelPublicId: PublicIdSchema,
  modelSlug: SlugSchema,
  modelName: PartialLocalizedTextSchema,
  makeName: PartialLocalizedTextSchema,
  makeSlug: SlugSchema,
  makeLogoUrl: z.string().url().nullable(),
  bodyType: BodyTypeSchema.nullable(),
  startingPriceCents: MoneyCentsSchema.nullable(),
  currency: CurrencySchema,
  activeNewListingCount: z.number().int().nonnegative(),
});

export const ModelWithPriceSchema: z.ZodType<ModelWithPrice> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  name: PartialLocalizedTextSchema,
  bodyType: BodyTypeSchema.nullable(),
  vehicleType: VehicleTypeSchema.nullable(),
  startingPriceCents: MoneyCentsSchema.nullable(),
  currency: CurrencySchema,
  activeListingCount: z.number().int().nonnegative(),
});

export const GenerationSummarySchema: z.ZodType<GenerationSummary> = z
  .object({
    publicId: PublicIdSchema,
    name: z.string().trim().min(1),
    startYear: z.number().int().min(1900).max(2100),
    endYear: z.number().int().min(1900).max(2100).nullable(),
    trimCount: z.number().int().nonnegative(),
  })
  .refine(
    (value) => value.endYear === null || value.endYear >= value.startYear,
    { path: ['endYear'], message: 'endYear must not precede startYear' }
  );

export const TrimSummarySchema: z.ZodType<TrimSummary> = z.object({
  publicId: PublicIdSchema,
  name: PartialLocalizedTextSchema,
  modelYear: z.number().int().min(1900).max(2100),
  engineCc: z.number().int().positive().nullable(),
  powerHp: z.number().int().positive().nullable(),
  fuelType: FuelTypeSchema.nullable(),
  transmission: TransmissionSchema.nullable(),
  officialPriceCents: MoneyCentsSchema.nullable(),
  marketPriceCents: MoneyCentsSchema.nullable(),
  currency: CurrencySchema,
  isActive: z.boolean(),
});

export const ModelPageSchema: z.ZodType<ModelPage> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  name: PartialLocalizedTextSchema,
  bodyType: BodyTypeSchema.nullable(),
  vehicleType: VehicleTypeSchema.nullable(),
  make: z.object({
    publicId: PublicIdSchema,
    slug: SlugSchema,
    name: PartialLocalizedTextSchema,
    logoUrl: z.string().url().nullable(),
  }),
  startingPriceCents: MoneyCentsSchema.nullable(),
  currency: CurrencySchema,
  activeNewListingCount: z.number().int().nonnegative(),
  generations: z.array(GenerationSummarySchema),
  trims: z.array(TrimSummarySchema),
});

export const PriceHistoryEntrySchema: z.ZodType<PriceHistoryEntry> = z.object({
  priceCents: MoneyCentsSchema,
  priceType: z.string().trim().min(1),
  effectiveAt: IsoDateTimeSchema.nullable(),
  source: z.string().nullable(),
});

export const TrimAncestrySchema: z.ZodType<TrimAncestry> = z.object({
  publicId: PublicIdSchema,
  name: z.string().trim().min(1),
  model: z.object({
    publicId: PublicIdSchema,
    slug: SlugSchema,
    name: PartialLocalizedTextSchema,
    make: z.object({
      publicId: PublicIdSchema,
      slug: SlugSchema,
      name: PartialLocalizedTextSchema,
    }),
  }),
});

export const CatalogueTrimDetailSchema: z.ZodType<CatalogueTrimDetail> = TrimSchema.extend({
  generation: TrimAncestrySchema,
  priceHistory: z.array(PriceHistoryEntrySchema),
});

export const TrimDealerSchema: z.ZodType<TrimDealer> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  displayName: PartialLocalizedTextSchema,
  logoUrl: z.string().url().nullable(),
  cityName: PartialLocalizedTextSchema.nullable(),
  isVerified: z.boolean(),
  listingCount: z.number().int().nonnegative(),
  startingPriceCents: MoneyCentsSchema.nullable(),
  currency: CurrencySchema,
});

export const CitySchema: z.ZodType<City> = z.object({
  id: z.number().int().positive(),
  countryId: z.number().int().positive(),
  name: LocalizedTextSchema,
  isActive: z.boolean(),
});

export const AreaSchema: z.ZodType<Area> = z.object({
  id: z.number().int().positive(),
  cityId: z.number().int().positive(),
  name: LocalizedTextSchema,
  postalCode: z.string().nullable(),
  isActive: z.boolean(),
});

export const CountrySchema: z.ZodType<Country> = z.object({
  id: z.number().int().positive(),
  code: z.string().length(2).toUpperCase(),
  name: LocalizedTextSchema,
  phoneCode: z.string().trim().min(1),
  currency: CurrencySchema,
  configJson: JsonValueSchema.nullable(),
  isActive: z.boolean(),
});

export const CountryConfigSchema: z.ZodType<CountryConfig> = z.object({
  code: z.string().length(2).toUpperCase(),
  currency: CurrencySchema,
  currencySymbol: z.string().nullable(),
  phoneFormat: z.string().nullable(),
  legalDisclaimer: PartialLocalizedTextSchema.nullable(),
  defaultInterestRate: z.number().nonnegative().nullable(),
});

// ── Response Schemas ─────────────────────────────────────────────────────────

export const MakeListResponseSchema: z.ZodType<MakeListResponse> = z.object({
  data: z.array(MakeSchema),
});

export const VehicleModelListResponseSchema: z.ZodType<VehicleModelListResponse> = z.object({
  data: z.array(VehicleModelSchema),
});

export const GenerationListResponseSchema: z.ZodType<GenerationListResponse> = z.object({
  data: z.array(GenerationSchema),
});

export const TrimListResponseSchema: z.ZodType<TrimListResponse> = z.object({
  data: z.array(TrimSchema),
});

export const TrimResponseSchema: z.ZodType<TrimResponse> = z.object({
  data: TrimSchema,
});

export const SpotlightResponseSchema: z.ZodType<SpotlightResponse> = z.object({
  data: z.array(SpotlightItemSchema),
});

export const ModelsWithPricesResponseSchema: z.ZodType<ModelsWithPricesResponse> = z.object({
  data: z.array(ModelWithPriceSchema),
});

export const ModelPageResponseSchema: z.ZodType<ModelPageResponse> = z.object({
  data: ModelPageSchema,
});

export const CatalogueTrimDetailResponseSchema: z.ZodType<CatalogueTrimDetailResponse> = z.object({
  data: CatalogueTrimDetailSchema,
});

export const TrimDealersResponseSchema: z.ZodType<TrimDealersResponse> = z.object({
  data: z.array(TrimDealerSchema),
});

export const MakeDealersResponseSchema: z.ZodType<MakeDealersResponse> = TrimDealersResponseSchema;

export const CityListResponseSchema: z.ZodType<CityListResponse> = z.object({
  data: z.array(CitySchema),
});

export const AreaListResponseSchema: z.ZodType<AreaListResponse> = z.object({
  data: z.array(AreaSchema),
});

export const CountryListResponseSchema: z.ZodType<CountryListResponse> = z.object({
  data: z.array(CountrySchema),
});

export const CountryConfigResponseSchema: z.ZodType<CountryConfigResponse> = z.object({
  data: CountryConfigSchema,
});

// ── Operation / Parameter Schemas ───────────────────────────────────────────

export const SpotlightParamsSchema: z.ZodType<SpotlightParams> = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const ModelsWithPricesParamsSchema: z.ZodType<ModelsWithPricesParams> = z.object({
  makeSlug: SlugSchema,
  condition: CarConditionSchema.optional(),
});

export const TrimDealersParamsSchema: z.ZodType<TrimDealersParams> = z.object({
  publicId: PublicIdSchema,
  limit: z.number().int().min(1).max(50).optional(),
});

export const MakeDealersParamsSchema: z.ZodType<MakeDealersParams> = z.object({
  makeSlug: SlugSchema,
  limit: z.number().int().min(1).max(50).optional(),
});

export const ModelPathParamsSchema: z.ZodType<ModelPathParams> = z.object({
  publicId: PublicIdSchema,
});

export const TrimPathParamsSchema: z.ZodType<TrimPathParams> = z.object({
  publicId: PublicIdSchema,
});

export const TaxonomyModelsParamsSchema: z.ZodType<TaxonomyModelsParams> = z.object({
  makeSlug: SlugSchema,
});

export const TaxonomyGenerationsParamsSchema: z.ZodType<TaxonomyGenerationsParams> = z.object({
  modelPublicId: PublicIdSchema,
});

export const TaxonomyTrimsParamsSchema: z.ZodType<TaxonomyTrimsParams> = z.object({
  generationPublicId: PublicIdSchema,
});

export const CountryCodeParamsSchema: z.ZodType<CountryCodeParams> = z.object({
  code: z.string().length(2).toUpperCase(),
});

export const CountryCitiesParamsSchema: z.ZodType<CountryCitiesParams> = z.object({
  code: z.string().length(2).toUpperCase(),
});

export const CityAreasParamsSchema: z.ZodType<CityAreasParams> = z.object({
  cityId: z.number().int().positive(),
});

// ── Adapters ─────────────────────────────────────────────────────────────────

export function unwrapDataArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if ('data' in obj) {
      if (Array.isArray(obj.data)) {
        return obj.data;
      }
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data'],
          message: 'Expected data property to be an array',
        },
      ]);
    }
  }
  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'Expected array or { data: array } input',
    },
  ]);
}

export function unwrapDataObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected object input',
      },
    ]);
  }
  const obj = input as Record<string, unknown>;
  if ('data' in obj) {
    if (typeof obj.data !== 'object' || obj.data === null || Array.isArray(obj.data)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data'],
          message: 'Expected data property to be an object',
        },
      ]);
    }
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

export function ensureNonArrayObject(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: `Expected object for ${label}`,
      },
    ]);
  }
  return raw as Record<string, unknown>;
}

export function adaptRawMake(raw: unknown): Make {
  const item = ensureNonArrayObject(raw, 'make');
  const cleaned: Record<string, unknown> = {
    publicId: item.publicId,
    slug: item.slug,
    name: item.name,
    logoUrl: item.logoUrl ?? null,
    countryOfOrigin: item.countryOfOrigin ?? null,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    activeListingCount: item.activeListingCount ?? null,
  };
  return MakeSchema.parse(cleaned);
}

export function adaptRawMakeList(input: unknown): MakeListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map(adaptRawMake);
  return MakeListResponseSchema.parse({ data });
}

export function adaptRawVehicleModel(raw: unknown): VehicleModel {
  const item = ensureNonArrayObject(raw, 'vehicle model');
  const cleaned: Record<string, unknown> = {
    publicId: item.publicId,
    slug: item.slug,
    name: item.name,
    bodyType: item.bodyType ?? null,
    vehicleType: item.vehicleType ?? null,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    activeListingCount: item.activeListingCount ?? null,
  };
  return VehicleModelSchema.parse(cleaned);
}

export function adaptRawVehicleModelList(input: unknown): VehicleModelListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map(adaptRawVehicleModel);
  return VehicleModelListResponseSchema.parse({ data });
}

export function adaptRawGeneration(raw: unknown): Generation {
  const item = ensureNonArrayObject(raw, 'generation');
  const cleaned: Record<string, unknown> = {
    publicId: item.publicId,
    name: item.name,
    startYear: item.startYear,
    endYear: item.endYear ?? null,
  };
  return GenerationSchema.parse(cleaned);
}

export function adaptRawGenerationList(input: unknown): GenerationListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map(adaptRawGeneration);
  return GenerationListResponseSchema.parse({ data });
}

export function adaptRawTrim(raw: unknown): Trim {
  const item = ensureNonArrayObject(raw, 'trim');
  const cleaned: Record<string, unknown> = {
    publicId: item.publicId,
    name: item.name,
    modelYear: item.modelYear,
    engineCc: item.engineCc ?? null,
    powerHp: item.powerHp ?? null,
    torqueNm: item.torqueNm ?? null,
    fuelType: item.fuelType ?? null,
    transmission: item.transmission ?? null,
    drivetrain: item.drivetrain ?? null,
    seats: item.seats ?? null,
    fuelEconomyKmL: item.fuelEconomyKmL ?? null,
    warrantyYears: item.warrantyYears ?? null,
    warrantyKm: item.warrantyKm ?? null,
    specs: item.specs ?? null,
    officialPriceCents: item.officialPriceCents ?? null,
    marketPriceCents: item.marketPriceCents ?? null,
    currency: item.currency,
    brochureUrl: item.brochureUrl ?? null,
    isActive: item.isActive,
  };
  return TrimSchema.parse(cleaned);
}

export function adaptRawTrimList(input: unknown): TrimListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map(adaptRawTrim);
  return TrimListResponseSchema.parse({ data });
}

export function adaptRawTrimDetail(input: unknown): TrimResponse {
  const obj = unwrapDataObject(input);
  const data = adaptRawTrim(obj);
  return TrimResponseSchema.parse({ data });
}

export function adaptRawSpotlight(input: unknown): SpotlightResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map((raw) => {
    const item = ensureNonArrayObject(raw, 'spotlight item');
    return SpotlightItemSchema.parse({
      modelPublicId: item.modelPublicId,
      modelSlug: item.modelSlug,
      modelName: item.modelName,
      makeName: item.makeName,
      makeSlug: item.makeSlug,
      makeLogoUrl: item.makeLogoUrl ?? null,
      bodyType: item.bodyType ?? null,
      startingPriceCents: item.startingPriceCents ?? null,
      currency: item.currency,
      activeNewListingCount: item.activeNewListingCount,
    });
  });
  return SpotlightResponseSchema.parse({ data });
}

export function adaptRawModelsWithPrices(input: unknown): ModelsWithPricesResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map((raw) => {
    const item = ensureNonArrayObject(raw, 'model with price');
    return ModelWithPriceSchema.parse({
      publicId: item.publicId,
      slug: item.slug,
      name: item.name,
      bodyType: item.bodyType ?? null,
      vehicleType: item.vehicleType ?? null,
      startingPriceCents: item.startingPriceCents ?? null,
      currency: item.currency,
      activeListingCount: item.activeListingCount,
    });
  });
  return ModelsWithPricesResponseSchema.parse({ data });
}

export function adaptRawModelPage(input: unknown): ModelPageResponse {
  const obj = unwrapDataObject(input);
  const data = ModelPageSchema.parse(obj);
  return ModelPageResponseSchema.parse({ data });
}

export function adaptRawCatalogueTrimDetail(input: unknown): CatalogueTrimDetailResponse {
  const obj = unwrapDataObject(input);
  const data = CatalogueTrimDetailSchema.parse(obj);
  return CatalogueTrimDetailResponseSchema.parse({ data });
}

export function adaptRawTrimDealers(input: unknown): TrimDealersResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map((raw) => {
    const item = ensureNonArrayObject(raw, 'trim dealer');
    return TrimDealerSchema.parse({
      publicId: item.publicId,
      slug: item.slug,
      displayName: item.displayName,
      logoUrl: item.logoUrl ?? null,
      cityName: item.cityName ?? null,
      isVerified: item.isVerified,
      listingCount: item.listingCount,
      startingPriceCents: item.startingPriceCents ?? null,
      currency: item.currency,
    });
  });
  return TrimDealersResponseSchema.parse({ data });
}

export function adaptRawCityList(input: unknown): CityListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map((raw) => {
    const item = ensureNonArrayObject(raw, 'city');
    return CitySchema.parse({
      id: item.id,
      countryId: item.countryId,
      name: item.name,
      isActive: item.isActive,
    });
  });
  return CityListResponseSchema.parse({ data });
}

export function adaptRawAreaList(input: unknown): AreaListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map((raw) => {
    const item = ensureNonArrayObject(raw, 'area');
    return AreaSchema.parse({
      id: item.id,
      cityId: item.cityId,
      name: item.name,
      postalCode: item.postalCode ?? null,
      isActive: item.isActive,
    });
  });
  return AreaListResponseSchema.parse({ data });
}

export function adaptRawCountryList(input: unknown): CountryListResponse {
  const rawArray = unwrapDataArray(input);
  const data = rawArray.map((raw) => {
    const item = ensureNonArrayObject(raw, 'country');
    return CountrySchema.parse({
      id: item.id,
      code: item.code,
      name: item.name,
      phoneCode: item.phoneCode,
      currency: item.currency,
      configJson: item.configJson ?? null,
      isActive: item.isActive,
    });
  });
  return CountryListResponseSchema.parse({ data });
}

export function adaptRawCountryConfig(input: unknown): CountryConfigResponse {
  const obj = unwrapDataObject(input);
  const nestedConfig = (typeof obj.config === 'object' && obj.config !== null && !Array.isArray(obj.config))
    ? (obj.config as Record<string, unknown>)
    : {};

  const cleaned = {
    code: obj.code,
    currency: obj.currency,
    currencySymbol: obj.currencySymbol ?? nestedConfig.currencySymbol ?? null,
    phoneFormat: obj.phoneFormat ?? nestedConfig.phoneFormat ?? null,
    legalDisclaimer: obj.legalDisclaimer ?? nestedConfig.legalDisclaimer ?? null,
    defaultInterestRate: obj.defaultInterestRate ?? nestedConfig.defaultInterestRate ?? null,
  };

  const data = CountryConfigSchema.parse(cleaned);
  return CountryConfigResponseSchema.parse({ data });
}

