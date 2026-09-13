import 'server-only';

/**
 * Server-only JWT verification and claims inspection primitives.
 *
 * Implements Phase 1 Section 5.1/5.4 and TASK-014:
 * - Algorithmic enforcement: strictly HS256; rejects alg:none, RS256, etc.
 * - Issuer validation: allows 'arabiyatmart-api' and 'arabiyatmart-backend' or configured JWT_ISSUER.
 * - Audience validation: strictly allows 'arabiyatmart-mobile' and 'arabiyatmart-web'.
 * - Essential claims validation: sub, roles, emailVerified, phoneVerified, exp.
 * - Lightweight verification without database or external I/O suitable for Edge and middleware.
 * - Fast expiration inspection and unverified payload decoding for client advisory checks.
 * - Never leaks raw tokens or secrets in error outputs.
 */

import { jwtVerify, SignJWT, decodeJwt, decodeProtectedHeader, errors } from 'jose';
import { serverEnv } from '@/lib/env/server';
import type { AuthClaims } from '@/types/auth';

export const ALLOWED_JWT_ALGORITHMS = ['HS256'] as const;

export const DEFAULT_ALLOWED_ISSUERS = [
  'arabiyatmart-api',
  'arabiyatmart-backend',
] as const;

export const DEFAULT_ALLOWED_AUDIENCES = [
  'arabiyatmart-mobile',
  'arabiyatmart-web',
] as const;

export interface AccessTokenPayload {
  sub: number | string;
  roles: string[];
  email?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  sid?: string;
  mfaAt?: number;
  iss?: string;
  aud?: string | string[];
  exp: number;
  iat?: number;
  [key: string]: unknown;
}

export type JwtErrorReason =
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'INVALID_ISSUER'
  | 'INVALID_AUDIENCE'
  | 'INVALID_ALGORITHM'
  | 'MALFORMED'
  | 'MISSING_CLAIMS'
  | 'UNKNOWN';

export type JwtVerifyResult =
  | { valid: true; payload: AccessTokenPayload }
  | { valid: false; reason: JwtErrorReason; message: string; expired: boolean };

export interface JwtVerifyOptions {
  secret?: string;
  allowedIssuers?: readonly string[];
  allowedAudiences?: readonly string[];
  clockToleranceSeconds?: number;
}

export interface JwtSignOptions {
  secret?: string;
  issuer?: string;
  audience?: string | string[];
  expiresIn?: string | number; // e.g. '15m' or seconds
}

/**
 * Returns Uint8Array representation of the secret key.
 */
function getSecretKey(secret?: string): Uint8Array {
  const raw = secret ?? serverEnv.JWT_ACCESS_SECRET;
  return new TextEncoder().encode(raw);
}

/**
 * Validates essential claims on an already signature-verified payload.
 * Strictly enforces expected types without coercion:
 * - sub: must be a valid positive integer (number or numeric string matching /^[1-9]\d*$/)
 * - exp: must be a finite positive number
 * - roles: must be an array of non-empty strings (string[])
 * - emailVerified: must be a boolean (typeof === 'boolean')
 * - phoneVerified: must be a boolean (typeof === 'boolean')
 */
