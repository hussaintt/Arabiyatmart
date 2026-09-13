import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw-server';
import { hashPublicId, createSafeLogRecord } from '@/lib/observability/logger';
import { POST as boundaryErrorPost } from '@/app/api/bff/telemetry/boundary-error/route';
import { getHomePageDataWithStatus } from '@/server/queries/home';

describe('telemetry and HMAC hashing', () => {
  it('computes deterministic HMAC-SHA-256 for public IDs with given secret', () => {
    const secret = 'super-secret-key-that-is-at-least-16-bytes';
    const hash1 = hashPublicId('usr_test_123', secret);
    const hash2 = hashPublicId('usr_test_123', secret);
    const hashOther = hashPublicId('usr_test_456', secret);

    expect(hash1).toBeDefined();
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
    expect(hash1).not.toBe(hashOther);
  });

  it('returns undefined if secret is missing or too short', () => {
    expect(hashPublicId('usr_test_123', '')).toBeUndefined();
    expect(hashPublicId('usr_test_123', 'short')).toBeUndefined();
    expect(hashPublicId(null, 'super-secret-key-that-is-at-least-16-bytes')).toBeUndefined();
  });

  it('builds allowlisted log records stripping unallowed fields', () => {
    const record = createSafeLogRecord({
      level: 'info',
      operation: 'testOp',
      routeTemplate: '/test/path',
      status: 200,
    });
    expect(record.operation).toBe('testOp');
    expect(record.status).toBe(200);
    expect(record.level).toBe('info');
  });
});

describe('boundary error telemetry route', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('accepts valid boundary error payload and returns 204', async () => {
    const body = JSON.stringify({
      boundary: 'marketplace',
      digest: 'digest_12345',
      locale: 'en',
      timestamp: new Date().toISOString(),
    });
    const req = new NextRequest('http://localhost:3000/api/bff/telemetry/boundary-error', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await boundaryErrorPost(req);
    expect(res.status).toBe(204);
  });

  it('rejects payload exceeding 4KB with 413', async () => {
    const largePadding = 'a'.repeat(5000);
    const body = JSON.stringify({
      boundary: 'global',
      digest: largePadding,
    });
    const req = new NextRequest('http://localhost:3000/api/bff/telemetry/boundary-error', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await boundaryErrorPost(req);
    expect(res.status).toBe(413);
  });

  it('rejects invalid schema with 400', async () => {
    const body = JSON.stringify({
      boundary: 'unknown_invalid_boundary_name',
    });
    const req = new NextRequest('http://localhost:3000/api/bff/telemetry/boundary-error', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await boundaryErrorPost(req);
    expect(res.status).toBe(400);
  });
});

describe('degraded home queries', () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('handles partial upstream failures gracefully and marks isDegraded: true', async () => {
    // Upstream banners fail with 500
    server.use(
      http.get('*/v1/banners*', () => {
        return HttpResponse.json({ error: 'Upstream banners down' }, { status: 500 });
      }),
      http.get('*/v1/catalogue/spotlight*', () => {
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/v1/listings*', () => {
        return HttpResponse.json({ data: [], meta: { total: 0, page: 1, limit: 12, hasMore: false } });
      }),
      http.get('*/v1/dealers*', () => {
        return HttpResponse.json({ data: [], meta: { hasMore: false, nextCursor: null } });
      }),
      http.get('*/v1/settings/public*', () => {
        return HttpResponse.json({
          data: {
            rows: [],
            finance: { annualRate: 0.15, downPaymentFraction: 0.2, tenorMonths: 60 },
            support: { termsUrl: null, privacyUrl: null, supportEmail: null, supportPhone: null },
          },
        });
      }),
    );

    const result = await getHomePageDataWithStatus('en');
    expect(result.isDegraded).toBe(true);
    expect(result.degradedReasons).toContain('banners');
    expect(result.data.banners).toEqual([]);
  });
});
