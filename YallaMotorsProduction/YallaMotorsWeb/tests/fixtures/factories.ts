export const FIXED_TIMESTAMP = '2026-01-01T12:00:00.000Z';
export const FIXED_USER_ID = 'usr_01h7x9k3p0000000000000001';
export const FIXED_LISTING_ID = 'lst_01h7x9k3p0000000000000001';
export const FIXED_DEALER_ID = 'dlr_01h7x9k3p0000000000000001';
export const FIXED_REQUEST_ID = 'req_01h7x9k3p0000000000000001';

export type Locale = 'ar' | 'en';
export type AccountType = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type KycStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type SignInMethod = 'EMAIL_PASSWORD' | 'GOOGLE' | 'APPLE' | 'OTP' | 'RESTORED';
export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 502 | 503 | 504;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export interface LocalizedText {
  readonly ar: string;
  readonly en: string;
}

export interface PartialLocalizedText {
  readonly ar?: string;
  readonly en?: string;
}

export interface CursorMeta {
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface PageMeta {
  readonly total: number | null;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly error: {
    readonly status: HttpStatus;
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly fieldErrors: readonly FieldError[];
    readonly details: JsonValue | null;
    readonly retryAfterSeconds: number | null;
  };
}

export interface RoleSummary {
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
}

export interface UserProfile {
  readonly publicId: string;
  readonly email: string;
  readonly phone: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly status: UserStatus;
  readonly locale: Locale;
  readonly emailVerifiedAt: string | null;
  readonly phoneVerifiedAt: string | null;
  readonly kycStatus: KycStatus;
  readonly kycApprovedAt: string | null;
  readonly kycRejectionReason: string | null;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly avatarUrl: string | null;
  readonly accountType: AccountType;
  readonly roles: readonly RoleSummary[];
  readonly permissions: readonly string[];
}

export interface SafeSession {
  readonly user: UserProfile;
  readonly signInMethod: SignInMethod;
  readonly isAuthenticated: true;
}

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

export interface ListingCard {
  readonly publicId: string;
  readonly slug: string;
  readonly title: string;
  readonly makeName: LocalizedText;
  readonly modelName: LocalizedText;
  readonly year: number;
  readonly mileageKm: number;
  readonly priceCents: number;
  readonly currency: string;
  readonly isNegotiable: boolean;
  readonly fuelType: FuelType;
  readonly transmission: Transmission;
  readonly bodyType: BodyType;
  readonly condition: CarCondition;
  readonly conditionGrade: ConditionGrade | null;
  readonly sellerType: SellerType;
  readonly cityName: LocalizedText;
  readonly coverImageUrl: string | null;
  readonly officialPriceCents: number | null;
  readonly isFavorited: boolean;
  readonly isFeatured: boolean;
  readonly featuredUntil: string | null;
  readonly featuredTier: 'PREMIUM' | 'EXTRA_PREMIUM' | null;
  readonly publishedAt: string | null;
  readonly viewsCount: number;
  readonly favoritesCount: number;
  readonly imagesCount: number;
  readonly isSellerVerified: boolean;
}

export interface ListingTaxonRef {
  readonly publicId: string;
  readonly slug: string;
  readonly name: LocalizedText;
}

export interface ListingGenerationRef {
  readonly publicId: string;
  readonly name: string;
}

export interface ListingTrimRef {
  readonly publicId: string;
  readonly name: LocalizedText;
  readonly officialPriceCents: number | null;
}

export interface ListingLocationRef {
  readonly id: number;
  readonly name: LocalizedText;
}

export interface ListingImage {
  readonly url: string;
  readonly isCover: boolean;
  readonly sortOrder: number;
}

export interface ListingVendorInfo {
  readonly publicId: string;
  readonly slug: string;
  readonly displayName: LocalizedText;
  readonly logoUrl: string | null;
  readonly ratingAverage: number;
  readonly reviewCount: number;
  readonly isVerified: boolean;
}

export interface ListingDetail {
  readonly publicId: string;
  readonly slug: string;
  readonly title: string;
  readonly sellerType: SellerType;
  readonly status: ListingStatus;
  readonly rejectionReason: string | null;
  readonly make: ListingTaxonRef;
  readonly model: ListingTaxonRef;
  readonly generation: ListingGenerationRef | null;
  readonly trim: ListingTrimRef | null;
  readonly year: number;
  readonly mileageKm: number;
  readonly priceCents: number;
  readonly currency: string;
  readonly isNegotiable: boolean;
  readonly installmentAvailable: boolean;
  readonly exchangeAccepted: boolean;
  readonly condition: CarCondition;
  readonly conditionGrade: ConditionGrade | null;
  readonly fuelType: FuelType;
  readonly transmission: Transmission;
  readonly bodyType: BodyType;
  readonly colorExterior: string | null;
  readonly colorInterior: string | null;
  readonly engineCc: number | null;
  readonly powerHp: number | null;
  readonly seats: number | null;
  readonly drivetrain: Drivetrain | null;
  readonly vin: string | null;
  readonly description: PartialLocalizedText | null;
  readonly features: readonly string[] | null;
  readonly city: ListingLocationRef;
  readonly area: ListingLocationRef | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly registrationStatus: string | null;
  readonly hasWarranty: boolean;
  readonly hasServiceHistory: boolean;
  readonly images: readonly ListingImage[];
  readonly contactPhone: string | null;
  readonly whatsappPhone: string | null;
  readonly allowChat: boolean;
  readonly vendor: ListingVendorInfo | null;
  readonly publishedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string | null;
  readonly featuredUntil: string | null;
  readonly viewsCount: number;
  readonly favoritesCount: number;
  readonly leadsCount: number;
  readonly isFavorited: boolean;
}

export function createUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    publicId: FIXED_USER_ID,
    email: 'user@arabiyatmart.com',
    phone: '+201000000001',
    firstName: 'أحمد',
    lastName: 'علي',
    status: 'ACTIVE',
    locale: 'ar',
    emailVerifiedAt: FIXED_TIMESTAMP,
    phoneVerifiedAt: FIXED_TIMESTAMP,
    kycStatus: 'APPROVED',
    kycApprovedAt: FIXED_TIMESTAMP,
    kycRejectionReason: null,
    lastLoginAt: FIXED_TIMESTAMP,
    createdAt: FIXED_TIMESTAMP,
    avatarUrl: 'https://images.arabiyatmart.com/avatars/default.webp',
    accountType: 'CUSTOMER',
    roles: [
      {
        name: 'CUSTOMER',
        description: 'Standard marketplace user',
        isSystem: true,
      },
    ],
    permissions: ['listing:read', 'lead:create', 'favorite:toggle'],
    ...overrides,
  };
}

