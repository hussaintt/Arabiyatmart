import 'server-only';

import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import {
  PromotionListResponseSchema,
  adaptRawPromotionList,
} from '@/lib/api/schemas/lead';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { PromotionListResponse } from '@/types/lead';

export async function listMyPromotions(): Promise<PromotionListResponse> {
  const store = await cookies();

  return serverApiRequest({
    operation: 'listMyPromotions',
    method: 'GET',
    endpoint: () => UPSTREAM_ENDPOINTS.myPromotions(),
    outputSchema: PromotionListResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike
    ),
    adapter: adaptRawPromotionList,
  });
}
