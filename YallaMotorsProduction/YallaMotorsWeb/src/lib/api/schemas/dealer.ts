import { z } from 'zod';
import type {
  ActiveVendorState,
  BusinessDayHours,
  DealerBranch,
  DealerDirectoryItem,
  DealerDirectoryResponse,
  DealerInventoryParams,
  DealerListParams,
  DealerProfile,
  DealerProfileResponse,
  MyVendorsResponse,
  StoreType,
  Vendor,
  VendorMembership,
  VendorMembershipWithVendor,
  VendorRole,
  VendorStatus,
  WeeklyBusinessHours,
} from '@/types/dealer';
import {
  ApiErrorBodySchema,
  CurrencySchema,
  CursorMetaSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  LocalizedTextSchema,
  MoneyCentsSchema,
  PublicIdSchema,
  SlugSchema,
} from './common';
import {
  BodyTypeSchema,
  CarConditionSchema,
  FuelTypeSchema,
  TransmissionSchema,
  VehicleTypeSchema,
} from './listing';
import {
  unwrapDataArray,
  unwrapDataObject,
} from './taxonomy';

// ── Enums ───────────────────────────────────────────────────────────────────

export const VendorStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'SUSPENDED',
  'REJECTED',
  'CLOSED',
]) satisfies z.ZodType<VendorStatus>;

export const VendorRoleSchema = z.enum([
  'OWNER',
  'MANAGER',
  'STAFF',
  'VIEWER',
]) satisfies z.ZodType<VendorRole>;

export const StoreTypeSchema = z.enum([
  'INDIVIDUAL',
  'COMPANY',
  'SUPPLIER',
]) satisfies z.ZodType<StoreType>;

// ── Business Hours ──────────────────────────────────────────────────────────

export function isOvernightHours(open: string, close: string): boolean {
  return close < open;
}

export const BusinessDayHoursSchema: z.ZodType<BusinessDayHours> = z.object({
  open: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:mm)'),
  close: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:mm)'),
  closed: z.boolean().optional(),
  isOvernight: z.boolean().optional(),
});

export const WeeklyBusinessHoursSchema: z.ZodType<WeeklyBusinessHours> = z.record(
  z.enum([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]),
  BusinessDayHoursSchema.optional()
);

// ── Dealer Directory & Profile ───────────────────────────────────────────────

export const DealerDirectoryItemSchema: z.ZodType<DealerDirectoryItem> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  displayName: LocalizedTextSchema,
  logoUrl: z.string().url().nullable(),
  cityName: LocalizedTextSchema.nullable(),
  activeListingCount: z.number().int().nonnegative(),
  isVerified: z.boolean(),
});

export const DealerDirectoryResponseSchema: z.ZodType<DealerDirectoryResponse> = z.object({
  data: z.array(DealerDirectoryItemSchema),
  meta: CursorMetaSchema,
});

export const DealerBranchSchema: z.ZodType<DealerBranch> = z.object({
  publicId: PublicIdSchema,
  name: LocalizedTextSchema,
  cityId: z.number().int().positive(),
  areaId: z.number().int().positive().nullable(),
  addressLine: z.string().nullable(),
  phone: z.string().nullable(),
  hours: JsonValueSchema.nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export const DealerProfileSchema: z.ZodType<DealerProfile> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  displayName: LocalizedTextSchema,
  description: LocalizedTextSchema.nullable(),
  logoUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  storeType: StoreTypeSchema,
  isVerified: z.boolean(),
  activeListingCount: z.number().int().nonnegative(),
  branchCount: z.number().int().nonnegative(),
  ratingAverage: z.number().nonnegative().max(5),
  reviewCount: z.number().int().nonnegative(),
  branches: z.array(DealerBranchSchema),
});

export const DealerProfileResponseSchema: z.ZodType<DealerProfileResponse> = z.object({
  data: DealerProfileSchema,
});

// ── Vendor & Memberships ────────────────────────────────────────────────────

export const VendorSchema: z.ZodType<Vendor> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  legalName: z.string().trim().min(1),
  displayName: LocalizedTextSchema,
  description: LocalizedTextSchema.nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  status: VendorStatusSchema,
  approvedAt: IsoDateTimeSchema.nullable(),
  storeType: StoreTypeSchema,
  businessAddressLine: z.string().nullable(),
  businessCountryId: z.number().int().positive().nullable(),
  businessCityId: z.number().int().positive().nullable(),
  businessPostalCode: z.string().nullable(),
  defaultCurrency: CurrencySchema,
  createdAt: IsoDateTimeSchema,
});

export const VendorMembershipSchema: z.ZodType<VendorMembership> = z.object({
  vendorPublicId: PublicIdSchema,
  role: VendorRoleSchema,
  invitedAt: IsoDateTimeSchema,
  acceptedAt: IsoDateTimeSchema.nullable(),
});

export const VendorMembershipWithVendorSchema: z.ZodType<VendorMembershipWithVendor> = z
  .object({
    vendor: VendorSchema,
    membership: VendorMembershipSchema,
  })
  .superRefine((value, context) => {
    if (value.vendor.publicId !== value.membership.vendorPublicId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['membership', 'vendorPublicId'],
        message: 'Membership vendor does not match',
      });
    }
  });

