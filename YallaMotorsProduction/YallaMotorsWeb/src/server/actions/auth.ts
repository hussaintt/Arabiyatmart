'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import {
  LoginInputSchema,
  RegisterInputSchema,
  UpstreamTokenResponseSchema,
} from '@/lib/api/schemas/auth';
import { CountResponseSchema, MutationAckResponseSchema } from '@/lib/api/schemas/common';
import { getCredentialsFromCookies, type CookieStoreLike, type CookieTarget } from '@/lib/auth/cookies';
import { clearSessionCredentials, setSessionCredentials } from '@/lib/auth/session';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { getSafeSessionForAccessToken } from '@/server/queries/session';
import type { ActionResult, CountResponse, MutationAckResponse } from '@/types/common';
import type { LoginInput, RegisterInput, SafeSession } from '@/types/auth';

function formOrUnknown(input: unknown): unknown {
  if (input instanceof FormData) return Object.fromEntries(input.entries());
  return input;
}

function errorResult<T>(error: unknown): ActionResult<T> {
  if (error instanceof ApiContractError) return { ok: false, error: error.body.error };
  return {
    ok: false,
    error: createOperationError({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication request could not be completed',
    }).error,
  };
}

function writableCookieTarget(store: Awaited<ReturnType<typeof cookies>>): CookieTarget {
  // Server Actions are the Next.js context where the request cookie store is writable.
  return store as unknown as CookieTarget;
}

function readableCookieStore(store: Awaited<ReturnType<typeof cookies>>): CookieStoreLike {
  return store as unknown as CookieStoreLike;
}

async function issueSession(
  endpoint: () => string,
  input: unknown,
  signInMethod: SafeSession['signInMethod'],
  idempotencyKey?: string
): Promise<SafeSession> {
  const credentials = await serverApiRequest({
    operation: signInMethod === 'EMAIL_PASSWORD' ? 'login' : 'register',
    method: 'POST',
    endpoint,
    input,
    outputSchema: UpstreamTokenResponseSchema,
    authMode: 'P',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    idempotencyKey,
  });
  const session = await getSafeSessionForAccessToken(credentials.accessToken, signInMethod);
  setSessionCredentials(writableCookieTarget(await cookies()), credentials);
  return session;
}

export async function login(input: unknown): Promise<ActionResult<SafeSession>> {
  const parsed = LoginInputSchema.safeParse(formOrUnknown(input));
  if (!parsed.success) return errorResult(createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid login input', fieldErrors: parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'input', code: i.code, message: i.message })) }));
  try {
    const { email, password } = parsed.data;
    const session = await issueSession(UPSTREAM_ENDPOINTS.login, { email, password }, 'EMAIL_PASSWORD');
    sanitizeReturnTo(parsed.data.returnTo, 'ar');
    await executeInvalidationPlan(invalidationPlans.login(), { revalidatePath, revalidateTag });
    return { ok: true, data: session };
  } catch (error) {
    return errorResult(error);
  }
}

export async function register(input: unknown): Promise<ActionResult<SafeSession>> {
  const parsed = RegisterInputSchema.safeParse(formOrUnknown(input));
  if (!parsed.success) return errorResult(createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid registration input', fieldErrors: parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'input', code: i.code, message: i.message })) }));
  try {
    const { firstName, lastName, email, password, accountType } = parsed.data;
    const session = await issueSession(UPSTREAM_ENDPOINTS.register, { firstName, lastName, email, password, accountType }, 'EMAIL_PASSWORD', crypto.randomUUID());
    sanitizeReturnTo(parsed.data.returnTo, 'ar');
    await executeInvalidationPlan(invalidationPlans.register(), { revalidatePath, revalidateTag });
    return { ok: true, data: session };
  } catch (error) {
    return errorResult(error);
  }
}

export async function refreshSession(): Promise<ActionResult<SafeSession>> {
  const store = await cookies();
  const { refreshToken } = getCredentialsFromCookies(readableCookieStore(store));
  if (!refreshToken) return errorResult(createOperationError({ status: 401, code: 'UNAUTHORIZED', message: 'No refresh session is available' }));
  try {
    const { refreshSessionCredentials } = await import('@/server/queries/session');
    const credentials = await refreshSessionCredentials(refreshToken, writableCookieTarget(store));
    return { ok: true, data: await getSafeSessionForAccessToken(credentials.accessToken) };
  } catch (error) {
    return errorResult(error);
  }
}

export async function logout(): Promise<ActionResult<MutationAckResponse>> {
  const store = await cookies();
  const { refreshToken } = getCredentialsFromCookies(readableCookieStore(store));
  try {
    if (refreshToken) {
      await serverApiRequest({
        operation: 'logout', method: 'POST', endpoint: UPSTREAM_ENDPOINTS.logout,
        input: { refreshToken }, inputSchema: z.object({ refreshToken: z.string().min(1) }),
        outputSchema: MutationAckResponseSchema, authMode: 'P', cachePolicy: { cache: 'no-store', isPrivate: true }, idempotencyKey: crypto.randomUUID(),
      });
    }
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return errorResult(error);
  } finally {
    clearSessionCredentials(writableCookieTarget(store));
    await executeInvalidationPlan(invalidationPlans.logout(), { revalidatePath, revalidateTag });
  }
}

export async function logoutAll(): Promise<ActionResult<CountResponse>> {
  const store = await cookies();
  const { accessToken } = getCredentialsFromCookies(readableCookieStore(store));
  try {
    if (!accessToken) throw new ApiContractError(createOperationError({ status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }));
    const response = await serverApiRequest({
      operation: 'logoutAll', method: 'POST', endpoint: UPSTREAM_ENDPOINTS.logoutAll,
      outputSchema: CountResponseSchema, authMode: 'S', cachePolicy: { cache: 'no-store', isPrivate: true }, idempotencyKey: crypto.randomUUID(),
      credentialResolver: async () => accessToken, adapter: (raw) => ({ count: (raw as { revokedSessions?: unknown }).revokedSessions }),
    });
    return { ok: true, data: response };
  } catch (error) {
    return errorResult(error);
  } finally {
    clearSessionCredentials(writableCookieTarget(store));
    await executeInvalidationPlan(invalidationPlans.logoutAll(), { revalidatePath, revalidateTag });
  }
}

export type { LoginInput, RegisterInput };
