import 'server-only';

import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import {
  DealerEntitlementsResponseSchema,
  VendorBillingSummaryResponseSchema,
  VendorSubscriptionResponseSchema,
  SubscriptionPlansResponseSchema,
  adaptRawDealerEntitlements,
  adaptRawVendorBillingSummary,
  adaptRawVendorSubscription,
  adaptRawSubscriptionPlans,
} from '@/lib/api/schemas/billing';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type {
  DealerEntitlementsSnapshot,
  VendorBillingSummary,
  VendorSubscription,
  SubscriptionPlan,
} from '@/types/billing';

export async function getDealerEntitlements(
  vendorPublicId: string,
): Promise<DealerEntitlementsSnapshot | null> {
  try {
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'getVendorEntitlements',
      method: 'GET',
      endpoint: () => UPSTREAM_ENDPOINTS.vendorEntitlements(vendorPublicId),
      outputSchema: DealerEntitlementsResponseSchema,
      adapter: adaptRawDealerEntitlements,
      authMode: 'S',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike),
    });
    return response.data;
  } catch {
    return null;
  }
}

export async function getDealerBillingSummary(
  vendorPublicId: string,
): Promise<VendorBillingSummary | null> {
  try {
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'getVendorBillingSummary',
      method: 'GET',
      endpoint: () => UPSTREAM_ENDPOINTS.vendorBillingSummary(vendorPublicId),
      outputSchema: VendorBillingSummaryResponseSchema,
      adapter: adaptRawVendorBillingSummary,
      authMode: 'S',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike),
    });
    return response.data;
  } catch {
    return null;
  }
}

export async function getDealerSubscription(
  vendorPublicId: string,
): Promise<VendorSubscription | null> {
  try {
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'getVendorSubscription',
      method: 'GET',
      endpoint: () => UPSTREAM_ENDPOINTS.vendorSubscription(vendorPublicId),
      outputSchema: VendorSubscriptionResponseSchema,
      adapter: adaptRawVendorSubscription,
      authMode: 'S',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike),
    });
    return response.data;
  } catch {
    return null;
  }
}

import { promotionPackagesPolicy } from '@/lib/cache/policy';

export async function getAvailableSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const response = await serverApiRequest({
      operation: 'listSubscriptionPlans',
      method: 'GET',
      endpoint: UPSTREAM_ENDPOINTS.subscriptionPlans,
      outputSchema: SubscriptionPlansResponseSchema,
      adapter: adaptRawSubscriptionPlans,
      authMode: 'P',
      cachePolicy: promotionPackagesPolicy(),
    });
    return response.data;
  } catch {
    return [];
  }
}
