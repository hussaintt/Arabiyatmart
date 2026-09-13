'use client';

import { z } from 'zod';
import { createOperationError } from '@/lib/api/error';
import { generateRequestId } from '@/lib/api/request-id';
import { OperationErrorSchema } from '@/lib/api/schemas/common';

const MAX_BROWSER_RESPONSE_BYTES = 2 * 1024 * 1024;

type BrowserMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface BrowserApiRequestOptions<TInput, TOutput> {
  path: string;
  method?: BrowserMethod;
  input?: TInput;
  inputSchema?: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export function getBrowserCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === 'am_csrf') return decodeURIComponent(value.join('='));
  }
  return null;
}

function assertSameOriginBffPath(path: string): void {
  if (path !== path.trim() || !path.startsWith('/api/bff/') || path.includes('://') || path.startsWith('//') || path.includes('#') || /[\u0000-\u001f\\]/.test(path)) {
    throw new Error('Browser API requests must use a relative, same-origin BFF path');
  }
  let decoded = path;
  for (let index = 0; index < 3; index += 1) {
    try { decoded = decodeURIComponent(decoded); }
    catch { throw new Error('Browser API path contains malformed encoding'); }
    const decodedPath = decoded.split('?')[0]!;
    if (!decodedPath.startsWith('/api/bff/') || decodedPath.includes('//') || /[\u0000-\u001f\\]/.test(decodedPath) || decodedPath.split('/').some((segment) => segment === '..' || segment === '.')) {
      throw new Error('Browser API path contains an unsafe path segment');
    }
  }
}

export async function browserApiRequest<TInput = never, TOutput = unknown>(
  options: BrowserApiRequestOptions<TInput, TOutput>
): Promise<TOutput> {
  assertSameOriginBffPath(options.path);
  const method = options.method ?? 'GET';
  const input = options.inputSchema ? options.inputSchema.parse(options.input) : options.input;
  const headers = new Headers({ Accept: 'application/json', 'x-request-id': generateRequestId() });
  const init: RequestInit = { method, headers, credentials: 'same-origin', cache: 'no-store', ...(options.signal ? { signal: options.signal } : {}) };
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json');
    const csrf = getBrowserCsrfToken();
    if (!csrf) throw createOperationError({ status: 403, code: 'CSRF_TOKEN_MISSING', message: 'The security token is missing; refresh the page and try again' }).error;
    headers.set('x-csrf-token', csrf);
    if (options.idempotencyKey) headers.set('idempotency-key', options.idempotencyKey);
    if (input !== undefined) init.body = JSON.stringify(input);
  }
  const response = await fetch(options.path, init);
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;.*)?$/i.test(contentType)) {
    throw createOperationError({ status: 502, code: 'UPSTREAM_CONTRACT_MISMATCH', message: 'The server returned an invalid response format' }).error;
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BROWSER_RESPONSE_BYTES) {
    throw createOperationError({ status: 502, code: 'UPSTREAM_CONTRACT_MISMATCH', message: 'The server response exceeded the permitted size' }).error;
  }
  const responseText = await response.text();
  if (new TextEncoder().encode(responseText).byteLength > MAX_BROWSER_RESPONSE_BYTES) {
    throw createOperationError({ status: 502, code: 'UPSTREAM_CONTRACT_MISMATCH', message: 'The server response exceeded the permitted size' }).error;
  }
  let raw: unknown;
  try { raw = JSON.parse(responseText) as unknown; }
  catch { throw createOperationError({ status: 502, code: 'UPSTREAM_CONTRACT_MISMATCH', message: 'The server returned invalid JSON' }).error; }
  if (!response.ok) {
    const parsedError = OperationErrorSchema.safeParse(raw);
    throw parsedError.success
      ? parsedError.data.error
      : createOperationError({ status: response.status >= 500 ? 502 : 400, message: 'Request failed' }).error;
  }
  const parsed = options.outputSchema.safeParse(raw);
  if (!parsed.success) throw createOperationError({ status: 502, code: 'UPSTREAM_CONTRACT_MISMATCH', message: 'The server response did not match its contract' }).error;
  return parsed.data;
}
