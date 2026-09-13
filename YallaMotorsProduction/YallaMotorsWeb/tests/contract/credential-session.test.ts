import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET as getSession } from '@/app/api/bff/session/route';
import { POST as refreshSession } from '@/app/api/bff/auth/refresh/route';

describe('TASK-018 credential session boundary', () => {
  it('returns an anonymous, private no-store session when no credentials are present', async () => {
    const response = await getSession(new Request('http://localhost:3000/api/bff/session'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ data: null });
  });

  it('rejects an explicit refresh without same-origin CSRF proof', async () => {
    const response = await refreshSession(new Request('http://localhost:3000/api/bff/auth/refresh', { method: 'POST' }));
    expect(response.status).toBe(403);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(body)).not.toMatch(/accessToken|refreshToken/i);
  });

  it('does not disclose cookie credentials when an explicit refresh has no refresh cookie', async () => {
    const csrf = 'a'.repeat(64);
    const response = await refreshSession(new Request('http://localhost:3000/api/bff/auth/refresh', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'sec-fetch-site': 'same-origin',
        cookie: `am_csrf=${csrf}`,
        'x-csrf-token': csrf,
      },
    }));
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toMatch(/accessToken|refreshToken/i);
  });
});
