import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn(), sessionQuery: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock('@/lib/api/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api/server')>()), serverApiRequest: mocks.apiRequest }));
vi.mock('@/server/queries/session', () => ({ getSafeSessionForAccessToken: mocks.sessionQuery }));

import { ApiContractError, createOperationError } from '@/lib/api/error';
import { handleSocialAuth } from '@/lib/auth/oauth';

const safeSession = { isAuthenticated: true as const, signInMethod: 'GOOGLE' as const, user: { publicId: 'usr_public' } };

function request(body: unknown, options: { provider?: 'google' | 'apple'; origin?: string; contentType?: string; csrf?: string; cookieCsrf?: string; rawBody?: string } = {}) {
  const provider = options.provider ?? 'google';
  const csrf = options.csrf ?? 'csrf-value';
  return new Request(`http://localhost:3000/api/bff/auth/${provider}`, {
    method: 'POST',
    headers: {
      'content-type': options.contentType ?? 'application/json',
      origin: options.origin ?? 'http://localhost:3000',
      cookie: `am_csrf=${options.cookieCsrf ?? csrf}`,
      'x-csrf-token': csrf,
    },
    body: options.rawBody ?? JSON.stringify(body),
  });
}

describe('social auth exchange', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset().mockResolvedValue({ accessToken: 'platform-at-secret', refreshToken: 'platform-rt-secret', expiresIn: 900 });
    mocks.sessionQuery.mockReset().mockResolvedValue(safeSession);
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it('rejects cross-origin and invalid-CSRF exchanges before upstream I/O', async () => {
    const crossOrigin = await handleSocialAuth(request({ idToken: 'provider-secret', accountType: 'CUSTOMER', returnTo: null }, { origin: 'https://evil.example' }), 'google');
    const csrfMismatch = await handleSocialAuth(request({ idToken: 'provider-secret', accountType: 'CUSTOMER', returnTo: null }, { csrf: 'one', cookieCsrf: 'two' }), 'google');
    expect(crossOrigin.status).toBe(403);
    expect(csrfMismatch.status).toBe(403);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('requires JSON and rejects malformed or oversized provider input as client errors', async () => {
    expect((await handleSocialAuth(request({}, { contentType: 'text/plain' }), 'google')).status).toBe(400);
    expect((await handleSocialAuth(request({}, { rawBody: '{' }), 'google')).status).toBe(400);
    expect((await handleSocialAuth(request({ idToken: 'x'.repeat(8193), accountType: 'CUSTOMER', returnTo: null }), 'google')).status).toBe(400);
    expect((await handleSocialAuth(request({}, { rawBody: JSON.stringify({ padding: 'x'.repeat(25 * 1024) }) }), 'google')).status).toBe(413);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('exchanges Google credentials server-side and returns only a safe no-store session', async () => {
    const response = await handleSocialAuth(request({ idToken: 'google-provider-secret', accountType: 'CUSTOMER', returnTo: '/en/profile' }), 'google');
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly.*SameSite=Lax/i);
    expect(text).not.toMatch(/google-provider-secret|platform-at-secret|platform-rt-secret/);
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'loginWithGoogle',
      input: { idToken: 'google-provider-secret', accountType: 'CUSTOMER' },
    }));
    expect(mocks.apiRequest.mock.calls[0]![0]).not.toHaveProperty('idempotencyKey');
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/', 'layout');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/profile');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/ar/profile');
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it('sends the exact Apple exchange shape and strips local returnTo state', async () => {
    await handleSocialAuth(request({ identityToken: 'apple-provider-secret', firstName: 'Ada', lastName: 'Lovelace', accountType: 'VENDOR', returnTo: '/ar/me/dashboard' }, { provider: 'apple' }), 'apple');
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'loginWithApple',
      input: { identityToken: 'apple-provider-secret', firstName: 'Ada', lastName: 'Lovelace', accountType: 'VENDOR' },
    }));
    expect(mocks.sessionQuery).toHaveBeenCalledWith('platform-at-secret', 'APPLE');
  });

  it('preserves normalized upstream conflict and outage status without echoing credentials', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new ApiContractError(createOperationError({ status: 409, code: 'ACCOUNT_CONFLICT', message: 'Account requires another sign-in method' })));
    const response = await handleSocialAuth(request({ idToken: 'provider-secret', accountType: 'CUSTOMER', returnTo: null }), 'google');
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('provider-secret');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
