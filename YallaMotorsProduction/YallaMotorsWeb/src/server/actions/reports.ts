'use server';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { CreateReportInputSchema, ListingReportResponseSchema, adaptRawListingReport, stripLeadNullsForUpstream } from '@/lib/api/schemas/lead';
import { validateOrigin, validateSecFetchSite } from '@/lib/auth/csrf';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { ActionResult } from '@/types/common';
import type { CreateReportInput, ListingReport } from '@/types/lead';

export async function createListingReport(input: CreateReportInput | unknown, idempotencyKey?: string): Promise<ActionResult<ListingReport>> {
  try {
    const requestHeaders = await headers();
    if (!validateOrigin(requestHeaders).valid || !validateSecFetchSite(requestHeaders).valid) {
      throw new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin' }));
    }
    const parsed = CreateReportInputSchema.parse(input);
    const store = await cookies();
    const response = await serverApiRequest({
      operation: 'createListingReport',
      method: 'POST',
      endpoint: UPSTREAM_ENDPOINTS.createReport,
      input: stripLeadNullsForUpstream(parsed),
      outputSchema: ListingReportResponseSchema,
      authMode: 'M',
      cachePolicy: { cache: 'no-store', isPrivate: true },
      credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike),
      idempotencyKey: idempotencyKey?.trim() || crypto.randomUUID(),
      adapter: adaptRawListingReport,
    });
    return { ok: true, data: response.data };
  } catch (error) {
    if (error instanceof ApiContractError) return { ok: false, error: error.body.error };
    return { ok: false, error: createOperationError({ status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'The report could not be submitted' }).error };
  }
}
