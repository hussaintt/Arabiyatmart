import { z } from 'zod';
import type {
  CreateOfferInput,
  CreateOfferParams,
  Offer,
  OfferBuyer,
  OfferListing,
  OfferListParams,
  OfferListResponse,
  OfferPublicIdParams,
  OfferResponse,
  OfferStatus,
  RespondOfferInput,
  SellerScope,
} from '@/types/offer';
import {
  CurrencySchema,
  IsoDateTimeSchema,
  MoneyCentsSchema,
  PositiveMoneyCentsSchema,
  PublicIdSchema,
  SlugSchema,
} from './common';
import { unwrapDataArray, unwrapDataObject } from './taxonomy';

// ── Enums ───────────────────────────────────────────────────────────────────

export const OfferStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'COUNTERED',
  'EXPIRED',
  'WITHDRAWN',
]) satisfies z.ZodType<OfferStatus>;

// ── Seller Scope ────────────────────────────────────────────────────────────

export const SellerScopeSchema: z.ZodType<SellerScope> = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('PRIVATE') }),
    z.object({ kind: z.literal('VENDOR'), vendorPublicId: PublicIdSchema }),
  ]
);

// ── Offer Sub-entities ──────────────────────────────────────────────────────

export const OfferListingSchema: z.ZodType<OfferListing> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  title: z.string().min(1),
  coverImageUrl: z.string().url().nullable(),
  priceCents: MoneyCentsSchema,
});

export const OfferBuyerSchema: z.ZodType<OfferBuyer> = z.object({
  publicId: PublicIdSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

// ── Offer Entity ────────────────────────────────────────────────────────────

export const OfferSchema: z.ZodType<Offer> = z.object({
  publicId: PublicIdSchema,
  offerCents: PositiveMoneyCentsSchema,
  counterCents: PositiveMoneyCentsSchema.nullable(),
  currency: CurrencySchema,
  status: OfferStatusSchema,
  message: z.string().max(500).nullable(),
  sellerNote: z.string().max(500).nullable(),
  expiresAt: IsoDateTimeSchema,
  respondedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  listing: OfferListingSchema,
  buyer: OfferBuyerSchema,
});

export const OfferResponseSchema: z.ZodType<OfferResponse> = z.object({
  data: OfferSchema,
});

export const OfferListResponseSchema: z.ZodType<OfferListResponse> = z.object({
  data: z.array(OfferSchema),
  total: z.number().int().nonnegative().nullable(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(50),
});

// ── Input & Params Schemas ──────────────────────────────────────────────────

export const CreateOfferInputSchema: z.ZodType<CreateOfferInput> = z.object({
  offerCents: PositiveMoneyCentsSchema,
  message: z.string().trim().max(500).nullable(),
});

export const RespondOfferInputSchema: z.ZodType<RespondOfferInput> = z
  .object({
    action: z.enum(['accept', 'reject', 'counter']),
    counterCents: PositiveMoneyCentsSchema.optional(),
    sellerNote: z.string().trim().max(500).nullable(),
  })
  .superRefine((value, context) => {
    if (value.action === 'counter' && value.counterCents === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['counterCents'],
        message: 'A counter amount is required',
      });
    }
    if (value.action !== 'counter' && value.counterCents !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['counterCents'],
        message: 'A counter amount is allowed only for counter',
      });
    }
  });

export const OfferListParamsSchema: z.ZodType<OfferListParams> = z.object({
  status: OfferStatusSchema.optional(),
  page: z.number().int().positive().optional(),
  limit: z.union([z.literal(10), z.literal(20), z.literal(40)]).optional(),
});

export const OfferPublicIdParamsSchema: z.ZodType<OfferPublicIdParams> = z.object({
  publicId: PublicIdSchema,
});

export const CreateOfferParamsSchema: z.ZodType<CreateOfferParams> = z.object({
  listingSlug: SlugSchema,
});

// ── Null Omission for Upstream Bodies ────────────────────────────────────────

export function stripOfferNullsForUpstream<T extends Record<string, unknown>>(
  input: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val !== null && val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

// ── Adapters ─────────────────────────────────────────────────────────────────

function cleanRawOffer(raw: Record<string, unknown>): Record<string, unknown> {
  let listing: unknown = raw.listing;
  if (typeof raw.listing === 'object' && raw.listing !== null && !Array.isArray(raw.listing)) {
    const rawListing = raw.listing as Record<string, unknown>;
    listing = {
      publicId: rawListing.publicId,
      slug: rawListing.slug,
      title: rawListing.title,
      coverImageUrl: rawListing.coverImageUrl === undefined ? null : rawListing.coverImageUrl,
      priceCents: rawListing.priceCents,
    };
  }

  let buyer: unknown = raw.buyer;
  if (typeof raw.buyer === 'object' && raw.buyer !== null && !Array.isArray(raw.buyer)) {
    const rawBuyer = raw.buyer as Record<string, unknown>;
    buyer = {
      publicId: rawBuyer.publicId,
      firstName: rawBuyer.firstName === undefined ? null : rawBuyer.firstName,
      lastName: rawBuyer.lastName === undefined ? null : rawBuyer.lastName,
    };
  }

  return {
    publicId: raw.publicId,
    offerCents: raw.offerCents,
    counterCents: raw.counterCents === undefined ? null : raw.counterCents,
    currency: raw.currency,
    status: raw.status,
    message: raw.message === undefined ? null : raw.message,
    sellerNote: raw.sellerNote === undefined ? null : raw.sellerNote,
    expiresAt: raw.expiresAt,
    respondedAt: raw.respondedAt === undefined ? null : raw.respondedAt,
    createdAt: raw.createdAt,
    listing,
    buyer,
  };
}

export function adaptRawOffer(input: unknown): OfferResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  const cleaned = cleanRawOffer(target);
  const data = OfferSchema.parse(cleaned);
  return { data };
}

export function adaptRawOfferList(input: unknown): OfferListResponse {
  if (typeof input !== 'object' || input === null) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected offer list object input',
      },
    ]);
  }

  const rawObj = input as Record<string, unknown>;
  const list = unwrapDataArray(rawObj);

  const data = list.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index],
          message: 'Expected offer entry to be an object',
        },
      ]);
    }
    const cleaned = cleanRawOffer(item as Record<string, unknown>);
    return OfferSchema.parse(cleaned);
  });

  // Only documented legacy transformation: missing total becomes null
  const total = rawObj.total === undefined ? null : rawObj.total;

  return OfferListResponseSchema.parse({
    data,
    total,
    page: rawObj.page,
    limit: rawObj.limit,
  });
}
