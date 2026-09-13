import type { Locale } from "./common";
import type { CompareItemRef } from "./compare";
import type {
  BodyType,
  CarCondition,
  FuelType,
  SellerType,
  Transmission,
} from "./listing";

export interface SavedSearchQuery {
  makeSlug?: string | undefined;
  modelSlug?: string | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  mileageMax?: number | undefined;
  cityId?: number | undefined;
  areaId?: number | undefined;
  condition?: CarCondition | undefined;
  fuelType?: FuelType | undefined;
  transmission?: Transmission | undefined;
  bodyType?: BodyType | undefined;
  sellerType?: SellerType | undefined;
  hasWarranty?: boolean | undefined;
  isNegotiable?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  exchangeAccepted?: boolean | undefined;
}

export interface SavedSearch {
  publicId: string;
  name: string | null;
  query: SavedSearchQuery;
  isActive: boolean;
  notifyPush: boolean;
  notifyEmail: boolean;
  lastMatchedAt: string | null;
  createdAt: string;
}

export interface SavedSearchListResponse {
  data: SavedSearch[];
}

export interface SavedSearchResponse {
  data: SavedSearch;
}

export interface CreateSavedSearchInput {
  name: string | null;
  query: SavedSearchQuery;
  notifyPush: boolean;
  notifyEmail: boolean;
}

export interface UpdateSavedSearchInput {
  name?: string | null | undefined;
  isActive?: boolean | undefined;
  notifyPush?: boolean | undefined;
  notifyEmail?: boolean | undefined;
}

export interface SavedSearchPublicIdParams {
  publicId: string;
}

export interface VehicleSearchSuggestion {
  type: "MAKE" | "MODEL";
  label: string;
  makeSlug: string;
  modelSlug: string | null;
  comparisonRef: CompareItemRef | null;
}

export interface VehicleSearchSuggestionParams {
  q: string;
  locale: Locale;
  condition?: CarCondition | undefined;
  limit?: (5 | 8 | 12) | undefined;
}

export interface VehicleSearchSuggestionResponse {
  data: VehicleSearchSuggestion[];
}
