import 'server-only';

/**
 * Server-Only Upstream API Client for Fastify API.
 *
 * Implements Phase 1 Section 2.6/3.1 and Phase 2 Section 3.1/3.8:
 * - Direct validated gateway to upstream Fastify API.
 * - Enforces strict server-only execution; never exposed to browser bundles.
 * - Builds URLs strictly through the TASK-011 UPSTREAM_ENDPOINTS registry; rejects SSRF/protocol-relative paths.
 * - Validates input and output schemas with Zod (validates inputSchema even when input is undefined).
 * - Supports auth profiles: P (public), O (optional), S (protected read), M (mutation), U (upload).
 * - Enforces server-only credential resolution for bearer tokens (caller custom headers can never inject Authorization).
 * - Enforces response size limits and timeouts (10s read, 20s mutation, 60s upload).
 * - Aborts on timeout or client disconnect; maps all non-2xx via normalizeOperationError.
 * - Handles 202/204 acknowledgements, bare arrays, and raw-to-normalized adapters (catching adapter failures as 502).
 * - Recognizes application/json and application/*+json media types.
 * - On contract mismatch, logs operation/requestId/issuePaths only and returns 502 UPSTREAM_CONTRACT_MISMATCH.
 */

import { z } from 'zod';
import { serverEnv } from '@/lib/env/server';
import {
  isAllowedUpstreamEndpoint,
} from '@/lib/api/endpoints';
import {
  getOrCreateRequestId,
  isValidRequestId,
  REQUEST_ID_HEADER,
} from '@/lib/api/request-id';
import {
  createOperationError,
  normalizeOperationError,
  ApiContractError,
} from '@/lib/api/error';
import type { CachePolicy } from '@/lib/cache/policy';
import type { OperationError } from '@/types/common';
import { adapt204Acknowledgement } from './adapters';
import { logSafeEvent } from '@/lib/observability/logger';

export { ApiContractError };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
export type AuthMode = 'P' | 'O' | 'S' | 'M' | 'U';

export type UpstreamEndpointBuilder = () => string;

/**
 * Server-only credential resolver function signature.
 * Used to retrieve bearer access tokens from server cookie/session primitives in TASK-014.
 */
export type ServerCredentialResolver = () =>
  | Promise<string | null | undefined>
  | string
  | null
  | undefined;

let globalServerCredentialResolver: ServerCredentialResolver | null = null;

/**
 * Configures the server-only credential resolver (used by auth/session primitives in TASK-014).
 */
export function setServerCredentialResolver(
  resolver: ServerCredentialResolver | null
): void {
  globalServerCredentialResolver = resolver;
}

/**
 * Retrieves the current server credential resolver.
 */
export function getServerCredentialResolver(): ServerCredentialResolver | null {
  return globalServerCredentialResolver;
}

/**
 * Checks if a Content-Type header represents a JSON media type:
 * matches 'application/json' or 'application/*+json' (e.g. application/problem+json, application/vnd.api+json).
 */
export function isJsonContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return /^application\/(?:[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+\+)?json(?:\s*;.*)?$/i.test(
    contentType.trim()
  );
}

/**
 * Default timeouts in milliseconds according to Phase 2 Section 3.1:
 * - 10-second read timeout
 * - 20-second mutation timeout
 * - 60-second multipart upload timeout
 */
export const DEFAULT_TIMEOUTS: Record<AuthMode, number> = {
  P: 10_000,
  O: 10_000,
  S: 10_000,
  M: 20_000,
  U: 60_000,
};

/**
 * Default maximum upstream response size: 10 MB.
 */
export const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024;

