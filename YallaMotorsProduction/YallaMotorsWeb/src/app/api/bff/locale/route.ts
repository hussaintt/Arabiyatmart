import { NextResponse } from 'next/server';
import { LocaleSchema } from '@/lib/api/schemas/common';
import { createOperationError } from '@/lib/api/error';
import { validateMutationCsrf } from '@/lib/auth/csrf';
import { getAuthCookieName, getAuthCookieOptions } from '@/lib/auth/cookies';
import { signLocalePreference } from '@/lib/auth/locale-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  const csrf = validateMutationCsrf({ method: 'POST', headers: request.headers, cookies: request.headers });
  if (!csrf.valid) return NextResponse.json(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token' }), { status: 403, headers });
  let locale;
  try {
    locale = LocaleSchema.parse((await request.json() as { locale?: unknown }).locale);
  } catch {
    return NextResponse.json(createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Unsupported locale' }), { status: 400, headers });
  }
  try {
    const response = NextResponse.json({ data: { locale } }, { status: 200, headers });
    response.cookies.set(getAuthCookieName('locale'), await signLocalePreference(locale), getAuthCookieOptions('locale'));
    return response;
  } catch {
    return NextResponse.json(createOperationError({ status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Locale preference could not be saved' }), { status: 500, headers });
  }
}
