export type VendorBillingInvoiceStatus = 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID';

export type VendorBillingPaymentMethod =
  | 'CARD'
  | 'WALLET'
  | 'FAWRY_REFERENCE'
  | 'BANK_TRANSFER'
  | 'CASH';

export type VendorBillingPaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED';

export interface QuotaMetric {
  used: number;
  limit: number;
}

export interface FeaturedCreditQuota {
  balance: number;
  monthlyGrant: number;
}

export interface DealerEntitlementsSnapshot {
  listings: QuotaMetric;
  staff: QuotaMetric;
  branches: QuotaMetric;
  featuredCredits: FeaturedCreditQuota;
  features: {
    analyticsEnabled: boolean;
    verifiedBadge: boolean;
  };
}

export interface SubscriptionPlanFeatures {
  activeListingQuota?: number;
  featuredCreditsPerMonth?: number;
  staffLimit?: number;
  branchLimit?: number;
  analyticsEnabled?: boolean;
  verifiedBadge?: boolean;
  [key: string]: unknown;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  code: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  features: SubscriptionPlanFeatures;
  isActive: boolean;
}

export interface VendorSubscription {
  id: number;
  vendorId: number;
  planId: number;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  plan?: SubscriptionPlan | undefined;
}

export interface VendorBillingAccountSummary {
  currency: string;
  prepaidBalanceCents: number;
  autopayIntentEnabled: boolean;
  preferredPaymentMethod: VendorBillingPaymentMethod | null;
  restrictedAt: string | null;
  restrictionReason: string | null;
}

export interface VendorInvoiceItemSummary {
  publicId: string;
  invoiceNumber: string;
  status: VendorBillingInvoiceStatus;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string;
  graceEndsAt: string;
  totalAmountCents: number;
  balanceDueCents: number;
  currency: string;
}

export interface VendorInvoiceLineItem {
  publicId: string;
  sourceType: string;
  sourceId: string;
  amountCents: number;
  currency: string;
  occurredAt: string;
  description: Record<string, string> | null;
}

export interface VendorInvoiceDetail extends VendorInvoiceItemSummary {
  lines: VendorInvoiceLineItem[];
  paidCents: number;
  appliedCreditCents: number;
  paidAt: string | null;
}

export interface VendorBillingPaymentSummary {
  publicId: string;
  purpose: string;
  method: VendorBillingPaymentMethod;
  status: VendorBillingPaymentStatus;
  amountCents: number;
  currency: string;
  createdAt: string;
  rejectionReason: string | null;
}

export interface VendorBillingSummary {
  vendor: {
    publicId: string;
    displayName: Record<string, string> | string;
    defaultCurrency: string;
  };
  account: VendorBillingAccountSummary;
  currentInvoice: VendorInvoiceDetail | null;
  recentInvoices: VendorInvoiceItemSummary[];
  pendingPayments: VendorBillingPaymentSummary[];
  paymentCapabilities: {
    methods: VendorBillingPaymentMethod[];
    autopayTokenizationAvailable: boolean;
    manualProofPurpose: string;
  };
}

export interface VendorBillingTransactionItem {
  id: number;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  description: Record<string, string> | null;
  createdAt: string;
}