function validateEssentialClaims(rawPayload: Record<string, unknown>): {
  valid: boolean;
  payload?: AccessTokenPayload;
  message?: string;
} {
  const { sub, exp, roles, emailVerified, phoneVerified } = rawPayload;

  // 1. Subject (sub): valid numeric user ID
  if (sub === undefined || sub === null) {
    return { valid: false, message: 'Missing subject (sub) claim' };
  }

  let validSub: number | string;
  if (typeof sub === 'number') {
    if (!Number.isInteger(sub) || sub <= 0) {
      return { valid: false, message: 'Invalid subject (sub) claim: must be a positive integer' };
    }
    validSub = sub;
  } else if (typeof sub === 'string') {
    if (!/^[1-9]\d*$/.test(sub.trim())) {
      return { valid: false, message: 'Invalid subject (sub) claim: must be a positive numeric string' };
    }
    validSub = sub.trim();
  } else {
    return { valid: false, message: 'Invalid subject (sub) claim: must be a number or numeric string' };
  }

  // 2. Expiration (exp): finite positive number
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) {
    return { valid: false, message: 'Missing or invalid expiration (exp) claim: must be a finite positive number' };
  }

  // 3. Roles: strictly string[] with non-empty string items
  if (!Array.isArray(roles)) {
    return { valid: false, message: 'Missing or invalid roles claim: must be an array of strings' };
  }

  for (let i = 0; i < roles.length; i++) {
    const r = roles[i];
    if (typeof r !== 'string' || r.trim().length === 0) {
      return {
        valid: false,
        message: `Invalid role at index ${i}: role items must be non-empty strings`,
      };
    }
  }

  // 4. emailVerified: strictly boolean
  if (typeof emailVerified !== 'boolean') {
    return { valid: false, message: 'Missing or invalid emailVerified claim: must be a boolean' };
  }

  // 5. phoneVerified: strictly boolean
  if (typeof phoneVerified !== 'boolean') {
    return { valid: false, message: 'Missing or invalid phoneVerified claim: must be a boolean' };
  }

  const payload: AccessTokenPayload = {
    ...rawPayload,
    sub: validSub,
    exp,
    roles: [...roles],
    emailVerified,
    phoneVerified,
  };

  return { valid: true, payload };
}

/**
 * Verifies an access JWT with strictly pinned HS256 algorithm, issuer, audience, and essential claims.
 */
export async function verifyAccessToken(
  token: string,
  options: JwtVerifyOptions = {}
): Promise<JwtVerifyResult> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      valid: false,
      reason: 'MALFORMED',
      message: 'Token is empty or not a string',
      expired: false,
    };
  }

  const cleanToken = token.trim();

  // 1. Inspect protected header to enforce HS256 algorithm strictly
  try {
    const header = decodeProtectedHeader(cleanToken);
    if (!header.alg || header.alg !== 'HS256') {
      return {
        valid: false,
        reason: 'INVALID_ALGORITHM',
        message: `Algorithm "${header.alg}" is not allowed; only HS256 is accepted`,
        expired: false,
      };
    }
  } catch {
    return {
      valid: false,
      reason: 'MALFORMED',
      message: 'Failed to decode token header',
      expired: false,
    };
  }

  const secretKey = getSecretKey(options.secret);
  const allowedIssuers = options.allowedIssuers ?? [
    ...DEFAULT_ALLOWED_ISSUERS,
    serverEnv.JWT_ISSUER,
  ];
  const allowedAudiences = options.allowedAudiences ?? [
    ...DEFAULT_ALLOWED_AUDIENCES,
    serverEnv.JWT_AUDIENCE,
  ];

  try {
    const { payload: rawPayload } = await jwtVerify(cleanToken, secretKey, {
      algorithms: ['HS256'],
      clockTolerance: options.clockToleranceSeconds ?? 5,
    });

    // Verify Issuer
    const iss = rawPayload.iss;
    if (!iss || !allowedIssuers.includes(iss)) {
      return {
        valid: false,
        reason: 'INVALID_ISSUER',
        message: `Token issuer "${iss}" is not in allowed issuers list`,
        expired: false,
      };
    }

    // Verify Audience
    const aud = rawPayload.aud;
    let audMatches = false;
    if (typeof aud === 'string') {
      audMatches = allowedAudiences.includes(aud);
    } else if (Array.isArray(aud)) {
      audMatches = aud.some((a) => allowedAudiences.includes(a));
    }
    if (!audMatches) {
      return {
        valid: false,
        reason: 'INVALID_AUDIENCE',
        message: `Token audience is not in allowed audiences list`,
        expired: false,
      };
    }

    // Verify Essential Claims
    const claimsValidation = validateEssentialClaims(rawPayload as Record<string, unknown>);
    if (!claimsValidation.valid || !claimsValidation.payload) {
      return {
        valid: false,
        reason: 'MISSING_CLAIMS',
        message: claimsValidation.message ?? 'Essential claims validation failed',
        expired: false,
      };
    }

    return {
      valid: true,
      payload: claimsValidation.payload,
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return {
        valid: false,
        reason: 'EXPIRED',
        message: 'Token has expired',
        expired: true,
      };
    }

    if (error instanceof errors.JWSSignatureVerificationFailed) {
      return {
        valid: false,
        reason: 'INVALID_SIGNATURE',
        message: 'Token signature verification failed',
        expired: false,
      };
    }

    if (error instanceof errors.JWTClaimValidationFailed) {
      if (error.claim === 'iss') {
        return {
          valid: false,
          reason: 'INVALID_ISSUER',
          message: 'Token issuer validation failed',
          expired: false,
        };
      }
      if (error.claim === 'aud') {
        return {
          valid: false,
          reason: 'INVALID_AUDIENCE',
          message: 'Token audience validation failed',
          expired: false,
        };
      }
      return {
        valid: false,
        reason: 'MALFORMED',
        message: `Token claim validation failed for "${error.claim}"`,
        expired: false,
      };
    }

    if (error instanceof errors.JWSInvalid || error instanceof errors.JWTInvalid) {
      return {
        valid: false,
        reason: 'MALFORMED',
        message: 'Token format is invalid or corrupted',
        expired: false,
      };
    }

    return {
      valid: false,
      reason: 'UNKNOWN',
      message: 'Token verification failed unexpectedly',
      expired: false,
    };
  }
}

