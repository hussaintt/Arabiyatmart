'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { PublicIdSchema } from '@/lib/api/schemas/common';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { validateOrigin, validateSecFetchSite } from '@/lib/auth/csrf';
import { getAuthoritativeVendorMemberships, hasVendorRole } from '@/lib/auth/guards';
import { clearVendorCookie, setVendorCookie, type CookieStoreLike } from '@/lib/auth/cookies';
import type { ActionResult } from '@/types/common';

interface VendorSelection { vendorPublicId: string | null }

export async function setActiveVendor(input: VendorSelection | unknown): Promise<ActionResult<VendorSelection>> {
  try {
    const requestHeaders = await headers();
    if (!validateOrigin(requestHeaders).valid || !validateSecFetchSite(requestHeaders).valid) {
      throw new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin' }));
    }
    const candidate = typeof input === 'object' && input !== null && 'vendorPublicId' in input
      ? (input as { vendorPublicId?: unknown }).vendorPublicId
      : undefined;
    const store = await cookies();
    if (candidate === null) {
      clearVendorCookie(store as unknown as CookieStoreLike);
      revalidatePath('/[locale]/(account)/me', 'layout');
      return { ok: true, data: { vendorPublicId: null } };
    }
    const vendorPublicId = PublicIdSchema.parse(candidate);
    const memberships = await getAuthoritativeVendorMemberships();
    if (!hasVendorRole(memberships, 'VIEWER', vendorPublicId)) {
      throw new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'The selected vendor is unavailable' }));
    }
    setVendorCookie(store as unknown as CookieStoreLike, vendorPublicId);
    revalidatePath('/[locale]/(account)/me', 'layout');
    return { ok: true, data: { vendorPublicId } };
  } catch (error) {
    if (error instanceof ApiContractError) return { ok: false, error: error.body.error };
    return { ok: false, error: createOperationError({ status: 400, code: 'VALIDATION_ERROR', message: 'The vendor could not be selected' }).error };
  }
}
