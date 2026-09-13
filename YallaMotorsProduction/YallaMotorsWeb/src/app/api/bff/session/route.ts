import { NextResponse } from 'next/server';
import { getCredentialsFromCookies, getCsrfTokenFromCookies, clearAuthCookies, clearCsrfCookie } from '@/lib/auth/cookies';
import { rotateCsrfToken } from '@/lib/auth/csrf';
import { ApiContractError } from '@/lib/api/error';
import { getSafeSessionForAccessToken, refreshSessionCredentials, toSessionOperationError } from '@/server/queries/session';

export const dynamic = 'force-dynamic';

/** Token-free browser session projection. Anonymous visitors receive a cache-safe 200. */
export async function GET(request: Request): Promise<Response> {
  const credentials = getCredentialsFromCookies(request.headers);
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  if (!getCsrfTokenFromCookies(request.headers)) rotateCsrfToken(headers);
  if (!credentials.accessToken) return NextResponse.json({ data: null }, { status: 200, headers });

  try {
    const session = await getSafeSessionForAccessToken(credentials.accessToken);
    return NextResponse.json({ data: session }, { status: 200, headers });
  } catch (error) {
    if (error instanceof ApiContractError && error.body.error.status === 401 && credentials.refreshToken) {
      try {
        const rotated = await refreshSessionCredentials(credentials.refreshToken, headers);
        const session = await getSafeSessionForAccessToken(rotated.accessToken);
        return NextResponse.json({ data: session }, { status: 200, headers });
      } catch (refreshError) {
        if (refreshError instanceof ApiContractError && refreshError.body.error.status === 401) {
          clearAuthCookies(headers);
          clearCsrfCookie(headers);
          return NextResponse.json({ data: null }, { status: 200, headers });
        }
        const body = toSessionOperationError(refreshError);
        return NextResponse.json(body, { status: body.error.status, headers });
      }
    }
    if (error instanceof ApiContractError && error.body.error.status === 401) {
      clearAuthCookies(headers);
      clearCsrfCookie(headers);
      return NextResponse.json({ data: null }, { status: 200, headers });
    }
    const body = toSessionOperationError(error);
    return NextResponse.json(body, { status: body.error.status, headers });
  }
}
