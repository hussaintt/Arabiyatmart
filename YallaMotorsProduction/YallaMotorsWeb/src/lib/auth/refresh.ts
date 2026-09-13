import 'server-only';

/**
 * Single-flight server token refresh and 401 retry orchestrator.
 *
 * Implements Phase 1 Section 5.3 and TASK-014:
 * - Single-flight deduplication: concurrent refresh requests for the same token
 *   share a single in-flight network call to prevent refresh token reuse detection.
 * - Upstream 401 retry: protected requests intercept 401, perform one refresh,
 *   commit rotated HttpOnly cookies atomically, and retry the request once.
 * - Terminal error handling: missing refresh token or 401/403 response clears
 *   both credentials atomically.
 * - Transient error preservation: timeouts, 5xx, or network issues do not
 *   proactively destroy the refresh cookie.
 * - Zero token leakage: tokens never enter logs, error details, or browser payloads.
 */

import { serverEnv } from '@/lib/env/server';
import { UpstreamTokenResponseSchema } from '@/lib/api/schemas/auth';
import type { UpstreamTokenResponse } from '@/types/auth';
import { ApiContractError } from '@/lib/api/error';

export class AuthRefreshError extends Error {
  public readonly isTerminal: boolean;
  public readonly status: number;

  constructor(message: string, isTerminal: boolean = true, status: number = 401) {
    super(message);
    this.name = 'AuthRefreshError';
    this.isTerminal = isTerminal;
    this.status = status;
  }
}

/**
 * In-memory map coalescing active refresh promises by refresh token.
 */
const inFlightRefreshes = new Map<string, Promise<UpstreamTokenResponse>>();

/**
 * Performs the raw network call to Fastify /v1/auth/refresh.
 */
export async function executeUpstreamRefresh(
  refreshToken: string,
  options: {
    backendUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<UpstreamTokenResponse> {
  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
    throw new AuthRefreshError('Missing or empty refresh token', true, 401);
  }

  const backendUrl = options.backendUrl ?? serverEnv.BACKEND_API_ORIGIN;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchFn = options.fetchImpl ?? fetch;

  const endpoint = `${backendUrl.replace(/\/+$/, '')}/v1/auth/refresh`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshToken.trim() }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('aborted'));
    throw new AuthRefreshError(
      isAbort ? 'Upstream refresh timed out' : 'Failed to connect to authentication server',
      false, // Transient failure; do not destroy refresh cookie
      isAbort ? 504 : 503
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle HTTP status codes
  if (response.status === 401 || response.status === 403) {
    throw new AuthRefreshError('Session expired or revoked', true, 401);
  }

  if (!response.ok) {
    const isServerError = response.status >= 500;
    throw new AuthRefreshError(
      `Upstream refresh failed with status ${response.status}`,
      !isServerError, // 5xx are transient; 4xx are terminal
      response.status
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AuthRefreshError('Invalid JSON response from refresh endpoint', false, 502);
  }

  const parsed = UpstreamTokenResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new AuthRefreshError('Upstream refresh returned malformed token response', false, 502);
  }

  return parsed.data;
}

/**
 * Single-flight server refresh wrapper.
 * Coalesces concurrent calls for the same refresh token into a single active promise.
 */
export async function singleFlightRefresh(
  refreshToken: string,
  refreshFn: (token: string) => Promise<UpstreamTokenResponse> = executeUpstreamRefresh
): Promise<UpstreamTokenResponse> {
  const tokenKey = refreshToken.trim();

  // If a refresh for this token is already in flight, reuse the promise
  const existingPromise = inFlightRefreshes.get(tokenKey);
  if (existingPromise) {
    return existingPromise;
  }

  // Create a new in-flight promise
  const promise = refreshFn(tokenKey).finally(() => {
    inFlightRefreshes.delete(tokenKey);
  });

  inFlightRefreshes.set(tokenKey, promise);
  return promise;
}