/**
 * Decodes an access token without cryptographic signature verification.
 * Useful for Edge middleware or fast unverified claim checks where
 * upstream or serverApiRequest will be the authoritative boundary.
 */
export function decodeAccessTokenUnverified(token: string): AccessTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  try {
    const raw = decodeJwt(token.trim()) as Record<string, unknown>;
    const validated = validateEssentialClaims(raw);
    return validated.valid && validated.payload ? validated.payload : null;
  } catch {
    return null;
  }
}

/**
 * Checks whether a token or payload is expired, with an optional advisory buffer.
 * For example, bufferSeconds=30 returns true if token expires within 30 seconds.
 */
export function isTokenExpired(
  tokenOrPayload: string | AccessTokenPayload,
  bufferSeconds: number = 0
): boolean {
  let exp: number | undefined;

  if (typeof tokenOrPayload === 'string') {
    const payload = decodeAccessTokenUnverified(tokenOrPayload);
    exp = payload?.exp;
  } else {
    exp = tokenOrPayload.exp;
  }

  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return true; // Malformed/missing exp is treated as expired
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= exp - bufferSeconds;
}

/**
 * Maps AccessTokenPayload to the standardized AuthClaims contract.
 */
export function toAuthClaims(payload: AccessTokenPayload): AuthClaims {
  const numericSub =
    typeof payload.sub === 'number'
      ? payload.sub
      : parseInt(String(payload.sub), 10) || 0;

  return {
    sub: numericSub,
    sid: payload.sid ?? '',
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: Boolean(payload.emailVerified),
    phoneVerified: Boolean(payload.phoneVerified),
    roles: payload.roles,
    mfaAt: typeof payload.mfaAt === 'number' ? payload.mfaAt : undefined,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    exp: payload.exp,
    iss: typeof payload.iss === 'string' ? payload.iss : undefined,
    aud: payload.aud,
  };
}

/**
 * Signs a test or mock access token (primarily used in testing and fixtures).
 */
export async function signAccessToken(
  claims: Record<string, unknown> = {},
  options: JwtSignOptions = {}
): Promise<string> {
  const secretKey = getSecretKey(options.secret);
  const issuer = options.issuer ?? serverEnv.JWT_ISSUER ?? 'arabiyatmart-api';
  const audience = options.audience ?? serverEnv.JWT_AUDIENCE ?? 'arabiyatmart-mobile';
  const expiresIn = options.expiresIn ?? '15m';

  const defaultClaims = {
    sub: '1',
    roles: ['CUSTOMER'],
    emailVerified: false,
    phoneVerified: false,
    sid: 'test_session_id',
  };

  const payload = {
    ...defaultClaims,
    ...claims,
  };

  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience);

  if (typeof expiresIn === 'number') {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn);
  } else {
    builder.setExpirationTime(expiresIn);
  }

  return builder.sign(secretKey);
}
