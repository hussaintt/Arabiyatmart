import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  matchBffOperation,
  type BffOperationDefinition,
  type BffPathContext,
} from '@/lib/security/bff-allowlist';
import {
  reserveIdempotency,
  finalizeIdempotency,
  releaseIdempotency,
  getUserOrAnonymousFingerprint,
  computeCanonicalRequestHash,
} from '@/lib/security/idempotency';
import {
  serverApiRequest,
  ApiContractError,
} from '@/lib/api/server';
import {
  createOperationError,
  normalizeOperationError,
} from '@/lib/api/error';
import {
  getOrCreateRequestId,
  isValidRequestId,
  REQUEST_ID_HEADER,
} from '@/lib/api/request-id';
import {
  validateMutationCsrf,
  rotateCsrfToken,
  isSafeHttpMethod,
} from '@/lib/auth/csrf';
import {
  getCredentialsFromCookies,
  getVendorFromCookies,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth/cookies';
import {
  executeWithAuthRetry,
  AuthRefreshError,
} from '@/lib/auth/refresh';
import {
  buildCacheControlHeader,
  normalizePublicCachePayload,
  type CachePolicy,
} from '@/lib/cache/policy';
import { decodeJwt } from 'jose';
import { logSafeEvent } from '@/lib/observability/logger';

export interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

/**
 * Intelligent query parameters extractor and coercer.
 * Normalizes numbers, booleans, and comma-delimited/repeated lists according to query schema.
 */
function parseQueryParams(
  searchParams: URLSearchParams,
  querySchema?: z.ZodTypeAny
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(searchParams.keys())) {
    const allValues = searchParams.getAll(key);
    if (allValues.length > 1) {
      raw[key] = allValues;
    } else {
      raw[key] = allValues[0] ?? '';
    }
  }

  if (!querySchema) {
    return raw;
  }

  // 1. Direct validation attempt
  const firstTry = querySchema.safeParse(raw);
  if (firstTry.success) {
    return firstTry.data as Record<string, unknown>;
  }

  // 2. Coerce string numbers, booleans, and comma-separated values
  const coerced: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'string') {
      if (val === 'true') {
        coerced[key] = true;
      } else if (val === 'false') {
        coerced[key] = false;
      } else if (/^-?\d+$/.test(val) && Number.isSafeInteger(Number(val))) {
        coerced[key] = Number(val);
      } else if (val.includes(',')) {
        coerced[key] = val.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        coerced[key] = val;
      }
    } else {
      coerced[key] = val;
    }
  }

  const secondTry = querySchema.safeParse(coerced);
  if (secondTry.success) {
    return secondTry.data as Record<string, unknown>;
  }

  // 3. Coerce single values to single-item arrays if schema expects array
  const thirdCoerced = { ...coerced };
  for (const [k, v] of Object.entries(thirdCoerced)) {
    if (typeof v === 'string' && !Array.isArray(v)) {
      thirdCoerced[k] = [v];
    }
  }
  const thirdTry = querySchema.safeParse(thirdCoerced);
  if (thirdTry.success) {
    return thirdTry.data as Record<string, unknown>;
  }

  return coerced;
}

/**
 * Universal BFF Request Gateway and Dispatcher.
 *
 * Implements TASK-017, Phase 1 Section 1.4/2.6, and Phase 2 Sections 3.1-3.8:
 * - ERR-01: Normalized OperationError on every failure without leaking stacks, SQL, or internal details.
 * - OUT-01: Adapts raw upstream bodies and validates output against Phase 2 schemas.
 * - IDEM-01: 24h idempotency store keyed by fingerprint, operation, and key. Replays match; differences 409.
 * - CACHE-01: Forces isFavorited:false on shared public cached reads; strictly isolates user sessions.
 * - OBS-01: Preserves and propagates X-Request-Id; logs only requestId, operation, status, duration.
 */
