import { z } from 'zod';
import type {
  CreateLeadInput,
  CreateReportInput,
  Lead,
  LeadChannel,
  LeadDetail,
  LeadDetailResponse,
  LeadEvent,
  LeadListing,
  LeadListParams,
  LeadListResponse,
  LeadParty,
  LeadPublicIdParams,
  LeadResponse,
  LeadStatus,
  ListingPromotion,
  ListingReport,
  ListingReportResponse,
  PromotionListing,
  PromotionPackage,
  PromotionPackageListResponse,
  PromotionListResponse,
  PromotionPerks,
  PromotionResponse,
  PurchasePromotionInput,
  ReportCategory,
  UpdateLeadStatusInput,
} from '@/types/lead';
import {
  CurrencySchema,
  CursorMetaSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  MoneyCentsSchema,
  PublicIdSchema,
  SlugSchema,
} from './common';
import { PromotionTierSchema } from './listing';
import { unwrapDataArray, unwrapDataObject } from './taxonomy';

// ── Enums ───────────────────────────────────────────────────────────────────

export const LeadChannelSchema = z.enum([
  'CALL_REVEAL',
  'WHATSAPP',
  'CHAT',
  'CALLBACK_FORM',
  'FINANCE_REQUEST',
  'INSURANCE_REQUEST',
  'TEST_DRIVE',
  'INSPECTION',
]) satisfies z.ZodType<LeadChannel>;

export const LeadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'WON',
  'LOST',
  'SPAM',
]) satisfies z.ZodType<LeadStatus>;

export const ReportCategorySchema = z.enum([
  'FRAUD',
  'WRONG_INFO',
  'SOLD_ALREADY',
  'DUPLICATE',
  'OFFENSIVE',
  'OTHER',
]) satisfies z.ZodType<ReportCategory>;

// ── Sub-entities ────────────────────────────────────────────────────────────

export const LeadPartySchema: z.ZodType<LeadParty> = z.object({
  publicId: PublicIdSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
});

export const LeadListingSchema: z.ZodType<LeadListing> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema,
  title: z.string(),
});

export const LeadEventSchema: z.ZodType<LeadEvent> = z.object({
  type: z.string().min(1),
  meta: JsonValueSchema.nullable(),
  createdAt: IsoDateTimeSchema.nullable(),
});

// ── Lead Entities & Responses ───────────────────────────────────────────────

export const LeadSchema = z.object({
  publicId: PublicIdSchema,
  channel: LeadChannelSchema,
  status: LeadStatusSchema,
  buyerName: z.string().nullable(),
  buyerPhone: z.string().nullable(),
  note: z.string().nullable(),
  eventsCount: z.number().int().nonnegative(),
  lastActivityAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema.nullable(),
  listing: LeadListingSchema,
  buyer: LeadPartySchema.nullable(),
  seller: LeadPartySchema.nullable(),
}) satisfies z.ZodType<Lead>;

export const LeadDetailSchema: z.ZodType<LeadDetail> = LeadSchema.extend({
  events: z.array(LeadEventSchema).max(50),
});

export const LeadResponseSchema: z.ZodType<LeadResponse> = z.object({
  data: LeadSchema,
});

export const LeadDetailResponseSchema: z.ZodType<LeadDetailResponse> = z.object({
  data: LeadDetailSchema,
});

export const LeadListResponseSchema: z.ZodType<LeadListResponse> = z.object({
  data: z.array(LeadSchema),
  meta: CursorMetaSchema,
});

// ── Lead Inputs & Params ────────────────────────────────────────────────────

export const CreateLeadInputSchema: z.ZodType<CreateLeadInput> = z
  .object({
    listingPublicId: PublicIdSchema,
    channel: LeadChannelSchema,
    buyerPhone: z.string().trim().min(8).max(32).nullable(),
    buyerName: z.string().trim().min(1).max(160).nullable(),
    note: z.string().trim().max(1000).nullable(),
    meta: JsonValueSchema.nullable(),
  })
  .superRefine((val, ctx) => {
    // Cross-field rule: Direct callback / request channels require buyerPhone
    if (
      ['CALLBACK_FORM', 'FINANCE_REQUEST', 'INSURANCE_REQUEST', 'TEST_DRIVE', 'INSPECTION'].includes(
        val.channel
      )
    ) {
      if (!val.buyerPhone || val.buyerPhone.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['buyerPhone'],
          message: 'Buyer phone is required for lead requests',
        });
      }
    }
  });

export const UpdateLeadStatusInputSchema: z.ZodType<UpdateLeadStatusInput> = z.object({
  status: z.enum(['CONTACTED', 'QUALIFIED', 'WON', 'LOST', 'SPAM']),
  note: z.string().trim().max(1000).nullable(),
});

export const LeadListParamsSchema: z.ZodType<LeadListParams> = z.object({
  status: LeadStatusSchema.optional(),
  channel: LeadChannelSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.union([z.literal(20), z.literal(40), z.literal(80)]).optional(),
});

