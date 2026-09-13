import { describe, it, expect, vi } from 'vitest';

// Mock server-only so Node/Vitest test runner can import server-only modules
vi.mock('server-only', () => ({}));

import {
  AUTH_COOKIE_NAMES,
  COOKIE_MAX_AGE_SECONDS,
  getAuthCookieName,
  getAuthCookieOptions,
  getClearCookieOptions,
  serializeCookieHeader,
  parseCookieHeader,
  getCredentialsFromCookies,
  getCsrfTokenFromCookies,
  getVendorFromCookies,
  setAuthCookies,
  clearAuthCookies,
  setCsrfCookie,
  clearCsrfCookie,
  setVendorCookie,
  clearVendorCookie,
  signVendorScope,
  verifyVendorScope,
  type CookieStoreLike,
} from '@/lib/auth/cookies';

import {
  verifyAccessToken,
  decodeAccessTokenUnverified,
  isTokenExpired,
  toAuthClaims,
  signAccessToken,
} from '@/lib/auth/jwt';

import {
  generateCsrfToken,
  compareCsrfTokens,
  isSafeHttpMethod,
  getCsrfTokenFromHeaders,
  validateOrigin,
  validateSecFetchSite,
  validateMutationCsrf,
  rotateCsrfToken,
} from '@/lib/auth/csrf';

import {
  isValidReturnTo,
  sanitizeReturnTo,
  extractReturnTo,
} from '@/lib/auth/return-to';

import {
  getSessionFromCookies,
  setSessionCredentials,
  clearSessionCredentials,
  createCookieCredentialResolver,
} from '@/lib/auth/session';

import {
  singleFlightRefresh,
  executeWithAuthRetry,
  AuthRefreshError,
  isUnauthorizedError,
} from '@/lib/auth/refresh';

import { SignJWT } from 'jose';

// In-memory mock cookie store implementing CookieStoreLike
class MockCookieStore implements CookieStoreLike {
  private store = new Map<string, { value: string; options?: unknown }>();

  get(name: string) {
    const item = this.store.get(name);
    return item ? { name, value: item.value } : undefined;
  }

  set(name: string, value: string, options?: unknown) {
    this.store.set(name, { value, options });
  }

  delete(name: string) {
    this.store.delete(name);
  }

  has(name: string) {
    return this.store.has(name);
  }

  entries() {
    return Array.from(this.store.entries());
  }
}

