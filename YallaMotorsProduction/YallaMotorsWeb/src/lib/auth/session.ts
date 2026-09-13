import 'server-only';

/**
 * Server session resolution, credential commitment, and resolver integration.
 *
 * Implements Phase 1 Section 5.2/5.5 and TASK-014:
 * - Reads access token from HttpOnly cookies and verifies claims via jwt.ts.
 * - Extracts essential AuthClaims and SessionClaims without premature database lookups.
 * - Atomically commits ServerCredentials (access token, refresh token) and rotates CSRF.
 * - Atomically clears all credentials (access, refresh, CSRF, selected vendor) on logout.
 * - Provides the server-only credential resolver for serverApiRequest in TASK-013.
 * - Never serializes or exposes credentials to client-accessible stores or logs.
 */

import {
  getCredentialsFromCookies,
  setAuthCookies,
  clearAuthCookies,
  clearCsrfCookie,
  clearVendorCookie,
  type CookieStoreLike,
  type CookieTarget,
  isSecureEnvironment,
} from './cookies';
import { rotateCsrfToken } from './csrf';
import {
  verifyAccessToken,
  toAuthClaims,
  isTokenExpired,
  type JwtVerifyResult,
} from './jwt';
import {
  setServerCredentialResolver,
  type ServerCredentialResolver,
} from '@/lib/api/server';
import type {
  AuthClaims,
  ServerCredentials,
  SessionClaims,
} from '@/types/auth';

/**
 * Safe, token-free session snapshot suitable for React Server Components and props.
 * Strictly guarantees that no access tokens, refresh tokens, or secret credentials
 * ever enter client-accessible or RSC-serializable data.
 */
export interface SafeSessionSnapshot {
  isAuthenticated: boolean;
  claims: AuthClaims | null;
  sessionClaims: SessionClaims | null;
  canRefresh: boolean;
  isExpired: boolean;
  error?: string;
}

export type SessionState = SafeSessionSnapshot;

/**
 * Resolves safe, token-free session snapshot from a cookie source (store, headers, or cookie string).
 * Raw credentials are never returned in the snapshot.
 */
export async function getSessionFromCookies(
  source: CookieStoreLike | Headers | string | null | undefined
): Promise<SafeSessionSnapshot> {
  const { accessToken, refreshToken } = getCredentialsFromCookies(source);
  const canRefresh = Boolean(refreshToken && refreshToken.trim().length > 0);

  if (!accessToken) {
    return {
      isAuthenticated: false,
      claims: null,
      sessionClaims: null,
      canRefresh,
      isExpired: false,
      error: 'No access token cookie present',
    };
  }

  const verification: JwtVerifyResult = await verifyAccessToken(accessToken);

  if (!verification.valid) {
    return {
      isAuthenticated: false,
      claims: null,
      sessionClaims: null,
      canRefresh,
      isExpired: verification.expired,
      error: verification.message,
    };
  }

  const claims = toAuthClaims(verification.payload);
  const sessionClaims: SessionClaims = {
    sessionId: claims.sid,
    roles: claims.roles,
    emailVerified: claims.emailVerified,
    phoneVerified: claims.phoneVerified,
  };

  return {
    isAuthenticated: true,
    claims,
    sessionClaims,
    canRefresh,
    isExpired: false,
  };
}

/**
 * Atomically commits server credentials onto a target (store, headers, or response)
 * and rotates the double-submit CSRF cookie.
 */
export function setSessionCredentials(
  target: CookieTarget,
  credentials: ServerCredentials,
  isSecure: boolean = isSecureEnvironment()
): void {
  // 1. Commit access and refresh token cookies
  setAuthCookies(target, credentials, isSecure);

  // 2. Rotate CSRF cookie
  rotateCsrfToken(target, isSecure);
}

/**
 * Atomically clears all session credentials, tokens, CSRF, and active vendor cookies.
 */
export function clearSessionCredentials(
  target: CookieTarget,
  isSecure: boolean = isSecureEnvironment()
): void {
  clearAuthCookies(target, isSecure);
  clearCsrfCookie(target, isSecure);
  clearVendorCookie(target, isSecure);
}

export type CookieSourceSupplier =
  | CookieStoreLike
  | Headers
  | string
  | null
  | undefined
  | (() =>
      | Promise<CookieStoreLike | Headers | string | null | undefined>
      | CookieStoreLike
      | Headers
      | string
      | null
      | undefined);

/**
 * Creates a ServerCredentialResolver function configured to resolve
 * the bearer token from a cookie source for serverApiRequest.
 */
export function createCookieCredentialResolver(
  supplier: CookieSourceSupplier
): ServerCredentialResolver {
  return async (): Promise<string | null> => {
    try {
      const source = typeof supplier === 'function' ? await supplier() : supplier;
      const { accessToken } = getCredentialsFromCookies(source);
      if (!accessToken) return null;

      // Do not return an already-expired token to avoid needless 401s
      if (isTokenExpired(accessToken)) {
        return null;
      }

      return accessToken;
    } catch {
      return null;
    }
  };
}

/**
 * Registers a cookie-backed credential resolver into the global serverApiRequest client.
 */
export function registerServerCredentialResolver(
  supplier: CookieSourceSupplier
): void {
  const resolver = createCookieCredentialResolver(supplier);
  setServerCredentialResolver(resolver);
}
