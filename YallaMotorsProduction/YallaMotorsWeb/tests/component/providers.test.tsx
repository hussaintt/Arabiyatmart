import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dehydrate, QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { browserApiRequest } from '@/lib/api/browser';
import { AppProviders } from '@/providers/app-providers';
import { useSession } from '@/providers/session-provider';
import type { SafeSession } from '@/types/auth';

const session: SafeSession = {
  isAuthenticated: true, signInMethod: 'RESTORED',
  user: { publicId: 'user-1', email: 'user@example.com', phone: null, firstName: 'Test', lastName: 'User', status: 'ACTIVE', locale: 'ar', emailVerifiedAt: '2026-01-01T00:00:00.000Z', phoneVerifiedAt: null, kycStatus: 'NOT_SUBMITTED', kycApprovedAt: null, kycRejectionReason: null, lastLoginAt: null, createdAt: '2026-01-01T00:00:00.000Z', avatarUrl: null, accountType: 'CUSTOMER', roles: [], permissions: [] },
};

afterEach(cleanup);

function SessionProbe() {
  const value = useSession();
  return <><p>{value.status}:{value.session?.user.publicId ?? 'none'}</p><button onClick={() => void value.refetch()}>Refetch</button></>;
}

describe('application providers and browser transport', () => {
  it('hydrates a validated token-free safe session without a loading flash', () => {
    render(<AppProviders initialSession={session}><SessionProbe /></AppProviders>);
    expect(screen.getByText('authenticated:user-1')).toBeInTheDocument();
  });

  it('retains one QueryClient across rerenders', () => {
    const clients: QueryClient[] = [];
    function Probe({ label }: { label: string }) { clients.push(useQueryClient()); return <span>{label}</span>; }
    const view = render(<AppProviders initialSession={null}><Probe label="one" /></AppProviders>);
    view.rerender(<AppProviders initialSession={null}><Probe label="two" /></AppProviders>);
    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(new Set(clients).size).toBe(1);
  });

  it('hydrates schema-safe dehydrated query data', () => {
    const serverClient = new QueryClient();
    serverClient.setQueryData(['hydrated'], { value: 'server-value' });
    function Probe() {
      const result = useQuery({ queryKey: ['hydrated'], queryFn: async () => ({ value: 'browser-value' }), staleTime: Infinity });
      return <p>{result.data?.value}</p>;
    }
    render(<AppProviders initialSession={null} dehydratedState={dehydrate(serverClient)}><Probe /></AppProviders>);
    expect(screen.getByText('server-value')).toBeInTheDocument();
  });

  it('rejects non-serializable dehydrated state before hydration', () => {
    const unsafeState = {
      mutations: [],
      queries: [{ queryHash: 'unsafe', queryKey: ['unsafe'], state: { data: new Date() } }],
    } as unknown as ReturnType<typeof dehydrate>;
    expect(() => render(<AppProviders initialSession={null} dehydratedState={unsafeState}><p>unsafe</p></AppProviders>)).toThrow();
  });

  it('adds same-origin credentials, CSRF, request ID, and idempotency to mutations', async () => {
    document.cookie = 'am_csrf=csrf-browser-value; Path=/';
    const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(init?.credentials).toBe('same-origin');
      expect(headers.get('x-csrf-token')).toBe('csrf-browser-value');
      expect(headers.get('x-request-id')).toBeTruthy();
      expect(headers.get('idempotency-key')).toBe('mutation-key-1');
      expect(headers.has('authorization')).toBe(false);
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApiRequest({ path: '/api/bff/profile', method: 'PATCH', input: { name: 'Ada' }, inputSchema: z.object({ name: z.string() }), outputSchema: z.object({ ok: z.literal(true) }), idempotencyKey: 'mutation-key-1' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fails closed before fetch when mutation CSRF is absent', async () => {
    document.cookie = 'am_csrf=; Max-Age=0; Path=/';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(browserApiRequest({ path: '/api/bff/profile', method: 'PATCH', input: {}, outputSchema: z.object({ ok: z.boolean() }) })).rejects.toMatchObject({ status: 403, code: 'CSRF_TOKEN_MISSING' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes abort signals and rejects unsafe or encoded traversal BFF paths', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await browserApiRequest({ path: '/api/bff/session', outputSchema: z.object({ ok: z.literal(true) }), signal: controller.signal });
    await expect(browserApiRequest({ path: '/api/bff/%252e%252e/admin', outputSchema: z.object({}) })).rejects.toThrow(/unsafe path/i);
    await expect(browserApiRequest({ path: 'https://evil.example/api/bff/session', outputSchema: z.object({}) })).rejects.toThrow(/same-origin/i);
  });

  it('moves from anonymous to authenticated only after a validated refetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: session }), { headers: { 'content-type': 'application/json' } })));
    render(<AppProviders initialSession={null}><SessionProbe /></AppProviders>);
    expect(screen.getByText('anonymous:none')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refetch' }));
    await waitFor(() => expect(screen.getByText('authenticated:user-1')).toBeInTheDocument());
  });

  it('contains no browser credential symbols or persistent credential storage APIs', () => {
    const files = [
      'src/lib/api/browser.ts',
      'src/providers/query-provider.tsx',
      'src/providers/session-provider.tsx',
      'src/providers/toast-provider.tsx',
      'src/providers/app-providers.tsx',
    ];
    const source = files.map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');
    expect(source).not.toMatch(/accessToken|refreshToken|localStorage|sessionStorage|Authorization\s*:/);
  });
});