export const MyVendorsResponseSchema: z.ZodType<MyVendorsResponse> = z.object({
  data: z.array(VendorMembershipWithVendorSchema),
});

export const ActiveVendorStateSchema: z.ZodType<ActiveVendorState> = z
  .object({
    memberships: z.array(VendorMembershipWithVendorSchema),
    activeVendorPublicId: PublicIdSchema.nullable(),
    resolutionError: ApiErrorBodySchema.nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.activeVendorPublicId !== null &&
      !value.memberships.some((item) => item.vendor.publicId === value.activeVendorPublicId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activeVendorPublicId'],
        message: 'Active vendor must be one of the resolved memberships',
      });
    }
  });

// ── Params ──────────────────────────────────────────────────────────────────

export const DealerListParamsSchema: z.ZodType<DealerListParams> = z.object({
  cityId: z.number().int().positive().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.union([z.literal(12), z.literal(20), z.literal(24), z.literal(40)]).optional(),
});

export const DealerInventoryParamsSchema: z.ZodType<DealerInventoryParams> = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.union([z.literal(12), z.literal(20), z.literal(24), z.literal(40)]).optional(),
    makeSlug: SlugSchema.optional(),
    modelSlug: SlugSchema.optional(),
    yearMin: z.number().int().min(1900).max(2100).optional(),
    yearMax: z.number().int().min(1900).max(2100).optional(),
    priceMin: MoneyCentsSchema.optional(),
    priceMax: MoneyCentsSchema.optional(),
    mileageMax: z.number().int().nonnegative().optional(),
    cityId: z.number().int().positive().optional(),
    condition: CarConditionSchema.optional(),
    fuelType: FuelTypeSchema.optional(),
    transmission: TransmissionSchema.optional(),
    bodyType: BodyTypeSchema.optional(),
    vehicleType: VehicleTypeSchema.optional(),
    hasWarranty: z.boolean().optional(),
    installmentAvailable: z.boolean().optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
  })
  .superRefine((value, context) => {
    if (value.modelSlug && !value.makeSlug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modelSlug'],
        message: 'modelSlug requires makeSlug',
      });
    }
    if (value.yearMin !== undefined && value.yearMax !== undefined && value.yearMin > value.yearMax) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['yearMax'],
        message: 'Invalid year range',
      });
    }
    if (value.priceMin !== undefined && value.priceMax !== undefined && value.priceMin > value.priceMax) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceMax'],
        message: 'Invalid price range',
      });
    }
  });

// ── Adapters ─────────────────────────────────────────────────────────────────

export function adaptRawDealerBranch(raw: unknown): DealerBranch {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected object for dealer branch',
      },
    ]);
  }
  const item = raw as Record<string, unknown>;
  const lat = item.lat === null || item.lat === undefined
    ? null
    : typeof item.lat === 'number'
      ? item.lat
      : typeof item.lat === 'string' && item.lat.trim() !== ''
        ? Number(item.lat)
        : item.lat;

  const lng = item.lng === null || item.lng === undefined
    ? null
    : typeof item.lng === 'number'
      ? item.lng
      : typeof item.lng === 'string' && item.lng.trim() !== ''
        ? Number(item.lng)
        : item.lng;

  const cleaned = {
    publicId: item.publicId,
    name: item.name,
    cityId: item.cityId,
    areaId: item.areaId ?? null,
    addressLine: item.addressLine ?? null,
    phone: item.phone ?? null,
    hours: item.hours ?? item.hoursJson ?? null,
    lat,
    lng,
  };
  return DealerBranchSchema.parse(cleaned);
}

export function adaptRawDealerDirectory(input: unknown): DealerDirectoryResponse {
  let rawList: unknown[];
  let rawMeta: unknown = null;

  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      rawList = obj.data;
      if ('meta' in obj) rawMeta = obj.meta;
    } else {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data'],
          message: 'Expected data property to be an array for dealer directory',
        },
      ]);
    }
  } else {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected array or object input for dealer directory',
      },
    ]);
  }

  const meta = rawMeta !== null && typeof rawMeta === 'object'
    ? CursorMetaSchema.parse(rawMeta)
    : { hasMore: false, nextCursor: null };

  const data = rawList.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index],
          message: 'Expected dealer directory item to be an object',
        },
      ]);
    }
    const item = raw as Record<string, unknown>;
    return DealerDirectoryItemSchema.parse({
      publicId: item.publicId,
      slug: item.slug,
      displayName: item.displayName,
      logoUrl: item.logoUrl ?? null,
      cityName: item.cityName ?? null,
      activeListingCount: item.activeListingCount,
      isVerified: item.isVerified,
    });
  });

  return DealerDirectoryResponseSchema.parse({ data, meta });
}