export function createSafeSession(overrides?: Partial<SafeSession>): SafeSession {
  return {
    user: createUserProfile(),
    signInMethod: 'EMAIL_PASSWORD',
    isAuthenticated: true,
    ...overrides,
  };
}

export function createListingCard(overrides?: Partial<ListingCard>): ListingCard {
  return {
    publicId: FIXED_LISTING_ID,
    slug: 'toyota-corolla-2024-lst01h7',
    title: 'تويوتا كورولا 2024 فئة اولى',
    makeName: { ar: 'تويوتا', en: 'Toyota' },
    modelName: { ar: 'كورولا', en: 'Corolla' },
    year: 2024,
    mileageKm: 15000,
    priceCents: 65000000,
    currency: 'EGP',
    isNegotiable: true,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SEDAN',
    condition: 'USED',
    conditionGrade: 'EXCELLENT',
    sellerType: 'DEALER',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    coverImageUrl: 'https://images.arabiyatmart.com/listings/lst_01h7/cover.webp',
    officialPriceCents: 75000000,
    isFavorited: false,
    isFeatured: true,
    featuredUntil: '2026-12-31T23:59:59.000Z',
    featuredTier: 'PREMIUM',
    publishedAt: FIXED_TIMESTAMP,
    viewsCount: 142,
    favoritesCount: 18,
    imagesCount: 5,
    isSellerVerified: true,
    ...overrides,
  };
}

