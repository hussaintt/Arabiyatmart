import { z } from 'zod';
import type {
  CompareItemKind,
  CompareItemRef,
  ComparePageData,
  CompareParams,
  ComparisonBetter,
  ComparisonItem,
  ComparisonSpecRow,
} from '@/types/compare';
import {
  MoneyCentsSchema,
  PublicIdSchema,
  SlugSchema,
} from './common';
import {
  ApprovedImageUrlSchema,
  BodyTypeSchema,
  FuelTypeSchema,
  TransmissionSchema,
} from './listing';

export const CompareItemKindSchema = z.enum([
  'listing',
  'trim',
]) satisfies z.ZodType<CompareItemKind>;

export const CompareItemRefSchema: z.ZodType<CompareItemRef> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('listing'),
    id: SlugSchema,
  }),
  z.object({
    kind: z.literal('trim'),
    id: PublicIdSchema,
  }),
]);

/**
 * Validates and transforms a string formatted as "listing:<slug>" or "trim:<publicId>"
 * into a typed CompareItemRef.
 */
export const CompareItemParamSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const colonIdx = val.indexOf(':');
    if (colonIdx <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compare item param must be in the format "<kind>:<id>"',
      });
      return;
    }
    const kind = val.slice(0, colonIdx);
    const id = val.slice(colonIdx + 1);

    if (kind !== 'listing' && kind !== 'trim') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compare item kind must be "listing" or "trim"',
      });
      return;
    }

    if (kind === 'listing') {
      const slugRes = SlugSchema.safeParse(id);
      if (!slugRes.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Listing compare item must have a valid slug',
        });
      }
    } else {
      const idRes = PublicIdSchema.safeParse(id);
      if (!idRes.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Trim compare item must have a valid publicId',
        });
      }
    }
  })
  .transform((val): CompareItemRef => {
    const colonIdx = val.indexOf(':');
    const kind = val.slice(0, colonIdx) as 'listing' | 'trim';
    const id = val.slice(colonIdx + 1);
    return { kind, id };
  });

/**
 * Schema for compare workspace selections.
 * Enforces unique items and at most 3 compared listings/items (TASK-008 instruction 3).
 */
export const CompareSelectionSchema = z
  .array(CompareItemRefSchema)
  .min(1)
  .max(3, 'At most three items may be compared simultaneously')
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i],
          message: 'Duplicate compare items are not allowed',
        });
      }
      seen.add(key);
    }
  });

export const CompareParamsSchema: z.ZodType<CompareParams> = z.object({
  items: CompareSelectionSchema,
});

export const ComparisonItemSchema: z.ZodType<ComparisonItem> = z.object({
  id: PublicIdSchema,
  title: z.string().trim().min(1),
  subtitle: z.string().nullable(),
  detailRoute: z
    .string()
    .refine((r) => r.startsWith('/'), 'Detail route must be a relative path starting with /')
    .nullable(),
  imageUrl: ApprovedImageUrlSchema.nullable(),
  priceCents: MoneyCentsSchema.nullable(),
  powerHp: z.number().int().positive().nullable(),
  warrantyYears: z.number().int().nonnegative().nullable(),
  engineCc: z.number().int().positive().nullable(),
  mileageKm: z.number().int().nonnegative().nullable(),
  seats: z.number().int().positive().nullable(),
  transmission: TransmissionSchema.nullable(),
  fuelType: FuelTypeSchema.nullable(),
  bodyType: BodyTypeSchema.nullable(),
});

export const ComparisonBetterSchema = z.enum([
  'none',
  'lower',
  'higher',
]) satisfies z.ZodType<ComparisonBetter>;

export const ComparisonSpecRowSchema: z.ZodType<ComparisonSpecRow> = z
  .object({
    label: z.string().trim().min(1),
    display: z.array(z.string()).max(4),
    numeric: z.array(z.number().nullable()).max(4),
    better: ComparisonBetterSchema,
  })
  .superRefine((value, context) => {
    if (value.display.length !== value.numeric.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numeric'],
        message: 'display and numeric columns must align',
      });
    }
  });

export const ComparePageDataSchema: z.ZodType<ComparePageData> = z.object({
  items: z.array(ComparisonItemSchema).max(4),
  rows: z.array(ComparisonSpecRowSchema),
});

/**
 * Parses and canonicalizes compare items from URL search parameters.
 * Accepts single string or array of strings, deduplicates, and validates at most 3 items.
 */
export function parseCompareUrlItems(param: unknown): CompareItemRef[] {
  if (!param) return [];
  const rawList = Array.isArray(param) ? param : [param];
  const items: CompareItemRef[] = [];
  const seen = new Set<string>();

  for (const raw of rawList) {
    if (typeof raw !== 'string') continue;
    const parsed = CompareItemParamSchema.safeParse(raw);
    if (!parsed.success) continue;
    const key = `${parsed.data.kind}:${parsed.data.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push(parsed.data);
    }
  }

  // Cap at 3 selections per TASK-008 instruction 3 & TASK-044
  return items.slice(0, 3);
}