export function adaptRawDealerProfile(input: unknown): DealerProfileResponse {
  const item = unwrapDataObject(input);

  if (!Array.isArray(item.branches)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['branches'],
        message: 'Expected branches to be an array',
      },
    ]);
  }
  const branches = item.branches.map(adaptRawDealerBranch);

  const ratingAverage = typeof item.ratingAverage === 'number'
    ? item.ratingAverage
    : typeof item.ratingAverage === 'string' && item.ratingAverage.trim() !== ''
      ? Number(item.ratingAverage)
      : item.ratingAverage;

  const cleaned = {
    publicId: item.publicId,
    slug: item.slug,
    displayName: item.displayName,
    description: item.description ?? null,
    logoUrl: item.logoUrl ?? null,
    bannerUrl: item.bannerUrl ?? null,
    storeType: item.storeType,
    isVerified: item.isVerified,
    activeListingCount: item.activeListingCount,
    branchCount: branches.length,
    ratingAverage,
    reviewCount: item.reviewCount,
    branches,
  };

  const data = DealerProfileSchema.parse(cleaned);
  return DealerProfileResponseSchema.parse({ data });
}

export function adaptRawMyVendors(input: unknown): MyVendorsResponse {
  const list = unwrapDataArray(input);

  const data = list.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index],
          message: 'Expected vendor membership entry to be an object',
        },
      ]);
    }
    const item = raw as Record<string, unknown>;

    if (typeof item.vendor !== 'object' || item.vendor === null || Array.isArray(item.vendor)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index, 'vendor'],
          message: 'Expected vendor property to be an object',
        },
      ]);
    }
    const rawVendor = item.vendor as Record<string, unknown>;

    let createdAt = rawVendor.createdAt;
    if (createdAt instanceof Date && !isNaN(createdAt.getTime())) {
      createdAt = createdAt.toISOString();
    }

    let approvedAt = rawVendor.approvedAt;
    if (approvedAt instanceof Date && !isNaN(approvedAt.getTime())) {
      approvedAt = approvedAt.toISOString();
    } else if (approvedAt === undefined) {
      approvedAt = null;
    }

    const vendorCleaned = {
      publicId: rawVendor.publicId,
      slug: rawVendor.slug,
      legalName: rawVendor.legalName,
      displayName: rawVendor.displayName,
      description: rawVendor.description ?? null,
      email: rawVendor.email,
      phone: rawVendor.phone ?? null,
      logoUrl: rawVendor.logoUrl ?? null,
      bannerUrl: rawVendor.bannerUrl ?? null,
      status: rawVendor.status,
      approvedAt,
      storeType: rawVendor.storeType,
      businessAddressLine: rawVendor.businessAddressLine ?? null,
      businessCountryId: rawVendor.businessCountryId ?? null,
      businessCityId: rawVendor.businessCityId ?? null,
      businessPostalCode: rawVendor.businessPostalCode ?? null,
      defaultCurrency: rawVendor.defaultCurrency,
      createdAt,
    };

    const vendor = VendorSchema.parse(vendorCleaned);

    const rawMembership = (typeof item.membership === 'object' && item.membership !== null && !Array.isArray(item.membership))
      ? (item.membership as Record<string, unknown>)
      : item;

    let invitedAt = rawMembership.invitedAt ?? item.invitedAt;
    if (invitedAt instanceof Date && !isNaN(invitedAt.getTime())) {
      invitedAt = invitedAt.toISOString();
    }

    let acceptedAt = rawMembership.acceptedAt ?? item.acceptedAt;
    if (acceptedAt instanceof Date && !isNaN(acceptedAt.getTime())) {
      acceptedAt = acceptedAt.toISOString();
    } else if (acceptedAt === undefined) {
      acceptedAt = null;
    }

    const membershipCleaned = {
      vendorPublicId: rawMembership.vendorPublicId ?? vendor.publicId,
      role: rawMembership.role ?? item.role,
      invitedAt,
      acceptedAt,
    };

    const membership = VendorMembershipSchema.parse(membershipCleaned);

    return VendorMembershipWithVendorSchema.parse({ vendor, membership });
  });

  return MyVendorsResponseSchema.parse({ data });
}

export function resolveActiveVendorState(
  memberships: VendorMembershipWithVendor[],
  requestedVendorPublicId?: string | null
): ActiveVendorState {
  if (memberships.length === 0) {
    return ActiveVendorStateSchema.parse({
      memberships: [],
      activeVendorPublicId: null,
      resolutionError: null,
    });
  }

  if (requestedVendorPublicId) {
    const exists = memberships.some((m) => m.vendor.publicId === requestedVendorPublicId);
    if (exists) {
      return ActiveVendorStateSchema.parse({
        memberships,
        activeVendorPublicId: requestedVendorPublicId,
        resolutionError: null,
      });
    }

    return ActiveVendorStateSchema.parse({
      memberships,
      activeVendorPublicId: null,
      resolutionError: {
        error: {
          status: 403,
          code: 'VENDOR_NOT_FOUND',
          message: 'Requested vendor was not found in user memberships',
          requestId: 'active_vendor_resolution',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      },
    });
  }

  // Default: select the first membership
  return ActiveVendorStateSchema.parse({
    memberships,
    activeVendorPublicId: memberships[0]!.vendor.publicId,
    resolutionError: null,
  });
}