/**
 * Detects whether an error represents an authentication failure (HTTP 401).
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ApiContractError && error.body.error.status === 401) {
    return true;
  }
  if (error instanceof AuthRefreshError && error.status === 401) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (record.status === 401 || record.statusCode === 401) {
      return true;
    }
  }
  return false;
}

export interface AuthRetryOptions<T> {
  /**
   * Function to execute with the active access token.
   */
  operation: (accessToken: string) => Promise<T>;

  /**
   * Current access token (may be expired or absent).
   */
  accessToken: string | null | undefined;

  /**
   * Current refresh token (used if access token is absent or returns 401).
   */
  refreshToken: string | null | undefined;

  /**
   * Callback invoked when tokens are refreshed to commit rotated cookies atomically.
   */
  onTokensRefreshed: (tokens: UpstreamTokenResponse) => Promise<void> | void;

  /**
   * Callback invoked when authentication fails terminally to clear credentials atomically.
   */
  onAuthFailed: (error: AuthRefreshError | Error) => Promise<void> | void;

  /**
   * Custom refresh function implementation (defaults to executeUpstreamRefresh).
   */
  refreshFn?: (token: string) => Promise<UpstreamTokenResponse>;
}

/**
 * Executes an authenticated server operation with single-flight refresh and one retry on 401.
 *
 * Implements Acceptance Criteria:
 * GIVEN: A request with expired access cookie, valid refresh cookie, CSRF pair, and safe relative return path
 * WHEN: One protected upstream request returns 401
 * THEN: Exactly one refresh occurs, rotated HttpOnly cookies are committed, the request retries once, and no credential enters browser-visible data
 */
export async function executeWithAuthRetry<T>(
  options: AuthRetryOptions<T>
): Promise<T> {
  const {
    operation,
    accessToken,
    refreshToken,
    onTokensRefreshed,
    onAuthFailed,
    refreshFn,
  } = options;

  let currentToken = accessToken?.trim() ?? null;

  // 1. If access token is completely absent, attempt refresh before initial operation
  if (!currentToken) {
    if (!refreshToken || refreshToken.trim().length === 0) {
      const err = new AuthRefreshError('No credentials available', true, 401);
      await onAuthFailed(err);
      throw err;
    }

    try {
      const refreshed = await singleFlightRefresh(refreshToken, refreshFn);
      await onTokensRefreshed(refreshed);
      currentToken = refreshed.accessToken;
    } catch (refreshErr: unknown) {
      const authErr =
        refreshErr instanceof AuthRefreshError
          ? refreshErr
          : new AuthRefreshError('Token refresh failed', true, 401);

      if (authErr.isTerminal) {
        await onAuthFailed(authErr);
      }
      throw authErr;
    }
  }

  // 2. Execute the initial operation
  try {
    return await operation(currentToken);
  } catch (opError: unknown) {
    // If not a 401 error, rethrow immediately without retrying
    if (!isUnauthorizedError(opError)) {
      throw opError;
    }

    // 3. Upstream returned 401: attempt exactly one refresh and retry
    if (!refreshToken || refreshToken.trim().length === 0) {
      const terminalErr = new AuthRefreshError('Session expired and no refresh token available', true, 401);
      await onAuthFailed(terminalErr);
      throw terminalErr;
    }

    let refreshedTokens: UpstreamTokenResponse;
    try {
      refreshedTokens = await singleFlightRefresh(refreshToken, refreshFn);
      // Commit rotated cookies atomically
      await onTokensRefreshed(refreshedTokens);
    } catch (refreshErr: unknown) {
      const authErr =
        refreshErr instanceof AuthRefreshError
          ? refreshErr
          : new AuthRefreshError('Token refresh failed on retry', true, 401);

      if (authErr.isTerminal) {
        await onAuthFailed(authErr);
      }
      throw authErr;
    }

    // 4. Retry the operation ONCE with the freshly issued access token
    return await operation(refreshedTokens.accessToken);
  }
}
