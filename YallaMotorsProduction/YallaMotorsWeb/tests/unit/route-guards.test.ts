import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ redirect: vi.fn((target: string) => { throw new Error(`REDIRECT:${target}`); }) }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import { hasVendorRole, requireOwnership, requireScopedVendor } from '@/lib/auth/guards';
import { signLocalePreference, verifyLocalePreference } from '@/lib/auth/locale-cookie';
import { classifyRoute, isProtectedAccess, localizedPath, stripLocale } from '@/lib/auth/route-policy';
import { middleware } from '@/middleware';
import type { VendorMembershipWithVendor } from '@/types/dealer';

import { SignJWT } from 'jose';
import { DEVELOPMENT_JWT_ACCESS_SECRET } from '@/lib/auth/edge-jwt';

const jwtSecret = new TextEncoder().encode(DEVELOPMENT_JWT_ACCESS_SECRET);

function request(path: string, headers: { cookie?: string; 'accept-language'?: string } | string = {}): NextRequest {
  const reqHeaders = new Headers();
  if (typeof headers === 'string') {
    reqHeaders.set('cookie', headers);
  } else {
    if (headers.cookie) reqHeaders.set('cookie', headers.cookie);
    if (headers['accept-language']) reqHeaders.set('accept-language', headers['accept-language']);
  }
  return new NextRequest(`http://localhost:3000${path}`, { headers: reqHeaders });
}

