import type { CursorMeta, JsonValue } from './common';
import type { PromotionTier } from './listing';

export type LeadChannel =
  | 'CALL_REVEAL'
  | 'WHATSAPP'
  | 'CHAT'
  | 'CALLBACK_FORM'
  | 'FINANCE_REQUEST'
  | 'INSURANCE_REQUEST'
  | 'TEST_DRIVE'
  | 'INSPECTION';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'WON'
  | 'LOST'
  | 'SPAM';

export type ReportCategory =
  | 'FRAUD'
  | 'WRONG_INFO'
  | 'SOLD_ALREADY'
  | 'DUPLICATE'
  | 'OFFENSIVE'
  | 'OTHER';

export interface LeadParty {
  publicId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export interface LeadListing {
  publicId: string;
  slug: string;
  title: string;
}

export interface Lead {
  publicId: string;
  channel: LeadChannel;
  status: LeadStatus;
  buyerName: string | null;
  buyerPhone: string | null;
  note: string | null;
  eventsCount: number;
  lastActivityAt: string | null;
  createdAt: string | null;
  listing: LeadListing;
  buyer: LeadParty | null;
  seller: LeadParty | null;
}

export interface LeadEvent {
  type: string;
  meta: JsonValue | null;
  createdAt: string | null;
}

export interface LeadDetail extends Lead {
  events: LeadEvent[];
}

export interface LeadResponse {
  data: Lead;
}

export interface LeadDetailResponse {
  data: LeadDetail;
}

export interface LeadListResponse {
  data: Lead[];
  meta: CursorMeta;
}

export interface CreateLeadInput {
  listingPublicId: string;
  channel: LeadChannel;
  buyerPhone: string | null;
  buyerName: string | null;
  note: string | null;
  meta: JsonValue | null;
}

export interface UpdateLeadStatusInput {
  status: Exclude<LeadStatus, 'NEW'>;
  note: string | null;
}

export interface LeadListParams {
  status?: LeadStatus | undefined;
  channel?: LeadChannel | undefined;
  cursor?: string | undefined;
  limit?: (20 | 40 | 80) | undefined;
}

export interface LeadPublicIdParams {
  publicId: string;
}

// ── Reports ─────────────────────────────────────────────────────────────────

export interface ListingReport {
  publicId: string;
  category: ReportCategory;
  details: string | null;
  status: string;
  createdAt: string | null;
  listing: LeadListing;
}

export interface ListingReportResponse {
  data: ListingReport;
}

export interface CreateReportInput {
  listingPublicId: string;
  category: ReportCategory;
  details: string | null;
}

// ── Promotions ──────────────────────────────────────────────────────────────

export interface PromotionPerks {
  highlightedCard: boolean;
  homepageSlot: boolean;
  performanceStats: boolean;
  autoRenewEveryDays: number | null;
}

export interface PromotionListing {
  publicId: string;
  slug: string | null;
  year: number | null;
}

export interface ListingPromotion {
  publicId: string;
  tier: PromotionTier | null;
  type: string;
  status: string;
  durationDays: number;
  priceCents: number;
  currency: string;
  startsAt: string | null;
  endsAt: string | null;
  lastBumpedAt: string | null;
  createdAt: string;
  perks: PromotionPerks | null;
  listing: PromotionListing | null;
}

export interface PromotionPackage extends PromotionPerks {
  tier: PromotionTier;
  durationDays: number;
  priceCents: number;
  currency: string;
  placements: string[];
}

export interface PromotionResponse {
  data: ListingPromotion;
}

export interface PromotionListResponse {
  data: ListingPromotion[];
}

export interface PromotionPackageListResponse {
  data: PromotionPackage[];
}

export interface PurchasePromotionInput {
  listingPublicId: string;
  tier: PromotionTier;
}
