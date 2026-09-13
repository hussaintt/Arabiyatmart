import 'server-only';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import { ListingCursorResponseSchema } from '@/lib/api/schemas/listing';
import { normalizeCursorMeta } from '@/lib/api/pagination';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { ListingCursorResponse } from '@/types/listing';

export interface FavoriteListParams {
  cursor?: string | undefined;
  limit?: 20 | 50 | 100 | undefined;
}

export const FavoriteListParamsSchema: z.ZodType<FavoriteListParams> = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.union([z.literal(20), z.literal(50), z.literal(100)]).optional(),
  })
  .strict();

/** Enforces FAV-01 without ever synthesizing a cursor from a listing. */
export function enforceFavoriteCursorContract(raw: unknown): ListingCursorResponse {
  const response = ListingCursorResponseSchema.parse(raw);
  return {
    ...response,
    meta: normalizeCursorMeta(response.meta),
  };
}

export async function getFavorites(
  params: FavoriteListParams = {}
): Promise<ListingCursorResponse> {
  const input = FavoriteListParamsSchema.parse(params);
  const store = await cookies();

  return serverApiRequest({
    operation: 'getFavorites',
    method: 'GET',
    endpoint: UPSTREAM_ENDPOINTS.favorites,
    query: {
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
    },
    outputSchema: ListingCursorResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike
    ),
    adapter: enforceFavoriteCursorContract,
  });
}
