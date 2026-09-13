import 'server-only';

import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import {
  LeadDetailResponseSchema,
  LeadListParamsSchema,
  LeadListResponseSchema,
  LeadPublicIdParamsSchema,
  adaptRawLeadDetail,
  adaptRawLeadList,
} from '@/lib/api/schemas/lead';
import { getCredentialsFromCookies, getVendorFromCookies, type CookieStoreLike } from '@/lib/auth/cookies';
import { getAuthoritativeVendorMemberships, hasVendorRole } from '@/lib/auth/guards';
import type { LeadDetailResponse, LeadListParams, LeadListResponse } from '@/types/lead';

export interface LeadScope {
  accessToken: string;
  vendorPublicId: string | null;
}

export async function resolveLeadScope(): Promise<LeadScope> {
  const store = await cookies();
  const cookieStore = store as unknown as CookieStoreLike;
  const { accessToken } = getCredentialsFromCookies(cookieStore);
  if (!accessToken) {
    throw new ApiContractError(createOperationError({ status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }));
  }

  const vendorPublicId = getVendorFromCookies(cookieStore);
  if (vendorPublicId) {
    const memberships = await getAuthoritativeVendorMemberships();
    if (!hasVendorRole(memberships, 'STAFF', vendorPublicId)) {
      throw new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'The selected vendor is unavailable' }));
    }
  }

  return { accessToken, vendorPublicId };
}

export async function listSellerLeads(params: LeadListParams = {}): Promise<LeadListResponse> {
  const input = LeadListParamsSchema.parse(params);
  const scope = await resolveLeadScope();
  return serverApiRequest({
    operation: 'listSellerLeads',
    method: 'GET',
    endpoint: () => scope.vendorPublicId ? UPSTREAM_ENDPOINTS.leadsVendor(scope.vendorPublicId) : UPSTREAM_ENDPOINTS.leadsPrivate(),
    query: input as Readonly<Record<string, string | number | boolean | undefined>>,
    outputSchema: LeadListResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: () => scope.accessToken,
    adapter: adaptRawLeadList,
  });
}

export async function getSellerLead(publicId: string): Promise<LeadDetailResponse> {
  const params = LeadPublicIdParamsSchema.parse({ publicId });
  const scope = await resolveLeadScope();
  return serverApiRequest({
    operation: 'getSellerLead',
    method: 'GET',
    endpoint: () => scope.vendorPublicId
      ? UPSTREAM_ENDPOINTS.leadVendor(scope.vendorPublicId, params.publicId)
      : UPSTREAM_ENDPOINTS.leadPrivate(params.publicId),
    outputSchema: LeadDetailResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: () => scope.accessToken,
    adapter: adaptRawLeadDetail,
  });
}
