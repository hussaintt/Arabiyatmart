/**
 * Edge-safe JWT verification primitives for middleware and Edge runtime.
 * Implements Phase 2 Task 2.1:
 * - Algorithmic enforcement: strictly HS256; rejects alg:none, RS256, etc.
 * - Signature verification using jose.
 * - Issuer validation: allows 'arabiyatmart-api', 'arabiyatmart-backend', or configured JWT_ISSUER.
 * - Audience validation: strictly allows 'arabiyatmart-mobile', 'arabiyatmart-web', or configured JWT_AUDIENCE.
 * - Expiry validation with 5-second clock tolerance.
 * - Essential claims validation: sub, roles, emailVerified, phoneVerified, exp.
 * - Safe for Next.js middleware (no server-only imports or Node built-in dependencies).
 */

import { jwtVerify, decodeProtectedHeader, errors } from 'jose';

export const ALLOWED_JWT_ALGORITHMS = ['HS256'] as const;

export const DEFAULT_ALLOWED_ISSUERS = [
  'arabiyatmart-api',
  'arabiyatmart-backend',
] as const;

export const DEFAULT_ALLOWED_AUDIENCES = [
  'arabiyatmart-mobile',
  'arabiyatmart-web',
] as const;

export const DEVELOPMENT_JWT_ACCESS_SECRET =
  'development-jwt-access-secret-32-chars-long-placeholder';

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

function getSecretKey(secret?: string): Uint8Array {
  const raw =
    secret ??
    process.env.JWT_ACCESS_SECRET ??
    DEVELOPMENT_JWT_ACCESS_SECRET;
  return new TextEncoder().encode(raw);
}

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
 * Verifies an access token using Edge-safe jose library.
 * Can be safely called in Next.js middleware, Edge runtime, or Node.js runtime.
 */
export async function verifyAccessTokenEdge(
  token: string | null | undefined,
  options: JwtVerifyOptions = {}
): Promise<JwtVerifyResult> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      reason: 'MALFORMED',
      message: 'Token must be a non-empty string',
      expired: false,
    };
  }

  const cleanToken = token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      reason: 'MALFORMED',
      message: `Invalid JWT format: expected 3 dot-separated segments, got ${parts.length}`,
      expired: false,
    };
  }

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
    ...(process.env.JWT_ISSUER ? [process.env.JWT_ISSUER] : []),
  ];
  const allowedAudiences = options.allowedAudiences ?? [
    ...DEFAULT_ALLOWED_AUDIENCES,
    ...(process.env.JWT_AUDIENCE ? [process.env.JWT_AUDIENCE] : []),
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
        message: 'Token audience is not in allowed audiences list',
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
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      return {
        valid: false,
        reason: 'EXPIRED',
        message: 'Access token has expired',
        expired: true,
      };
    }

    if (err instanceof errors.JWSSignatureVerificationFailed) {
      return {
        valid: false,
        reason: 'INVALID_SIGNATURE',
        message: 'Signature verification failed',
        expired: false,
      };
    }

    if (err instanceof errors.JWTClaimValidationFailed) {
      const isExpClaim = err.claim === 'exp';
      return {
        valid: false,
        reason: isExpClaim ? 'EXPIRED' : 'MISSING_CLAIMS',
        message: `Claim validation failed: ${err.message}`,
        expired: isExpClaim,
      };
    }

    return {
      valid: false,
      reason: 'MALFORMED',
      message: 'Token verification failed',
      expired: false,
    };
  }
}