export const LeadPublicIdParamsSchema: z.ZodType<LeadPublicIdParams> = z.object({
  publicId: PublicIdSchema,
});

// ── Reports ─────────────────────────────────────────────────────────────────

export const ListingReportSchema: z.ZodType<ListingReport> = z.object({
  publicId: PublicIdSchema,
  category: ReportCategorySchema,
  details: z.string().max(1000).nullable(),
  status: z.string(),
  createdAt: IsoDateTimeSchema.nullable(),
  listing: LeadListingSchema,
});

export const ListingReportResponseSchema: z.ZodType<ListingReportResponse> = z.object({
  data: ListingReportSchema,
});

export const CreateReportInputSchema: z.ZodType<CreateReportInput> = z
  .object({
    listingPublicId: PublicIdSchema,
    category: ReportCategorySchema,
    details: z.string().trim().max(1000).nullable(),
  })
  .superRefine((val, ctx) => {
    // Cross-field rule: OTHER category requires non-empty details
    if (val.category === 'OTHER') {
      if (!val.details || val.details.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['details'],
          message: 'Details are required when category is OTHER',
        });
      }
    }
  });

// ── Promotions ──────────────────────────────────────────────────────────────

export const PromotionPerksSchema = z.object({
  highlightedCard: z.boolean(),
  homepageSlot: z.boolean(),
  performanceStats: z.boolean(),
  autoRenewEveryDays: z.number().int().positive().nullable(),
}) satisfies z.ZodType<PromotionPerks>;

export const PromotionListingSchema: z.ZodType<PromotionListing> = z.object({
  publicId: PublicIdSchema,
  slug: SlugSchema.nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
});

export const ListingPromotionSchema: z.ZodType<ListingPromotion> = z.object({
  publicId: PublicIdSchema,
  tier: PromotionTierSchema.nullable(),
  type: z.string(),
  status: z.string(),
  durationDays: z.number().int().positive().max(30),
  priceCents: MoneyCentsSchema,
  currency: CurrencySchema,
  startsAt: IsoDateTimeSchema.nullable(),
  endsAt: IsoDateTimeSchema.nullable(),
  lastBumpedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  perks: PromotionPerksSchema.nullable(),
  listing: PromotionListingSchema.nullable(),
});

export const PromotionPackageSchema: z.ZodType<PromotionPackage> = PromotionPerksSchema.extend({
  tier: PromotionTierSchema,
  durationDays: z.number().int().positive().max(30),
  priceCents: MoneyCentsSchema,
  currency: CurrencySchema,
  placements: z.array(z.string()),
});

export const PromotionResponseSchema: z.ZodType<PromotionResponse> = z.object({
  data: ListingPromotionSchema,
});

export const PromotionListResponseSchema: z.ZodType<PromotionListResponse> = z.object({
  data: z.array(ListingPromotionSchema),
});

export const PromotionPackageListResponseSchema: z.ZodType<PromotionPackageListResponse> = z.object({
  data: z.array(PromotionPackageSchema),
});

export const PurchasePromotionInputSchema: z.ZodType<PurchasePromotionInput> = z.object({
  listingPublicId: PublicIdSchema,
  tier: PromotionTierSchema,
});

// ── Null Omission for Upstream Bodies ────────────────────────────────────────

export function stripLeadNullsForUpstream<T extends object>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val !== null && val !== undefined) {
      result[key as keyof T] = val as T[keyof T];
    }
  }
  return result;
}

// ── Adapters ─────────────────────────────────────────────────────────────────

function cleanRawParty(raw: unknown): LeadParty | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected party to be an object or null',
      },
    ]);
  }
  const obj = raw as Record<string, unknown>;
  const cleaned = {
    publicId: obj.publicId,
    firstName: obj.firstName === undefined ? null : obj.firstName,
    lastName: obj.lastName === undefined ? null : obj.lastName,
    phone: obj.phone === undefined ? null : obj.phone,
  };
  return LeadPartySchema.parse(cleaned);
}

function cleanRawLead(raw: Record<string, unknown>): Record<string, unknown> {
  let listing: unknown = raw.listing;
  if (typeof raw.listing === 'object' && raw.listing !== null && !Array.isArray(raw.listing)) {
    const rawListing = raw.listing as Record<string, unknown>;
    listing = {
      publicId: rawListing.publicId,
      slug: rawListing.slug,
      title: rawListing.title,
    };
  }

  return {
    publicId: raw.publicId,
    channel: raw.channel,
    status: raw.status,
    buyerName: raw.buyerName === undefined ? null : raw.buyerName,
    buyerPhone: raw.buyerPhone === undefined ? null : raw.buyerPhone,
    note: raw.note === undefined ? null : raw.note,
    eventsCount: raw.eventsCount,
    lastActivityAt: raw.lastActivityAt === undefined ? null : raw.lastActivityAt,
    createdAt: raw.createdAt === undefined ? null : raw.createdAt,
    listing,
    buyer: cleanRawParty(raw.buyer),
    seller: cleanRawParty(raw.seller),
  };
}

