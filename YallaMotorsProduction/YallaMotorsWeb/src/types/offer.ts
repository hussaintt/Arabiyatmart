export type OfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTERED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export type SellerScopeKind = 'PRIVATE' | 'VENDOR';

export type SellerScope =
  | { kind: 'PRIVATE' }
  | { kind: 'VENDOR'; vendorPublicId: string };

export interface OfferListing {
  publicId: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  priceCents: number;
}

export interface OfferBuyer {
  publicId: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Offer {
  publicId: string;
  offerCents: number;
  counterCents: number | null;
  currency: string;
  status: OfferStatus;
  message: string | null;
  sellerNote: string | null;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  listing: OfferListing;
  buyer: OfferBuyer;
}

export interface OfferResponse {
  data: Offer;
}

export interface OfferListResponse {
  data: Offer[];
  total: number | null;
  page: number;
  limit: number;
}

export interface CreateOfferInput {
  offerCents: number;
  message: string | null;
}

export interface RespondOfferInput {
  action: 'accept' | 'reject' | 'counter';
  counterCents?: number | undefined;
  sellerNote: string | null;
}

export interface OfferListParams {
  status?: OfferStatus | undefined;
  page?: number | undefined;
  limit?: (10 | 20 | 40) | undefined;
}

export interface OfferPublicIdParams {
  publicId: string;
}

export interface CreateOfferParams {
  listingSlug: string;
}