export function createListingDetail(overrides?: Partial<ListingDetail>): ListingDetail {
  return {
    publicId: FIXED_LISTING_ID,
    slug: 'toyota-corolla-2024-lst01h7',
    title: 'تويوتا كورولا 2024 فئة اولى',
    sellerType: 'DEALER',
    status: 'ACTIVE',
    rejectionReason: null,
    make: {
      publicId: 'mak_toyota001',
      slug: 'toyota',
      name: { ar: 'تويوتا', en: 'Toyota' },
    },
    model: {
      publicId: 'mod_corolla001',
      slug: 'corolla',
      name: { ar: 'كورولا', en: 'Corolla' },
    },
    generation: {
      publicId: 'gen_corolla12',
      name: 'E210',
    },
    trim: {
      publicId: 'trm_active001',
      name: { ar: 'اكتيف', en: 'Active' },
      officialPriceCents: 75000000,
    },
    year: 2024,
    mileageKm: 15000,
    priceCents: 65000000,
    currency: 'EGP',
    isNegotiable: true,
    installmentAvailable: true,
    exchangeAccepted: false,
    condition: 'USED',
    conditionGrade: 'EXCELLENT',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SEDAN',
    colorExterior: 'أبيض لؤلؤي',
    colorInterior: 'أسود',
    engineCc: 1600,
    powerHp: 120,
    seats: 5,
    drivetrain: 'FWD',
    vin: null,
    description: {
      ar: 'سيارة بحالة الوكالة صيانات منتظمة بالتوكيل',
      en: 'Car in agency condition with regular maintenance',
    },
    features: ['ABS', 'Airbags', 'Sunroof', 'Touchscreen', 'Rear Camera'],
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
    registrationStatus: 'مفحوصة ومرخصة',
    hasWarranty: true,
    hasServiceHistory: true,
    images: [
      {
        url: 'https://images.arabiyatmart.com/listings/lst_01h7/img1.webp',
        isCover: true,
        sortOrder: 0,
      },
      {
        url: 'https://images.arabiyatmart.com/listings/lst_01h7/img2.webp',
        isCover: false,
        sortOrder: 1,
      },
    ],
    contactPhone: '+201000000000',
    whatsappPhone: '+201000000000',
    allowChat: true,
    vendor: {
      publicId: FIXED_DEALER_ID,
      slug: 'al-futtaim-motors',
      displayName: { ar: 'الفطيم للسيارات', en: 'Al-Futtaim Motors' },
      logoUrl: 'https://images.arabiyatmart.com/dealers/logo.webp',
      ratingAverage: 4.8,
      reviewCount: 96,
      isVerified: true,
    },
    publishedAt: FIXED_TIMESTAMP,
    expiresAt: '2026-03-01T12:00:00.000Z',
    createdAt: FIXED_TIMESTAMP,
    featuredUntil: '2026-12-31T23:59:59.000Z',
    viewsCount: 142,
    favoritesCount: 18,
    leadsCount: 12,
    isFavorited: false,
    ...overrides,
  };
}

export function createApiError(overrides?: Partial<ApiErrorBody['error']>): ApiErrorBody {
  return {
    error: {
      status: 400,
      code: 'BAD_REQUEST',
      message: 'طلب غير صالح',
      requestId: FIXED_REQUEST_ID,
      fieldErrors: [],
      details: null,
      retryAfterSeconds: null,
      ...overrides,
    },
  };
}

export function createCursorMeta(overrides?: Partial<CursorMeta>): CursorMeta {
  return {
    hasMore: true,
    nextCursor: 'cursor_01h7x9k3p0000000000000002',
    ...overrides,
  };
}

export function createPageMeta(overrides?: Partial<PageMeta>): PageMeta {
  return {
    total: 100,
    page: 1,
    limit: 20,
    hasMore: true,
    ...overrides,
  };
}
