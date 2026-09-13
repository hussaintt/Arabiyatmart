import 'server-only';

import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env/server';

/**
 * Cookie security and session storage primitives.
 *
 * Implements Phase 1 Section 5.2 and TASK-014:
 * - Production cookies: '__Host-am_at', '__Host-am_rt', 'am_csrf', 'am_locale', 'am_vendor'.
 * - Development cookies: explicitly named unprefixed 'am_at', 'am_rt', 'am_csrf', 'am_locale', 'am_vendor'.
 * - Credentials: HttpOnly, Secure in production, SameSite=Lax, Path=/, no Domain, bounded expiry.
 * - CSRF cookie: readable by JavaScript for double-submit header attachment.
 * - Vendor cookie: HttpOnly, Secure in production, SameSite=Lax, Path=/.
 * - Never serializes credentials into HTML, JS, RSC props, logs, or URLs.
 */

export const AUTH_COOKIE_NAMES = {
  PRODUCTION: {
    ACCESS_TOKEN: '__Host-am_at',
    REFRESH_TOKEN: '__Host-am_rt',
    CSRF_TOKEN: 'am_csrf',
    LOCALE: 'am_locale',
    VENDOR: 'am_vendor',
  },
  DEVELOPMENT: {
    ACCESS_TOKEN: 'am_at',
    REFRESH_TOKEN: 'am_rt',
    CSRF_TOKEN: 'am_csrf',
    LOCALE: 'am_locale',
    VENDOR: 'am_vendor',
  },
} as const;

export type AuthCookieType = 'access' | 'refresh' | 'csrf' | 'locale' | 'vendor';

/**
 * Standard TTL bounds for authentication cookies (in seconds).
 */
export const COOKIE_MAX_AGE_SECONDS = {
  ACCESS_TOKEN: 900, // 15 minutes (aligned with Fastify JWT_ACCESS_EXPIRES_IN)
  REFRESH_TOKEN: 7 * 24 * 3600, // 7 days (aligned with Fastify JWT_REFRESH_EXPIRES_IN)
  CSRF_TOKEN: 7 * 24 * 3600, // 7 days
  LOCALE: 365 * 24 * 3600, // 1 year
  VENDOR: 7 * 24 * 3600, // 7 days
} as const;

export interface CookieOptions {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge?: number;
  expires?: Date;
  priority?: 'low' | 'medium' | 'high';
  domain?: undefined; // Strictly undefined for __Host- compliance
}

/**
 * Determines whether the current execution requires production secure cookies.
 */
export function isSecureEnvironment(override?: boolean): boolean {
  if (typeof override === 'boolean') {
    return override;
  }
  if (process.env.APP_ENV === 'test') {
    return false;
  }
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production'
  );
}

/**
 * Resolves the cookie name for a given cookie role and environment.
 */
export function getAuthCookieName(
  type: AuthCookieType,
  isSecure: boolean = isSecureEnvironment()
): string {
  const table = isSecure ? AUTH_COOKIE_NAMES.PRODUCTION : AUTH_COOKIE_NAMES.DEVELOPMENT;
  switch (type) {
    case 'access':
      return table.ACCESS_TOKEN;
    case 'refresh':
      return table.REFRESH_TOKEN;
    case 'csrf':
      return table.CSRF_TOKEN;
    case 'locale':
      return table.LOCALE;
    case 'vendor':
      return table.VENDOR;
  }
}

/**
 * Generates the standardized CookieOptions for a specific cookie role.
 */
export function getAuthCookieOptions(
  type: AuthCookieType,
  customMaxAge?: number,
  isSecure: boolean = isSecureEnvironment()
): CookieOptions {
  switch (type) {
    case 'access':
      return {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: customMaxAge ?? COOKIE_MAX_AGE_SECONDS.ACCESS_TOKEN,
        priority: 'high',
        domain: undefined,
      };
    case 'refresh':
      return {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: customMaxAge ?? COOKIE_MAX_AGE_SECONDS.REFRESH_TOKEN,
        priority: 'high',
        domain: undefined,
      };
    case 'csrf':
      return {
        path: '/',
        httpOnly: false, // Must be readable by client JS for double-submit
        secure: isSecure,
        sameSite: 'lax',
        maxAge: customMaxAge ?? COOKIE_MAX_AGE_SECONDS.CSRF_TOKEN,
        domain: undefined,
      };
    case 'locale':
      return {
        path: '/',
        httpOnly: false, // Readable by client JS for presentation
        secure: isSecure,
        sameSite: 'lax',
        maxAge: customMaxAge ?? COOKIE_MAX_AGE_SECONDS.LOCALE,
        domain: undefined,
      };
    case 'vendor':
      return {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: customMaxAge ?? COOKIE_MAX_AGE_SECONDS.VENDOR,
        domain: undefined,
      };
  }
}

