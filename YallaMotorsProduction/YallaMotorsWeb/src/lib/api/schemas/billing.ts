import { z } from 'zod';

export const QuotaMetricSchema = z
  .object({
    used: z.number().int().min(0),
    limit: z.number().int().min(0),
  })
  .strict();

export const FeaturedCreditQuotaSchema = z
  .object({
    balance: z.number().int().min(0),
    monthlyGrant: z.number().int().min(0),
  })
  .strict();

export const DealerEntitlementsSnapshotSchema = z
  .object({
    listings: QuotaMetricSchema,
    staff: QuotaMetricSchema,
    branches: QuotaMetricSchema,
    featuredCredits: FeaturedCreditQuotaSchema,
    features: z
      .object({
        analyticsEnabled: z.boolean(),
        verifiedBadge: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const DealerEntitlementsResponseSchema = z
  .object({
    data: DealerEntitlementsSnapshotSchema,
  })
  .strict();

export const SubscriptionPlanSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().nullable().optional().transform((val) => val ?? null),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3),
    billingInterval: z.enum(['MONTHLY', 'YEARLY']),
    features: z.record(z.string(), z.unknown()).default({}),
    isActive: z.boolean(),
  })
  .passthrough();

export const SubscriptionPlansResponseSchema = z
  .object({
    data: z.array(SubscriptionPlanSchema),
  })
  .passthrough();

export const VendorSubscriptionSchema = z
  .object({
    id: z.number().int().positive(),
    vendorId: z.number().int().positive(),
    planId: z.number().int().positive(),
    status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED']),
    currentPeriodStart: z.string(),
    currentPeriodEnd: z.string(),
    cancelAtPeriodEnd: z.boolean().default(false),
    canceledAt: z.string().nullable().optional().transform((val) => val ?? null),
    plan: SubscriptionPlanSchema.optional(),
  })
  .passthrough();

export const VendorSubscriptionResponseSchema = z
  .object({
    data: VendorSubscriptionSchema.nullable(),
  })
  .passthrough();

export const VendorBillingAccountSummarySchema = z
  .object({
    currency: z.string(),
    prepaidBalanceCents: z.number().int(),
    autopayIntentEnabled: z.boolean(),
    preferredPaymentMethod: z
      .enum(['CARD', 'WALLET', 'FAWRY_REFERENCE', 'BANK_TRANSFER', 'CASH'])
      .nullable(),
    restrictedAt: z.string().nullable(),
    restrictionReason: z.string().nullable(),
  })
  .strict();

export const VendorInvoiceItemSummarySchema = z
  .object({
    publicId: z.string(),
    invoiceNumber: z.string(),
    status: z.enum(['OPEN', 'PAID', 'OVERDUE', 'VOID']),
    periodStart: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val.toISOString() : val)),
    periodEnd: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val.toISOString() : val)),
    issuedAt: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val.toISOString() : val)),
    dueAt: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val.toISOString() : val)),
    graceEndsAt: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val.toISOString() : val)),
    totalAmountCents: z.number().int().min(0),
    balanceDueCents: z.number().int().min(0),
    currency: z.string(),
  })
  .passthrough();

export const VendorInvoiceLineItemSchema = z
  .object({
    publicId: z.string(),
    sourceType: z.string(),
    sourceId: z.string(),
    amountCents: z.number().int(),
    currency: z.string(),
    occurredAt: z.string(),
    description: z.record(z.string(), z.string()).nullable().optional().transform((val) => val ?? null),
  })
  .passthrough();

export const VendorInvoiceDetailSchema = VendorInvoiceItemSummarySchema.extend({
  lines: z.array(VendorInvoiceLineItemSchema).default([]),
  paidCents: z.number().int().default(0),
  appliedCreditCents: z.number().int().default(0),
  paidAt: z.string().nullable().optional().transform((val) => val ?? null),
}).passthrough();

export const VendorBillingPaymentSummarySchema = z
  .object({
    publicId: z.string(),
    purpose: z.string(),
    method: z.enum(['CARD', 'WALLET', 'FAWRY_REFERENCE', 'BANK_TRANSFER', 'CASH']),
    status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REJECTED']),
    amountCents: z.number().int().min(0),
    currency: z.string(),
    createdAt: z.string(),
    rejectionReason: z.string().nullable().optional().transform((val) => val ?? null),
  })
  .passthrough();

export const VendorBillingSummarySchema = z
  .object({
    vendor: z.object({
      publicId: z.string(),
      displayName: z.union([z.record(z.string(), z.string()), z.string()]),
      defaultCurrency: z.string().default('EGP'),
    }),
    account: VendorBillingAccountSummarySchema,
    currentInvoice: VendorInvoiceDetailSchema.nullable().optional().transform((val) => val ?? null),
    recentInvoices: z.array(VendorInvoiceItemSummarySchema).default([]),
    pendingPayments: z.array(VendorBillingPaymentSummarySchema).default([]),
    paymentCapabilities: z
      .object({
        methods: z.array(z.enum(['CARD', 'WALLET', 'FAWRY_REFERENCE', 'BANK_TRANSFER', 'CASH'])),
        autopayTokenizationAvailable: z.boolean(),
        manualProofPurpose: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const VendorBillingSummaryResponseSchema = z
  .object({
    data: VendorBillingSummarySchema,
  })
  .passthrough();

import { unwrapDataObject, unwrapDataArray } from './taxonomy';

export function adaptRawDealerEntitlements(input: unknown): { data: z.infer<typeof DealerEntitlementsSnapshotSchema> } {
  const obj = unwrapDataObject(input);
  const data = DealerEntitlementsSnapshotSchema.parse(obj);
  return { data };
}

export function adaptRawSubscriptionPlans(input: unknown): { data: z.infer<typeof SubscriptionPlanSchema>[] } {
  const arr = unwrapDataArray(input);
  const data = z.array(SubscriptionPlanSchema).parse(arr);
  return { data };
}

export function adaptRawVendorSubscription(input: unknown): { data: z.infer<typeof VendorSubscriptionSchema> | null } {
  if (input === null || input === undefined) {
    return { data: null };
  }
  if (typeof input === 'object' && 'data' in input && (input as Record<string, unknown>).data === null) {
    return { data: null };
  }
  const obj = unwrapDataObject(input);
  const data = VendorSubscriptionSchema.parse(obj);
  return { data };
}

export function adaptRawVendorBillingSummary(input: unknown): { data: z.infer<typeof VendorBillingSummarySchema> } {
  const obj = unwrapDataObject(input);
  const data = VendorBillingSummarySchema.parse(obj);
  return { data };
}
