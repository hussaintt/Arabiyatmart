import { z } from 'zod';
import type {
  ListingSearchParams,
  ListingSearchResponse,
} from '@/types/search';
import {
  MoneyCentsSchema,
  PageMetaSchema,
  SlugSchema,
} from './common';
import {
  BodyTypeSchema,
  CarConditionSchema,
  FuelTypeSchema,
  ListingCardSchema,
  ListingSortSchema,
  PublicListingCardSchema,
  SellerTypeSchema,
  TransmissionSchema,
  VehicleTypeSchema,
} from './listing';

function preprocessScalar(val: unknown): unknown {
  if (Array.isArray(val)) {
    if (val.length > 1) {
      return '__REPEATED_SCALAR_PARAMETER__';
    }
    return val.length === 1 ? val[0] : undefined;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return val;
}

const repeatedScalarCheck = (v: unknown) => v !== '__REPEATED_SCALAR_PARAMETER__';
const repeatedScalarError = { message: 'Repeated scalar parameters are forbidden' };

export const ListingSearchParamsSchema: z.ZodType<ListingSearchParams> = z
  .object({
    q: z.string().trim().min(2).max(120).optional(),
    makeSlug: SlugSchema.optional(),
    modelSlug: SlugSchema.optional(),
    yearMin: z.number().int().min(1900).max(2100).optional(),
    yearMax: z.number().int().min(1900).max(2100).optional(),
    priceMin: MoneyCentsSchema.optional(),
    priceMax: MoneyCentsSchema.optional(),
    mileageMax: z.number().int().nonnegative().optional(),
    cityId: z.number().int().positive().optional(),
    areaId: z.number().int().positive().optional(),
    condition: CarConditionSchema.optional(),
    fuelType: FuelTypeSchema.optional(),
    transmission: TransmissionSchema.optional(),
    bodyType: BodyTypeSchema.optional(),
    sellerType: SellerTypeSchema.optional(),
    vehicleType: VehicleTypeSchema.optional(),
    hasWarranty: z.boolean().optional(),
    isNegotiable: z.boolean().optional(),
    installmentAvailable: z.boolean().optional(),
    exchangeAccepted: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    sort: ListingSortSchema.optional(),
    page: z.number().int().positive().max(10000).optional(),
    limit: z.union([z.literal(12), z.literal(20), z.literal(24), z.literal(40)]).optional(),
    countOnly: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.modelSlug && !value.makeSlug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modelSlug'],
        message: 'modelSlug requires makeSlug',
      });
    }
    if (value.yearMin && value.yearMax && value.yearMin > value.yearMax) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['yearMax'],
        message: 'yearMax must be greater than or equal to yearMin',
      });
    }
    if (
      value.priceMin !== undefined &&
      value.priceMax !== undefined &&
      value.priceMin > value.priceMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceMax'],
        message: 'priceMax must be greater than or equal to priceMin',
      });
    }
  });

export const ListingSearchUrlSchema = z
  .object({
    q: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.string().trim().min(2).max(120).optional()),
    makeSlug: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(SlugSchema.optional()),
    modelSlug: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(SlugSchema.optional()),
    yearMin: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().min(1900).max(2100).optional()),
    yearMax: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().min(1900).max(2100).optional()),
    priceMin: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().nonnegative().optional()),
    priceMax: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().nonnegative().optional()),
    mileageMax: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().nonnegative().optional()),
    cityId: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().positive().optional()),
    areaId: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().positive().optional()),
    condition: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(CarConditionSchema.optional()),
    fuelType: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(FuelTypeSchema.optional()),
    transmission: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(TransmissionSchema.optional()),
    bodyType: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(BodyTypeSchema.optional()),
    sellerType: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(SellerTypeSchema.optional()),
    vehicleType: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(VehicleTypeSchema.optional()),
    hasWarranty: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z
          .union([
            z.boolean(),
            z.enum(['true', 'false']).transform((val) => val === 'true'),
          ])
          .optional()
      ),
    isNegotiable: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z
          .union([
            z.boolean(),
            z.enum(['true', 'false']).transform((val) => val === 'true'),
          ])
          .optional()
      ),
    installmentAvailable: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z
          .union([
            z.boolean(),
            z.enum(['true', 'false']).transform((val) => val === 'true'),
          ])
          .optional()
      ),
    exchangeAccepted: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z
          .union([
            z.boolean(),
            z.enum(['true', 'false']).transform((val) => val === 'true'),
          ])
          .optional()
      ),
    isVerified: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z
          .union([
            z.boolean(),
            z.enum(['true', 'false']).transform((val) => val === 'true'),
          ])
          .optional()
      ),
    sort: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(ListingSortSchema.optional()),
    page: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(z.coerce.number().int().positive().max(10000).optional()),
    limit: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z.coerce
          .number()
          .int()
          .pipe(z.union([z.literal(12), z.literal(20), z.literal(24), z.literal(40)]))
          .optional()
      ),
    countOnly: z
      .preprocess(preprocessScalar, z.unknown())
      .refine(repeatedScalarCheck, repeatedScalarError)
      .pipe(
        z
          .union([
            z.boolean(),
            z.enum(['true', 'false']).transform((val) => val === 'true'),
          ])
          .optional()
      ),
  })
  .superRefine((value, context) => {
    if (value.modelSlug && !value.makeSlug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modelSlug'],
        message: 'modelSlug requires makeSlug',
      });
    }
    if (value.yearMin && value.yearMax && value.yearMin > value.yearMax) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['yearMax'],
        message: 'yearMax must be greater than or equal to yearMin',
      });
    }
    if (
      value.priceMin !== undefined &&
      value.priceMax !== undefined &&
      value.priceMin > value.priceMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceMax'],
        message: 'priceMax must be greater than or equal to priceMin',
      });
    }
  });

export const ListingSearchResponseSchema: z.ZodType<ListingSearchResponse> = z.object({
  data: z.array(ListingCardSchema),
  meta: PageMetaSchema,
});

export const PublicListingSearchResponseSchema: z.ZodType<ListingSearchResponse> = z.object({
  data: z.array(PublicListingCardSchema),
  meta: PageMetaSchema,
});

export function canonicalizeListingSearchParams(raw: unknown): ListingSearchParams {
  const parsed = ListingSearchUrlSchema.parse(raw);
  return ListingSearchParamsSchema.parse(parsed);
}
