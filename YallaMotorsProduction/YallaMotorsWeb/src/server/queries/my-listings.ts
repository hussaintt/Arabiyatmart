import 'server-only';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import { MyListingsResponseSchema } from '@/lib/api/schemas/listing';
import { normalizeCursorMeta } from '@/lib/api/pagination';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { MyListingsResponse, ListingStatus } from '@/types/listing';

export interface MyListingsParams {
  status?: ListingStatus | string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export const MyListingsParamsSchema: z.ZodType<MyListingsParams> = z
  .object({
    status: z.string().optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export async function getMyListings(
  params: MyListingsParams = {}
): Promise<MyListingsResponse> {
  const input = MyListingsParamsSchema.parse(params);
  const store = await cookies();

  return serverApiRequest({
    operation: 'getMyListings',
    method: 'GET',
    endpoint: UPSTREAM_ENDPOINTS.myListings,
    query: {
      ...(input.status && input.status !== 'ALL' ? { status: input.status } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
    },
    outputSchema: MyListingsResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike
    ),
    adapter: (raw) => {
      const parsed = MyListingsResponseSchema.parse(raw);
      return {
        ...parsed,
        meta: normalizeCursorMeta(parsed.meta),
      };
    },
  });
}
