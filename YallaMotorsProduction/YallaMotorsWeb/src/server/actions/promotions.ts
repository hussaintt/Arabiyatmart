'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import {
  PromotionResponseSchema,
  PurchasePromotionInputSchema,
} from '@/lib/api/schemas/lead';
import { getCredentialsFromCookies, type CookieStoreLike } from '@/lib/auth/cookies';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';
import type { ActionResult } from '@/types/common';
import type { ListingPromotion, PurchasePromotionInput } from '@/types/lead';

function errorResult<T>(
  error: unknown,
  defaultMessage = 'Promotion purchase could not be completed'
): ActionResult<T> {
  if (error instanceof ApiContractError) {
    return { ok: false, error: error.body.error };
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const candidate = (error as { error: unknown }).error;
    if (
      candidate &&
      typeof candidate === 'object' &&
      'status' in candidate &&
      'code' in candidate
    ) {
      return {
        ok: false,
        error: candidate as ActionResult<T> extends { ok: false; error: infer E }
          ? E
          : never,
      };
    }
  }
  return {
    ok: false,
    error: createOperationError({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : defaultMessage,
    }).error,
  };
}

function normalizeInput(input: unknown): unknown {
  if (input instanceof FormData) {
    return Object.fromEntries(input.entries());
  }
  return input;
}

export async function purchasePromotion(
  input: PurchasePromotionInput | FormData,
  idempotencyKey?: string,
  slug?: string
): Promise<ActionResult<ListingPromotion>> {
  const raw = normalizeInput(input);
  const parsed = PurchasePromotionInputSchema.safeParse(raw);

  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid promotion purchase input',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'root',
          code: issue.code,
          message: issue.message,
        })),
      })
    );
  }

  const store = await cookies();
  const { accessToken } = getCredentialsFromCookies(store as unknown as CookieStoreLike);
  if (!accessToken) {
    return errorResult(
      createOperationError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to purchase promotion',
      })
    );
  }

  const effectiveIdempotencyKey = idempotencyKey?.trim() || crypto.randomUUID();

  try {
    const result = await serverApiRequest({
      operation: 'purchasePromotion',
      method: 'POST',
      endpoint: () => UPSTREAM_ENDPOINTS.purchasePromotion(),
      inputSchema: PurchasePromotionInputSchema,
      outputSchema: PromotionResponseSchema,
      input: parsed.data,
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: effectiveIdempotencyKey,
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });

    const resolvedSlug = slug || result.data.listing?.slug;
    if (resolvedSlug) {
      try {
        await executeInvalidationPlan(
          invalidationPlans.purchasePromotion({ slug: resolvedSlug }),
          {
            revalidateTag,
            revalidatePath,
          }
        );
      } catch {
        // Invalidation failures should not fail the 201 response
      }
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to purchase promotion package');
  }
}
