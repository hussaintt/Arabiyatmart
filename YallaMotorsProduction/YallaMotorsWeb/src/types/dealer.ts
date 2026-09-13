import type {
  ApiErrorBody,
  CursorMeta,
  JsonValue,
  LocalizedText,
} from './common';
import type {
  BodyType,
  CarCondition,
  FuelType,
  Transmission,
  VehicleType,
} from './listing';

export type VendorStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED' | 'CLOSED';
export type VendorRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'VIEWER';
export type StoreType = 'INDIVIDUAL' | 'COMPANY' | 'SUPPLIER';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface BusinessDayHours {
  open: string;
  close: string;
  closed?: boolean | undefined;
  isOvernight?: boolean | undefined;
}

export type WeeklyBusinessHours = {
  [K in DayOfWeek]?: BusinessDayHours | undefined;
};

export interface DealerDirectoryItem {
  publicId: string;
  slug: string;
  displayName: LocalizedText;
  logoUrl: string | null;
  cityName: LocalizedText | null;
  activeListingCount: number;
  isVerified: boolean;
}

export interface DealerDirectoryResponse {
  data: DealerDirectoryItem[];
  meta: CursorMeta;
}

export interface DealerBranch {
  publicId: string;
  name: LocalizedText;
  cityId: number;
  areaId: number | null;
  addressLine: string | null;
  phone: string | null;
  hours: JsonValue | null;
  lat: number | null;
  lng: number | null;
}

export interface DealerProfile {
  publicId: string;
  slug: string;
  displayName: LocalizedText;
  description: LocalizedText | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  storeType: StoreType;
  isVerified: boolean;
  activeListingCount: number;
  branchCount: number;
  ratingAverage: number;
  reviewCount: number;
  branches: DealerBranch[];
}

export interface DealerProfileResponse {
  data: DealerProfile;
}

export interface Vendor {
  publicId: string;
  slug: string;
  legalName: string;
  displayName: LocalizedText;
  description: LocalizedText | null;
  email: string;
  phone: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: VendorStatus;
  approvedAt: string | null;
  storeType: StoreType;
  businessAddressLine: string | null;
  businessCountryId: number | null;
  businessCityId: number | null;
  businessPostalCode: string | null;
  defaultCurrency: string;
  createdAt: string;
}

export interface VendorMembership {
  vendorPublicId: string;
  role: VendorRole;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface VendorMembershipWithVendor {
  vendor: Vendor;
  membership: VendorMembership;
}

export interface MyVendorsResponse {
  data: VendorMembershipWithVendor[];
}

export interface ActiveVendorState {
  memberships: VendorMembershipWithVendor[];
  activeVendorPublicId: string | null;
  resolutionError: ApiErrorBody | null;
}

export interface DealerListParams {
  cityId?: number | undefined;
  cursor?: string | undefined;
  limit?: 12 | 20 | 24 | 40 | undefined;
}

export interface DealerInventoryParams {
  cursor?: string | undefined;
  limit?: 12 | 20 | 24 | 40 | undefined;
  makeSlug?: string | undefined;
  modelSlug?: string | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  mileageMax?: number | undefined;
  cityId?: number | undefined;
  condition?: CarCondition | undefined;
  fuelType?: FuelType | undefined;
  transmission?: Transmission | undefined;
  bodyType?: BodyType | undefined;
  vehicleType?: VehicleType | undefined;
  hasWarranty?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  sort?: 'newest' | 'price_asc' | 'price_desc' | undefined;
}
