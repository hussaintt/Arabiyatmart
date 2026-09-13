import 'server-only';

/**
 * Double-submit CSRF and mutation origin validation primitives.
 *
 * Implements Phase 1 Section 5.7 and TASK-014:
 * - Double-submit CSRF cookie ('am_csrf') paired with request header ('x-csrf-token').
 * - Constant-time secret comparison via crypto.timingSafeEqual to eliminate timing attacks.
 * - Strict Sec-Fetch-Site validation: rejects 'cross-site' requests unconditionally.
 * - Strict Origin / Referer validation: verifies origin against allowed application origins.
 * - RFC 7231 safe HTTP methods (GET, HEAD, OPTIONS) are exempt from mutation CSRF requirements.
 * - CSRF rotation at login, session refresh, and logout.
 */

import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env/server';
import {
  getCsrfTokenFromCookies,
  setCsrfCookie,
  type CookieStoreLike,
  type CookieTarget,
} from './cookies';

export const CSRF_HEADER_NAMES = [
  'x-csrf-token',
  'x-xsrf-token',
  'x-csrftoken',
] as const;

export const SAFE_HTTP_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generates a high-entropy 256-bit random CSRF token (64 hex characters).
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compares two CSRF tokens in constant time to prevent side-channel timing attacks.
 */
export function compareCsrfTokens(
  tokenA: string | null | undefined,
  tokenB: string | null | undefined
): boolean {
  if (
    typeof tokenA !== 'string' ||
    typeof tokenB !== 'string' ||
    tokenA.length === 0 ||
    tokenB.length === 0
  ) {
    return false;
  }

  const bufA = Buffer.from(tokenA, 'utf8');
  const bufB = Buffer.from(tokenB, 'utf8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Checks if an HTTP method is considered safe under RFC 7231 (GET, HEAD, OPTIONS).
 */
export function isSafeHttpMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return SAFE_HTTP_METHODS.has(method.toUpperCase());
}

/**
 * Extracts the CSRF header token from Headers or a record.
 */
export function getCsrfTokenFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  if (headers instanceof Headers) {
    for (const name of CSRF_HEADER_NAMES) {
      const val = headers.get(name);
      if (val && val.trim().length > 0) {
        return val.trim();
      }
    }
    return null;
  }

  for (const name of CSRF_HEADER_NAMES) {
    const raw = headers[name];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      return raw[0].trim();
    }
  }

  return null;
}

/**
 * Normalizes an origin string (strips trailing slash and lowercases protocol/host).
 */
