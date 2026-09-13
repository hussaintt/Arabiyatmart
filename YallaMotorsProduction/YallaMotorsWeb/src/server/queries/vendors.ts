import 'server-only';

import { cookies } from 'next/headers';
import { getAuthoritativeVendorMemberships } from '@/lib/auth/guards';
import { getVendorFromCookies, type CookieStoreLike } from '@/lib/auth/cookies';
import type { ActiveVendorState } from '@/types/dealer';

export async function getActiveVendorState(): Promise<ActiveVendorState> {
  const memberships = await getAuthoritativeVendorMemberships();
  const store = await cookies();
  const selected = getVendorFromCookies(store as unknown as CookieStoreLike);
  const activeVendorPublicId = selected && memberships.some((item) => item.vendor.publicId === selected && item.vendor.status === 'APPROVED')
    ? selected
    : null;
  return { memberships, activeVendorPublicId, resolutionError: null };
}
