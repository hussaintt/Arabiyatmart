import 'server-only';

import { cookies } from 'next/headers';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { UserProfileResponseSchema, normalizeUserProfile } from '@/lib/api/schemas/profile';
import { createSafeSession } from '@/lib/api/schemas/auth';
import { getCredentialsFromCookies, type CookieStoreLike, type CookieTarget } from '@/lib/auth/cookies';
import { singleFlightRefresh } from '@/lib/auth/refresh';
import { setSessionCredentials } from '@/lib/auth/session';
import type { SafeSession, SessionResponse, UpstreamTokenResponse } from '@/types/auth';

/** Loads and validates a token-free session projection using a server-held bearer only. */
export async function getSafeSessionForAccessToken(
  accessToken: string,
  signInMethod: SafeSession['signInMethod'] = 'RESTORED'
): Promise<SafeSession> {
  const profile = await serverApiRequest({
    operation: 'getSession',
    method: 'GET',
    endpoint: UPSTREAM_ENDPOINTS.me,
    outputSchema: UserProfileResponseSchema,
    authMode: 'S',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: async () => accessToken,
    adapter: (raw) => ({ data: normalizeUserProfile(raw) }),
  });
  return createSafeSession(profile.data, signInMethod);
}

/** Refreshes once through the single-flight primitive and commits the rotated credential pair. */
export async function refreshSessionCredentials(
  refreshToken: string,
  target: CookieTarget
): Promise<UpstreamTokenResponse> {
  const credentials = await singleFlightRefresh(refreshToken);
  setSessionCredentials(target, credentials);
  return credentials;
}

/**
 * RSC-safe session query. Missing credentials intentionally produce anonymous 200.
 * A refresh is attempted only after a protected `/v1/me` request establishes a 401.
 */
export async function getSession(): Promise<SessionResponse> {
  const store = await cookies();
  const { accessToken, refreshToken } = getCredentialsFromCookies(store as unknown as CookieStoreLike);
  if (!accessToken) return { data: null };

  try {
    return { data: await getSafeSessionForAccessToken(accessToken) };
  } catch (error) {
    if (!(error instanceof ApiContractError) || error.body.error.status !== 401 || !refreshToken) {
      if (error instanceof ApiContractError && error.body.error.status === 401) return { data: null };
      throw error;
    }
    // Cookie mutation is only legal in a Server Action or Route Handler. The caller
    // may pass through the dedicated refresh route when this RSC query is read-only.
    return { data: null };
  }
}

export function toSessionOperationError(error: unknown, requestId?: string) {
  if (error instanceof ApiContractError) return error.body;
  return createOperationError({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unable to resolve session',
    requestId,
  });
}
