import 'server-only';

import { NextResponse } from 'next/server';
import { AppleLoginInputSchema, GoogleLoginInputSchema, UpstreamTokenResponseSchema } from '@/lib/api/schemas/auth';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { validateMutationCsrf } from '@/lib/auth/csrf';
import { setSessionCredentials } from '@/lib/auth/session';
import { getSafeSessionForAccessToken } from '@/server/queries/session';
import { revalidatePath, revalidateTag } from 'next/cache';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';
import { z } from 'zod';

const MAX_SOCIAL_BODY_BYTES = 24 * 1024;
type Provider = 'google' | 'apple';

function errorResponse(error: unknown): Response {
  const body = error instanceof ApiContractError ? error.body : error instanceof z.ZodError
    ? createOperationError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Invalid social authentication request',
        fieldErrors: error.issues.map((issue) => ({ field: issue.path.join('.') || 'input', code: issue.code, message: issue.message })),
      })
    : createOperationError({
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Social authentication could not be completed',
      });
  return NextResponse.json(body, {
    status: body.error.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    throw new ApiContractError(createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'A JSON request body is required',
    }));
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_SOCIAL_BODY_BYTES) {
    throw new ApiContractError(createOperationError({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Authentication request is too large',
    }));
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SOCIAL_BODY_BYTES) {
    throw new ApiContractError(createOperationError({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Authentication request is too large',
    }));
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiContractError(createOperationError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid JSON request body',
    }));
  }
}

export async function handleSocialAuth(request: Request, provider: Provider): Promise<Response> {
  const csrf = validateMutationCsrf({ method: request.method, headers: request.headers, cookies: request.headers });
  if (!csrf.valid) {
    return errorResponse(new ApiContractError(createOperationError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Invalid request origin or CSRF token',
    })));
  }

  try {
    const raw = await readBoundedJson(request);
    const input = provider === 'google'
      ? (() => { const parsed = GoogleLoginInputSchema.parse(raw); return { idToken: parsed.idToken, accountType: parsed.accountType }; })()
      : (() => { const parsed = AppleLoginInputSchema.parse(raw); return { identityToken: parsed.identityToken, firstName: parsed.firstName, lastName: parsed.lastName, accountType: parsed.accountType }; })();
    const credentials = await serverApiRequest({
      operation: provider === 'google' ? 'loginWithGoogle' : 'loginWithApple',
      method: 'POST',
      endpoint: provider === 'google' ? UPSTREAM_ENDPOINTS.loginWithGoogle : UPSTREAM_ENDPOINTS.loginWithApple,
      input,
      outputSchema: UpstreamTokenResponseSchema,
      authMode: 'M',
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });
    const session = await getSafeSessionForAccessToken(credentials.accessToken, provider === 'google' ? 'GOOGLE' : 'APPLE');
    const headers = new Headers({ 'Cache-Control': 'private, no-store' });
    setSessionCredentials(headers, credentials);
    await executeInvalidationPlan(invalidationPlans.login(), { revalidatePath, revalidateTag });
    return NextResponse.json({ data: session }, { status: 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