export function adaptRawLead(input: unknown): LeadResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  const cleaned = cleanRawLead(target);
  const data = LeadSchema.parse(cleaned);
  return { data };
}

export function adaptRawLeadDetail(input: unknown): LeadDetailResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  const cleaned = cleanRawLead(target);
  const rawEvents = target.events;
  const events = Array.isArray(rawEvents)
    ? rawEvents.map((evt) => {
        if (typeof evt !== 'object' || evt === null || Array.isArray(evt)) {
          return evt;
        }
        const e = evt as Record<string, unknown>;
        return {
          type: e.type,
          meta: e.meta === undefined ? null : e.meta,
          createdAt: e.createdAt === undefined ? null : e.createdAt,
        };
      })
    : rawEvents;

  const data = LeadDetailSchema.parse({
    ...cleaned,
    events,
  });
  return { data };
}

export function adaptRawLeadList(input: unknown): LeadListResponse {
  if (typeof input !== 'object' || input === null) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected lead list object input',
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
          message: 'Expected lead entry to be an object',
        },
      ]);
    }
    const cleaned = cleanRawLead(item as Record<string, unknown>);
    return LeadSchema.parse(cleaned);
  });

  let meta: unknown;
  if (typeof rawObj.meta === 'object' && rawObj.meta !== null && !Array.isArray(rawObj.meta)) {
    const m = rawObj.meta as Record<string, unknown>;
    meta = {
      hasMore: m.hasMore,
      nextCursor: m.nextCursor === undefined ? null : m.nextCursor,
    };
  } else if ('hasMore' in rawObj || 'nextCursor' in rawObj) {
    meta = {
      hasMore: rawObj.hasMore,
      nextCursor: rawObj.nextCursor === undefined ? null : rawObj.nextCursor,
    };
  } else {
    meta = rawObj.meta;
  }

  const validatedMeta = CursorMetaSchema.parse(meta);

  return {
    data,
    meta: validatedMeta,
  };
}

export function adaptRawListingReport(input: unknown): ListingReportResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  let listing: unknown = target.listing;
  if (typeof target.listing === 'object' && target.listing !== null && !Array.isArray(target.listing)) {
    const rawListing = target.listing as Record<string, unknown>;
    listing = {
      publicId: rawListing.publicId,
      slug: rawListing.slug,
      title: rawListing.title,
    };
  }

  const cleaned = {
    publicId: target.publicId,
    category: target.category,
    details: target.details === undefined ? null : target.details,
    status: target.status,
    createdAt: target.createdAt === undefined ? null : target.createdAt,
    listing,
  };

  const data = ListingReportSchema.parse(cleaned);
  return { data };
}

export function adaptRawListingPromotion(input: unknown): PromotionResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;

  let perks: unknown = null;
  if (target.perks !== undefined && target.perks !== null) {
    if (typeof target.perks === 'object' && !Array.isArray(target.perks)) {
      const p = target.perks as Record<string, unknown>;
      perks = {
        highlightedCard: p.highlightedCard,
        homepageSlot: p.homepageSlot,
        performanceStats: p.performanceStats,
        autoRenewEveryDays: p.autoRenewEveryDays === undefined ? null : p.autoRenewEveryDays,
      };
    } else {
      perks = target.perks;
    }
  }

  let listing: unknown = null;
  if (target.listing !== undefined && target.listing !== null) {
    if (typeof target.listing === 'object' && !Array.isArray(target.listing)) {
      const l = target.listing as Record<string, unknown>;
      listing = {
        publicId: l.publicId,
        slug: l.slug === undefined ? null : l.slug,
        year: l.year === undefined ? null : l.year,
      };
    } else {
      listing = target.listing;
    }
  }

  const cleaned = {
    publicId: target.publicId,
    tier: target.tier === undefined ? null : target.tier,
    type: target.type,
    status: target.status,
    durationDays: target.durationDays,
    priceCents: target.priceCents,
    currency: target.currency,
    startsAt: target.startsAt === undefined ? null : target.startsAt,
    endsAt: target.endsAt === undefined ? null : target.endsAt,
    lastBumpedAt: target.lastBumpedAt === undefined ? null : target.lastBumpedAt,
    createdAt: target.createdAt,
    perks,
    listing,
  };

  const data = ListingPromotionSchema.parse(cleaned);
  return { data };
}

export function adaptRawPromotionList(input: unknown): PromotionListResponse {
  const list = unwrapDataArray(input);
  const data = list.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: 'Expected promotion item to be an object',
        },
      ]);
    }
    const single = adaptRawListingPromotion({ data: item });
    return single.data;
  });
  return PromotionListResponseSchema.parse({ data });
}

export function adaptRawPromotionPackageList(input: unknown): PromotionPackageListResponse {
  const list = unwrapDataArray(input);
  const data = list.map((item) => {
    return PromotionPackageSchema.parse(item);
  });
  return PromotionPackageListResponseSchema.parse({ data });
}
