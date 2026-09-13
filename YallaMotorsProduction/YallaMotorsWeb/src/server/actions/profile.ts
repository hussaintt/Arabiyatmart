'use server';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';
import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { adapt204Acknowledgement } from '@/lib/api/adapters';
import { serverApiRequest } from '@/lib/api/server';
import {
  DeleteAccountInputSchema,
} from '@/lib/api/schemas/auth';
import {
  UpdateProfileInputSchema,
  UserProfileResponseSchema,
  normalizeUserProfile,
} from '@/lib/api/schemas/profile';
import { MutationAckResponseSchema } from '@/lib/api/schemas/common';
import { validateOrigin, validateSecFetchSite } from '@/lib/auth/csrf';
import { clearSessionCredentials, createCookieCredentialResolver } from '@/lib/auth/session';
import { changePassword as changePasswordAction } from '@/server/actions/verification';
import type { CookieStoreLike, CookieTarget } from '@/lib/auth/cookies';
import type { ActionResult, MutationAckResponse } from '@/types/common';
import type { DeleteAccountInput } from '@/types/auth';
import type { UpdateProfileInput, UserProfile } from '@/types/profile';

function asRecord(input: unknown): unknown {
  return input instanceof FormData ? Object.fromEntries(input.entries()) : input;
}

function failure<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof ApiContractError) {
    return { ok: false, error: error.body.error };
  }

  const body =
    error instanceof z.ZodError
      ? createOperationError({
          status: 400,
          code: 'BAD_REQUEST',
          message: 'Invalid profile request',
          fieldErrors: error.issues.map((issue) => ({
            field: issue.path.join('.') || 'input',
            code: issue.code,
            message: issue.message,
          })),
        })
      : createOperationError({
          status: 500,
          code: 'INTERNAL_SERVER_ERROR',
          message: fallback,
        });

  return { ok: false, error: body.error };
}

async function requireActionCsrf(): Promise<void> {
  const requestHeaders = await headers();
  const origin = validateOrigin(requestHeaders);
  const site = validateSecFetchSite(requestHeaders);
  if (!origin.valid || !site.valid) {
    throw new ApiContractError(
      createOperationError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Invalid request origin',
      })
    );
  }
}

function adaptProfileResponse(raw: unknown) {
  const value =
    typeof raw === 'object' && raw !== null && 'data' in raw
      ? (raw as { data: unknown }).data
      : raw;
  return { data: normalizeUserProfile(value) };
}

export async function updateProfile(
  input: UpdateProfileInput | unknown
): Promise<ActionResult<UserProfile>> {
  try {
    await requireActionCsrf();
    const parsed = UpdateProfileInputSchema.parse(asRecord(input));
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'updateProfile',
      method: 'PATCH',
      endpoint: UPSTREAM_ENDPOINTS.me,
      input: parsed,
      outputSchema: UserProfileResponseSchema,
      authMode: 'M',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(
        store as unknown as CookieStoreLike
      ),
      idempotencyKey: crypto.randomUUID(),
      adapter: adaptProfileResponse,
    });

    await executeInvalidationPlan(invalidationPlans.updateProfile(), { revalidatePath, revalidateTag });
    return { ok: true, data: response.data };
  } catch (error) {
    return failure(error, 'Profile could not be updated');
  }
}

export async function deleteAccount(
  input: DeleteAccountInput | unknown
): Promise<ActionResult<MutationAckResponse>> {
  try {
    await requireActionCsrf();
    const parsed = DeleteAccountInputSchema.parse(asRecord(input));
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'deleteAccount',
      method: 'DELETE',
      endpoint: UPSTREAM_ENDPOINTS.me,
      input: parsed,
      outputSchema: MutationAckResponseSchema,
      authMode: 'M',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(
        store as unknown as CookieStoreLike
      ),
      idempotencyKey: crypto.randomUUID(),
      adapter: adapt204Acknowledgement,
    });

    clearSessionCredentials(store as unknown as CookieTarget);
    await executeInvalidationPlan(invalidationPlans.deleteAccount(), { revalidatePath, revalidateTag });
    return { ok: true, data: response };
  } catch (error) {
    return failure(error, 'Account could not be deleted');
  }
}

export async function changePassword(input: unknown) {
  return changePasswordAction(input);
}
