import type { LocalizedText } from './common';
import type {
  BodyType,
  CarCondition,
  ConditionGrade,
  Drivetrain,
  FuelType,
  ListingCard,
  ListingTransitionAction,
  Transmission,
} from './listing';

export type {
  BodyType,
  CarCondition,
  ConditionGrade,
  Drivetrain,
  FuelType,
  ListingCard,
  ListingTransitionAction,
  Transmission,
};

export interface CreateListingInput {
  makePublicId: string;
  modelPublicId: string;
  generationPublicId?: string | undefined;
  trimPublicId?: string | undefined;
  year: number;
  mileageKm: number;
  condition: CarCondition;
  conditionGrade?: ConditionGrade | null | undefined;
  priceCents: number;
  currency?: string | undefined;
  isNegotiable?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  exchangeAccepted?: boolean | undefined;
  fuelType: FuelType;
  transmission: Transmission;
  bodyType: BodyType;
  colorExterior?: string | null | undefined;
  colorInterior?: string | null | undefined;
  engineCc?: number | null | undefined;
  powerHp?: number | null | undefined;
  seats?: number | null | undefined;
  drivetrain?: Drivetrain | null | undefined;
  vin?: string | null | undefined;
  description?: LocalizedText | null | undefined;
  features?: string[] | null | undefined;
  cityId: number;
  areaId?: number | null | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  registrationStatus?: string | null | undefined;
  hasWarranty?: boolean | undefined;
  hasServiceHistory?: boolean | undefined;
  contactPhone?: string | null | undefined;
  whatsappPhone?: string | null | undefined;
  allowChat?: boolean | undefined;
  imageFilePublicIds?: string[] | undefined;
  coverImagePublicId?: string | undefined;
  branchPublicId?: string | undefined;
}

export interface UpdateListingInput {
  generationPublicId?: string | undefined;
  trimPublicId?: string | undefined;
  year?: number | undefined;
  mileageKm?: number | undefined;
  condition?: CarCondition | undefined;
  conditionGrade?: ConditionGrade | null | undefined;
  priceCents?: number | undefined;
  currency?: string | undefined;
  isNegotiable?: boolean | undefined;
  installmentAvailable?: boolean | undefined;
  exchangeAccepted?: boolean | undefined;
  fuelType?: FuelType | undefined;
  transmission?: Transmission | undefined;
  bodyType?: BodyType | undefined;
  colorExterior?: string | null | undefined;
  colorInterior?: string | null | undefined;
  engineCc?: number | null | undefined;
  powerHp?: number | null | undefined;
  seats?: number | null | undefined;
  drivetrain?: Drivetrain | null | undefined;
  vin?: string | null | undefined;
  description?: LocalizedText | null | undefined;
  features?: string[] | null | undefined;
  cityId?: number | undefined;
  areaId?: number | null | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  registrationStatus?: string | null | undefined;
  hasWarranty?: boolean | undefined;
  hasServiceHistory?: boolean | undefined;
  contactPhone?: string | null | undefined;
  whatsappPhone?: string | null | undefined;
  allowChat?: boolean | undefined;
  imageFilePublicIds?: string[] | undefined;
  coverImagePublicId?: string | undefined;
  branchPublicId?: string | undefined;
}

export interface TransitionListingInput {
  action: ListingTransitionAction;
  rejectionReason?: string | undefined;
}

export interface UpdatePriceInput {
  priceCents: number;
}

export type SellStep =
  | 'condition'
  | 'vehicle'
  | 'details'
  | 'pricing'
  | 'photos'
  | 'location'
  | 'review';

export interface SellListingDraft {
  condition: CarCondition | null;
  makePublicId: string | null;
  modelPublicId: string | null;
  generationPublicId: string | null;
  trimPublicId: string | null;
  year: number | null;
  mileageKm: number | null;
  fuelType: FuelType | null;
  transmission: Transmission | null;
  bodyType: BodyType | null;
  engineCc: number | null;
  colorExterior: string | null;
  colorInterior: string | null;
  features: string[];
  description: string;
  priceCents: number | null;
  isNegotiable: boolean;
  installmentAvailable: boolean;
  exchangeAccepted: boolean;
  hasWarranty: boolean;
  hasServiceHistory: boolean;
  cityId: number | null;
  areaId: number | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  allowChat: boolean;
}

export type SellPhotoStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface SellPhoto {
  clientId: string;
  localPreviewUrl: string;
  publicId: string | null;
  url: string | null;
  status: SellPhotoStatus;
  progress: number;
}

export interface SellWizardState {
  currentStep: SellStep;
  draft: SellListingDraft;
  photos: SellPhoto[];
  coverPhotoClientId: string | null;
  isSubmitting: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  createdListing: ListingCard | null;
  isSuccess: boolean;
}

export interface ListingFeedState {
  items: ListingCard[];
  page: number;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
}

export type ListingScopeType = 'personal' | 'dealership';

export interface ListingScopeQuota {
  currentCount: number;
  maxLimit: number;
  availableSlots: number;
}

export interface ListingOwnershipScope {
  id: string; // 'personal' or vendorPublicId
  type: ListingScopeType;
  displayName: string;
  role: string; // 'INDIVIDUAL' | 'OWNER' | 'MANAGER' | 'STAFF'
  vendorPublicId?: string | undefined;
  isVerified: boolean;
  phoneVerified: boolean;
  quota: ListingScopeQuota;
}