async function validTestJwt(expiresInSeconds = 300): Promise<string> {
  return new SignJWT({
    sub: '42',
    roles: ['CUSTOMER'],
    emailVerified: true,
    phoneVerified: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .setIssuer('arabiyatmart-api')
    .setAudience('arabiyatmart-web')
    .sign(jwtSecret);
}

function membership(role: 'VIEWER' | 'STAFF' | 'MANAGER' | 'OWNER', status: 'APPROVED' | 'PENDING' = 'APPROVED', id = 'vnd_public'): VendorMembershipWithVendor {
  return { vendor: { publicId: id, status }, membership: { vendorPublicId: id, role } } as VendorMembershipWithVendor;
}

describe('route policy, middleware, and authoritative guard contracts', () => {
  it.each([
    ['/ar', 'public'], ['/en/search', 'public'], ['/ar/listing/car-one', 'public'],
    ['/ar/login', 'guest'], ['/ar/register', 'guest'], ['/en/forgot-password', 'public'],
    ['/ar/profile', 'authenticated'], ['/ar/profile/edit', 'authenticated'],
    ['/ar/verify-email', 'authenticated'], ['/ar/me/leads/item-one', 'authenticated'],
    ['/ar/me/offers/item-one', 'not-found'],
    ['/en/sell', 'verified-phone'], ['/ar/me/dashboard', 'vendor-manager'],
    ['/ar/seller/team', 'not-found'], ['/ar/admin', 'not-found'],
  ])('classifies %s as %s', (path, expected) => expect(classifyRoute(path)).toBe(expected));

  it('marks only session/verification/vendor route families as protected', () => {
    expect(isProtectedAccess(classifyRoute('/ar/favorites'))).toBe(true);
    expect(isProtectedAccess(classifyRoute('/ar/sell'))).toBe(true);
    expect(isProtectedAccess(classifyRoute('/ar/me/dashboard'))).toBe(true);
    expect(isProtectedAccess(classifyRoute('/ar/listing/car-one'))).toBe(false);
  });

  it('normalizes locale paths without duplicate slashes or locale loss', () => {
    expect(stripLocale('/ar/sell')).toEqual({ locale: 'ar', path: '/sell' });
    expect(localizedPath('en', '/search')).toBe('/en/search');
    expect(localizedPath('ar', '/')).toBe('/ar');
  });

  it('signs locale preferences and rejects tampering or unsupported values', async () => {
    const signed = await signLocalePreference('en', 'test-secret-with-at-least-32-characters');
    expect(await verifyLocalePreference(signed, 'test-secret-with-at-least-32-characters')).toBe('en');
    expect(await verifyLocalePreference(signed.replace('.en.', '.ar.'), 'test-secret-with-at-least-32-characters')).toBeNull();
    expect(await verifyLocalePreference('v1.fr.invalid', 'test-secret-with-at-least-32-characters')).toBeNull();
  });

  it('uses only a valid signed preference for locale-less canonical redirects with 307 and Vary', async () => {
    const signed = await signLocalePreference('en');
    const response = await middleware(request('/search?q=toyota', `am_locale=${signed}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(response.headers.get('location')).toBe('http://localhost:3000/en/search?q=toyota');
    const tampered = await middleware(request('/search', 'am_locale=v1.en.invalid'));
    expect(tampered.status).toBe(307);
    expect(tampered.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(tampered.headers.get('location')).toBe('http://localhost:3000/ar/search');
  });

  it('negotiates locale from Accept-Language when no cookie is set', async () => {
    const responseEn = await middleware(request('/search', { 'accept-language': 'en-US,en;q=0.9,ar;q=0.8' }));
    expect(responseEn.status).toBe(307);
    expect(responseEn.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(responseEn.headers.get('location')).toBe('http://localhost:3000/en/search');

    const responseAr = await middleware(request('/search', { 'accept-language': 'ar-EG,ar;q=0.9' }));
    expect(responseAr.status).toBe(307);
    expect(responseAr.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(responseAr.headers.get('location')).toBe('http://localhost:3000/ar/search');
  });

  it('preserves permanent 308 redirects for locale-invariant legacy paths', async () => {
    const responseLegacyExplore = await middleware(request('/explore'));
    expect(responseLegacyExplore.status).toBe(308);
    expect(responseLegacyExplore.headers.get('location')).toBe('http://localhost:3000/search');

    const responseLegacyHome = await middleware(request('/home'));
    expect(responseLegacyHome.status).toBe(308);
    expect(responseLegacyHome.headers.get('location')).toBe('http://localhost:3000/');

    const responseLocalizedLegacy = await middleware(request('/en/explore'));
    expect(responseLocalizedLegacy.status).toBe(308);
    expect(responseLocalizedLegacy.headers.get('location')).toBe('http://localhost:3000/en/search');
  });

  it('redirects anonymous protected requests to localized login with a safe deep link', async () => {
    const response = await middleware(request('/en/profile/edit?panel=avatar'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/en/login');
    expect(location.searchParams.get('returnTo')).toBe('/en/profile/edit?panel=avatar');
  });

  it('sends refresh-only and expired-access sessions through one navigation refresh', async () => {
    const refreshOnly = await middleware(request('/ar/favorites', 'am_rt=refresh-cookie'));
    expect(new URL(refreshOnly.headers.get('location')!).pathname).toBe('/api/bff/auth/refresh');
    const expiredToken = await validTestJwt(-60);
    const expired = await middleware(request('/en/profile', `am_at=${expiredToken}; am_rt=refresh-cookie`));
    expect(new URL(expired.headers.get('location')!).searchParams.get('returnTo')).toBe('/en/profile');
  });

  it('rejects forged/tampered access tokens and redirects to login when no refresh token', async () => {
    const valid = await validTestJwt();
    const forged = `${valid.slice(0, -5)}abcde`;
    const response = await middleware(request('/en/profile', `am_at=${forged}`));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/en/login');
  });

  it('rejects tokens with wrong issuer or wrong audience in middleware', async () => {
    const wrongIssuer = await new SignJWT({ sub: '1', roles: ['CUSTOMER'], emailVerified: true, phoneVerified: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .setIssuer('evil-issuer')
      .setAudience('arabiyatmart-web')
      .sign(jwtSecret);

    const response = await middleware(request('/ar/profile', `am_at=${wrongIssuer}`));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/ar/login');
  });

  it('allows a locally unexpired, validly signed access cookie through without external I/O', async () => {
    const valid = await validTestJwt();
    const response = await middleware(request('/ar/profile', `am_at=${valid}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('applies the vendor role hierarchy only to approved authoritative memberships', () => {
    const memberships = [membership('STAFF'), membership('OWNER', 'PENDING', 'vnd_pending')];
    expect(hasVendorRole(memberships, 'STAFF')).toBe(true);
    expect(hasVendorRole(memberships, 'MANAGER')).toBe(false);
    expect(hasVendorRole(memberships, 'OWNER', 'vnd_pending')).toBe(false);
  });

  it('preserves locale in ownership and vendor-scope denial redirects', () => {
    expect(() => requireOwnership(null, () => false, 'en')).toThrow('REDIRECT:/en/forbidden');
    expect(() => requireScopedVendor([membership('STAFF')], 'vnd_other', 'en')).toThrow('REDIRECT:/en/forbidden');
  });
});
