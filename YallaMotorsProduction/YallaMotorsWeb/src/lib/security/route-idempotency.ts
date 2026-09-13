import 'server-only';

import { decodeJwt } from 'jose';
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { getOrCreateRequestId } from '@/lib/api/request-id';
import { getCredentialsFromCookies } from '@/lib/auth/cookies';
import { OperationErrorSchema } from '@/lib/api/schemas/common';
import {
  computeCanonicalRequestHash,
  finalizeIdempotency,
  getUserOrAnonymousFingerprint,
  releaseIdempotency,
  reserveIdempotency,
} from '@/lib/security/idempotency';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function requireIdempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value) {
    throw new ApiContractError(createOperationError({
      status: 400,
      code: 'MISSING_IDEMPOTENCY_KEY',
      message: 'An Idempotency-Key header is required',
    }));
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new ApiContractError(createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Idempotency-Key must be 8–128 safe ASCII characters',
    }));
  }
  return value;
}

function requestFingerprint(request: Request): string {
  const { accessToken } = getCredentialsFromCookies(request.headers);
  if (accessToken) {
    try {
      const subject = decodeJwt(accessToken).sub;
      if (subject !== undefined && subject !== null) {
        return getUserOrAnonymousFingerprint({ sub: String(subject) }, request.headers);
      }
    } catch {
      return `session:${crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 32)}`;
    }
  }
  return getUserOrAnonymousFingerprint(null, request.headers);
}

export async function executeIdempotentRoute(options: {
  request: Request;
  operation: string;
  canonicalBody: unknown;
  execute: (idempotencyKey: string) => Promise<Response>;
}): Promise<Response> {
  const { request, operation, canonicalBody } = options;
  const idempotencyKey = requireIdempotencyKey(request);
  const requestId = getOrCreateRequestId(request.headers);
  const url = new URL(request.url);
  const query = Object.fromEntries([...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const requestHash = computeCanonicalRequestHash(request.method, url.pathname, query, canonicalBody);
  let reservation;
  try {
    reservation = await reserveIdempotency({
      fingerprint: requestFingerprint(request), operation, idempotencyKey, requestHash, requestId,
    });
  } catch (error) {
    const parsed = OperationErrorSchema.safeParse(error);
    if (parsed.success) throw new ApiContractError(parsed.data);
    throw error;
  }

  if (reservation.action === 'conflict') {
    return NextResponse.json(reservation.error, {
      status: 409,
      headers: { 'Cache-Control': 'private, no-store', 'x-request-id': requestId },
    });
  }
  if (reservation.action === 'replay') {
    return NextResponse.json(reservation.response.body, {
      status: reservation.response.status,
      headers: {
        ...reservation.response.headers,
        'Cache-Control': 'private, no-store',
        'x-idempotent-replay': 'true',
      },
    });
  }

  try {
    const response = await options.execute(idempotencyKey);
    if (response.status >= 500) {
      await releaseIdempotency({ key: reservation.key, ownerToken: reservation.ownerToken });
      return response;
    }
    const clone = response.clone();
    const body = await clone.json() as unknown;
    await finalizeIdempotency({
      key: reservation.key,
      ownerToken: reservation.ownerToken,
      response: {
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type') ?? 'application/json',
          'cache-control': 'private, no-store',
        },
        body,
      },
    });
    return response;
  } catch (error) {
    await releaseIdempotency({ key: reservation.key, ownerToken: reservation.ownerToken });
    throw error;
  }
}