function normalizeOrigin(origin: string): string {
  try {
    const parsed = new URL(origin);
    return parsed.origin.toLowerCase();
  } catch {
    return origin.trim().replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Builds the list of allowed origins from server environment and optional additions.
 */
export function getAllowedOrigins(customOrigins?: readonly string[]): string[] {
  const allowed = new Set<string>();

  if (serverEnv.SITE_ORIGIN) {
    allowed.add(normalizeOrigin(serverEnv.SITE_ORIGIN));
  }
  if (serverEnv.NEXT_PUBLIC_SITE_ORIGIN) {
    allowed.add(normalizeOrigin(serverEnv.NEXT_PUBLIC_SITE_ORIGIN));
  }

  if (customOrigins) {
    for (const orig of customOrigins) {
      if (orig) {
        allowed.add(normalizeOrigin(orig));
      }
    }
  }

  return Array.from(allowed);
}

export interface OriginValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates the Origin and/or Referer header against allowed application origins.
 */
export function validateOrigin(
  headers: Headers | Record<string, string | string[] | undefined>,
  allowedOrigins?: readonly string[]
): OriginValidationResult {
  const allowed = getAllowedOrigins(allowedOrigins);

  let rawOrigin: string | null = null;
  let rawReferer: string | null = null;

  if (headers instanceof Headers) {
    rawOrigin = headers.get('origin');
    rawReferer = headers.get('referer');
  } else {
    const orig = headers['origin'];
    rawOrigin = typeof orig === 'string' ? orig : Array.isArray(orig) ? (orig[0] ?? null) : null;
    const ref = headers['referer'];
    rawReferer = typeof ref === 'string' ? ref : Array.isArray(ref) ? (ref[0] ?? null) : null;
  }

  // 1. Check Origin header first
  if (rawOrigin && rawOrigin.trim().length > 0) {
    const normalized = normalizeOrigin(rawOrigin);
    if (allowed.includes(normalized)) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `Origin "${rawOrigin}" is not allowed. Expected one of: ${allowed.join(', ')}`,
    };
  }

  // 2. Fall back to Referer header if Origin is absent
  if (rawReferer && rawReferer.trim().length > 0) {
    try {
      const refererUrl = new URL(rawReferer);
      const normalized = normalizeOrigin(refererUrl.origin);
      if (allowed.includes(normalized)) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Referer origin "${refererUrl.origin}" is not allowed. Expected one of: ${allowed.join(', ')}`,
      };
    } catch {
      return {
        valid: false,
        reason: 'Malformed Referer header in request',
      };
    }
  }

  // If both Origin and Referer are absent for a mutating browser request, reject
  return {
    valid: false,
    reason: 'Missing Origin and Referer headers on state-changing request',
  };
}

export interface SecFetchSiteValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates the browser Sec-Fetch-Site header.
 * Blocks 'cross-site' requests; allows 'same-origin', 'same-site', 'none', or absent.
 */
export function validateSecFetchSite(
  headers: Headers | Record<string, string | string[] | undefined>
): SecFetchSiteValidationResult {
  let siteVal: string | null = null;

  if (headers instanceof Headers) {
    siteVal = headers.get('sec-fetch-site');
  } else {
    const raw = headers['sec-fetch-site'];
    siteVal = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? null) : null;
  }

  if (!siteVal) {
    // Non-browser or older browser; permitted if other checks pass
    return { valid: true };
  }

  const normalized = siteVal.trim().toLowerCase();

  if (normalized === 'cross-site') {
    return {
      valid: false,
      reason: 'Sec-Fetch-Site header is "cross-site"; cross-site mutations are strictly forbidden',
    };
  }

  if (normalized === 'same-origin' || normalized === 'same-site' || normalized === 'none') {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Unrecognized Sec-Fetch-Site value: "${siteVal}"`,
  };
}

export interface MutationCsrfCheckOptions {
  method: string;
  headers: Headers | Record<string, string | string[] | undefined>;
  cookies: CookieStoreLike | Headers | string | null | undefined;
  allowedOrigins?: readonly string[];
}

export interface MutationCsrfCheckResult {
  valid: boolean;
  status: 200 | 403;
  reason?: string;
}

/**
 * Comprehensive CSRF and Origin validator for mutating Route Handlers and Server Actions.
 *
 * For safe methods (GET, HEAD, OPTIONS): passes immediately.
 * For mutating methods (POST, PUT, PATCH, DELETE):
 * 1. Checks Sec-Fetch-Site (rejects cross-site).
 * 2. Checks Origin / Referer (must match allowed application origin).
 * 3. Checks double-submit CSRF (cookie am_csrf must match header x-csrf-token in constant time).
 */
export function validateMutationCsrf(
  options: MutationCsrfCheckOptions
): MutationCsrfCheckResult {
  const { method, headers, cookies, allowedOrigins } = options;

  if (isSafeHttpMethod(method)) {
    return { valid: true, status: 200 };
  }

  // 1. Strict Sec-Fetch-Site check
  const siteCheck = validateSecFetchSite(headers);
  if (!siteCheck.valid) {
    return {
      valid: false,
      status: 403,
      reason: siteCheck.reason ?? 'Sec-Fetch-Site validation failed',
    };
  }

  // 2. Strict Origin check
  const originCheck = validateOrigin(headers, allowedOrigins);
  if (!originCheck.valid) {
    return {
      valid: false,
      status: 403,
      reason: originCheck.reason ?? 'Origin validation failed',
    };
  }

  // 3. Double-submit CSRF check
  const cookieToken = getCsrfTokenFromCookies(cookies);
  const headerToken = getCsrfTokenFromHeaders(headers);

  if (!cookieToken || cookieToken.trim().length === 0) {
    return {
      valid: false,
      status: 403,
      reason: 'Missing CSRF cookie ("am_csrf")',
    };
  }

  if (!headerToken || headerToken.trim().length === 0) {
    return {
      valid: false,
      status: 403,
      reason: 'Missing CSRF header ("x-csrf-token")',
    };
  }

  const matches = compareCsrfTokens(cookieToken, headerToken);
  if (!matches) {
    return {
      valid: false,
      status: 403,
      reason: 'CSRF token mismatch between cookie and header',
    };
  }

  return { valid: true, status: 200 };
}

/**
 * Rotates the CSRF cookie on a target (store, headers, or response) and returns the new token.
 */
export function rotateCsrfToken(
  target: CookieTarget,
  isSecure?: boolean
): string {
  const newToken = generateCsrfToken();
  setCsrfCookie(target, newToken, isSecure);
  return newToken;
}
