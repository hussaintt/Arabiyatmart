import { NextResponse } from 'next/server';
import { clearAuthCookies, clearCsrfCookie, getCredentialsFromCookies } from '@/lib/auth/cookies';
import { validateMutationCsrf } from '@/lib/auth/csrf';
import { AuthRefreshError } from '@/lib/auth/refresh';
import { getSafeSessionForAccessToken, refreshSessionCredentials, toSessionOperationError } from '@/server/queries/session';
import { createOperationError } from '@/lib/api/error';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { validateSecFetchSite } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

/** Explicit same-origin refresh endpoint; it consumes the HttpOnly refresh cookie and never returns credentials. */
export async function POST(request: Request): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  const csrf = validateMutationCsrf({ method: 'POST', headers: request.headers, cookies: request.headers });
  if (!csrf.valid) {
    const body = createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid refresh request origin or CSRF token' });
    return NextResponse.json(body, { status: 403, headers });
  }

  const { refreshToken } = getCredentialsFromCookies(request.headers);
  if (!refreshToken) {
    const body = createOperationError({ status: 401, code: 'UNAUTHORIZED', message: 'No refresh session is available' });
    return NextResponse.json(body, { status: 401, headers });
  }

  try {
    const credentials = await refreshSessionCredentials(refreshToken, headers);
    const session = await getSafeSessionForAccessToken(credentials.accessToken);
    return NextResponse.json({ data: session }, { status: 200, headers });
  } catch (error) {
    if (error instanceof AuthRefreshError && error.isTerminal) {
      clearAuthCookies(headers);
      clearCsrfCookie(headers);
    }
    const body = toSessionOperationError(error);
    return NextResponse.json(body, { status: body.error.status, headers });
  }
}

/** Navigation refresh used by middleware when only a refresh cookie remains. */
export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const rawReturnTo = requestUrl.searchParams.get('returnTo');
  const locale = rawReturnTo?.startsWith('/en') ? 'en' : 'ar';
  const returnTo = sanitizeReturnTo(rawReturnTo, locale);
  const responseHeaders = new Headers({ 'Cache-Control': 'private, no-store' });
  if (!validateSecFetchSite(request.headers).valid) {
    return NextResponse.json(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid refresh navigation' }), { status: 403, headers: responseHeaders });
  }
  const { refreshToken } = getCredentialsFromCookies(request.headers);
  if (!refreshToken) {
    return NextResponse.redirect(new URL(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`, request.url), 303);
  }
  try {
    await refreshSessionCredentials(refreshToken, responseHeaders);
    return NextResponse.redirect(new URL(returnTo, request.url), { status: 303, headers: responseHeaders });
  } catch (error) {
    if (error instanceof AuthRefreshError && error.isTerminal) {
      clearAuthCookies(responseHeaders);
      clearCsrfCookie(responseHeaders);
    }
    return NextResponse.redirect(new URL(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`, request.url), { status: 303, headers: responseHeaders });
  }
}
