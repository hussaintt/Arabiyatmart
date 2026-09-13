'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LocaleSchema } from '@/lib/api/schemas/common';
import { createOperationError } from '@/lib/api/error';
import { getAuthCookieName, getAuthCookieOptions } from '@/lib/auth/cookies';
import { signLocalePreference } from '@/lib/auth/locale-cookie';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { validateOrigin, validateSecFetchSite } from '@/lib/auth/csrf';
import type { ActionResult, Locale } from '@/types/common';

export async function setLocale(localeInput: unknown, currentPath = '/ar'): Promise<ActionResult<{ locale: Locale }>> {
  const parsed = LocaleSchema.safeParse(localeInput);
  if (!parsed.success) return { ok: false, error: createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Unsupported locale' }).error };
  try {
    const requestHeaders = await headers();
    if (!validateOrigin(requestHeaders).valid || !validateSecFetchSite(requestHeaders).valid) {
      return { ok: false, error: createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin' }).error };
    }
    const store = await cookies();
    store.set(getAuthCookieName('locale'), await signLocalePreference(parsed.data), getAuthCookieOptions('locale'));
    revalidatePath(sanitizeReturnTo(currentPath, parsed.data));
    return { ok: true, data: { locale: parsed.data } };
  } catch {
    return { ok: false, error: createOperationError({ status: 500, message: 'Locale could not be saved' }).error };
  }
}
