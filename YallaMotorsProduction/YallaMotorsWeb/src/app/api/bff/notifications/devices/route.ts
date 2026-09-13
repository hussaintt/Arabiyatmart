import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { MutationAckResponseSchema } from '@/lib/api/schemas/common';
import { DeviceRegistrationListResponseSchema, DeviceRegistrationResponseSchema, RegisterDeviceInputSchema, UnregisterDeviceInputSchema, adaptRawDeviceRegistration, adaptRawDeviceRegistrationList } from '@/lib/api/schemas/notification';
import { validateMutationCsrf } from '@/lib/auth/csrf';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import { executeIdempotentRoute } from '@/lib/security/route-idempotency';

export const dynamic = 'force-dynamic';

function fail(error: unknown): Response {
  const body = error instanceof ApiContractError ? error.body : createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid notification device request' });
  return NextResponse.json(body, { status: body.error.status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) throw new ApiContractError(createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'A JSON request body is required' }));
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > 16 * 1024) throw new ApiContractError(createOperationError({ status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Device request is too large' }));
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 16 * 1024) throw new ApiContractError(createOperationError({ status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Device request is too large' }));
  try { return JSON.parse(text) as unknown; }
  catch { throw new ApiContractError(createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid JSON request body' })); }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const data = await serverApiRequest({ operation: 'listNotificationDevices', method: 'GET', endpoint: UPSTREAM_ENDPOINTS.notificationDevices, outputSchema: DeviceRegistrationListResponseSchema, authMode: 'S', cachePolicy: { cache: 'no-store', isPrivate: true }, credentialResolver: createCookieCredentialResolver(request.headers), adapter: adaptRawDeviceRegistrationList });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request): Promise<Response> {
  const csrf = validateMutationCsrf({ method: 'POST', headers: request.headers, cookies: request.headers });
  if (!csrf.valid) return fail(new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token' })));
  try {
    const input = RegisterDeviceInputSchema.parse(await readBoundedJson(request));
    return await executeIdempotentRoute({ request, operation: 'registerNotificationDevice', canonicalBody: input, execute: async (idempotencyKey) => {
      const data = await serverApiRequest({ operation: 'registerNotificationDevice', method: 'POST', endpoint: UPSTREAM_ENDPOINTS.notificationDevices, input, outputSchema: DeviceRegistrationResponseSchema, authMode: 'M', cachePolicy: { cache: 'no-store', isPrivate: true }, credentialResolver: createCookieCredentialResolver(request.headers), idempotencyKey, adapter: adaptRawDeviceRegistration });
      return NextResponse.json(data, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
    } });
  } catch (error) { return fail(error); }
}

export async function DELETE(request: Request): Promise<Response> {
  const csrf = validateMutationCsrf({ method: 'DELETE', headers: request.headers, cookies: request.headers });
  if (!csrf.valid) return fail(new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token' })));
  try {
    const input = UnregisterDeviceInputSchema.parse(await readBoundedJson(request));
    const AckOrEmpty = z.union([MutationAckResponseSchema, z.object({}).strict()]);
    return await executeIdempotentRoute({ request, operation: 'unregisterNotificationDevice', canonicalBody: input, execute: async (idempotencyKey) => {
      const raw = await serverApiRequest({ operation: 'unregisterNotificationDevice', method: 'DELETE', endpoint: () => UPSTREAM_ENDPOINTS.unregisterNotificationDevice(input.token), outputSchema: AckOrEmpty, authMode: 'M', cachePolicy: { cache: 'no-store', isPrivate: true }, credentialResolver: createCookieCredentialResolver(request.headers), idempotencyKey });
      return NextResponse.json('ok' in raw ? raw : { ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    } });
  } catch (error) { return fail(error); }
}
