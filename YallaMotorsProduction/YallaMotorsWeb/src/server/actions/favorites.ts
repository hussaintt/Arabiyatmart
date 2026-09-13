'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { PublicIdSchema } from '@/lib/api/schemas/common';
import { FavoriteMutationResponseSchema } from '@/lib/api/schemas/listing';
import { getCredentialsFromCookies, type CookieStoreLike } from '@/lib/auth/cookies';
import { z } from 'zod';
import type { ActionResult } from '@/types/common';
import type { FavoriteMutationResponse } from '@/types/listing';

const ListingPublicIdParamsSchema = z.object({
  publicId: PublicIdSchema,
});

type ListingPublicIdParams = z.infer<typeof ListingPublicIdParamsSchema>;

function errorResult<T>(error: unknown, defaultMessage = 'Favorite operation could not be completed'): ActionResult<T> {
  if (error instanceof ApiContractError) {
    return { ok: false, error: error.body.error };
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const candidate = (error as { error: unknown }).error;
    if (candidate && typeof candidate === 'object' && 'status' in candidate && 'code' in candidate) {
      return { ok: false, error: candidate as ActionResult<T> extends { ok: false; error: infer E } ? E : never };
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

export async function addFavorite(
  params: ListingPublicIdParams | unknown
): Promise<ActionResult<FavoriteMutationResponse['data']>> {
  const parsed = ListingPublicIdParamsSchema.safeParse(normalizeInput(params));
  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Invalid listing identifier',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'publicId',
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
        message: 'Authentication required to favorite listings',
      })
    );
  }

  try {
    const result = await serverApiRequest({
      operation: 'addFavorite',
      method: 'POST',
      endpoint: () => UPSTREAM_ENDPOINTS.addFavorite(parsed.data.publicId),
      outputSchema: FavoriteMutationResponseSchema,
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: crypto.randomUUID(),
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });

    // CACHE-01: Invalidate private favorites path without busting public tags
    try {
      revalidatePath('/[locale]/(account)/favorites', 'page');
    } catch {
      // In standalone unit tests or non-render contexts revalidatePath may not be active
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to add favorite');
  }
}

export async function removeFavorite(
  params: ListingPublicIdParams | unknown
): Promise<ActionResult<FavoriteMutationResponse['data']>> {
  const parsed = ListingPublicIdParamsSchema.safeParse(normalizeInput(params));
  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Invalid listing identifier',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'publicId',
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
        message: 'Authentication required to unfavorite listings',
      })
    );
  }

  try {
    const result = await serverApiRequest({
      operation: 'removeFavorite',
      method: 'DELETE',
      endpoint: () => UPSTREAM_ENDPOINTS.removeFavorite(parsed.data.publicId),
      outputSchema: FavoriteMutationResponseSchema,
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: crypto.randomUUID(),
      cachePolicy: { cache: 'no-store', isPrivate: true },
      adapter: (raw) => {
        if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data: unknown }).data) {
          return raw as FavoriteMutationResponse;
        }
        return { data: { favorited: false } };
      },
    });

    // CACHE-01: Invalidate private favorites path without busting public tags
    try {
      revalidatePath('/[locale]/(account)/favorites', 'page');
    } catch {
      // In standalone unit tests or non-render contexts revalidatePath may not be active
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to remove favorite');
  }
}
