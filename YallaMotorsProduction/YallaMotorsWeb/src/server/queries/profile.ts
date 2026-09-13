import 'server-only';

import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { serverApiRequest } from '@/lib/api/server';
import {
  UserProfileResponseSchema,
  normalizeUserProfile,
} from '@/lib/api/schemas/profile';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import type { UserProfileResponse } from '@/types/profile';

function adaptProfileResponse(raw: unknown): UserProfileResponse {
  const value =
    typeof raw === 'object' && raw !== null && 'data' in raw
      ? (raw as { data: unknown }).data
      : raw;

  return { data: normalizeUserProfile(value) };
}

/**
 * Reads the authoritative private profile. Profile data is deliberately never
 * cached because verification and account status can change between requests.
 */
export async function getProfile(): Promise<UserProfileResponse> {
  const store = await cookies();

  return serverApiRequest({
    operation: 'getProfile',
    method: 'GET',
    endpoint: UPSTREAM_ENDPOINTS.me,
    outputSchema: UserProfileResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike
    ),
    adapter: adaptProfileResponse,
  });
}

