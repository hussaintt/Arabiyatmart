import { NextRequest, NextResponse } from 'next/server';
import { type AppLocale } from '@/i18n/config';
import { classifyRoute, isProtectedAccess, LEGACY_REDIRECTS, localizedPath, stripLocale } from '@/lib/auth/route-policy';
import { buildSecurityHeaders } from '@/lib/security/headers';
import { verifyAccessTokenEdge } from '@/lib/auth/edge-jwt';
import { resolveNegotiatedLocale } from '@/lib/auth/locale-negotiation';

function cookieValue(request: NextRequest, names: readonly string[]): string | null {
  for (const name of names) {
    const value = request.cookies.get(name)?.value;
    if (value) return value;
  }
  return null;
}

function applyHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(
    buildSecurityHeaders({
      backendOrigin: process.env.BACKEND_API_ORIGIN,
      mediaCdnOrigin: process.env.MEDIA_CDN_ORIGIN,
      siteOrigin: process.env.SITE_ORIGIN,
      reportOnly: process.env.CSP_REPORT_ONLY === 'true',
    })
  )) {
    response.headers.set(key, value);
  }
  if (!response.headers.has('x-request-id')) response.headers.set('x-request-id', crypto.randomUUID());
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.clone();

  // 1. Locale-invariant legacy redirects (e.g. /explore -> /search, /home -> /)
  const legacyDirect = LEGACY_REDIRECTS[url.pathname];
  if (legacyDirect) {
    url.pathname = legacyDirect;
    return applyHeaders(NextResponse.redirect(url, 308));
  }

  const resolved = stripLocale(url.pathname);

  // If path already has locale and is a legacy alias under that locale (e.g. /en/explore -> /en/search)
  const legacyPath = LEGACY_REDIRECTS[resolved.path];
  if (resolved.locale && legacyPath) {
    url.pathname = localizedPath(resolved.locale, legacyPath);
    return applyHeaders(NextResponse.redirect(url, 308));
  }

  // 2. Unlocalized path handling (deliberate cache-safe negotiation)
  if (!resolved.locale) {
    // If request path is a 2-letter segment (e.g. /fr/about), let Next.js routing catch it (404 in layout)
    if (/^\/[a-zA-Z]{2}(?:\/|$)/.test(url.pathname)) {
      return applyHeaders(NextResponse.next());
    }

    // Negotiate locale: verified cookie -> Accept-Language -> default 'ar'
    const targetLocale: AppLocale = await resolveNegotiatedLocale({
      cookie: request.cookies.get('am_locale')?.value,
      acceptLanguage: request.headers.get('accept-language'),
    });

    url.pathname = localizedPath(targetLocale, url.pathname);

    // Context-dependent redirect MUST be 307 with Vary: Accept-Language, Cookie
    const response = applyHeaders(NextResponse.redirect(url, 307));
    response.headers.set('Vary', 'Accept-Language, Cookie');
    return response;
  }

  // 3. Route protection & JWT verification (Task 2.1)
  const access = classifyRoute(url.pathname);
  const accessToken = cookieValue(request, ['__Host-am_at', 'am_at']);
  const refreshToken = cookieValue(request, ['__Host-am_rt', 'am_rt']);

  if (isProtectedAccess(access)) {
    const jwtResult = await verifyAccessTokenEdge(accessToken);
    if (!jwtResult.valid) {
      const returnTo = `${url.pathname}${url.search}`;

      // If refresh token exists, preserve session refresh flow
      if (refreshToken) {
        url.pathname = '/api/bff/auth/refresh';
        url.search = '';
        url.searchParams.set('returnTo', returnTo);
        return applyHeaders(NextResponse.redirect(url, 307));
      }

      // No refresh token: redirect to localized login
      url.pathname = `/${resolved.locale}/login`;
      url.search = '';
      url.searchParams.set('returnTo', returnTo);
      return applyHeaders(NextResponse.redirect(url, 307));
    }
  }

  return applyHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|fonts|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.[a-zA-Z0-9]+$).*)'],
};

