import 'server-only';

import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import { DashboardOverviewResponseSchema, DashboardRangeSchema, adaptRawDashboardOverview, dashboardRangeToDays } from '@/lib/api/schemas/dashboard';
import { getActiveVendorState } from '@/server/queries/vendors';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { DashboardOverview, DashboardRange } from '@/types/dashboard';
import type { VendorMembershipWithVendor } from '@/types/dealer';

const roleLevel = { VIEWER: 0, STAFF: 1, MANAGER: 2, OWNER: 3 } as const;

export interface SellerDashboardState {
  memberships: VendorMembershipWithVendor[];
  activeVendorPublicId: string | null;
  overview: DashboardOverview | null;
}

export async function getSellerDashboard(rangeInput: DashboardRange | unknown): Promise<SellerDashboardState> {
  const range = DashboardRangeSchema.parse(rangeInput);
  const state = await getActiveVendorState();
  const memberships = state.memberships.filter((item) => item.vendor.status === 'APPROVED' && roleLevel[item.membership.role] >= roleLevel.MANAGER);
  const selected = memberships.find((item) => item.vendor.publicId === state.activeVendorPublicId)
    ?? (memberships.length === 1 ? memberships[0] : undefined);
  if (!selected) return { memberships, activeVendorPublicId: null, overview: null };
  const store = await cookies();

  const response = await serverApiRequest({
    operation: 'getDashboardOverview',
    method: 'GET',
    endpoint: () => UPSTREAM_ENDPOINTS.dashboardOverview(selected.vendor.publicId),
    query: { days: dashboardRangeToDays(range) },
    outputSchema: DashboardOverviewResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike),
    adapter: adaptRawDashboardOverview,
  });
  return { memberships, activeVendorPublicId: selected.vendor.publicId, overview: response.data };
}