/**
 * Generates options for clearing an expired cookie.
 */
export function getClearCookieOptions(
  type: AuthCookieType,
  isSecure: boolean = isSecureEnvironment()
): CookieOptions {
  const base = getAuthCookieOptions(type, 0, isSecure);
  return {
    ...base,
    maxAge: 0,
    expires: new Date(0),
  };
}

/**
 * Formats a single Set-Cookie header value string.
 */
export function serializeCookieHeader(
  name: string,
  value: string,
  options: CookieOptions
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.sameSite) {
    const s = options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
    parts.push(`SameSite=${s}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.priority) {
    const p = options.priority.charAt(0).toUpperCase() + options.priority.slice(1);
    parts.push(`Priority=${p}`);
  }

  return parts.join('; ');
}

/**
 * Parses a standard HTTP Cookie header into key-value pairs.
 */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  if (!header || typeof header !== 'string') {
    return {};
  }
  const result: Record<string, string> = {};
  const pairs = header.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const rawVal = pair.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

/**
 * Universal cookie store interface compatible with Next.js cookies(),
 * response.cookies, and testing mocks.
 */
export interface CookieStoreLike {
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string, options?: CookieOptions): void | unknown;
  delete?(name: string): void | unknown;
}

/**
 * Extracts access and refresh tokens from a cookie source (store, headers, or string).
 * Checks both production (__Host-) and development names.
 */
export function getCredentialsFromCookies(
  source: CookieStoreLike | Headers | string | null | undefined
): { accessToken: string | null; refreshToken: string | null } {
  if (!source) {
    return { accessToken: null, refreshToken: null };
  }

  if (typeof source === 'string') {
    const cookies = parseCookieHeader(source);
    return {
      accessToken:
        cookies[AUTH_COOKIE_NAMES.PRODUCTION.ACCESS_TOKEN] ??
        cookies[AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN] ??
        null,
      refreshToken:
        cookies[AUTH_COOKIE_NAMES.PRODUCTION.REFRESH_TOKEN] ??
        cookies[AUTH_COOKIE_NAMES.DEVELOPMENT.REFRESH_TOKEN] ??
        null,
    };
  }

  if (source instanceof Headers) {
    const cookies = parseCookieHeader(source.get('cookie'));
    return {
      accessToken:
        cookies[AUTH_COOKIE_NAMES.PRODUCTION.ACCESS_TOKEN] ??
        cookies[AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN] ??
        null,
      refreshToken:
        cookies[AUTH_COOKIE_NAMES.PRODUCTION.REFRESH_TOKEN] ??
        cookies[AUTH_COOKIE_NAMES.DEVELOPMENT.REFRESH_TOKEN] ??
        null,
    };
  }

  // CookieStoreLike
  const prodAt = source.get(AUTH_COOKIE_NAMES.PRODUCTION.ACCESS_TOKEN)?.value;
  const devAt = source.get(AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN)?.value;
  const prodRt = source.get(AUTH_COOKIE_NAMES.PRODUCTION.REFRESH_TOKEN)?.value;
  const devRt = source.get(AUTH_COOKIE_NAMES.DEVELOPMENT.REFRESH_TOKEN)?.value;

  return {
    accessToken: prodAt ?? devAt ?? null,
    refreshToken: prodRt ?? devRt ?? null,
  };
}

/**
 * Extracts CSRF token from cookies.
 */
export function getCsrfTokenFromCookies(
  source: CookieStoreLike | Headers | string | null | undefined
): string | null {
  if (!source) return null;
  if (typeof source === 'string') {
    return parseCookieHeader(source)[AUTH_COOKIE_NAMES.PRODUCTION.CSRF_TOKEN] ?? null;
  }
  if (source instanceof Headers) {
    return parseCookieHeader(source.get('cookie'))[AUTH_COOKIE_NAMES.PRODUCTION.CSRF_TOKEN] ?? null;
  }
  return source.get(AUTH_COOKIE_NAMES.PRODUCTION.CSRF_TOKEN)?.value ?? null;
}

/**
 * Extracts vendor publicId from cookies.
 */
export function getVendorFromCookies(
  source: CookieStoreLike | Headers | string | null | undefined
): string | null {
  if (!source) return null;
  let raw: string | null = null;
  if (typeof source === 'string') {
    raw = parseCookieHeader(source)[AUTH_COOKIE_NAMES.PRODUCTION.VENDOR] ?? null;
  } else if (source instanceof Headers) {
    raw = parseCookieHeader(source.get('cookie'))[AUTH_COOKIE_NAMES.PRODUCTION.VENDOR] ?? null;
  } else {
    raw = source.get(AUTH_COOKIE_NAMES.PRODUCTION.VENDOR)?.value ?? null;
  }
  return raw ? verifyVendorScope(raw) : null;
}

const VENDOR_SCOPE_VERSION = 'v1';

export function signVendorScope(vendorPublicId: string): string {
  const encodedId = Buffer.from(vendorPublicId, 'utf8').toString('base64url');
  const payload = `${VENDOR_SCOPE_VERSION}.${encodedId}`;
  const signature = crypto.createHmac('sha256', serverEnv.CSRF_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyVendorScope(value: string): string | null {
  const [version, encodedId, signature, ...extra] = value.split('.');
  if (version !== VENDOR_SCOPE_VERSION || !encodedId || !signature || extra.length > 0) return null;
  const payload = `${version}.${encodedId}`;
  const expected = crypto.createHmac('sha256', serverEnv.CSRF_SECRET).update(payload).digest('base64url');
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) return null;
  try {
    const publicId = Buffer.from(encodedId, 'base64url').toString('utf8');
    return publicId.length >= 1 && publicId.length <= 128 ? publicId : null;
  } catch {
    return null;
  }
}

export type CookieTarget = CookieStoreLike | Headers | Response;

/**
 * Atomically commits access and refresh token cookies onto a target (store, headers, or response).
 */
export function setAuthCookies(
  target: CookieTarget,
  tokens: { accessToken: string; refreshToken: string; expiresIn?: number },
  isSecure: boolean = isSecureEnvironment()
): void {
  const atName = getAuthCookieName('access', isSecure);
  const rtName = getAuthCookieName('refresh', isSecure);
  const atOptions = getAuthCookieOptions('access', tokens.expiresIn, isSecure);
  const rtOptions = getAuthCookieOptions('refresh', undefined, isSecure);

  if ('append' in target && typeof (target as Headers).append === 'function') {
    const headers = target as Headers;
    headers.append('Set-Cookie', serializeCookieHeader(atName, tokens.accessToken, atOptions));
    headers.append('Set-Cookie', serializeCookieHeader(rtName, tokens.refreshToken, rtOptions));
    return;
  }

  if ('headers' in target && (target as Response).headers instanceof Headers) {
    const headers = (target as Response).headers;
    headers.append('Set-Cookie', serializeCookieHeader(atName, tokens.accessToken, atOptions));
    headers.append('Set-Cookie', serializeCookieHeader(rtName, tokens.refreshToken, rtOptions));
    return;
  }

  const store = target as CookieStoreLike;
  store.set(atName, tokens.accessToken, atOptions);
  store.set(rtName, tokens.refreshToken, rtOptions);
}

/**
 * Atomically clears access and refresh token cookies from a target.
 */
export function clearAuthCookies(
  target: CookieTarget,
  isSecure: boolean = isSecureEnvironment()
): void {
  const names = [
    AUTH_COOKIE_NAMES.PRODUCTION.ACCESS_TOKEN,
    AUTH_COOKIE_NAMES.PRODUCTION.REFRESH_TOKEN,
    AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN,
    AUTH_COOKIE_NAMES.DEVELOPMENT.REFRESH_TOKEN,
  ];

  if ('append' in target && typeof (target as Headers).append === 'function') {
    const headers = target as Headers;
    for (const name of names) {
      const type: AuthCookieType = name.includes('at') ? 'access' : 'refresh';
      const clearOptions = getClearCookieOptions(type, isSecure);
      headers.append('Set-Cookie', serializeCookieHeader(name, '', clearOptions));
    }
    return;
  }

  if ('headers' in target && (target as Response).headers instanceof Headers) {
    const headers = (target as Response).headers;
    for (const name of names) {
      const type: AuthCookieType = name.includes('at') ? 'access' : 'refresh';
      const clearOptions = getClearCookieOptions(type, isSecure);
      headers.append('Set-Cookie', serializeCookieHeader(name, '', clearOptions));
    }
    return;
  }

  const store = target as CookieStoreLike;
  for (const name of names) {
    if (typeof store.delete === 'function') {
      store.delete(name);
    } else {
      const type: AuthCookieType = name.includes('at') ? 'access' : 'refresh';
      store.set(name, '', getClearCookieOptions(type, isSecure));
    }
  }
}

/**
 * Sets CSRF token cookie on a target.
 */
export function setCsrfCookie(
  target: CookieTarget,
  token: string,
  isSecure: boolean = isSecureEnvironment()
): void {
  const name = getAuthCookieName('csrf', isSecure);
  const options = getAuthCookieOptions('csrf', undefined, isSecure);

  if ('append' in target && typeof (target as Headers).append === 'function') {
    (target as Headers).append('Set-Cookie', serializeCookieHeader(name, token, options));
    return;
  }
  if ('headers' in target && (target as Response).headers instanceof Headers) {
    (target as Response).headers.append('Set-Cookie', serializeCookieHeader(name, token, options));
    return;
  }
  const store = target as CookieStoreLike;
  store.set(name, token, options);
}

/**
 * Clears CSRF token cookie on a target.
 */
export function clearCsrfCookie(
  target: CookieTarget,
  isSecure: boolean = isSecureEnvironment()
): void {
  const name = getAuthCookieName('csrf', isSecure);
  const options = getClearCookieOptions('csrf', isSecure);

  if ('append' in target && typeof (target as Headers).append === 'function') {
    (target as Headers).append('Set-Cookie', serializeCookieHeader(name, '', options));
    return;
  }
  if ('headers' in target && (target as Response).headers instanceof Headers) {
    (target as Response).headers.append('Set-Cookie', serializeCookieHeader(name, '', options));
    return;
  }
  const store = target as CookieStoreLike;
  if (typeof store.delete === 'function') {
    store.delete(name);
  } else {
    store.set(name, '', options);
  }
}

/**
 * Sets selected vendor publicId cookie on a target.
 */
export function setVendorCookie(
  target: CookieTarget,
  vendorPublicId: string,
  isSecure: boolean = isSecureEnvironment()
): void {
  const name = getAuthCookieName('vendor', isSecure);
  const options = getAuthCookieOptions('vendor', undefined, isSecure);
  const signedValue = signVendorScope(vendorPublicId);

  if ('append' in target && typeof (target as Headers).append === 'function') {
    (target as Headers).append('Set-Cookie', serializeCookieHeader(name, signedValue, options));
    return;
  }
  if ('headers' in target && (target as Response).headers instanceof Headers) {
    (target as Response).headers.append('Set-Cookie', serializeCookieHeader(name, signedValue, options));
    return;
  }
  const store = target as CookieStoreLike;
  store.set(name, signedValue, options);
}

/**
 * Clears selected vendor publicId cookie on a target.
 */
export function clearVendorCookie(
  target: CookieTarget,
  isSecure: boolean = isSecureEnvironment()
): void {
  const name = getAuthCookieName('vendor', isSecure);
  const options = getClearCookieOptions('vendor', isSecure);

  if ('append' in target && typeof (target as Headers).append === 'function') {
    (target as Headers).append('Set-Cookie', serializeCookieHeader(name, '', options));
    return;
  }
  if ('headers' in target && (target as Response).headers instanceof Headers) {
    (target as Response).headers.append('Set-Cookie', serializeCookieHeader(name, '', options));
    return;
  }
  const store = target as CookieStoreLike;
  if (typeof store.delete === 'function') {
    store.delete(name);
  } else {
    store.set(name, '', options);
  }
}
