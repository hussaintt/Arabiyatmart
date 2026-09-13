import type { PageMeta } from './common';
import type {
  BodyType,
  CarCondition,
  FuelType,
  ListingCard,
  ListingSort,
  SellerType,
  Transmission,
  VehicleType,
} from './listing';

export interface ListingSearchParams {
  q?: string | undefined;
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
  vehicleType?: VehicleType | undefined;
  hasWarranty?: boolean | undefined;
  isNegotiable?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  exchangeAccepted?: boolean | undefined;
  isVerified?: boolean | undefined;
  sort?: ListingSort | undefined;
  page?: number | undefined;
  limit?: (12 | 20 | 24 | 40) | undefined;
  countOnly?: boolean | undefined;
}

export interface ListingSearchResponse {
  data: ListingCard[];
  meta: PageMeta;
}

export interface ListingSearchUrlParams {
  q?: string | undefined;
  makeSlug?: string | undefined;
  modelSlug?: string | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  mileageMax?: number | undefined;
  cityId?: number | undefined;
  areaId?: number | undefined;
  condition?: string | undefined;
  fuelType?: string | undefined;
  transmission?: string | undefined;
  bodyType?: string | undefined;
  sellerType?: string | undefined;
  vehicleType?: string | undefined;
  hasWarranty?: boolean | undefined;
  isNegotiable?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  exchangeAccepted?: boolean | undefined;
  isVerified?: boolean | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}