export interface ServerApiRequestOptions<TInput = unknown, TOutput = unknown> {
  readonly operation: string;
  readonly method: HttpMethod;
  readonly endpoint: UpstreamEndpointBuilder;
  readonly inputSchema?: z.ZodType<TInput> | undefined;
  readonly input?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>> | undefined;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly authMode: AuthMode;
  readonly cachePolicy?: CachePolicy | undefined;
  readonly requestId?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly timeout?: number | undefined;
  readonly locale?: 'ar' | 'en' | string | undefined;
  readonly credentialResolver?: ServerCredentialResolver | undefined;
  readonly idempotencyKey?: string | null | undefined;
  readonly adapter?: ((raw: unknown) => unknown) | undefined;
  readonly maxResponseSizeBytes?: number | undefined;
  readonly headers?: Record<string, string | undefined> | Headers | undefined;
  readonly signal?: AbortSignal | undefined;
}

export type ServerApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OperationError['error'] };

/**
 * Generic server-only API request gateway.
 */
export function serverApiRequest<TInput = unknown, TOutput = unknown>(
  options: ServerApiRequestOptions<TInput, TOutput>
): Promise<TOutput>;
export function serverApiRequest<TInput = unknown, TOutput = unknown>(
  operation: string,
  method: HttpMethod,
  endpoint: UpstreamEndpointBuilder,
  inputSchema: z.ZodType<TInput> | undefined,
  outputSchema: z.ZodType<TOutput>,
  authMode: AuthMode,
  cachePolicy?: CachePolicy,
  requestId?: string,
  timeout?: number
): Promise<TOutput>;
export async function serverApiRequest<TInput = unknown, TOutput = unknown>(
  optionsOrOperation: ServerApiRequestOptions<TInput, TOutput> | string,
  ...rest: unknown[]
): Promise<TOutput> {
  const options: ServerApiRequestOptions<TInput, TOutput> =
    typeof optionsOrOperation === 'string'
      ? {
          operation: optionsOrOperation,
          method: rest[0] as HttpMethod,
          endpoint: rest[1] as UpstreamEndpointBuilder,
          inputSchema: rest[2] as z.ZodType<TInput> | undefined,
          outputSchema: rest[3] as z.ZodType<TOutput>,
          authMode: rest[4] as AuthMode,
          cachePolicy: rest[5] as CachePolicy | undefined,
          requestId: rest[6] as string | undefined,
          timeout: rest[7] as number | undefined,
        }
      : optionsOrOperation;

  const {
    operation,
    method,
    endpoint,
    inputSchema,
    input,
    outputSchema,
    authMode,
    cachePolicy,
    locale = 'ar',
    credentialResolver,
    idempotencyKey,
    adapter,
  } = options;

  // 1. Establish validated Request ID
  const requestId =
    options.requestId && isValidRequestId(options.requestId)
      ? options.requestId.trim()
      : getOrCreateRequestId();

  // 2. Validate Endpoint strictly through TASK-011 registry builder & prevent SSRF
  if (typeof endpoint !== 'function') {
    const opError = createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid endpoint: endpoint must be a builder function from UPSTREAM_ENDPOINTS registry',
      requestId,
      details: {
        operation,
        reason: 'direct strings and non-builder endpoints are strictly forbidden',
      },
    });
    throw new ApiContractError(opError);
  }

  let rawPath: string;
  try {
    rawPath = endpoint();
  } catch {
    const opError = createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Endpoint builder evaluation failed',
      requestId,
      details: { operation },
    });
    throw new ApiContractError(opError);
  }

  if (!rawPath || typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    const opError = createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Endpoint builder returned invalid empty path',
      requestId,
      details: { operation },
    });
    throw new ApiContractError(opError);
  }

  // Reject protocol-relative URLs (//) and absolute URLs (://) immediately to prevent SSRF
  if (rawPath.startsWith('//') || rawPath.includes('://')) {
    const opError = createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Disallowed protocol-relative or absolute URL endpoint',
      requestId,
      details: {
        operation,
        reason: 'protocol-relative and absolute URLs are strictly forbidden',
      },
    });
    throw new ApiContractError(opError);
  }

  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  if (!isAllowedUpstreamEndpoint(cleanPath)) {
    const opError = createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Endpoint is not registered in UPSTREAM_ENDPOINTS',
      requestId,
      details: {
        operation,
        reason: 'not registered in Task-011 registry',
      },
    });
    throw new ApiContractError(opError);
  }

  // Build target URL strictly bound to backend API origin
  const baseOrigin = serverEnv.BACKEND_API_ORIGIN.replace(/\/+$/, '');
  const targetUrl = new URL(`${baseOrigin}${cleanPath}`);

  // 3. Validate Input unconditionally if inputSchema is provided (even when input is undefined!)
  let validatedInput: unknown = input;
  if (inputSchema) {
    const inputResult = inputSchema.safeParse(input);
    if (!inputResult.success) {
      const fieldErrors = inputResult.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'input',
        code: issue.code,
        message: issue.message,
      }));
      const opError = createOperationError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Invalid request parameters',
        requestId,
        fieldErrors,
        details: { operation },
      });
      throw new ApiContractError(opError);
    }
    validatedInput = inputResult.data;
  }

  // If GET or HEAD and validatedInput is provided, serialize validated query parameters
  if ((method === 'GET' || method === 'HEAD') && validatedInput && typeof validatedInput === 'object') {
    for (const [key, value] of Object.entries(validatedInput as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            targetUrl.searchParams.append(key, String(item));
          }
        }
      } else {
        targetUrl.searchParams.append(key, String(value));
      }
    }
  }

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) value.forEach((item) => targetUrl.searchParams.append(key, String(item)));
      else targetUrl.searchParams.append(key, String(value));
    }
  }

  // 4. Construct Request Headers based on AuthMode profile
  const headers = new Headers();

  // Common Headers
  headers.set('Accept', 'application/json');
  headers.set(REQUEST_ID_HEADER, requestId);
  headers.set('Accept-Language', locale === 'en' ? 'en' : 'ar');

  // Resolve bearer token strictly from server credential resolver (never from caller-supplied headers)
  let resolvedToken: string | null | undefined = null;
  if (authMode !== 'P') {
    const resolver = credentialResolver ?? globalServerCredentialResolver;
    if (resolver) {
      resolvedToken = await resolver();
    }
  }

  // Authorization Header enforcement
  if (authMode === 'P') {
    // Public: strictly forbid Authorization header
    headers.delete('Authorization');
  } else if (authMode === 'O') {
    // Optional: attach token only if resolved by server credential resolver
    if (typeof resolvedToken === 'string' && resolvedToken.trim().length > 0) {
      headers.set('Authorization', `Bearer ${resolvedToken.trim()}`);
    }
  } else if (authMode === 'S' || authMode === 'M' || authMode === 'U') {
    // Protected: attach token from server credential resolver
    if (typeof resolvedToken === 'string' && resolvedToken.trim().length > 0) {
      headers.set('Authorization', `Bearer ${resolvedToken.trim()}`);
    }
  }

  // Idempotency Header for mutations & uploads
  if (idempotencyKey && idempotencyKey.trim().length > 0) {
    headers.set('Idempotency-Key', idempotencyKey.trim());
  }

  // Merge custom caller headers, strictly preventing any caller from setting Authorization in ANY mode
  if (options.headers) {
    const extraHeaders =
      options.headers instanceof Headers
        ? options.headers
        : new Headers(options.headers as Record<string, string>);

    extraHeaders.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower === 'x-request-id') return;
      // Prevent caller custom headers from setting Authorization in EVERY mode!
      if (lower === 'authorization') return;
      headers.set(key, val);
    });
  }

  // 5. Construct Body
  let body: BodyInit | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    if (authMode === 'U') {
      // Multipart upload: let fetch set the Content-Type boundary automatically
      if (validatedInput instanceof FormData || typeof validatedInput === 'string') {
        body = validatedInput as BodyInit;
      } else if (validatedInput !== undefined) {
        body = JSON.stringify(validatedInput);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    } else if (validatedInput !== undefined) {
      body = JSON.stringify(validatedInput);
      headers.set('Content-Type', 'application/json');
    }
  }

  // 6. Timeout and Abort Controller Configuration
  const effectiveTimeout =
    options.timeoutMs ??
    options.timeout ??
    (method === 'GET' || method === 'HEAD' ? DEFAULT_TIMEOUTS[authMode] : DEFAULT_TIMEOUTS[authMode]);

  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;

  if (effectiveTimeout > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException('Request timeout', 'TimeoutError'));
    }, effectiveTimeout);
  }

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', () => {
        controller.abort(options.signal?.reason);
      });
    }
  }

  // 7. Cache Policy Options
  const fetchOptions: RequestInit & {
    next?: {
      revalidate?: number | false | undefined;
      tags?: string[] | undefined;
    } | undefined;
  } = {
    method,
    headers,
    body,
    signal: controller.signal,
  };

  if (cachePolicy) {
    fetchOptions.cache = cachePolicy.cache;
    if (cachePolicy.next) {
      const nextConfig: { revalidate?: number | false; tags?: string[] } = {};
      if (cachePolicy.next.revalidate !== undefined) {
        nextConfig.revalidate = cachePolicy.next.revalidate;
      }
      if (cachePolicy.next.tags && cachePolicy.next.tags.length > 0) {
        nextConfig.tags = [...cachePolicy.next.tags];
      }
      fetchOptions.next = nextConfig;
    }
  } else {
    fetchOptions.cache = 'no-store';
  }

  // 8. Execute HTTP Request
  let response: Response;
  try {
    response = await fetch(targetUrl.toString(), fetchOptions);
  } catch (error) {
    const isTimeout =
      (controller.signal.aborted &&
        (controller.signal.reason?.name === 'TimeoutError' ||
          String(controller.signal.reason).includes('timeout'))) ||
      (error instanceof Error &&
        (error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout')));

    if (isTimeout) {
      const opError = createOperationError({
        status: 504,
        code: 'GATEWAY_TIMEOUT',
        message: 'Gateway timeout',
        requestId,
        details: { operation, timeoutMs: effectiveTimeout },
      });
      throw new ApiContractError(opError);
    }

    const isAbort =
      (controller.signal.aborted &&
        (controller.signal.reason?.name === 'AbortError' ||
          String(controller.signal.reason).includes('abort'))) ||
      (error instanceof Error &&
        (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')));

    if (isAbort) {
      const opError = createOperationError({
        status: 504,
        code: 'GATEWAY_TIMEOUT',
        message: 'Request aborted or gateway timeout',
        requestId,
        details: { operation },
      });
      throw new ApiContractError(opError);
    }

    // Network disconnect or connection failure
    const opError = createOperationError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Failed to reach upstream service',
      requestId,
      details: { operation },
    });
    throw new ApiContractError(opError);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  // 9. Handle Non-2xx Responses via normalizeOperationError
  if (!response.ok) {
    const opError = await normalizeOperationError(response, requestId);
    throw new ApiContractError(opError);
  }

  // 10. Handle 204 No Content and 202 Accepted Empty Acknowledgements
  if (response.status === 204) {
    const ack = adapt204Acknowledgement(null, 204);
    const parsed = outputSchema.safeParse(ack);
    if (parsed.success) {
      return parsed.data;
    }
  }

  // 11. Enforce Response Size Limit from Headers
  const maxSizeBytes = options.maxResponseSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
      logSafeEvent({ level: 'warn', operation, status: 502, requestId });
      const opError = createOperationError({
        status: 502,
        code: 'UPSTREAM_CONTRACT_MISMATCH',
        message: 'Upstream response exceeded size limit',
        requestId,
        details: {
          operation,
          maxSizeBytes,
          actualBytes: contentLength,
        },
      });
      throw new ApiContractError(opError);
    }
  }

  // 12. Enforce Content-Type is valid JSON (application/json or application/*+json)
  const contentType = response.headers.get('content-type') ?? '';
  if (!isJsonContentType(contentType)) {
    logSafeEvent({ level: 'warn', operation, status: 502, requestId });
    const opError = createOperationError({
      status: 502,
      code: 'UPSTREAM_CONTRACT_MISMATCH',
      message: 'Upstream returned non-JSON content type',
      requestId,
      details: {
        operation,
        contentType,
      },
    });
    throw new ApiContractError(opError);
  }

  // 13. Read Response Body with Size Limit
  const text = await response.text();
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength > maxSizeBytes) {
    logSafeEvent({ level: 'warn', operation, status: 502, requestId });
    const opError = createOperationError({
      status: 502,
      code: 'UPSTREAM_CONTRACT_MISMATCH',
      message: 'Upstream response exceeded size limit',
      requestId,
      details: {
        operation,
        maxSizeBytes,
        actualBytes: byteLength,
      },
    });
    throw new ApiContractError(opError);
  }

  // If body is empty and status is 202/204
  if (text.trim().length === 0 && (response.status === 202 || response.status === 200)) {
    const ack = adapt204Acknowledgement(null, response.status);
    const parsed = outputSchema.safeParse(ack);
    if (parsed.success) {
      return parsed.data;
    }
  }

  // 14. Parse JSON
  let rawData: unknown;
  try {
    rawData = JSON.parse(text);
  } catch {
    logSafeEvent({ level: 'warn', operation, status: 502, requestId });
    const opError = createOperationError({
      status: 502,
      code: 'UPSTREAM_CONTRACT_MISMATCH',
      message: 'Failed to parse upstream response as JSON',
      requestId,
      details: {
        operation,
      },
    });
    throw new ApiContractError(opError);
  }

  // 15. Apply Raw-to-Normalized Adapter if provided (catching adapter failures as 502)
  let adaptedData: unknown;
  try {
    adaptedData = adapter ? adapter(rawData) : rawData;
  } catch (adapterError) {
    let issuePaths: string[] = [];
    let fieldErrors: { field: string; code: string; message: string }[] = [];

    if (adapterError instanceof z.ZodError) {
      issuePaths = adapterError.issues.map((i) => i.path.join('.')).filter(Boolean);
      fieldErrors = adapterError.issues.map((issue) => ({
        field: issue.path.join('.') || 'adapter',
        code: issue.code,
        message: issue.message,
      }));
    } else if (adapterError instanceof Error) {
      fieldErrors = [
        {
          field: 'adapter',
          code: 'ADAPTER_ERROR',
          message: 'Adapter normalization failed',
        },
      ];
    }

    logSafeEvent({ level: 'warn', operation, status: 502, requestId, schemaIssuePaths: issuePaths });

    const opError = createOperationError({
      status: 502,
      code: 'UPSTREAM_CONTRACT_MISMATCH',
      message: 'Upstream response contract mismatch during adaptation',
      requestId,
      fieldErrors,
      details: {
        operation,
        issuePaths,
      },
    });

    throw new ApiContractError(opError);
  }

  // 16. Validate Response Schema & Handle 502 UPSTREAM_CONTRACT_MISMATCH
  const parseResult = outputSchema.safeParse(adaptedData);
  if (!parseResult.success) {
    const issuePaths = parseResult.error.issues.map((i) => i.path.join('.')).filter(Boolean);
    logSafeEvent({ level: 'warn', operation, status: 502, requestId, schemaIssuePaths: issuePaths });

    const fieldErrors = parseResult.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'response',
      code: issue.code,
      message: issue.message,
    }));

    const opError = createOperationError({
      status: 502,
      code: 'UPSTREAM_CONTRACT_MISMATCH',
      message: 'Upstream response contract mismatch',
      requestId,
      fieldErrors,
      details: {
        operation,
        issuePaths,
      },
    });

    throw new ApiContractError(opError);
  }

  return parseResult.data;
}

/**
 * Safe variant of serverApiRequest returning ActionResult-style typed union.
 */
export async function serverApiRequestSafe<TInput = unknown, TOutput = unknown>(
  options: ServerApiRequestOptions<TInput, TOutput>
): Promise<ServerApiResult<TOutput>> {
  try {
    const data = await serverApiRequest(options);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiContractError) {
      return { ok: false, error: err.body.error };
    }
    const opError = createOperationError({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      requestId: options.requestId,
    });
    return { ok: false, error: opError.error };
  }
}
