import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only so the Node test runner can import server-only modules
vi.mock('server-only', () => ({}));

import { http, HttpResponse, delay } from 'msw';
import { server } from '../setup/msw-server';
import { serverEnv } from '@/lib/env/server';
import {
  GET,
  POST,
  DELETE,
  OPTIONS,
} from '@/app/api/bff/[...path]/route';
import {
  clearIdempotencyStore,
  setIdempotencyStore,
  resolveIdempotencyStore,
  RedisIdempotencyStore,
  MemoryIdempotencyStore,
  MockRedisClient,
  UnsafeIdempotencyConfigurationError,
} from '@/lib/security/idempotency';
import { signAccessToken } from '@/lib/auth/jwt';
import { generateCsrfToken } from '@/lib/auth/csrf';
import { AUTH_COOKIE_NAMES, signVendorScope } from '@/lib/auth/cookies';
import { REQUEST_ID_HEADER } from '@/lib/api/request-id';
import {
  createListingCard,
  createPageMeta,
  createUserProfile,
} from '../fixtures/factories';

const BACKEND_BASE = serverEnv.BACKEND_API_ORIGIN.replace(/\/+$/, '');
const SITE_ORIGIN = (serverEnv.SITE_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');

describe('TASK-017: Strict BFF Allowlist, Idempotency, and Catch-All Gateway Contract Tests', () => {
  beforeEach(() => {
    server.resetHandlers();
    clearIdempotencyStore();
  });

  // ── 1. BDD Acceptance Criteria ───────────────────────────────────────────────

  describe('BDD Acceptance Criteria: Allowlisted Mutation vs /v1/admin Proxy Attempt', () => {
    it('GIVEN a valid allowlisted mutation and an arbitrary /v1/admin proxy attempt, WHEN both reach the catch-all handler, THEN valid is schema-validated/correlated/idempotent, admin is rejected before upstream I/O, and neither leaks secrets', async () => {
      let adminUpstreamCalled = false;
      server.use(
        http.all(`${BACKEND_BASE}/v1/admin*`, () => {
          adminUpstreamCalled = true;
          return HttpResponse.json({ admin: 'secret_data' }, { status: 200 });
        })
      );

      let favoriteUpstreamCalled = false;
      let upstreamAuthHeader: string | null = null;
      server.use(
        http.post(`${BACKEND_BASE}/v1/listings/:publicId/favorite`, ({ request }) => {
          favoriteUpstreamCalled = true;
          upstreamAuthHeader = request.headers.get('authorization');
          return HttpResponse.json(
            { data: { favorited: true } },
            {
              status: 200,
              headers: {
                'X-Powered-By': 'Fastify-Hidden-Banner',
                'Server': 'Fastify/4.0',
              },
            }
          );
        })
      );

      // Part A: Arbitrary /v1/admin proxy attempt
      const adminReq = new Request(`${SITE_ORIGIN}/api/bff/v1/admin/users`, {
        method: 'GET',
        headers: {
          'x-request-id': 'req_admin_attempt_001',
        },
      });

      const adminRes = await GET(adminReq, {
        params: Promise.resolve({ path: ['v1', 'admin', 'users'] }),
      });

      expect(adminRes.status).toBe(404);
      expect(adminUpstreamCalled).toBe(false); // Rejected before upstream I/O

      const adminBody = await adminRes.json();
      expect(adminBody.error.code).toBe('NOT_FOUND');
      expect(adminBody.error.requestId).toBe('req_admin_attempt_001');
      expect(adminRes.headers.get('Server')).toBeNull();
      expect(adminRes.headers.get('X-Powered-By')).toBeNull();
      expect(JSON.stringify(adminBody)).not.toContain('secret_data');

      // Part B: Valid allowlisted mutation
      const validToken = await signAccessToken({ sub: 'user_123' });
      const csrfToken = generateCsrfToken();
      const idempotencyKey = 'idem_key_favorite_001';

      const favoriteReq = new Request(
        `${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${validToken}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrfToken}`,
            'x-csrf-token': csrfToken,
            'idempotency-key': idempotencyKey,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
            'x-request-id': 'req_fav_success_001',
          },
        }
      );

      const favoriteRes = await POST(favoriteReq, {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });

      expect(favoriteRes.status).toBe(200);
      expect(favoriteUpstreamCalled).toBe(true);
      expect(upstreamAuthHeader).toBe(`Bearer ${validToken}`);

      const favBody = await favoriteRes.json();
      expect(favBody).toEqual({ data: { favorited: true } });

      // Correlation check: same X-Request-Id returned
      expect(favoriteRes.headers.get(REQUEST_ID_HEADER)).toBe('req_fav_success_001');

      // Zero-leakage check: no server banner, no auth header in client response
      expect(favoriteRes.headers.get('Server')).toBeNull();
      expect(favoriteRes.headers.get('X-Powered-By')).toBeNull();
      expect(favoriteRes.headers.get('Authorization')).toBeNull();
      expect(JSON.stringify(favBody)).not.toContain(validToken);
    });
  });

  // ── 2. Security Checks: Traversal, Smuggling, and Disallowed Keywords ─────────

  describe('Security Checks: Path Smuggling, Directory Traversal, and Blocked Keywords', () => {
    it('rejects path traversal with .. or %2e%2e with 400 before upstream I/O', async () => {
      let upstreamCalled = false;
      server.use(
        http.all('*', () => {
          upstreamCalled = true;
          return HttpResponse.json({});
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/..%2fadmin`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy', '..', 'admin'] }),
      });

      expect(res.status).toBe(400);
      expect(upstreamCalled).toBe(false);
      const body = await res.json();
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects encoded path separators %2f and backslashes with 400', async () => {
      let upstreamCalled = false;
      server.use(
        http.all('*', () => {
          upstreamCalled = true;
          return HttpResponse.json({});
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy%2fmakes`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy%2fmakes'] }),
      });

      expect(res.status).toBe(400);
      expect(upstreamCalled).toBe(false);
      const body = await res.json();
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects disallowed keywords (scraper, swagger, worker, metrics, internal, testing) with 404', async () => {
      const blockedPaths = [
        ['scraper', 'listings'],
        ['swagger'],
        ['worker', 'jobs'],
        ['metrics'],
        ['internal', 'config'],
        ['testing', 'reset'],
      ];

      for (const pathSegments of blockedPaths) {
        const path = pathSegments.join('/');
        const req = new Request(`${SITE_ORIGIN}/api/bff/${path}`, {
          method: 'GET',
        });
        const res = await GET(req, {
          params: Promise.resolve({ path: pathSegments }),
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe('NOT_FOUND');
      }
    });

    it('rejects unallowlisted random routes with 404', async () => {
      const req = new Request(`${SITE_ORIGIN}/api/bff/some/random/unregistered/route`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ path: ['some', 'random', 'unregistered', 'route'] }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ── 3. HTTP Method Enforcement & Preflight ───────────────────────────────────

  describe('HTTP Method Matching and OPTIONS Preflight', () => {
    it('forwards validated public query parameters to the upstream request', async () => {
      let upstreamQuery = '';
      server.use(
        http.get(`${BACKEND_BASE}/v1/listings`, ({ request }) => {
          upstreamQuery = new URL(request.url).search;
          return HttpResponse.json({ data: [], meta: createPageMeta({ page: 2, limit: 24, total: 0, hasMore: false }) });
        })
      );
      const req = new Request(`${SITE_ORIGIN}/api/bff/listings?page=2&limit=24`, { method: 'GET' });
      const res = await GET(req, { params: Promise.resolve({ path: ['listings'] }) });
      expect(res.status).toBe(200);
      expect(new URLSearchParams(upstreamQuery).get('page')).toBe('2');
      expect(new URLSearchParams(upstreamQuery).get('limit')).toBe('24');
    });

    it('uses only a signed vendor cookie and maps dashboard range to upstream days', async () => {
      const token = await signAccessToken({ sub: 'manager_01' });
      let requestedDays: string | null = null;
      server.use(
        http.get(`${BACKEND_BASE}/v1/vendors/vnd_01/analytics/overview`, ({ request }) => {
          requestedDays = new URL(request.url).searchParams.get('days');
          return HttpResponse.json({ window: { days: 7, startAt: '2026-09-03T00:00:00.000Z' }, summary: { activeListingsCount: 2, totalViews: 10, totalLeads: 3, leadsByChannel: { WHATSAPP: 3 }, totalFavorites: 4, responseRatePercentage: 50 } });
        })
      );
      const req = new Request(`${SITE_ORIGIN}/api/bff/me/dashboard?range=7d&vendorPublicId=evil`, {
        method: 'GET',
        headers: {
          cookie: `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.VENDOR}=${signVendorScope('vnd_01')}`,
          'x-vendor-id': 'evil',
        },
      });
      const res = await GET(req, { params: Promise.resolve({ path: ['me', 'dashboard'] }) });
      expect(res.status).toBe(200);
      expect(requestedDays).toBe('7');

      const forged = new Request(`${SITE_ORIGIN}/api/bff/me/dashboard?range=7d`, {
        method: 'GET',
        headers: { cookie: `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.VENDOR}=evil` },
      });
      const forgedResponse = await GET(forged, { params: Promise.resolve({ path: ['me', 'dashboard'] }) });
      expect(forgedResponse.status).toBe(400);
    });

    it('executes valid GET operation on taxonomy makes', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/taxonomy/makes`, () => {
          return HttpResponse.json([
            {
              publicId: 'mak_01',
              slug: 'toyota',
              name: { ar: 'تويوتا', en: 'Toyota' },
              countryOfOrigin: 'Japan',
              isActive: true,
              sortOrder: 1,
              activeListingCount: 50,
            },
          ]);
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe('toyota');
    });

    it('returns 405 Method Not Allowed with Allow header on method mismatch', async () => {
      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'DELETE',
      });
      const res = await DELETE(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toContain('GET');
      const body = await res.json();
      expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('handles OPTIONS preflight by returning 204 with Allow and CORS headers', async () => {
      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'OPTIONS',
      });
      const res = await OPTIONS(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Allow')).toContain('GET');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });

  // ── 4. CSRF & Origin Enforcement ────────────────────────────────────────────

  describe('CSRF & Origin Protection on Mutations (TASK-014)', () => {
    it('rejects mutation without CSRF cookie with 403', async () => {
      const token = await signAccessToken({ sub: 'user_1' });
      const req = new Request(
        `${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`,
        {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}`,
            'x-csrf-token': 'some_token',
            'idempotency-key': 'idem_csrf_test_01',
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        }
      );
      const res = await POST(req, {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('rejects mutation with mismatched CSRF tokens with 403', async () => {
      const token = await signAccessToken({ sub: 'user_1' });
      const cookieCsrf = generateCsrfToken();
      const headerCsrf = generateCsrfToken(); // Different token

      const req = new Request(
        `${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`,
        {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${cookieCsrf}`,
            'x-csrf-token': headerCsrf,
            'idempotency-key': 'idem_csrf_test_02',
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        }
      );
      const res = await POST(req, {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('rejects mutation with Sec-Fetch-Site: cross-site unconditionally with 403', async () => {
      const token = await signAccessToken({ sub: 'user_1' });
      const csrf = generateCsrfToken();

      const req = new Request(
        `${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`,
        {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
            'x-csrf-token': csrf,
            'idempotency-key': 'idem_csrf_test_03',
            'origin': 'https://attacker.evil.com',
            'sec-fetch-site': 'cross-site',
          },
        }
      );
      const res = await POST(req, {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });

      expect(res.status).toBe(403);
    });

    it('exempts safe GET requests from CSRF requirements', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/taxonomy/makes`, () => {
          return HttpResponse.json([]);
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(200);
    });
  });

  // ── 5. Request Limits & Schema Validation ────────────────────────────────────

  describe('Payload Limits and Zod Schema Validation', () => {
    it('rejects payload exceeding maxBodySizeBytes with 413', async () => {
      const csrf = generateCsrfToken();
      const token = await signAccessToken({ sub: 'user_1' });

      // createLead maxBodySizeBytes is 1_048_576
      const hugePayload = 'x'.repeat(2 * 1024 * 1024);

      const req = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(hugePayload.length),
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': 'idem_huge_01',
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({ message: hugePayload }),
      });

      const res = await POST(req, {
        params: Promise.resolve({ path: ['leads'] }),
      });

      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects malformed JSON body with 400', async () => {
      const csrf = generateCsrfToken();
      const token = await signAccessToken({ sub: 'user_1' });

      const req = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': 'idem_malformed_01',
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
        },
        body: '{"invalid json: not closed',
      });

      const res = await POST(req, {
        params: Promise.resolve({ path: ['leads'] }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('JSON');
    });

    it('rejects body failing schema validation with 400 and field errors', async () => {
      const csrf = generateCsrfToken();
      const token = await signAccessToken({ sub: 'user_1' });

      // createLead requires listingPublicId, name, phone, type
      const req = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': 'idem_invalid_lead_01',
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          listingPublicId: 'invalid_id',
          name: '',
          phone: 'not-a-phone',
        }),
      });

      const res = await POST(req, {
        params: Promise.resolve({ path: ['leads'] }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.fieldErrors.length).toBeGreaterThan(0);
    });
  });

  // ── 6. Idempotency Engine (IDEM-01) ──────────────────────────────────────────

  describe('Idempotency Engine Replay and Conflict (IDEM-01)', () => {
    it('returns 400 when an operation requiring idempotency is missing Idempotency-Key', async () => {
      const csrf = generateCsrfToken();
      const token = await signAccessToken({ sub: 'user_1' });

      const req = new Request(
        `${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`,
        {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
            'x-csrf-token': csrf,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        }
      );

      const res = await POST(req, {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('replays cached response when identical request key and payload are submitted, calling upstream once', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BACKEND_BASE}/v1/listings/:publicId/favorite`, () => {
          callCount++;
          return HttpResponse.json({ data: { favorited: true } });
        })
      );

      const csrf = generateCsrfToken();
      const token = await signAccessToken({ sub: 'user_idem_01' });
      const idempotencyKey = 'unique_idem_key_12345';

      const makeRequest = () =>
        new Request(
          `${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`,
          {
            method: 'POST',
            headers: {
              'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
              'x-csrf-token': csrf,
              'idempotency-key': idempotencyKey,
              'origin': SITE_ORIGIN,
              'sec-fetch-site': 'same-origin',
              'x-request-id': 'req_first_call',
            },
          }
        );

      // Call 1: Executes upstream
      const res1 = await POST(makeRequest(), {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });
      expect(res1.status).toBe(200);
      expect(callCount).toBe(1);
      const body1 = await res1.json();
      expect(body1).toEqual({ data: { favorited: true } });
      expect(res1.headers.get('X-Idempotent-Replay')).toBeNull();

      // Call 2: Replays without calling upstream
      const res2 = await POST(makeRequest(), {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });
      expect(res2.status).toBe(200);
      expect(callCount).toBe(1); // Upstream was NOT called again
      const body2 = await res2.json();
      expect(body2).toEqual({ data: { favorited: true } });
      expect(res2.headers.get('X-Idempotent-Replay')).toBe('true');
    });

    it('returns 409 Conflict when same idempotency key is reused with a different payload', async () => {
      server.use(
        http.post(`${BACKEND_BASE}/v1/leads`, () => {
          return HttpResponse.json({
            data: {
              publicId: 'led_01h7x9k3p0000000000000001',
              channel: 'WHATSAPP',
              status: 'NEW',
              buyerName: 'Ahmed',
              buyerPhone: '+201000000001',
              note: 'Message 1',
              eventsCount: 0,
              lastActivityAt: '2026-01-01T12:00:00.000Z',
              createdAt: '2026-01-01T12:00:00.000Z',
              listing: {
                publicId: 'lst_01h7x9k3p0000000000000001',
                slug: 'mercedes-c200',
                title: 'Mercedes C200',
              },
              buyer: null,
              seller: null,
            },
          });
        })
      );

      const csrf = generateCsrfToken();
      const token = await signAccessToken({ sub: 'user_lead_01' });
      const idempotencyKey = 'idem_lead_conflict_key';

      // First call with payload A
      const req1 = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': idempotencyKey,
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          listingPublicId: 'lst_01h7x9k3p0000000000000001',
          channel: 'WHATSAPP',
          buyerName: 'Ahmed',
          buyerPhone: '+201000000001',
          note: 'Message 1',
          meta: null,
        }),
      });

      const res1 = await POST(req1, {
        params: Promise.resolve({ path: ['leads'] }),
      });
      expect(res1.status).toBe(201);

      // Second call with different payload B using same key
      const req2 = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': idempotencyKey,
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          listingPublicId: 'lst_01h7x9k3p0000000000000001',
          channel: 'WHATSAPP',
          buyerName: 'Mahmoud', // Changed name!
          buyerPhone: '+201000000002',
          note: 'Different message',
          meta: null,
        }),
      });

      const res2 = await POST(req2, {
        params: Promise.resolve({ path: ['leads'] }),
      });
      expect(res2.status).toBe(409);
      const body2 = await res2.json();
      expect(body2.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('isolates idempotency keys by user fingerprint (different users do not conflict)', async () => {
      server.use(
        http.post(`${BACKEND_BASE}/v1/listings/:publicId/favorite`, () => {
          return HttpResponse.json({ data: { favorited: true } });
        })
      );

      const csrf1 = generateCsrfToken();
      const token1 = await signAccessToken({ sub: 'user_alpha' });
      const csrf2 = generateCsrfToken();
      const token2 = await signAccessToken({ sub: 'user_beta' });

      const sharedKey = 'shared_key_across_users';

      // User 1 executes
      const res1 = await POST(
        new Request(`${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`, {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token1}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf1}`,
            'x-csrf-token': csrf1,
            'idempotency-key': sharedKey,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        }),
        {
          params: Promise.resolve({
            path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
          }),
        }
      );
      expect(res1.status).toBe(200);

      // User 2 executes with the same key
      const res2 = await POST(
        new Request(`${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`, {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token2}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf2}`,
            'x-csrf-token': csrf2,
            'idempotency-key': sharedKey,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        }),
        {
          params: Promise.resolve({
            path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
          }),
        }
      );
      expect(res2.status).toBe(200);
      expect(res2.headers.get('X-Idempotent-Replay')).toBeNull(); // Fresh execution for user 2
    });

    it('handles concurrent identical mutation requests safely by calling upstream only once and replaying response to concurrent waiter', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BACKEND_BASE}/v1/listings/:publicId/favorite`, async () => {
          callCount++;
          await delay(60); // In-flight processing delay
          return HttpResponse.json({ data: { favorited: true } });
        })
      );

      const token = await signAccessToken({ sub: 'user_concurrent_01' });
      const csrf = generateCsrfToken();
      const idempotencyKey = 'idem_concurrent_favorite_001';

      const createReq = (reqId: string) =>
        new Request(`${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`, {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
            'x-csrf-token': csrf,
            'idempotency-key': idempotencyKey,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
            'x-request-id': reqId,
          },
        });

      // Launch 2 requests simultaneously
      const [res1, res2] = await Promise.all([
        POST(createReq('req_conc_1'), {
          params: Promise.resolve({
            path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
          }),
        }),
        POST(createReq('req_conc_2'), {
          params: Promise.resolve({
            path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
          }),
        }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // Key invariant: upstream was called ONLY once despite concurrency!
      expect(callCount).toBe(1);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1).toEqual({ data: { favorited: true } });
      expect(body2).toEqual({ data: { favorited: true } });

      const replays = [res1.headers.get('X-Idempotent-Replay'), res2.headers.get('X-Idempotent-Replay')];
      expect(replays).toContain('true');
    });

    it('returns 409 Conflict immediately when a different-payload request arrives while the first is in flight', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BACKEND_BASE}/v1/leads`, async () => {
          callCount++;
          await delay(80);
          return HttpResponse.json({
            data: {
              publicId: 'led_inflight_01',
              channel: 'WHATSAPP',
              status: 'NEW',
              buyerName: 'First Caller',
              buyerPhone: '+201000000001',
              note: null,
              eventsCount: 0,
              lastActivityAt: '2026-01-01T12:00:00.000Z',
              createdAt: '2026-01-01T12:00:00.000Z',
              listing: {
                publicId: 'lst_01h7x9k3p0000000000000001',
                slug: 'mercedes-c200',
                title: 'Mercedes C200',
              },
              buyer: null,
              seller: null,
            },
          });
        })
      );

      const token = await signAccessToken({ sub: 'user_lead_concurrent' });
      const csrf = generateCsrfToken();
      const idempotencyKey = 'idem_lead_inflight_conflict_key';

      const req1 = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': idempotencyKey,
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
          'x-request-id': 'req_inflight_1',
        },
        body: JSON.stringify({
          listingPublicId: 'lst_01h7x9k3p0000000000000001',
          channel: 'WHATSAPP',
          buyerName: 'First Caller',
          buyerPhone: '+201000000001',
          note: null,
          meta: null,
        }),
      });

      const req2 = new Request(`${SITE_ORIGIN}/api/bff/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
          'x-csrf-token': csrf,
          'idempotency-key': idempotencyKey, // Same key!
          'origin': SITE_ORIGIN,
          'sec-fetch-site': 'same-origin',
          'x-request-id': 'req_inflight_2',
        },
        body: JSON.stringify({
          listingPublicId: 'lst_01h7x9k3p0000000000000001',
          channel: 'WHATSAPP',
          buyerName: 'Different Name Caller', // Different payload!
          buyerPhone: '+201000000002',
          note: null,
          meta: null,
        }),
      });

      // Start first request
      const p1 = POST(req1, { params: Promise.resolve({ path: ['leads'] }) });
      // Brief pause so req1 acquires the in-flight lock
      await new Promise((r) => setTimeout(r, 15));

      // Second request with different body arrives while req1 is in flight
      const res2 = await POST(req2, { params: Promise.resolve({ path: ['leads'] }) });
      expect(res2.status).toBe(409);
      const body2 = await res2.json();
      expect(body2.error.code).toBe('IDEMPOTENCY_CONFLICT');

      // First request finishes successfully
      const res1 = await p1;
      expect(res1.status).toBe(201);
      expect(callCount).toBe(1);
    });

    it('persists final response in durable Redis storage across simulated process restarts and multi-instance requests', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BACKEND_BASE}/v1/listings/:publicId/favorite`, () => {
          callCount++;
          return HttpResponse.json({ data: { favorited: true } });
        })
      );

      const sharedRedisClient = new MockRedisClient();
      const redisStore1 = new RedisIdempotencyStore({ client: sharedRedisClient });
      setIdempotencyStore(redisStore1);

      const token = await signAccessToken({ sub: 'user_restart_test' });
      const csrf = generateCsrfToken();
      const idempotencyKey = 'idem_restart_key_redis_123';

      const makeReq = () =>
        new Request(`${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`, {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
            'x-csrf-token': csrf,
            'idempotency-key': idempotencyKey,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        });

      // 1. Initial request executed on Instance 1
      const res1 = await POST(makeReq(), {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });
      expect(res1.status).toBe(200);
      expect(callCount).toBe(1);

      // 2. Simulate multi-instance / process restart: create brand new RedisIdempotencyStore instance
      // connected to the same underlying Redis database
      const redisStore2 = new RedisIdempotencyStore({ client: sharedRedisClient });
      setIdempotencyStore(redisStore2);

      // 3. Second request uses Instance 2, proving 24-hour persistence across nodes and processes
      const res2 = await POST(makeReq(), {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });
      expect(res2.status).toBe(200);
      expect(callCount).toBe(1); // Upstream was NOT called again
      expect(res2.headers.get('X-Idempotent-Replay')).toBe('true');
      const body2 = await res2.json();
      expect(body2).toEqual({ data: { favorited: true } });
    });

    it('enforces release ownership safety so an expired or non-owning caller cannot release another caller lock', async () => {
      const mockClient = new MockRedisClient();
      const store = new RedisIdempotencyStore({ client: mockClient });

      const key = 'test:ownership:key';
      const owner1 = 'token_owner_1';
      const owner2 = 'token_owner_2';

      // 1. Owner 1 reserves
      const res1 = await store.reserve({
        key,
        ownerToken: owner1,
        fingerprint: 'usr:1',
        operation: 'addFavorite',
        idempotencyKey: 'idem_own_1',
        requestHash: 'hash_1',
        lockTimeoutMs: 30000,
      });
      expect(res1.reserved).toBe(true);

      // 2. Owner 2 attempts to release Owner 1 lock with mismatched token
      await store.release(key, owner2);

      // Lock MUST STILL EXIST because owner2 does not own the reservation!
      const stillThere = await store.get(key);
      expect(stillThere).toBeDefined();
      expect(stillThere?.status).toBe('IN_FLIGHT');

      // 3. Owner 1 releases with matching token
      await store.release(key, owner1);

      // Lock is now released
      const afterRelease = await store.get(key);
      expect(afterRelease).toBeUndefined();
    });

    it('does not let a late lease owner finalize or release a reservation reclaimed by a newer owner', async () => {
      const store = new RedisIdempotencyStore({ client: new MockRedisClient() });
      const key = 'test:late-owner:key';
      const owner1 = 'expired_owner';
      const owner2 = 'reclaimed_owner';
      const reservation = {
        key,
        fingerprint: 'usr:1',
        operation: 'addFavorite',
        idempotencyKey: 'idem_late_owner',
        requestHash: 'hash_1',
      };

      expect((await store.reserve({ ...reservation, ownerToken: owner1, lockTimeoutMs: 1 })).reserved).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect((await store.reserve({ ...reservation, ownerToken: owner2, lockTimeoutMs: 30000 })).reserved).toBe(true);

      await store.finalize({
        key,
        ownerToken: owner1,
        ttlMs: 86400000,
        response: { status: 200, body: { stale: true } },
      });
      await store.release(key, owner1);

      const inFlight = await store.get(key);
      expect(inFlight).toMatchObject({ status: 'IN_FLIGHT', ownerToken: owner2 });

      await store.finalize({
        key,
        ownerToken: owner2,
        ttlMs: 86400000,
        response: { status: 200, body: { fresh: true } },
      });
      expect(await store.get(key)).toMatchObject({
        status: 'COMPLETED',
        response: { status: 200, body: { fresh: true } },
      });
    });

    it('forbids silent in-memory fallback in production and enforces Redis configuration', () => {
      // Production with driver=memory strictly throws UnsafeIdempotencyConfigurationError
      expect(() => {
        resolveIdempotencyStore({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          IDEMPOTENCY_STORAGE_DRIVER: 'memory',
        });
      }).toThrow(UnsafeIdempotencyConfigurationError);

      // Production with driver=redis but missing REDIS_URL throws UnsafeIdempotencyConfigurationError
      expect(() => {
        resolveIdempotencyStore({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          IDEMPOTENCY_STORAGE_DRIVER: 'redis',
          REDIS_URL: '',
        });
      }).toThrow(UnsafeIdempotencyConfigurationError);

      // Production with driver=redis and valid REDIS_URL returns RedisIdempotencyStore
      const prodStore = resolveIdempotencyStore({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        IDEMPOTENCY_STORAGE_DRIVER: 'redis',
        REDIS_URL: 'redis://prod-redis.internal:6379/0',
        IDEMPOTENCY_TTL_SECONDS: 86400,
      });
      expect(prodStore).toBeInstanceOf(RedisIdempotencyStore);
      expect((prodStore as RedisIdempotencyStore).ttlSeconds).toBe(86400);

      // Development / Test permits MemoryIdempotencyStore
      const devStore = resolveIdempotencyStore({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        IDEMPOTENCY_STORAGE_DRIVER: 'memory',
      });
      expect(devStore).toBeInstanceOf(MemoryIdempotencyStore);
    });

    it('releases in-flight reservation on upstream failure so a subsequent retry can succeed', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BACKEND_BASE}/v1/listings/:publicId/favorite`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({ error: 'Transient upstream 500 failure' }, { status: 500 });
          }
          return HttpResponse.json({ data: { favorited: true } }, { status: 200 });
        })
      );

      const token = await signAccessToken({ sub: 'user_retry_glitch' });
      const csrf = generateCsrfToken();
      const idempotencyKey = 'idem_glitch_retry_key_456';

      const makeReq = () =>
        new Request(`${SITE_ORIGIN}/api/bff/listings/lst_01h7x9k3p0000000000000001/favorite`, {
          method: 'POST',
          headers: {
            'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN}=${csrf}`,
            'x-csrf-token': csrf,
            'idempotency-key': idempotencyKey,
            'origin': SITE_ORIGIN,
            'sec-fetch-site': 'same-origin',
          },
        });

      // Call 1 fails with 500
      const res1 = await POST(makeReq(), {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });
      expect(res1.status).toBe(500);

      // Call 2 (retry with same key) must succeed and execute upstream
      const res2 = await POST(makeReq(), {
        params: Promise.resolve({
          path: ['listings', 'lst_01h7x9k3p0000000000000001', 'favorite'],
        }),
      });
      expect(res2.status).toBe(200);
      expect(callCount).toBe(2);
      const body2 = await res2.json();
      expect(body2).toEqual({ data: { favorited: true } });
    });
  });

  // ── 7. Upstream Contract Mismatch, Timeouts & Error Normalization ────────────

  describe('Upstream Errors, Contract Mismatch, and Timeouts (ERR-01, OUT-01, OBS-01)', () => {
    it('returns 502 UPSTREAM_CONTRACT_MISMATCH on malformed upstream response without leaking raw data', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/taxonomy/makes`, () => {
          // Missing required fields 'name', 'countryOfOrigin', etc.
          return HttpResponse.json([
            {
              publicId: 'mak_01',
              internalDbSecret: 'secret_leak_attempt_db_123',
            },
          ]);
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'GET',
        headers: { 'x-request-id': 'req_mismatch_test_01' },
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
      expect(body.error.requestId).toBe('req_mismatch_test_01');
      expect(JSON.stringify(body)).not.toContain('secret_leak_attempt_db_123');
    });

    it('maps upstream 500 error to normalized OperationError with same X-Request-Id', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/taxonomy/makes`, () => {
          return HttpResponse.json(
            {
              statusCode: 500,
              error: 'Internal Server Error',
              message: 'database connection error: SELECT * FROM secrets WHERE id = 1 error at /var/app/index.js:12:4',
            },
            { status: 500 }
          );
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'GET',
        headers: { 'x-request-id': 'req_upstream_500' },
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.status).toBe(500);
      expect(body.error.requestId).toBe('req_upstream_500');
      // Redaction check: never leaks DB query or file path
      expect(JSON.stringify(body)).not.toContain('SELECT * FROM');
      expect(JSON.stringify(body)).not.toContain('/var/app');
    });

    it('returns 504 GATEWAY_TIMEOUT on upstream timeout', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/taxonomy/makes`, async () => {
          await delay(150);
          return HttpResponse.json([]);
        })
      );

      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), 50);

      const req = new Request(`${SITE_ORIGIN}/api/bff/taxonomy/makes`, {
        method: 'GET',
        signal: controller.signal,
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['taxonomy', 'makes'] }),
      });

      expect(res.status).toBe(504);
      const body = await res.json();
      expect(body.error.code).toBe('GATEWAY_TIMEOUT');
    });
  });

  // ── 8. CACHE-01 Guest-Safe Public Cache & Session Separation ─────────────────

  describe('Guest-Safe Public Cache & Session Isolation (CACHE-01)', () => {
    it('forces isFavorited: false on anonymous public listing reads with public Cache-Control', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/listings`, () => {
          return HttpResponse.json({
            data: [
              createListingCard({ isFavorited: true }),
            ],
            meta: createPageMeta({ hasMore: false }),
          });
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/listings`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ path: ['listings'] }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // CACHE-01: Forced to false for anonymous public read!
      expect(body.data[0].isFavorited).toBe(false);
      expect(res.headers.get('Cache-Control')).toContain('public');
      expect(res.headers.get('Cache-Control')).toContain('s-maxage=30');
    });

    it('returns private, no-store Cache-Control for authenticated listing reads', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/listings`, () => {
          return HttpResponse.json({
            data: [],
            meta: createPageMeta({ total: 0, hasMore: false }),
          });
        })
      );

      const token = await signAccessToken({ sub: 'user_auth_search' });
      const req = new Request(`${SITE_ORIGIN}/api/bff/listings`, {
        method: 'GET',
        headers: {
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${token}`,
        },
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['listings'] }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    });
  });

  // ── 9. Single-Flight Auth Refresh Rotation ───────────────────────────────────

  describe('Single-Flight Refresh Retry on Upstream 401', () => {
    it('refreshes token once on 401, retries upstream once, and emits rotated Set-Cookie headers', async () => {
      let callAttempts = 0;
      const initialToken = 'expired_access_token_123';
      const newAccessToken = await signAccessToken({ sub: 'user_refreshed_01' });
      const validRefreshToken = 'valid_refresh_token_456';

      server.use(
        http.get(`${BACKEND_BASE}/v1/me`, ({ request }) => {
          callAttempts++;
          const auth = request.headers.get('authorization');
          if (auth === `Bearer ${initialToken}`) {
            return HttpResponse.json({ error: 'Token expired' }, { status: 401 });
          }
          if (auth === `Bearer ${newAccessToken}`) {
            return HttpResponse.json({
              data: createUserProfile({ email: 'refreshed@example.com' }),
            });
          }
          return HttpResponse.json({}, { status: 403 });
        }),
        http.post(`${BACKEND_BASE}/v1/auth/refresh`, () => {
          return HttpResponse.json({
            accessToken: newAccessToken,
            refreshToken: 'new_rotated_refresh_token_789',
            expiresIn: 900,
          });
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/me`, {
        method: 'GET',
        headers: {
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=${initialToken}; ${AUTH_COOKIE_NAMES.DEVELOPMENT.REFRESH_TOKEN}=${validRefreshToken}`,
        },
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['me'] }),
      });

      expect(res.status).toBe(200);
      expect(callAttempts).toBe(2); // Retried once!

      // Verify Set-Cookie header contains rotated access token and CSRF token
      const setCookies = res.headers.get('set-cookie');
      expect(setCookies).not.toBeNull();
      expect(setCookies).toContain(AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN);
      expect(setCookies).toContain(AUTH_COOKIE_NAMES.DEVELOPMENT.CSRF_TOKEN);
    });

    it('clears cookies atomically and returns 401 when refresh token is rejected upstream', async () => {
      server.use(
        http.get(`${BACKEND_BASE}/v1/me`, () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),
        http.post(`${BACKEND_BASE}/v1/auth/refresh`, () => {
          return HttpResponse.json({ error: 'Session revoked' }, { status: 401 });
        })
      );

      const req = new Request(`${SITE_ORIGIN}/api/bff/me`, {
        method: 'GET',
        headers: {
          'cookie': `${AUTH_COOKIE_NAMES.DEVELOPMENT.ACCESS_TOKEN}=expired_token; ${AUTH_COOKIE_NAMES.DEVELOPMENT.REFRESH_TOKEN}=revoked_refresh_token`,
        },
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['me'] }),
      });

      expect(res.status).toBe(401);
      const setCookies = res.headers.get('set-cookie');
      expect(setCookies).not.toBeNull();
      // Verifies cookie clearing (Max-Age=0 or Expires in the past)
      expect(setCookies).toContain('Max-Age=0');
    });
  });
});
