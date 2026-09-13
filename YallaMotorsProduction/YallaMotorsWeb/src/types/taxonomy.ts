import type {
  JsonValue,
  LocalizedText,
  PartialLocalizedText,
} from './common';
import type {
  BodyType,
  CarCondition,
  Drivetrain,
  FuelType,
  Transmission,
  VehicleType,
} from './listing';

export interface Make {
  publicId: string;
  slug: string;
  name: LocalizedText;
  logoUrl: string | null;
  countryOfOrigin: string | null;
  isActive: boolean;
  sortOrder: number;
  activeListingCount: number | null;
}

export interface VehicleModel {
  publicId: string;
  slug: string;
  name: LocalizedText;
  bodyType: BodyType | null;
  vehicleType: VehicleType | null;
  isActive: boolean;
  sortOrder: number;
  activeListingCount: number | null;
}

export interface Generation {
  publicId: string;
  name: string;
  startYear: number;
  endYear: number | null;
}

export interface Trim {
  publicId: string;
  name: LocalizedText;
  modelYear: number;
  engineCc: number | null;
  powerHp: number | null;
  torqueNm: number | null;
  fuelType: FuelType | null;
  transmission: Transmission | null;
  drivetrain: Drivetrain | null;
  seats: number | null;
  fuelEconomyKmL: number | null;
  warrantyYears: number | null;
  warrantyKm: number | null;
  specs: JsonValue | null;
  officialPriceCents: number | null;
  marketPriceCents: number | null;
  currency: string;
  brochureUrl: string | null;
  isActive: boolean;
}

export interface SpotlightItem {
  modelPublicId: string;
  modelSlug: string;
  modelName: PartialLocalizedText;
  makeName: PartialLocalizedText;
  makeSlug: string;
  makeLogoUrl: string | null;
  bodyType: BodyType | null;
  startingPriceCents: number | null;
  currency: string;
  activeNewListingCount: number;
}

export interface ModelWithPrice {
  publicId: string;
  slug: string;
  name: PartialLocalizedText;
  bodyType: BodyType | null;
  vehicleType: VehicleType | null;
  startingPriceCents: number | null;
  currency: string;
  activeListingCount: number;
}

export interface GenerationSummary extends Generation {
  trimCount: number;
}

export interface TrimSummary {
  publicId: string;
  name: PartialLocalizedText;
  modelYear: number;
  engineCc: number | null;
  powerHp: number | null;
  fuelType: FuelType | null;
  transmission: Transmission | null;
  officialPriceCents: number | null;
  marketPriceCents: number | null;
  currency: string;
  isActive: boolean;
}

export interface ModelPage {
  publicId: string;
  slug: string;
  name: PartialLocalizedText;
  bodyType: BodyType | null;
  vehicleType: VehicleType | null;
  make: {
    publicId: string;
    slug: string;
    name: PartialLocalizedText;
    logoUrl: string | null;
  };
  startingPriceCents: number | null;
  currency: string;
  activeNewListingCount: number;
  generations: GenerationSummary[];
  trims: TrimSummary[];
}

export interface PriceHistoryEntry {
  priceCents: number;
  priceType: string;
  effectiveAt: string | null;
  source: string | null;
}

export interface TrimAncestry {
  publicId: string;
  name: string;
  model: {
    publicId: string;
    slug: string;
    name: PartialLocalizedText;
    make: {
      publicId: string;
      slug: string;
      name: PartialLocalizedText;
    };
  };
}

export interface CatalogueTrimDetail extends Trim {
  generation: TrimAncestry;
  priceHistory: PriceHistoryEntry[];
}

export interface TrimDealer {
  publicId: string;
  slug: string;
  displayName: PartialLocalizedText;
  logoUrl: string | null;
  cityName: PartialLocalizedText | null;
  isVerified: boolean;
  listingCount: number;
  startingPriceCents: number | null;
  currency: string;
}

export interface City {
  id: number;
  countryId: number;
  name: LocalizedText;
  isActive: boolean;
}

export interface Area {
  id: number;
  cityId: number;
  name: LocalizedText;
  postalCode: string | null;
  isActive: boolean;
}

export interface Country {
  id: number;
  code: string;
  name: LocalizedText;
  phoneCode: string;
  currency: string;
  configJson: JsonValue | null;
  isActive: boolean;
}

export interface CountryConfig {
  code: string;
  currency: string;
  currencySymbol: string | null;
  phoneFormat: string | null;
  legalDisclaimer: PartialLocalizedText | null;
  defaultInterestRate: number | null;
}

// ── Response Wrappers ──────────────────────────────────────────────────────────

export interface MakeListResponse {
  data: Make[];
}

export interface VehicleModelListResponse {
  data: VehicleModel[];
}

export interface GenerationListResponse {
  data: Generation[];
}

export interface TrimListResponse {
  data: Trim[];
}

export interface TrimResponse {
  data: Trim;
}

export interface SpotlightResponse {
  data: SpotlightItem[];
}

export interface ModelsWithPricesResponse {
  data: ModelWithPrice[];
}

export interface ModelPageResponse {
  data: ModelPage;
}

export interface CatalogueTrimDetailResponse {
  data: CatalogueTrimDetail;
}

export interface TrimDealersResponse {
  data: TrimDealer[];
}

export type MakeDealersResponse = TrimDealersResponse;

export interface CityListResponse {
  data: City[];
}

export interface AreaListResponse {
  data: Area[];
}

export interface CountryListResponse {
  data: Country[];
}

export interface CountryConfigResponse {
  data: CountryConfig;
}

// ── Operation Params ─────────────────────────────────────────────────────────

export interface SpotlightParams {
  limit?: number | undefined;
}

export interface ModelsWithPricesParams {
  makeSlug: string;
  condition?: CarCondition | undefined;
}

export interface TrimDealersParams {
  publicId: string;
  limit?: number | undefined;
}

export interface MakeDealersParams {
  makeSlug: string;
  limit?: number | undefined;
}

export interface ModelPathParams {
  publicId: string;
}

export interface TrimPathParams {
  publicId: string;
}

export interface TaxonomyModelsParams {
  makeSlug: string;
}

export interface TaxonomyGenerationsParams {
  modelPublicId: string;
}

export interface TaxonomyTrimsParams {
  generationPublicId: string;
}

export interface CountryCodeParams {
  code: string;
}

export interface CountryCitiesParams {
  code: string;
}

export interface CityAreasParams {
  cityId: number;
}
