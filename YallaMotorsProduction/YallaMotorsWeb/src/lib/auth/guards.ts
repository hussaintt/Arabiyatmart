import 'server-only';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import { MyVendorsResponseSchema, adaptRawMyVendors } from '@/lib/api/schemas/dealer';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { getSession } from '@/server/queries/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { AppLocale } from '@/i18n/config';
import type { SafeSession } from '@/types/auth';
import type { VendorMembershipWithVendor, VendorRole } from '@/types/dealer';

function safeTarget(returnTo: string, locale: AppLocale): string {
  return sanitizeReturnTo(returnTo, locale);
}

export async function optionalSession(): Promise<SafeSession | null> {
  return (await getSession()).data;
}

export async function requireSession(returnTo: string, locale: AppLocale = 'ar'): Promise<SafeSession> {
  const session = await optionalSession();
  if (!session) redirect(`/${locale}/login?returnTo=${encodeURIComponent(safeTarget(returnTo, locale))}`);
  return session;
}

export async function requireGuest(returnTo: string | null, locale: AppLocale = 'ar', reauth = false): Promise<void> {
  if (reauth) return;
  const session = await optionalSession();
  if (session) redirect(returnTo ? safeTarget(returnTo, locale) : `/${locale}`);
}

export async function requireVerifiedEmail(returnTo: string, locale: AppLocale = 'ar'): Promise<SafeSession> {
  const session = await requireSession(returnTo, locale);
  if (!session.user.emailVerifiedAt) redirect(`/${locale}/verify-email?returnTo=${encodeURIComponent(safeTarget(returnTo, locale))}`);
  return session;
}

export async function requireVerifiedPhone(returnTo: string, locale: AppLocale = 'ar'): Promise<SafeSession> {
  const session = await requireSession(returnTo, locale);
  if (!session.user.phoneVerifiedAt) {
    redirect(`/${locale}/profile?panel=verify-phone&returnTo=${encodeURIComponent(safeTarget(returnTo, locale))}`);
  }
  return session;
}

const ROLE_LEVEL: Record<VendorRole, number> = { VIEWER: 0, STAFF: 1, MANAGER: 2, OWNER: 3 };

export function hasVendorRole(
  memberships: readonly VendorMembershipWithVendor[],
  minimumRole: VendorRole,
  vendorPublicId?: string
): boolean {
  return memberships.some(({ membership, vendor }) =>
    vendor.status === 'APPROVED' &&
    (!vendorPublicId || vendor.publicId === vendorPublicId) &&
    ROLE_LEVEL[membership.role] >= ROLE_LEVEL[minimumRole]
  );
}

export async function getAuthoritativeVendorMemberships(): Promise<VendorMembershipWithVendor[]> {
  const store = await cookies();
  const response = await serverApiRequest({
    operation: 'getMyVendors', method: 'GET', endpoint: UPSTREAM_ENDPOINTS.myVendors,
    outputSchema: MyVendorsResponseSchema, authMode: 'S', cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike), adapter: adaptRawMyVendors,
  });
  return response.data;
}

export async function requireVendorRole(
  minimumRole: VendorRole,
  returnTo: string,
  locale: AppLocale = 'ar'
): Promise<{ session: SafeSession; memberships: VendorMembershipWithVendor[] }> {
  const session = await requireSession(returnTo, locale);
  const memberships = await getAuthoritativeVendorMemberships();
  if (!hasVendorRole(memberships, minimumRole)) {
    redirect(`/${locale}/forbidden`);
  }
  return { session, memberships };
}

export function requireOwnership<T>(resource: T | null | undefined, owns: (value: T) => boolean, locale: AppLocale = 'ar'): T {
  if (!resource || !owns(resource)) redirect(`/${locale}/forbidden`);
  return resource;
}

export function requireScopedVendor(memberships: VendorMembershipWithVendor[], vendorPublicId: string, locale: AppLocale = 'ar'): VendorMembershipWithVendor {
  const membership = memberships.find((item) => item.vendor.publicId === vendorPublicId && item.vendor.status === 'APPROVED');
  if (!membership) redirect(`/${locale}/forbidden`);
  return membership;
}