describe('TASK-014: Auth Primitives Suite', () => {
  // ── 1. Cookie Primitives ───────────────────────────────────────────────────

  describe('1. Cookie Primitives', () => {
    it('provides correct production cookie names with __Host- prefix and no Domain', () => {
      expect(getAuthCookieName('access', true)).toBe('__Host-am_at');
      expect(getAuthCookieName('refresh', true)).toBe('__Host-am_rt');
      expect(getAuthCookieName('csrf', true)).toBe('am_csrf');
      expect(getAuthCookieName('locale', true)).toBe('am_locale');
      expect(getAuthCookieName('vendor', true)).toBe('am_vendor');
    });

    it('provides correct development cookie names without prefix', () => {
      expect(getAuthCookieName('access', false)).toBe('am_at');
      expect(getAuthCookieName('refresh', false)).toBe('am_rt');
      expect(getAuthCookieName('csrf', false)).toBe('am_csrf');
      expect(getAuthCookieName('locale', false)).toBe('am_locale');
      expect(getAuthCookieName('vendor', false)).toBe('am_vendor');
    });

    it('enforces secure attributes on credentials: HttpOnly, Secure, SameSite=Lax, Path=/, no Domain', () => {
      const atOptions = getAuthCookieOptions('access', 900, true);
      expect(atOptions.httpOnly).toBe(true);
      expect(atOptions.secure).toBe(true);
      expect(atOptions.sameSite).toBe('lax');
      expect(atOptions.path).toBe('/');
      expect(atOptions.domain).toBeUndefined();
      expect(atOptions.maxAge).toBe(900);
      expect(atOptions.priority).toBe('high');

      const rtOptions = getAuthCookieOptions('refresh', undefined, true);
      expect(rtOptions.httpOnly).toBe(true);
      expect(rtOptions.secure).toBe(true);
      expect(rtOptions.sameSite).toBe('lax');
      expect(rtOptions.path).toBe('/');
      expect(rtOptions.domain).toBeUndefined();
      expect(rtOptions.maxAge).toBe(COOKIE_MAX_AGE_SECONDS.REFRESH_TOKEN);
      expect(rtOptions.priority).toBe('high');
    });

    it('allows JavaScript reading for double-submit am_csrf and am_locale', () => {
      const csrfOptions = getAuthCookieOptions('csrf', undefined, true);
      expect(csrfOptions.httpOnly).toBe(false);
      expect(csrfOptions.sameSite).toBe('lax');
      expect(csrfOptions.path).toBe('/');
      expect(csrfOptions.domain).toBeUndefined();

      const localeOptions = getAuthCookieOptions('locale', undefined, true);
      expect(localeOptions.httpOnly).toBe(false);
      expect(localeOptions.sameSite).toBe('lax');
      expect(localeOptions.path).toBe('/');
      expect(localeOptions.maxAge).toBe(COOKIE_MAX_AGE_SECONDS.LOCALE);
    });

    it('serializes Set-Cookie headers correctly without leaking secrets', () => {
      const header = serializeCookieHeader(
        '__Host-am_at',
        'safe_token_value',
        getAuthCookieOptions('access', 900, true)
      );

      expect(header).toContain('__Host-am_at=safe_token_value');
      expect(header).toContain('Path=/');
      expect(header).toContain('HttpOnly');
      expect(header).toContain('Secure');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Max-Age=900');
      expect(header).not.toContain('Domain=');
    });

    it('clears cookies with maxAge: 0 and expires in the past', () => {
      const clearOptions = getClearCookieOptions('access', true);
      expect(clearOptions.maxAge).toBe(0);
      expect(clearOptions.expires?.getTime()).toBe(0);
    });

    it('parses Cookie headers and extracts tokens across production and development formats', () => {
      const signedVendor = signVendorScope('v_123');
      const prodHeader = `__Host-am_at=access_1; __Host-am_rt=refresh_1; am_csrf=csrf_1; am_vendor=${encodeURIComponent(signedVendor)}`;
      const prodCreds = getCredentialsFromCookies(prodHeader);
      expect(prodCreds.accessToken).toBe('access_1');
      expect(prodCreds.refreshToken).toBe('refresh_1');
      expect(getCsrfTokenFromCookies(prodHeader)).toBe('csrf_1');
      expect(getVendorFromCookies(prodHeader)).toBe('v_123');

      const devHeader = 'am_at=access_dev; am_rt=refresh_dev; am_csrf=csrf_dev';
      const devCreds = getCredentialsFromCookies(devHeader);
      expect(devCreds.accessToken).toBe('access_dev');
      expect(devCreds.refreshToken).toBe('refresh_dev');
    });

    it('sets and clears cookies atomically on CookieStoreLike and Headers', () => {
      const store = new MockCookieStore();
      setAuthCookies(store, { accessToken: 'at_1', refreshToken: 'rt_1', expiresIn: 300 }, true);

      expect(store.get('__Host-am_at')?.value).toBe('at_1');
      expect(store.get('__Host-am_rt')?.value).toBe('rt_1');

      clearAuthCookies(store, true);
      expect(store.get('__Host-am_at')).toBeUndefined();
      expect(store.get('__Host-am_rt')).toBeUndefined();

      expect(AUTH_COOKIE_NAMES.PRODUCTION.ACCESS_TOKEN).toBe('__Host-am_at');
      expect(AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN).toBe('am_at');

      const parsed = parseCookieHeader('key1=val1; key2=val2%20test');
      expect(parsed.key1).toBe('val1');
      expect(parsed.key2).toBe('val2 test');

      const headers = new Headers();
      setAuthCookies(headers, { accessToken: 'at_2', refreshToken: 'rt_2' }, true);
      const setCookies = headers.getSetCookie();
      expect(setCookies.some((c) => c.includes('__Host-am_at=at_2'))).toBe(true);
      expect(setCookies.some((c) => c.includes('__Host-am_rt=rt_2'))).toBe(true);

      // CSRF and Vendor cookie helpers
      setCsrfCookie(store, 'test_csrf_token', true);
      expect(store.get('am_csrf')?.value).toBe('test_csrf_token');
      clearCsrfCookie(store, true);
      expect(store.get('am_csrf')).toBeUndefined();

      setVendorCookie(store, 'vendor_abc', true);
      expect(getVendorFromCookies(store)).toBe('vendor_abc');
      expect(store.get('am_vendor')?.value).not.toBe('vendor_abc');
      expect(verifyVendorScope(`${store.get('am_vendor')?.value}tampered`)).toBeNull();
      clearVendorCookie(store, true);
      expect(store.get('am_vendor')).toBeUndefined();
    });
  });

  // ── 2. JWT Verification & Claims ──────────────────────────────────────────

  describe('2. JWT Verification & Claims', () => {
    it('verifies a valid HS256 token and extracts essential claims', async () => {
      const token = await signAccessToken({
        sub: '42',
        roles: ['CUSTOMER'],
        email: 'buyer@example.com',
        emailVerified: true,
        phoneVerified: true,
        sid: 'sess_abc',
      });

      const result = await verifyAccessToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.sub).toBe('42');
        expect(result.payload.roles).toEqual(['CUSTOMER']);
        expect(result.payload.email).toBe('buyer@example.com');
        expect(result.payload.emailVerified).toBe(true);
        expect(result.payload.phoneVerified).toBe(true);
        expect(result.payload.sid).toBe('sess_abc');

        const claims = toAuthClaims(result.payload);
        expect(claims.sub).toBe(42);
        expect(claims.sid).toBe('sess_abc');
        expect(claims.emailVerified).toBe(true);
      }
    });

    it('rejects tokens signed with disallowed algorithms (e.g. none or RS256)', async () => {
      // Create a token with alg: 'none'
      const unsignedToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.`;

      const result = await verifyAccessToken(unsignedToken);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_ALGORITHM');
        expect(result.message).toContain('HS256');
      }
    });

    it('rejects tokens with invalid signature', async () => {
      const token = await signAccessToken({ sub: '1' }, { secret: 'different-secret-that-is-at-least-32-chars-long' });
      const result = await verifyAccessToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_SIGNATURE');
      }
    });

    it('rejects expired tokens and indicates expired: true', async () => {
      const expiredToken = await signAccessToken(
        { sub: '1' },
        { expiresIn: -100 } // expired in past
      );

      const result = await verifyAccessToken(expiredToken);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('EXPIRED');
        expect(result.expired).toBe(true);
      }
    });

    it('rejects tokens with unapproved issuer', async () => {
      const token = await signAccessToken(
        { sub: '1' },
        { issuer: 'untrusted-rogue-issuer' }
      );

      const result = await verifyAccessToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_ISSUER');
      }
    });

    it('rejects tokens with unapproved audience', async () => {
      const token = await signAccessToken(
        { sub: '1' },
        { audience: 'untrusted-rogue-audience' }
      );

      const result = await verifyAccessToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_AUDIENCE');
      }
    });

    it('rejects tokens missing essential subject (sub) claim', async () => {
      const secret = new TextEncoder().encode('development-jwt-access-secret-32-chars-long-placeholder');
      const tokenWithoutSub = await new SignJWT({
        roles: ['CUSTOMER'],
        emailVerified: true,
        phoneVerified: false,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result = await verifyAccessToken(tokenWithoutSub);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('MISSING_CLAIMS');
        expect(result.message).toContain('subject');
      }
    });

    it('regression: rejects tokens with arbitrary non-numeric or non-positive sub claims', async () => {
      // Non-numeric string sub
      const token1 = await signAccessToken({ sub: 'not-a-numeric-id', roles: ['CUSTOMER'], emailVerified: true, phoneVerified: true });
      const result1 = await verifyAccessToken(token1);
      expect(result1.valid).toBe(false);
      if (!result1.valid) {
        expect(result1.reason).toBe('MISSING_CLAIMS');
        expect(result1.message).toContain('subject');
      }

      // Zero sub
      const token2 = await signAccessToken({ sub: 0, roles: ['CUSTOMER'], emailVerified: true, phoneVerified: true });
      const result2 = await verifyAccessToken(token2);
      expect(result2.valid).toBe(false);
      if (!result2.valid) {
        expect(result2.reason).toBe('MISSING_CLAIMS');
      }

      // Negative sub
      const token3 = await signAccessToken({ sub: -5, roles: ['CUSTOMER'], emailVerified: true, phoneVerified: true });
      const result3 = await verifyAccessToken(token3);
      expect(result3.valid).toBe(false);
      if (!result3.valid) {
        expect(result3.reason).toBe('MISSING_CLAIMS');
      }
    });

    it('regression: rejects tokens missing or with wrong-type emailVerified claim without coercion', async () => {
      const secret = new TextEncoder().encode('development-jwt-access-secret-32-chars-long-placeholder');

      // Missing emailVerified
      const tokenWithoutEmailVer = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER'],
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result1 = await verifyAccessToken(tokenWithoutEmailVer);
      expect(result1.valid).toBe(false);
      if (!result1.valid) {
        expect(result1.reason).toBe('MISSING_CLAIMS');
        expect(result1.message).toContain('emailVerified');
      }

      // Wrong type: string 'true' instead of boolean
      const tokenWithStringEmailVer = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER'],
        emailVerified: 'true',
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result2 = await verifyAccessToken(tokenWithStringEmailVer);
      expect(result2.valid).toBe(false);
      if (!result2.valid) {
        expect(result2.reason).toBe('MISSING_CLAIMS');
        expect(result2.message).toContain('emailVerified');
      }

      // Wrong type: number 1 instead of boolean
      const tokenWithNumEmailVer = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER'],
        emailVerified: 1,
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result3 = await verifyAccessToken(tokenWithNumEmailVer);
      expect(result3.valid).toBe(false);
      if (!result3.valid) {
        expect(result3.reason).toBe('MISSING_CLAIMS');
        expect(result3.message).toContain('emailVerified');
      }
    });

    it('regression: rejects tokens missing or with wrong-type phoneVerified claim without coercion', async () => {
      const secret = new TextEncoder().encode('development-jwt-access-secret-32-chars-long-placeholder');

      // Missing phoneVerified
      const tokenWithoutPhoneVer = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER'],
        emailVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result1 = await verifyAccessToken(tokenWithoutPhoneVer);
      expect(result1.valid).toBe(false);
      if (!result1.valid) {
        expect(result1.reason).toBe('MISSING_CLAIMS');
        expect(result1.message).toContain('phoneVerified');
      }

      // Wrong type: string 'false' instead of boolean
      const tokenWithStringPhoneVer = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER'],
        emailVerified: true,
        phoneVerified: 'false',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result2 = await verifyAccessToken(tokenWithStringPhoneVer);
      expect(result2.valid).toBe(false);
      if (!result2.valid) {
        expect(result2.reason).toBe('MISSING_CLAIMS');
        expect(result2.message).toContain('phoneVerified');
      }
    });

    it('regression: rejects tokens with malformed or wrong-type roles claim', async () => {
      const secret = new TextEncoder().encode('development-jwt-access-secret-32-chars-long-placeholder');

      // Missing roles
      const tokenWithoutRoles = await new SignJWT({
        sub: '1',
        emailVerified: true,
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result1 = await verifyAccessToken(tokenWithoutRoles);
      expect(result1.valid).toBe(false);
      if (!result1.valid) {
        expect(result1.reason).toBe('MISSING_CLAIMS');
        expect(result1.message).toContain('roles');
      }

      // String role instead of array
      const tokenWithStringRole = await new SignJWT({
        sub: '1',
        roles: 'CUSTOMER',
        emailVerified: true,
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result2 = await verifyAccessToken(tokenWithStringRole);
      expect(result2.valid).toBe(false);
      if (!result2.valid) {
        expect(result2.reason).toBe('MISSING_CLAIMS');
        expect(result2.message).toContain('roles');
      }

      // Array with non-string element
      const tokenWithNonStringRole = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER', 123],
        emailVerified: true,
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result3 = await verifyAccessToken(tokenWithNonStringRole);
      expect(result3.valid).toBe(false);
      if (!result3.valid) {
        expect(result3.reason).toBe('MISSING_CLAIMS');
        expect(result3.message).toContain('role items must be non-empty strings');
      }

      // Array with empty string element
      const tokenWithEmptyRole = await new SignJWT({
        sub: '1',
        roles: ['CUSTOMER', '   '],
        emailVerified: true,
        phoneVerified: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('arabiyatmart-api')
        .setAudience('arabiyatmart-mobile')
        .sign(secret);

      const result4 = await verifyAccessToken(tokenWithEmptyRole);
      expect(result4.valid).toBe(false);
      if (!result4.valid) {
        expect(result4.reason).toBe('MISSING_CLAIMS');
      }
    });

    it('decodes unverified claims and detects expiration buffer accurately', async () => {
      const token = await signAccessToken({ sub: '10' }, { expiresIn: 20 }); // expires in 20s
      const decoded = decodeAccessTokenUnverified(token);
      expect(decoded?.sub).toBe('10');

      // Not expired yet with 0 buffer
      expect(isTokenExpired(token, 0)).toBe(false);
      // Expired within 30s buffer
      expect(isTokenExpired(token, 30)).toBe(true);
    });
  });

  // ── 3. CSRF & Origin Validation ───────────────────────────────────────────

  describe('3. CSRF & Origin Validation', () => {
    it('generates 256-bit random CSRF tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('compares CSRF tokens in constant time and rejects mismatches', () => {
      const token = generateCsrfToken();
      expect(compareCsrfTokens(token, token)).toBe(true);
      const corrupted = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      expect(compareCsrfTokens(token, corrupted)).toBe(false);
      expect(compareCsrfTokens(token, '')).toBe(false);
      expect(compareCsrfTokens(token, null)).toBe(false);
      expect(compareCsrfTokens(null, token)).toBe(false);
      expect(compareCsrfTokens('abc', 'abcd')).toBe(false);
    });

    it('exempts RFC 7231 safe HTTP methods (GET, HEAD, OPTIONS)', () => {
      expect(isSafeHttpMethod('GET')).toBe(true);
      expect(isSafeHttpMethod('get')).toBe(true);
      expect(isSafeHttpMethod('HEAD')).toBe(true);
      expect(isSafeHttpMethod('OPTIONS')).toBe(true);
      expect(isSafeHttpMethod('POST')).toBe(false);
      expect(isSafeHttpMethod('PUT')).toBe(false);
      expect(isSafeHttpMethod('PATCH')).toBe(false);
      expect(isSafeHttpMethod('DELETE')).toBe(false);

      // validateMutationCsrf passes GET immediately without CSRF header or cookie
      const result = validateMutationCsrf({
        method: 'GET',
        headers: new Headers(),
        cookies: null,
      });
      expect(result.valid).toBe(true);
      expect(result.status).toBe(200);
    });

    it('strictly rejects Sec-Fetch-Site: cross-site', () => {
      const headers = new Headers({
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
      });
      const result = validateSecFetchSite(headers);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('cross-site');

      const mutationResult = validateMutationCsrf({
        method: 'POST',
        headers,
        cookies: 'am_csrf=token_123',
      });
      expect(mutationResult.valid).toBe(false);
      expect(mutationResult.status).toBe(403);
    });

    it('allows Sec-Fetch-Site: same-origin, same-site, and none', () => {
      expect(validateSecFetchSite(new Headers({ 'sec-fetch-site': 'same-origin' })).valid).toBe(true);
      expect(validateSecFetchSite(new Headers({ 'sec-fetch-site': 'same-site' })).valid).toBe(true);
      expect(validateSecFetchSite(new Headers({ 'sec-fetch-site': 'none' })).valid).toBe(true);
    });

    it('validates Origin and Referer against allowed site origins', () => {
      // Allowed local origin
      const validHeaders = new Headers({ origin: 'http://localhost:3000' });
      expect(validateOrigin(validHeaders).valid).toBe(true);

      // Disallowed attacker origin
      const invalidHeaders = new Headers({ origin: 'https://attacker.evil.com' });
      expect(validateOrigin(invalidHeaders).valid).toBe(false);

      // Referer fallback when origin is missing
      const refererHeaders = new Headers({ referer: 'http://localhost:3000/ar/search' });
      expect(validateOrigin(refererHeaders).valid).toBe(true);

      // Missing both origin and referer on state-changing request
      expect(validateOrigin(new Headers()).valid).toBe(false);
    });

    it('passes mutation when Sec-Fetch-Site, Origin, and double-submit CSRF match', () => {
      const csrfToken = generateCsrfToken();
      const headers = new Headers({
        origin: 'http://localhost:3000',
        'sec-fetch-site': 'same-origin',
        'x-csrf-token': csrfToken,
      });
      const cookieStr = `am_csrf=${csrfToken}`;

      const result = validateMutationCsrf({
        method: 'POST',
        headers,
        cookies: cookieStr,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe(200);
    });

    it('rejects mutation when CSRF token mismatches or is missing', () => {
      const headers = new Headers({
        origin: 'http://localhost:3000',
        'sec-fetch-site': 'same-origin',
        'x-csrf-token': 'wrong-header-token',
      });
      const cookieStr = 'am_csrf=cookie-token';

      const result = validateMutationCsrf({
        method: 'POST',
        headers,
        cookies: cookieStr,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe(403);
      expect(result.reason).toContain('mismatch');
    });

    it('rotates CSRF token and sets fresh cookie', () => {
      const store = new MockCookieStore();
      const token = rotateCsrfToken(store, true);
      expect(token).toHaveLength(64);
      expect(store.get('am_csrf')?.value).toBe(token);

      const headerVal = getCsrfTokenFromHeaders(new Headers({ 'x-csrf-token': token }));
      expect(headerVal).toBe(token);
    });
  });

  // ── 4. Return-To Primitives ───────────────────────────────────────────────

  describe('4. Return-To Primitives', () => {
    it('accepts valid localized marketplace and account routes', () => {
      expect(isValidReturnTo('/ar')).toBe(true);
      expect(isValidReturnTo('/en')).toBe(true);
      expect(isValidReturnTo('/ar/search?q=toyota')).toBe(true);
      expect(isValidReturnTo('/en/listing/toyota-camry-2023')).toBe(true);
      expect(isValidReturnTo('/ar/catalogue/makes')).toBe(true);
      expect(isValidReturnTo('/ar/dealers')).toBe(true);
      expect(isValidReturnTo('/ar/favorites')).toBe(true);
      expect(isValidReturnTo('/ar/profile')).toBe(true);
      expect(isValidReturnTo('/ar/sell')).toBe(true);
      expect(isValidReturnTo('/ar/me/leads')).toBe(true);
      expect(isValidReturnTo('/ar/me/listings')).toBe(true);
      expect(isValidReturnTo('/ar/me/dashboard')).toBe(true);
    });

    it('rejects external URLs and protocol-relative paths', () => {
      expect(isValidReturnTo('https://evil.com')).toBe(false);
      expect(isValidReturnTo('http://attacker.com')).toBe(false);
      expect(isValidReturnTo('//evil.com')).toBe(false);
      expect(isValidReturnTo('///evil.com')).toBe(false);
      expect(isValidReturnTo('/\\evil.com')).toBe(false);
      expect(isValidReturnTo('javascript:alert(1)')).toBe(false);
    });

    it('rejects backslash and encoded directory traversals', () => {
      expect(isValidReturnTo('/ar/../admin')).toBe(false);
      expect(isValidReturnTo('/ar/..')).toBe(false);
      expect(isValidReturnTo('/ar/%2e%2e/admin')).toBe(false);
      expect(isValidReturnTo('/ar\\test')).toBe(false);
      expect(isValidReturnTo('/ar/%5ctest')).toBe(false);
      expect(isValidReturnTo('/ar/%2ftest')).toBe(false);
      expect(isValidReturnTo('/ar/%00test')).toBe(false);
    });

    it('rejects auth routes to prevent redirect loops', () => {
      expect(isValidReturnTo('/ar/login')).toBe(false);
      expect(isValidReturnTo('/ar/register')).toBe(false);
      expect(isValidReturnTo('/ar/verify-email')).toBe(false);
      expect(isValidReturnTo('/ar/register-success')).toBe(false);
      expect(isValidReturnTo('/ar/forgot-password')).toBe(false);
      expect(isValidReturnTo('/ar/reset-password')).toBe(false);
      expect(isValidReturnTo('/api/bff/auth/login')).toBe(false);
      expect(isValidReturnTo('/login')).toBe(false);
    });

    it('accepts localized root routes with query strings and hash fragments', () => {
      expect(isValidReturnTo('/ar/')).toBe(true);
      expect(isValidReturnTo('/en/')).toBe(true);
      expect(isValidReturnTo('/ar?tab=recent')).toBe(true);
      expect(isValidReturnTo('/en?filter=new')).toBe(true);
      expect(isValidReturnTo('/ar#main-content')).toBe(true);
      expect(isValidReturnTo('/en#top')).toBe(true);
      expect(isValidReturnTo('/ar?ref=email#cta')).toBe(true);
    });

    it('accepts application routes with hash fragments and query combinations', () => {
      expect(isValidReturnTo('/ar/search#filters')).toBe(true);
      expect(isValidReturnTo('/ar/search?q=toyota#results')).toBe(true);
      expect(isValidReturnTo('/en/listing/toyota-camry-2023#specs')).toBe(true);
      expect(isValidReturnTo('/en/listing/toyota-camry-2023?ref=search#specs')).toBe(true);
      expect(isValidReturnTo('/ar/compare#summary')).toBe(true);
      expect(isValidReturnTo('/ar/favorites#grid')).toBe(true);
      expect(isValidReturnTo('/ar/sell#step2')).toBe(true);
      expect(isValidReturnTo('/ar/forbidden#details')).toBe(true);
    });

    it('accepts percent-encoded and Arabic slugs for listings and dealers', () => {
      expect(isValidReturnTo('/ar/listing/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7')).toBe(true);
      expect(isValidReturnTo('/ar/listing/تويوتا-كامري')).toBe(true);
      expect(isValidReturnTo('/ar/dealers/معرض-القاهرة')).toBe(true);
      expect(isValidReturnTo('/ar/best-offer/toyota-camry-2023')).toBe(true);
      expect(isValidReturnTo('/ar/best-offer/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7')).toBe(true);
    });

    it('allows slashes in query parameters while rejecting them in path segments', () => {
      expect(isValidReturnTo('/ar/search?q=a%2Fb')).toBe(true);
      expect(isValidReturnTo('/ar/search?filter=make%2Fmodel')).toBe(true);
      expect(isValidReturnTo('/ar/search?range=2020%2F2024')).toBe(true);
      expect(isValidReturnTo('/ar/%2ftest')).toBe(false);
      expect(isValidReturnTo('/ar/search%2f')).toBe(false);
    });

    it('rejects routes requiring slugs when slug is missing', () => {
      expect(isValidReturnTo('/ar/listing')).toBe(false);
      expect(isValidReturnTo('/ar/listing/')).toBe(false);
      expect(isValidReturnTo('/ar/best-offer')).toBe(false);
      expect(isValidReturnTo('/ar/best-offer/')).toBe(false);
    });

    it('rejects auth routes with query strings, hashes, or subpaths', () => {
      expect(isValidReturnTo('/ar/login?returnTo=/ar/search')).toBe(false);
      expect(isValidReturnTo('/ar/login#section')).toBe(false);
      expect(isValidReturnTo('/ar/login/subpath')).toBe(false);
      expect(isValidReturnTo('/en/register?plan=vendor')).toBe(false);
      expect(isValidReturnTo('/ar/verify-email?code=123')).toBe(false);
      expect(isValidReturnTo('/en/reset-password#form')).toBe(false);
      expect(isValidReturnTo('/login?returnTo=/ar')).toBe(false);
      expect(isValidReturnTo('/api/auth/refresh?returnTo=/ar')).toBe(false);
    });

    it('rejects encoded traversal variations and double-encoded evasion', () => {
      expect(isValidReturnTo('/ar/.%2e/admin')).toBe(false);
      expect(isValidReturnTo('/ar/%2e./admin')).toBe(false);
      expect(isValidReturnTo('/ar/%2e/dealers')).toBe(false);
      expect(isValidReturnTo('/ar/%252e%252e/dealers')).toBe(false);
      expect(isValidReturnTo('/ar//dealers')).toBe(false);
      expect(isValidReturnTo('\\evil.com')).toBe(false);
      expect(isValidReturnTo('/\\evil.com')).toBe(false);
    });

    it('regression: rejects double- and multi-encoded traversal, slash, backslash, control, and protocol-relative bypasses', () => {
      // Double-encoded traversal through broad allowlist routes
      expect(isValidReturnTo('/ar/catalogue/%252e%252e%252fadmin')).toBe(false);
      expect(isValidReturnTo('/ar/catalogue/%252e%252e/admin')).toBe(false);
      expect(isValidReturnTo('/ar/dealers/%252e%252e%252fadmin')).toBe(false);
      expect(isValidReturnTo('/ar/dealers/%252e%252e/admin')).toBe(false);
      expect(isValidReturnTo('/ar/me/leads/%252e%252e%252fadmin')).toBe(false);
      expect(isValidReturnTo('/ar/profile/%252e%252e%252fadmin')).toBe(false);

      // Multi-encoded (triple) traversal
      expect(isValidReturnTo('/ar/catalogue/%25252e%25252e%25252fadmin')).toBe(false);
      expect(isValidReturnTo('/ar/dealers/%25252e%25252e%25252fadmin')).toBe(false);

      // Double-encoded backslash and protocol-relative
      expect(isValidReturnTo('/ar/%255cadmin')).toBe(false);
      expect(isValidReturnTo('/ar/catalogue/%255cadmin')).toBe(false);
      expect(isValidReturnTo('/%255cevil.com')).toBe(false);
      expect(isValidReturnTo('/%252f%252fevil.com')).toBe(false);
      expect(isValidReturnTo('/%252f%255cevil.com')).toBe(false);
      expect(isValidReturnTo('/%255c%252fevil.com')).toBe(false);
      expect(isValidReturnTo('/%255c%255cevil.com')).toBe(false);

      // Double-encoded slashes in path
      expect(isValidReturnTo('/ar/%252ftest')).toBe(false);
      expect(isValidReturnTo('/ar/catalogue/%252fadmin')).toBe(false);
      expect(isValidReturnTo('/ar/search/%252f')).toBe(false);
      expect(isValidReturnTo('/ar/%252f%252fdealers')).toBe(false);

      // Double-encoded control characters
      expect(isValidReturnTo('/ar/%2500test')).toBe(false);
      expect(isValidReturnTo('/ar/%250d%250atest')).toBe(false);
      expect(isValidReturnTo('/ar/catalogue/%2500')).toBe(false);

      // Double-encoded auth routes
      expect(isValidReturnTo('/ar/%256c%256f%2567%2569%256e')).toBe(false);
      expect(isValidReturnTo('/ar/%2572%2565%2567%2569%2573%2574%2565%2572')).toBe(false);

      // Sanitize resolves double-encoded attacks to safe localized root
      expect(sanitizeReturnTo('/ar/catalogue/%252e%252e%252fadmin', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo('/ar/%255cadmin', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo('/%252f%252fevil.com', 'ar')).toBe('/ar');
    });

    it('regression: preserves valid query encoding while rejecting malformed percent-decoding', () => {
      // Valid query encoding preserved
      expect(isValidReturnTo('/ar/search?q=a%2Fb')).toBe(true);
      expect(isValidReturnTo('/ar/search?q=toyota%20camry')).toBe(true);
      expect(isValidReturnTo('/ar/search?discount=20%25')).toBe(true);
      expect(isValidReturnTo('/ar/search?q=100%25%20guaranteed')).toBe(true);
      expect(isValidReturnTo('/ar/search?q=BMW%20M3#specs')).toBe(true);
      expect(isValidReturnTo('/ar/dealers?filter=bmw%2Fmercedes')).toBe(true);

      // Malformed percent-decoding in path or query rejected
      expect(isValidReturnTo('/ar/catalogue/%zz')).toBe(false);
      expect(isValidReturnTo('/ar/%/test')).toBe(false);
      expect(isValidReturnTo('/ar/search?q=%zz')).toBe(false);
      expect(isValidReturnTo('/ar/search?q=%')).toBe(false);
    });

    it('regression: rejects surrounding whitespace directly and sanitizes to localized fallback', () => {
      // Leading, trailing, and surrounding spaces
      expect(isValidReturnTo(' /ar')).toBe(false);
      expect(isValidReturnTo('/ar ')).toBe(false);
      expect(isValidReturnTo(' /ar ')).toBe(false);
      expect(isValidReturnTo('   /ar/search')).toBe(false);
      expect(isValidReturnTo('/ar/search   ')).toBe(false);

      // Tabs and newlines
      expect(isValidReturnTo('\t/ar/search')).toBe(false);
      expect(isValidReturnTo('/ar/search\t')).toBe(false);
      expect(isValidReturnTo('\n/ar/search')).toBe(false);
      expect(isValidReturnTo('/ar/search\n')).toBe(false);
      expect(isValidReturnTo('\r/ar/dealers\r\n')).toBe(false);

      // Whitespace on routes with query or hash
      expect(isValidReturnTo(' /ar/search?q=bmw')).toBe(false);
      expect(isValidReturnTo('/ar/search?q=bmw ')).toBe(false);
      expect(isValidReturnTo(' /ar#main ')).toBe(false);

      // sanitizeReturnTo falls back to localized root on whitespace input
      expect(sanitizeReturnTo(' /ar', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo('/ar ', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo(' /ar/search ', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo(' /en/profile ', 'en')).toBe('/en');

      // extractReturnTo sanitizes whitespace values
      expect(extractReturnTo('returnTo=%20%2Far%20', 'ar')).toBe('/ar');
      expect(extractReturnTo({ returnTo: ' /ar ' }, 'ar')).toBe('/ar');
      expect(extractReturnTo({ returnTo: '/ar ' }, 'ar')).toBe('/ar');
    });

    it('enforces expected locale matching and sanitizes invalid values to localized root', () => {
      expect(isValidReturnTo('/en/search', 'ar')).toBe(false); // expected ar, got en
      expect(isValidReturnTo('/ar/search', 'ar')).toBe(true);

      expect(sanitizeReturnTo('//evil.com', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo('/ar/login', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo('/en/search', 'ar')).toBe('/ar');
      expect(sanitizeReturnTo('/ar/search?page=2', 'ar')).toBe('/ar/search?page=2');
      expect(sanitizeReturnTo('/ar?tab=recent', 'ar')).toBe('/ar?tab=recent');
      expect(sanitizeReturnTo('/ar#top', 'ar')).toBe('/ar#top');
    });

    it('validates fallback destination and rejects unsafe fallbacks', () => {
      expect(sanitizeReturnTo('//evil.com', 'ar', '/ar/search')).toBe('/ar/search');
      expect(sanitizeReturnTo('//evil.com', 'ar', 'https://attacker.com')).toBe('/ar');
      expect(sanitizeReturnTo('//evil.com', 'ar', '/en/search')).toBe('/ar'); // mismatched fallback locale
    });

    it('extracts and sanitizes returnTo from URLSearchParams, full URLs, paths, and search records', () => {
      const params = new URLSearchParams('returnTo=%2Far%2Fsearch%3Fq%3Dbmw');
      expect(extractReturnTo(params, 'ar')).toBe('/ar/search?q=bmw');

      const evilParams = new URLSearchParams('returnTo=https%3A%2F%2Fevil.com');
      expect(extractReturnTo(evilParams, 'ar')).toBe('/ar');

      // Full URL string
      expect(
        extractReturnTo('https://arabiyatmart.com/ar/login?returnTo=%2Far%2Fsearch%3Fq%3Dbmw', 'ar')
      ).toBe('/ar/search?q=bmw');

      // Path string with query
      expect(extractReturnTo('/ar/login?returnTo=%2Far%2Fdealers', 'ar')).toBe('/ar/dealers');

      // Query string with leading ?
      expect(extractReturnTo('?returnTo=%2Far%2Ffavorites', 'ar')).toBe('/ar/favorites');

      // Parameter using return_to
      expect(extractReturnTo({ return_to: '/ar/profile' }, 'ar')).toBe('/ar/profile');

      // Record with array
      expect(extractReturnTo({ returnTo: ['/ar/me/leads', '/ar/dealers'] }, 'ar')).toBe(
        '/ar/me/leads'
      );

      // URL instance
      expect(
        extractReturnTo(
          new URL('https://arabiyatmart.internal/login?returnTo=/ar/sell'),
          'ar'
        )
      ).toBe('/ar/sell');

      // Null / undefined with default and custom fallback
      expect(extractReturnTo(null, 'ar')).toBe('/ar');
      expect(extractReturnTo(undefined, 'en')).toBe('/en');
      expect(extractReturnTo(null, 'ar', '/ar/search')).toBe('/ar/search');
    });
  });

  // ── 5. Session Primitives ─────────────────────────────────────────────────

  describe('5. Session Primitives', () => {
    it('resolves authenticated session snapshot without raw tokens', async () => {
      const token = await signAccessToken({
        sub: '99',
        roles: ['VENDOR'],
        email: 'vendor@example.com',
        emailVerified: true,
        phoneVerified: true,
        sid: 'sess_99',
      });

      const store = new MockCookieStore();
      store.set('__Host-am_at', token);
      store.set('__Host-am_rt', 'refresh_token_99');

      const state = await getSessionFromCookies(store);
      expect(state.isAuthenticated).toBe(true);
      expect(state.canRefresh).toBe(true);
      expect(state.claims?.sub).toBe(99);
      expect(state.sessionClaims?.sessionId).toBe('sess_99');
      expect(state.sessionClaims?.roles).toEqual(['VENDOR']);

      // Hard rule: tokens must NOT exist on session snapshot
      expect('accessToken' in state).toBe(false);
      expect('refreshToken' in state).toBe(false);
      expect('token' in state).toBe(false);
    });

    it('returns unauthenticated state when access cookie is missing', async () => {
      const store = new MockCookieStore();
      const state = await getSessionFromCookies(store);
      expect(state.isAuthenticated).toBe(false);
      expect(state.claims).toBeNull();
      expect(state.isExpired).toBe(false);
      expect(state.canRefresh).toBe(false);
      expect('accessToken' in state).toBe(false);
      expect('refreshToken' in state).toBe(false);
      expect('token' in state).toBe(false);
    });

    it('indicates isExpired: true when access token is expired without returning tokens', async () => {
      const expiredToken = await signAccessToken({ sub: '1' }, { expiresIn: -100 });
      const store = new MockCookieStore();
      store.set('__Host-am_at', expiredToken);
      store.set('__Host-am_rt', 'rt_still_valid');

      const state = await getSessionFromCookies(store);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isExpired).toBe(true);
      expect(state.canRefresh).toBe(true);
      expect('accessToken' in state).toBe(false);
      expect('refreshToken' in state).toBe(false);
      expect('token' in state).toBe(false);
    });

    it('regression: proves serialized session snapshots cannot contain either cookie value or token-named fields', async () => {
      const token = await signAccessToken({
        sub: '100',
        roles: ['CUSTOMER'],
        email: 'safe@example.com',
        emailVerified: true,
        phoneVerified: true,
        sid: 'sess_100',
      });
      const rawRefreshToken = 'secret_rotating_refresh_cookie_value_999';

      const store = new MockCookieStore();
      store.set('__Host-am_at', token);
      store.set('__Host-am_rt', rawRefreshToken);

      // Authenticated session
      const authState = await getSessionFromCookies(store);

      // 1. Assert no token-named keys exist on the snapshot object
      const keys = Object.keys(authState);
      for (const key of keys) {
        expect(['token', 'accesstoken', 'refreshtoken', 'access_token', 'refresh_token']).not.toContain(
          key.toLowerCase()
        );
      }
      expect('accessToken' in authState).toBe(false);
      expect('refreshToken' in authState).toBe(false);
      expect('token' in authState).toBe(false);

      // 2. Assert serialized snapshot contains neither raw token
      const serialized = JSON.stringify(authState);
      expect(serialized).not.toContain(token);
      expect(serialized).not.toContain(rawRefreshToken);
      expect(serialized).not.toContain('accessToken');
      expect(serialized).not.toContain('refreshToken');

      // 3. Test unauthenticated and expired snapshots also never contain tokens
      store.set('__Host-am_at', 'malformed_or_expired_token');
      const unauthState = await getSessionFromCookies(store);
      expect('accessToken' in unauthState).toBe(false);
      expect('refreshToken' in unauthState).toBe(false);
      const unauthSerialized = JSON.stringify(unauthState);
      expect(unauthSerialized).not.toContain('malformed_or_expired_token');
      expect(unauthSerialized).not.toContain(rawRefreshToken);
      expect(unauthSerialized).not.toContain('accessToken');
      expect(unauthSerialized).not.toContain('refreshToken');
    });

    it('commits session credentials and rotates CSRF cookie atomically', () => {
      const store = new MockCookieStore();
      setSessionCredentials(
        store,
        { accessToken: 'new_at', refreshToken: 'new_rt', expiresIn: 900 },
        true
      );

      expect(store.get('__Host-am_at')?.value).toBe('new_at');
      expect(store.get('__Host-am_rt')?.value).toBe('new_rt');
      expect(store.get('am_csrf')?.value).toHaveLength(64);
    });

    it('clears all session credentials and cookies atomically', () => {
      const store = new MockCookieStore();
      store.set('__Host-am_at', 'at');
      store.set('__Host-am_rt', 'rt');
      store.set('am_csrf', 'csrf');
      store.set('am_vendor', 'vendor_1');

      clearSessionCredentials(store, true);
      expect(store.get('__Host-am_at')).toBeUndefined();
      expect(store.get('__Host-am_rt')).toBeUndefined();
      expect(store.get('am_csrf')).toBeUndefined();
      expect(store.get('am_vendor')).toBeUndefined();
    });

    it('supplies server credential resolver that resolves unexpired access token for serverApiRequest', async () => {
      const token = await signAccessToken({ sub: '1' }, { expiresIn: 300 });
      const store = new MockCookieStore();
      store.set('__Host-am_at', token);

      const resolver = createCookieCredentialResolver(store);
      const resolved = await resolver();
      expect(resolved).toBe(token);
    });
  });

  // ── 6. Single-Flight Refresh & Upstream 401 Retry (Strict BDD) ───────────

  describe('6. Single-Flight Refresh & Upstream 401 Retry (Strict BDD)', () => {
    it('coalesces concurrent refresh calls into exactly one execution (single-flight)', async () => {
      let networkCalls = 0;

      const mockRefreshFn = vi.fn(async (refreshToken: string) => {
        networkCalls++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          accessToken: `new_access_for_${refreshToken}`,
          refreshToken: `new_refresh_for_${refreshToken}`,
          expiresIn: 900,
        };
      });

      // Launch 5 concurrent refresh requests with the same refresh token
      const results = await Promise.all([
        singleFlightRefresh('rt_concurrent', mockRefreshFn),
        singleFlightRefresh('rt_concurrent', mockRefreshFn),
        singleFlightRefresh('rt_concurrent', mockRefreshFn),
        singleFlightRefresh('rt_concurrent', mockRefreshFn),
        singleFlightRefresh('rt_concurrent', mockRefreshFn),
      ]);

      // Exactly ONE network execution occurred
      expect(networkCalls).toBe(1);
      expect(mockRefreshFn).toHaveBeenCalledTimes(1);

      // All 5 callers received identical refreshed tokens
      for (const res of results) {
        expect(res.accessToken).toBe('new_access_for_rt_concurrent');
        expect(res.refreshToken).toBe('new_refresh_for_rt_concurrent');
      }
    });

    // Acceptance Criteria (Strict BDD):
    // GIVEN: A request with expired access cookie, valid refresh cookie, CSRF pair, and safe relative return path
    // WHEN: One protected upstream request returns 401
    // THEN: Exactly one refresh occurs, rotated HttpOnly cookies are committed, the request retries once, and no credential enters browser-visible data
    it('Strict BDD: retries once after upstream 401, commits rotated cookies atomically, and does not leak credentials', async () => {
      const store = new MockCookieStore();
      const initialExpiredToken = await signAccessToken({ sub: '123' }, { expiresIn: -50 });
      const validRefreshToken = 'valid_rotating_refresh_token_123';
      const csrfToken = generateCsrfToken();

      // GIVEN: Expired access cookie, valid refresh cookie, CSRF pair, safe return path
      store.set('__Host-am_at', initialExpiredToken);
      store.set('__Host-am_rt', validRefreshToken);
      store.set('am_csrf', csrfToken);
      const safeReturnPath = sanitizeReturnTo('/ar/me/leads', 'ar');
      expect(safeReturnPath).toBe('/ar/me/leads');

      let refreshCallCount = 0;
      const mockRefreshFn = vi.fn(async (rt: string) => {
        refreshCallCount++;
        expect(rt).toBe(validRefreshToken);
        return {
          accessToken: 'rotated_access_token_456',
          refreshToken: 'rotated_refresh_token_789',
          expiresIn: 900,
        };
      });

      let operationAttempts = 0;
      const protectedOperation = vi.fn(async (token: string) => {
        operationAttempts++;
        if (token === initialExpiredToken) {
          // WHEN: One protected upstream request returns 401
          throw Object.assign(new Error('Unauthorized'), { status: 401 });
        }
        // Second attempt with rotated access token succeeds
        return { success: true, data: { listingId: 'list_abc' } };
      });

      const onTokensRefreshed = vi.fn((newTokens) => {
        // Rotated HttpOnly cookies committed atomically
        setAuthCookies(store, newTokens, true);
      });

      const onAuthFailed = vi.fn(() => {
        clearAuthCookies(store, true);
      });

      const response = await executeWithAuthRetry({
        operation: protectedOperation,
        accessToken: store.get('__Host-am_at')?.value,
        refreshToken: store.get('__Host-am_rt')?.value,
        onTokensRefreshed,
        onAuthFailed,
        refreshFn: mockRefreshFn,
      });

      // THEN: Exactly one refresh occurs
      expect(refreshCallCount).toBe(1);
      expect(mockRefreshFn).toHaveBeenCalledTimes(1);

      // Rotated HttpOnly cookies are committed atomically
      expect(onTokensRefreshed).toHaveBeenCalledTimes(1);
      expect(store.get('__Host-am_at')?.value).toBe('rotated_access_token_456');
      expect(store.get('__Host-am_rt')?.value).toBe('rotated_refresh_token_789');

      // The request retries once and succeeds
      expect(operationAttempts).toBe(2);
      expect(response).toEqual({ success: true, data: { listingId: 'list_abc' } });

      // No credential enters browser-visible data
      const jsonResponse = JSON.stringify(response);
      expect(jsonResponse).not.toContain('rotated_access_token_456');
      expect(jsonResponse).not.toContain('rotated_refresh_token_789');
      expect(jsonResponse).not.toContain(initialExpiredToken);
      expect(onAuthFailed).not.toHaveBeenCalled();
    });

    it('clears credentials atomically on terminal refresh failure (401/403) and throws', async () => {
      const store = new MockCookieStore();
      store.set('__Host-am_at', 'expired_at');
      store.set('__Host-am_rt', 'revoked_rt');

      const mockFailingRefresh = vi.fn(async () => {
        throw new AuthRefreshError('Session revoked', true, 401);
      });

      const onTokensRefreshed = vi.fn();
      const onAuthFailed = vi.fn(() => {
        clearAuthCookies(store, true);
      });

      await expect(
        executeWithAuthRetry({
          operation: async () => {
            throw Object.assign(new Error('Unauthorized'), { status: 401 });
          },
          accessToken: 'expired_at',
          refreshToken: 'revoked_rt',
          onTokensRefreshed,
          onAuthFailed,
          refreshFn: mockFailingRefresh,
        })
      ).rejects.toThrow(AuthRefreshError);

      expect(onAuthFailed).toHaveBeenCalledTimes(1);
      expect(store.get('__Host-am_at')).toBeUndefined();
      expect(store.get('__Host-am_rt')).toBeUndefined();
    });

    it('does not retry infinitely: caps retry at exactly one attempt', async () => {
      const mockRefresh = vi.fn(async () => ({
        accessToken: 'new_token',
        refreshToken: 'new_rt',
        expiresIn: 900,
      }));

      let attempts = 0;
      const failingOperation = vi.fn(async () => {
        attempts++;
        throw Object.assign(new Error('Persistent 401'), { status: 401 });
      });

      await expect(
        executeWithAuthRetry({
          operation: failingOperation,
          accessToken: 'initial_token',
          refreshToken: 'valid_rt',
          onTokensRefreshed: vi.fn(),
          onAuthFailed: vi.fn(),
          refreshFn: mockRefresh,
        })
      ).rejects.toThrow('Persistent 401');

      // Attempt 1: initial -> returns 401
      // Refresh occurs
      // Attempt 2: retry with refreshed token -> returns 401 again
      // Stopped immediately; no third attempt
      expect(attempts).toBe(2);
      expect(mockRefresh).toHaveBeenCalledTimes(1);

      expect(isUnauthorizedError(Object.assign(new Error('401'), { status: 401 }))).toBe(true);
      expect(isUnauthorizedError(new AuthRefreshError('Terminal', true, 401))).toBe(true);
      expect(isUnauthorizedError(new Error('Generic'))).toBe(false);
    });
  });
});
