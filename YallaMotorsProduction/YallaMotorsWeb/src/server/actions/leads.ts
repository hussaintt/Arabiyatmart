'use server';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import {
  CreateLeadInputSchema,
  LeadResponseSchema,
  UpdateLeadStatusInputSchema,
  adaptRawLead,
  stripLeadNullsForUpstream,
} from '@/lib/api/schemas/lead';
import { validateOrigin, validateSecFetchSite } from '@/lib/auth/csrf';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { ActionResult } from '@/types/common';
import type { CreateLeadInput, Lead, UpdateLeadStatusInput } from '@/types/lead';
import { resolveLeadScope } from '@/server/queries/leads';

async function requireActionOrigin(): Promise<void> {
  const requestHeaders = await headers();
  if (!validateOrigin(requestHeaders).valid || !validateSecFetchSite(requestHeaders).valid) {
    throw new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin' }));
  }
}

function failure<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof ApiContractError) return { ok: false, error: error.body.error };
  return { ok: false, error: createOperationError({ status: 500, code: 'INTERNAL_SERVER_ERROR', message: fallback }).error };
}

export async function createContactLead(input: CreateLeadInput | unknown, idempotencyKey?: string): Promise<ActionResult<{ publicId: string }>> {
  try {
    await requireActionOrigin();
    const parsed = CreateLeadInputSchema.parse(input);
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'createLead',
      method: 'POST',
      endpoint: UPSTREAM_ENDPOINTS.createLead,
      input: stripLeadNullsForUpstream(parsed),
      outputSchema: LeadResponseSchema,
      authMode: 'O',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike),
      idempotencyKey: idempotencyKey?.trim() || crypto.randomUUID(),
      adapter: adaptRawLead,
    });
    return { ok: true, data: { publicId: response.data.publicId } };
  } catch (error) {
    return failure(error, 'The inquiry could not be sent');
  }
}

export async function updateSellerLeadStatus(publicId: string, input: UpdateLeadStatusInput | unknown, idempotencyKey?: string): Promise<ActionResult<Lead>> {
  try {
    await requireActionOrigin();
    const parsed = UpdateLeadStatusInputSchema.parse(input);
    const scope = await resolveLeadScope();
    const response = await serverApiRequest({
      operation: 'updateSellerLeadStatus',
      method: 'PATCH',
      endpoint: () => scope.vendorPublicId
        ? UPSTREAM_ENDPOINTS.leadStatusVendor(scope.vendorPublicId, publicId)
        : UPSTREAM_ENDPOINTS.leadStatusPrivate(publicId),
      input: stripLeadNullsForUpstream(parsed),
      outputSchema: LeadResponseSchema,
      authMode: 'M',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: () => scope.accessToken,
      idempotencyKey: idempotencyKey?.trim() || crypto.randomUUID(),
      adapter: adaptRawLead,
    });
    revalidatePath('/[locale]/(account)/me/leads', 'page');
    revalidatePath('/[locale]/(account)/me/leads/[publicId]', 'page');
    revalidatePath('/[locale]/(account)/me/dashboard', 'page');
    return { ok: true, data: response.data };
  } catch (error) {
    return failure(error, 'The inquiry status could not be updated');
  }
}