async function handleBffRequest(
  request: Request,
  context?: RouteContext
): Promise<Response> {
  const startTime = Date.now();

  // 1. Establish Request ID (OBS-01)
  const incomingRequestId =
    request.headers.get(REQUEST_ID_HEADER) ??
    request.headers.get('x-request-id');
  const requestId =
    incomingRequestId && isValidRequestId(incomingRequestId)
      ? incomingRequestId.trim()
      : getOrCreateRequestId();

  // 2. Resolve Path and Validate Against Path Smuggling / Traversal
  let pathname: string;
  let rawUrlPath: string;
  try {
    const url = new URL(request.url);
    rawUrlPath = url.pathname;
    pathname = rawUrlPath;
  } catch {
    const opError = createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid request URL',
      requestId,
    });
    return NextResponse.json(opError, {
      status: 400,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });
  }

  // Extract params if present
  let resolvedParams: { path?: string[] } | undefined;
  if (context?.params) {
    try {
      resolvedParams = await Promise.resolve(context.params);
    } catch {
      // Ignored
    }
  }

  if (resolvedParams?.path && Array.isArray(resolvedParams.path)) {
    for (const segment of resolvedParams.path) {
      if (
        segment === '..' ||
        segment === '.' ||
        segment.includes('\\') ||
        /%(?:2f|5c|2e|00|23|3f)/i.test(segment)
      ) {
        const opError = createOperationError({
          status: 400,
          code: 'BAD_REQUEST',
          message: 'Directory traversal or invalid path segment strictly forbidden',
          requestId,
        });
        return NextResponse.json(opError, {
          status: 400,
          headers: { [REQUEST_ID_HEADER]: requestId },
        });
      }
    }

    if (!pathname.startsWith('/api/bff')) {
      pathname = `/api/bff/${resolvedParams.path.join('/')}`;
    }
  }

  // 3. Match against Strict Allowlist & Perform Security Checks
  const matchResult = matchBffOperation(request.method, pathname);

  if (matchResult.type === 'security_violation') {
    const durationMs = Date.now() - startTime;
    logSafeEvent({ level: 'warn', requestId, operation: 'security_violation', status: matchResult.status, durationMs, routeTemplate: '/api/bff/[...path]' });
    const opError = createOperationError({
      status: matchResult.status,
      code: matchResult.status === 400 ? 'BAD_REQUEST' : 'NOT_FOUND',
      message: matchResult.reason,
      requestId,
    });
    return NextResponse.json(opError, {
      status: matchResult.status,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });
  }

  if (matchResult.type === 'not_found') {
    const durationMs = Date.now() - startTime;
    logSafeEvent({ level: 'info', requestId, operation: 'not_found', status: 404, durationMs, routeTemplate: '/api/bff/[...path]' });
    const opError = createOperationError({
      status: 404,
      code: 'NOT_FOUND',
      message: matchResult.reason,
      requestId,
    });
    return NextResponse.json(opError, {
      status: 404,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });
  }

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    const allowed =
      matchResult.type === 'method_not_allowed'
        ? matchResult.allowedMethods
        : matchResult.type === 'matched'
          ? [matchResult.operation.method]
          : [];
    const allowHeader = Array.from(new Set([...allowed, 'HEAD', 'OPTIONS'])).join(', ');
    return new Response(null, {
      status: 204,
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        Allow: allowHeader,
        'Access-Control-Allow-Methods': allowHeader,
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, Idempotency-Key, X-Request-Id',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  if (matchResult.type === 'method_not_allowed') {
    const durationMs = Date.now() - startTime;
    logSafeEvent({ level: 'info', requestId, operation: 'method_not_allowed', status: 405, durationMs, routeTemplate: '/api/bff/[...path]' });
    const opError = createOperationError({
      status: 400,
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${request.method} not allowed for path "${pathname}"`,
      requestId,
    });
    return NextResponse.json(opError, {
      status: 405,
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        Allow: matchResult.allowedMethods.join(', '),
      },
    });
  }

  const operation: BffOperationDefinition = matchResult.operation;
  const pathParams: Record<string, string> = matchResult.pathParams;

  // 4. Validate CSRF for State-Changing Mutations (M, U)
  if (!isSafeHttpMethod(request.method) || operation.authMode === 'M' || operation.authMode === 'U') {
    const csrfResult = validateMutationCsrf({
      method: request.method,
      headers: request.headers,
      cookies: request.headers,
    });

    if (!csrfResult.valid) {
      const durationMs = Date.now() - startTime;
      logSafeEvent({ level: 'warn', requestId, operation: operation.operation, status: 403, durationMs, routeTemplate: operation.pathTemplate });
      const opError = createOperationError({
        status: 403,
        code: 'FORBIDDEN',
        message: csrfResult.reason ?? 'CSRF or origin validation failed',
        requestId,
      });
      return NextResponse.json(opError, {
        status: 403,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }
  }

  // 5. Enforce Payload Size Limit
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > operation.maxBodySizeBytes) {
      const opError = createOperationError({
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `Payload exceeds maximum allowed size of ${operation.maxBodySizeBytes} bytes`,
        requestId,
      });
      return NextResponse.json(opError, {
        status: 413,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }
  }

  // 6. Validate Path Parameters Schema
  if (operation.pathParamsSchema) {
    const parsedPath = operation.pathParamsSchema.safeParse(pathParams);
    if (!parsedPath.success) {
      const fieldErrors = parsedPath.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'path',
        code: issue.code,
        message: issue.message,
      }));
      const opError = createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid path parameters',
        requestId,
        fieldErrors,
      });
      return NextResponse.json(opError, {
        status: 400,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }
  }

  // 7. Parse and Validate Query Parameters
  const url = new URL(request.url);
  let query = parseQueryParams(url.searchParams, operation.querySchema);
  if (operation.querySchema) {
    const parsedQuery = operation.querySchema.safeParse(query);
    if (!parsedQuery.success) {
      const fieldErrors = parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        code: issue.code,
        message: issue.message,
      }));
      const opError = createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        requestId,
        fieldErrors,
      });
      return NextResponse.json(opError, {
        status: 400,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }
    query = parsedQuery.data as Record<string, unknown>;
  }

  // 8. Parse and Validate Request Body
  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (operation.authMode === 'U') {
      try {
        body = await request.formData();
      } catch {
        const opError = createOperationError({
          status: 400,
          code: 'BAD_REQUEST',
          message: 'Malformed multipart form data payload',
          requestId,
        });
        return NextResponse.json(opError, {
          status: 400,
          headers: { [REQUEST_ID_HEADER]: requestId },
        });
      }
    } else {
      const rawText = await request.text();
      if (rawText.trim().length > 0) {
        try {
          body = JSON.parse(rawText);
        } catch {
          const opError = createOperationError({
            status: 400,
            code: 'BAD_REQUEST',
            message: 'Malformed JSON payload',
            requestId,
          });
          return NextResponse.json(opError, {
            status: 400,
            headers: { [REQUEST_ID_HEADER]: requestId },
          });
        }
      }
    }

    if (operation.bodySchema) {
      const parsedBody = operation.bodySchema.safeParse(body);
      if (!parsedBody.success) {
        const fieldErrors = parsedBody.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          code: issue.code,
          message: issue.message,
        }));
        const opError = createOperationError({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          requestId,
          fieldErrors,
        });
        return NextResponse.json(opError, {
          status: 400,
          headers: { [REQUEST_ID_HEADER]: requestId },
        });
      }
      body = parsedBody.data;
    }
  }

  // 9. Extract Credentials & Identity
  const { accessToken, refreshToken } = getCredentialsFromCookies(request.headers);
  // Vendor scope is server-owned. Browser headers/query parameters can never
  // select an authorization scope; the upstream performs membership checks.
  const vendorPublicId = getVendorFromCookies(request.headers);

  let userClaimsSub: string | undefined;
  if (accessToken) {
    try {
      const decoded = decodeJwt(accessToken);
      if (decoded.sub) {
        userClaimsSub = String(decoded.sub);
      }
    } catch {
      // Ignored; falls back to anonymous fingerprint
    }
  }

  const isAuthenticated = Boolean(accessToken || userClaimsSub);
  const fingerprint = getUserOrAnonymousFingerprint(
    userClaimsSub ? { sub: userClaimsSub } : null,
    request.headers
  );

  // 10. Atomic Idempotency Reservation (IDEM-01)
  const idempotencyKey =
    request.headers.get('idempotency-key') ??
    request.headers.get('x-idempotency-key');

  let reservedIdem: { key: string; ownerToken: string } | null = null;

  if (operation.requiresIdempotency) {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      const opError = createOperationError({
        status: 400,
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: `Operation "${operation.operation}" requires an Idempotency-Key header`,
        requestId,
      });
      return NextResponse.json(opError, {
        status: 400,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }

    const requestHash = computeCanonicalRequestHash(request.method, pathname, query, body);
    const idemResult = await reserveIdempotency({
      fingerprint,
      operation: operation.operation,
      idempotencyKey: idempotencyKey.trim(),
      requestHash,
      requestId,
    });

    if (idemResult.action === 'replay') {
      const durationMs = Date.now() - startTime;
      logSafeEvent({ level: 'info', requestId, operation: operation.operation, status: idemResult.response.status, durationMs, routeTemplate: operation.pathTemplate });
      return NextResponse.json(idemResult.response.body, {
        status: idemResult.response.status,
        headers: {
          ...idemResult.response.headers,
          [REQUEST_ID_HEADER]: requestId,
          'X-Idempotent-Replay': 'true',
        },
      });
    }

    if (idemResult.action === 'conflict') {
      const durationMs = Date.now() - startTime;
      logSafeEvent({ level: 'warn', requestId, operation: operation.operation, status: 409, durationMs, routeTemplate: operation.pathTemplate });
      return NextResponse.json(idemResult.error, {
        status: 409,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }

    reservedIdem = { key: idemResult.key, ownerToken: idemResult.ownerToken };
  }

  try {
    // 11. Handle Anonymous getSession Fast-Path
    if (operation.operation === 'getSession' && !accessToken && !refreshToken) {
      const durationMs = Date.now() - startTime;
      logSafeEvent({ level: 'info', requestId, operation: 'getSession', status: 200, durationMs, routeTemplate: operation.pathTemplate });
      return NextResponse.json(
        { data: null },
        {
          status: 200,
          headers: {
            [REQUEST_ID_HEADER]: requestId,
            'Cache-Control': 'private, no-store',
          },
        }
      );
    }

    // 12. Check Authentication Requirement for Protected Operations (S, M, U)
    if ((operation.authMode === 'S' || operation.authMode === 'M' || operation.authMode === 'U') &&
        !accessToken && !refreshToken) {
      const durationMs = Date.now() - startTime;
      logSafeEvent({ level: 'warn', requestId, operation: operation.operation, status: 401, durationMs, routeTemplate: operation.pathTemplate });
      const opError = createOperationError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication credentials required',
        requestId,
      });
      return NextResponse.json(opError, {
        status: 401,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }

    // 13. Construct Upstream Path and Cache Policy Context
    const bffContext: BffPathContext = {
      pathParams,
      query,
      body,
      vendorPublicId,
      isPersonalized: isAuthenticated,
    };

    let upstreamPath: string;
    let upstreamQuery: Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>> | undefined;
    try {
      upstreamPath = operation.buildUpstreamPath(bffContext);
      upstreamQuery = operation.buildUpstreamQuery
        ? operation.buildUpstreamQuery(bffContext)
        : query as Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>>;
    } catch (pathErr) {
      const durationMs = Date.now() - startTime;
      logSafeEvent({ level: 'warn', requestId, operation: operation.operation, status: 400, durationMs, routeTemplate: operation.pathTemplate });
      const opError = createOperationError({
        status: 400,
        code: 'BAD_REQUEST',
        message: pathErr instanceof Error ? pathErr.message : 'Invalid parameters for upstream path',
        requestId,
      });
      return NextResponse.json(opError, {
        status: 400,
        headers: { [REQUEST_ID_HEADER]: requestId },
      });
    }

    const effectiveCachePolicy: CachePolicy =
      typeof operation.cachePolicy === 'function'
        ? operation.cachePolicy(bffContext)
        : operation.cachePolicy;

    // 14. Forwarding Headers Configuration (Strict Zero-Leakage)
    const forwardHeaders: Record<string, string> = {
      [REQUEST_ID_HEADER]: requestId,
    };
    const clientLocale =
      request.headers.get('accept-language') ??
      request.headers.get('x-locale');
    if (clientLocale) {
      forwardHeaders['Accept-Language'] = clientLocale.split(',')[0]?.trim() ?? 'ar';
    }

    // 15. Upstream Execution via executeWithAuthRetry and serverApiRequest
    const responseHeaders = new Headers();
    let upstreamResult: unknown;

    try {
      if (operation.authMode === 'S' || operation.authMode === 'M' || operation.authMode === 'U' || (operation.authMode === 'O' && (accessToken || refreshToken))) {
        upstreamResult = await executeWithAuthRetry({
          accessToken,
          refreshToken,
          operation: async (tokenToUse) => {
            return await serverApiRequest({
              operation: operation.operation,
              method: operation.method,
              endpoint: () => upstreamPath,
              input: body,
              query: upstreamQuery,
              outputSchema: operation.outputSchema,
              authMode: operation.authMode,
              cachePolicy: effectiveCachePolicy,
              requestId,
              timeoutMs: operation.timeoutMs,
              credentialResolver: () => tokenToUse,
              adapter: operation.adapter ?? undefined,
              headers: forwardHeaders,
              signal: request.signal,
            });
          },
          onTokensRefreshed: (tokens) => {
            setAuthCookies(responseHeaders, tokens);
            rotateCsrfToken(responseHeaders);
          },
          onAuthFailed: () => {
            clearAuthCookies(responseHeaders);
          },
        });
      } else {
        upstreamResult = await serverApiRequest({
          operation: operation.operation,
          method: operation.method,
          endpoint: () => upstreamPath,
          input: body,
          query: upstreamQuery,
          outputSchema: operation.outputSchema,
          authMode: operation.authMode,
          cachePolicy: effectiveCachePolicy,
          requestId,
          timeoutMs: operation.timeoutMs,
          adapter: operation.adapter ?? undefined,
          headers: forwardHeaders,
          signal: request.signal,
        });
      }
    } catch (execError: unknown) {
      const durationMs = Date.now() - startTime;

      if (execError instanceof ApiContractError) {
        logSafeEvent({ level: 'warn', requestId, operation: operation.operation, status: execError.body.error.status, durationMs, routeTemplate: operation.pathTemplate });
        responseHeaders.set(REQUEST_ID_HEADER, requestId);
        return NextResponse.json(execError.body, {
          status: execError.body.error.status,
          headers: responseHeaders,
        });
      }

      if (execError instanceof AuthRefreshError) {
        logSafeEvent({ level: 'warn', requestId, operation: operation.operation, status: execError.status, durationMs, routeTemplate: operation.pathTemplate });
        const opError = createOperationError({
          status: execError.status === 504 ? 504 : 401,
          code: execError.status === 504 ? 'GATEWAY_TIMEOUT' : 'UNAUTHORIZED',
          message: execError.message,
          requestId,
        });
        responseHeaders.set(REQUEST_ID_HEADER, requestId);
        return NextResponse.json(opError, {
          status: opError.error.status,
          headers: responseHeaders,
        });
      }

      logSafeEvent({ level: 'error', requestId, operation: operation.operation, status: 500, durationMs, routeTemplate: operation.pathTemplate });
      const opError = await normalizeOperationError(execError, requestId);
      responseHeaders.set(REQUEST_ID_HEADER, requestId);
      return NextResponse.json(opError, {
        status: opError.error.status,
        headers: responseHeaders,
      });
    }

    // 16. Apply CACHE-01 Guest-Safe Normalization for Anonymous Public Reads
    let finalData = upstreamResult;
    if (!isAuthenticated && !effectiveCachePolicy.isPrivate) {
      finalData = normalizePublicCachePayload(upstreamResult);
    }

    // 17. Formulate Final Response Headers
    const cacheControl = buildCacheControlHeader(effectiveCachePolicy);
    responseHeaders.set('Cache-Control', cacheControl);
    responseHeaders.set(REQUEST_ID_HEADER, requestId);

    const successStatus = operation.successStatus ?? 200;

    // 18. Persist Idempotent Response if Required (IDEM-01)
    if (reservedIdem) {
      const headersToPersist: Record<string, string> = {
        'Cache-Control': cacheControl,
      };
      await finalizeIdempotency({
        key: reservedIdem.key,
        ownerToken: reservedIdem.ownerToken,
        response: {
          status: successStatus,
          headers: headersToPersist,
          body: finalData,
        },
      });
      reservedIdem = null;
    }

    const durationMs = Date.now() - startTime;
    logSafeEvent({ level: 'info', requestId, operation: operation.operation, status: successStatus, durationMs, routeTemplate: operation.pathTemplate });

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: successStatus,
        headers: responseHeaders,
      });
    }

    return NextResponse.json(finalData, {
      status: successStatus,
      headers: responseHeaders,
    });
  } finally {
    if (reservedIdem) {
      await releaseIdempotency({
        key: reservedIdem.key,
        ownerToken: reservedIdem.ownerToken,
      }).catch(() => {});
    }
  }
}

// ── Next.js App Router HTTP Method Exports ───────────────────────────────────

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}

export async function OPTIONS(request: Request, context: RouteContext): Promise<Response> {
  return handleBffRequest(request, context);
}
