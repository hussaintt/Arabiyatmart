import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only so the Node test runner can import server-only modules
vi.mock('server-only', () => ({}));

import { http, HttpResponse, delay } from 'msw';
import { z } from 'zod';
import { server } from '../setup/msw-server';
import { serverEnv } from '@/lib/env/server';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import {
  serverApiRequest,
  serverApiRequestSafe,
  setServerCredentialResolver,
  ApiContractError,
  type UpstreamEndpointBuilder,
} from '@/lib/api/server';
import {
  adaptBareArray,
  adaptWrappedRows,
  adapt204Acknowledgement,
  adaptNullableTotalsAndReasons,
  stripDeviceToken,
  stripNumericIds,
  adaptTypeAnyNotification,
  adaptCountryConfig,
} from '@/lib/api/adapters';
import {
  MakeSchema,
  MakeListResponseSchema,
  CountryConfigResponseSchema,
} from '@/lib/api/schemas/taxonomy';
import {
  DeviceRegistrationResponseSchema,
  NotificationResponseSchema,
} from '@/lib/api/schemas/notification';
import {
  MutationAckResponseSchema,
  OperationErrorSchema,
} from '@/lib/api/schemas/common';
import { FIXED_REQUEST_ID } from '../fixtures/factories';

const BASE_URL = serverEnv.BACKEND_API_ORIGIN.replace(/\/+$/, '');

const SampleMake = {
  publicId: 'mak_toyota_01',
  slug: 'toyota',
  name: { ar: 'تويوتا', en: 'Toyota' },
  logoUrl: 'https://images.unsplash.com/toyota-logo.png',
  countryOfOrigin: 'Japan',
  isActive: true,
  sortOrder: 1,
  activeListingCount: 150,
};

describe('TASK-013: Server-Only Upstream API Client & Adapters Contract Tests', () => {
  beforeEach(() => {
    server.resetHandlers();
    setServerCredentialResolver(null);
  });

  // ── 1. Valid Responses & Output Schema Validation ──────────────────────────

  it('successfully fetches and validates an upstream 200 response matching output schema using UPSTREAM_ENDPOINTS', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return HttpResponse.json({ data: [SampleMake] });
      })
    );

    const result = await serverApiRequest({
      operation: 'getMakes',
      method: 'GET',
      endpoint: UPSTREAM_ENDPOINTS.makes,
      outputSchema: MakeListResponseSchema,
      authMode: 'P',
      requestId: FIXED_REQUEST_ID,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.publicId).toBe('mak_toyota_01');
    expect(result.data[0]?.slug).toBe('toyota');
  });

  // ── 2. Acceptance Criteria (Strict BDD) ────────────────────────────────────

  it('GIVEN an upstream 200 response missing a required Phase 2 field WHEN serverApiRequest validates THEN callers receive typed 502 UPSTREAM_CONTRACT_MISMATCH without raw payload and issue paths logged', async () => {
    // Upstream 200 returns an object missing the required 'slug' and 'name'
    const malformedPayload = {
      publicId: 'mak_toyota_01',
      isActive: true,
      sortOrder: 1,
      // 'slug' and 'name' are missing!
      // also include sensitive details that must NOT leak to caller
      _rawSecretData: 'SUPER_SECRET_INTERNAL_UPSTREAM_TOKEN',
      internalDbId: 998822,
    };

    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/trims/trm_incomplete`, () => {
        return HttpResponse.json(malformedPayload);
      })
    );

    const warnSpy = vi.spyOn(console, 'warn');

    let caughtError: unknown;
    try {
      await serverApiRequest({
        operation: 'getTrim',
        method: 'GET',
        endpoint: () => UPSTREAM_ENDPOINTS.trim('trm_incomplete'),
        outputSchema: MakeSchema,
        authMode: 'P',
        requestId: FIXED_REQUEST_ID,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiContractError);
    const contractError = caughtError as ApiContractError;

    // Callers receive typed 502 UPSTREAM_CONTRACT_MISMATCH
    expect(contractError.body.error.status).toBe(502);
    expect(contractError.body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
    expect(contractError.body.error.requestId).toBe(FIXED_REQUEST_ID);

    // Error body validates against OperationErrorSchema
    expect(() => OperationErrorSchema.parse(contractError.body)).not.toThrow();

    // Raw payload is NOT returned in the error body or message
    expect(JSON.stringify(contractError.body)).not.toContain('SUPER_SECRET_INTERNAL_UPSTREAM_TOKEN');
    expect(JSON.stringify(contractError.body)).not.toContain('998822');
    expect(contractError.message).not.toContain('SUPER_SECRET_INTERNAL_UPSTREAM_TOKEN');

    // Logs contain operation name, request ID, and schema issue paths
    expect(warnSpy).toHaveBeenCalled();
    const logCall = warnSpy.mock.calls.find((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('getTrim'))
    );
    expect(logCall).toBeDefined();
    const formattedLog = logCall?.join(' ') ?? '';
    expect(formattedLog).toContain('getTrim');
    expect(formattedLog).toContain(FIXED_REQUEST_ID);
    expect(formattedLog).toContain('slug');
    expect(formattedLog).toContain('name');
    expect(formattedLog).not.toContain('SUPER_SECRET_INTERNAL_UPSTREAM_TOKEN');

    warnSpy.mockRestore();
  });

  // ── 3. Malformed JSON Response ─────────────────────────────────────────────

  it('rejects upstream 200 response with malformed non-parseable JSON with 502 UPSTREAM_CONTRACT_MISMATCH', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return new HttpResponse('{invalid-json-body', {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const warnSpy = vi.spyOn(console, 'warn');

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: FIXED_REQUEST_ID,
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(502);
      expect(apiErr.body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
      expect(apiErr.body.error.requestId).toBe(FIXED_REQUEST_ID);
      return true;
    });

    warnSpy.mockRestore();
  });

  // ── 4. Oversized Response Enforcing Size Limit ─────────────────────────────

  it('rejects upstream responses that exceed maxResponseSizeBytes limit with 502 UPSTREAM_CONTRACT_MISMATCH', async () => {
    const largePayload = JSON.stringify({
      data: [
        {
          ...SampleMake,
          extraPadding: 'x'.repeat(1024 * 50), // 50 KB
        },
      ],
    });

    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return new HttpResponse(largePayload, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(largePayload)),
          },
        });
      })
    );

    const warnSpy = vi.spyOn(console, 'warn');

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: FIXED_REQUEST_ID,
        maxResponseSizeBytes: 1024, // 1 KB limit set for test
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(502);
      expect(apiErr.body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
      expect(apiErr.body.error.message).toContain('size limit');
      return true;
    });

    warnSpy.mockRestore();
  });

  // ── 5. Slow Response / Timeout ─────────────────────────────────────────────

  it('aborts on slow upstream response exceeding timeoutMs and returns 504 GATEWAY_TIMEOUT', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, async () => {
        await delay(150);
        return HttpResponse.json({ data: [SampleMake] });
      })
    );

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: FIXED_REQUEST_ID,
        timeoutMs: 30, // 30ms timeout
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(504);
      expect(apiErr.body.error.code).toBe('GATEWAY_TIMEOUT');
      expect(apiErr.body.error.requestId).toBe(FIXED_REQUEST_ID);
      return true;
    });
  });

  // ── 6. Media Types (Recognizing application/json and application/*+json) ────

  it('rejects upstream response with non-JSON content-type with 502 UPSTREAM_CONTRACT_MISMATCH', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return new HttpResponse('<html><body>502 Bad Gateway</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      })
    );

    const warnSpy = vi.spyOn(console, 'warn');

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: FIXED_REQUEST_ID,
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(502);
      expect(apiErr.body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
      expect(apiErr.body.error.message).toContain('non-JSON');
      return true;
    });

    warnSpy.mockRestore();
  });

  it('recognizes application/*+json media types (e.g. application/problem+json, application/vnd.api+json)', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return new HttpResponse(JSON.stringify({ data: [SampleMake] }), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json; charset=utf-8' },
        });
      })
    );

    const result = await serverApiRequest({
      operation: 'getMakes',
      method: 'GET',
      endpoint: UPSTREAM_ENDPOINTS.makes,
      outputSchema: MakeListResponseSchema,
      authMode: 'P',
      requestId: FIXED_REQUEST_ID,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.slug).toBe('toyota');
  });

  // ── 7. Caller Aborted Request ──────────────────────────────────────────────

  it('handles caller-aborted signals and returns 504 GATEWAY_TIMEOUT', async () => {
    const controller = new AbortController();

    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, async () => {
        await delay(100);
        return HttpResponse.json({ data: [SampleMake] });
      })
    );

    const requestPromise = serverApiRequest({
      operation: 'getMakes',
      method: 'GET',
      endpoint: UPSTREAM_ENDPOINTS.makes,
      outputSchema: MakeListResponseSchema,
      authMode: 'P',
      requestId: FIXED_REQUEST_ID,
      signal: controller.signal,
    });

    // Abort after 10ms
    setTimeout(() => {
      controller.abort();
    }, 10);

    await expect(requestPromise).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(504);
      expect(apiErr.body.error.code).toBe('GATEWAY_TIMEOUT');
      return true;
    });
  });

  // ── 8. SSRF & Protocol-Relative URL Rejection (Issue 1) ────────────────────

  describe('SSRF and Registry Enforcement', () => {
    it('strictly rejects a direct string passed through an untyped runtime call as 400 BAD_REQUEST', async () => {
      await expect(
        serverApiRequest({
          operation: 'getDirectStringEndpoint',
          method: 'GET',
          // Untyped runtime bypass passing a raw string instead of an endpoint builder function
          endpoint: '/v1/taxonomy/makes' as unknown as UpstreamEndpointBuilder,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        expect(apiErr.body.error.message).toContain('builder function');
        return true;
      });
    });

    it('strictly rejects a direct protocol-relative string at runtime before builder evaluation', async () => {
      await expect(
        serverApiRequest({
          operation: 'getMaliciousStringEndpoint',
          method: 'GET',
          endpoint: '//attacker.example/v1/taxonomy/makes' as unknown as UpstreamEndpointBuilder,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        expect(apiErr.body.error.message).toContain('builder function');
        return true;
      });
    });

    it('strictly rejects protocol-relative endpoints from builders (//attacker.example/...) as 400 BAD_REQUEST', async () => {
      await expect(
        serverApiRequest({
          operation: 'getMaliciousEndpoint',
          method: 'GET',
          endpoint: (() => '//attacker.example/v1/taxonomy/makes') as UpstreamEndpointBuilder,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        expect(apiErr.body.error.message).toContain('protocol-relative');
        return true;
      });
    });

    it('strictly rejects absolute URL endpoints from builders (https://evil.com/...) as 400 BAD_REQUEST', async () => {
      await expect(
        serverApiRequest({
          operation: 'getAbsoluteUrlEndpoint',
          method: 'GET',
          endpoint: (() => 'https://evil.com/v1/taxonomy/makes') as UpstreamEndpointBuilder,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        return true;
      });
    });

    it('strictly rejects unregistered arbitrary endpoints from builders not present in UPSTREAM_ENDPOINTS registry', async () => {
      await expect(
        serverApiRequest({
          operation: 'getArbitraryEndpoint',
          method: 'GET',
          endpoint: (() => '/v1/unregistered/arbitrary/path') as UpstreamEndpointBuilder,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        expect(apiErr.body.error.message).toContain('not registered');
        return true;
      });
    });
  });

  // ── 9. Credential Isolation & Server-Only Resolver (Issue 2) ───────────────

  describe('Credential Isolation & Server-Only Resolver', () => {
    it('proves caller custom Authorization header is NEVER forwarded in any mode', async () => {
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(`${BASE_URL}/v1/taxonomy/makes`, ({ request }) => {
          capturedHeaders = new Headers(request.headers);
          return HttpResponse.json({ data: [SampleMake] });
        })
      );

      // Attempt injection via custom headers across modes
      await serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        headers: {
          Authorization: 'Bearer malicious-caller-injected-token',
          authorization: 'Bearer malicious-caller-injected-token-2',
        },
        requestId: 'req_prevent_leak_01',
      });

      expect(capturedHeaders?.get('authorization')).toBeNull();

      // Test protected read without resolver: custom header must still be stripped!
      server.use(
        http.get(`${BASE_URL}/v1/me`, ({ request }) => {
          capturedHeaders = new Headers(request.headers);
          return HttpResponse.json(SampleMake);
        })
      );

      await serverApiRequest({
        operation: 'getMe',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.me,
        outputSchema: MakeSchema,
        authMode: 'S',
        headers: {
          Authorization: 'Bearer malicious-caller-injected-token-3',
        },
        requestId: 'req_prevent_leak_02',
      });

      expect(capturedHeaders?.get('authorization')).toBeNull();
    });

    it('attaches bearer token only from explicitly configured server-only credentialResolver', async () => {
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(`${BASE_URL}/v1/me`, ({ request }) => {
          capturedHeaders = new Headers(request.headers);
          return HttpResponse.json(SampleMake);
        })
      );

      // Using option-level credentialResolver
      await serverApiRequest({
        operation: 'getMe',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.me,
        outputSchema: MakeSchema,
        authMode: 'S',
        credentialResolver: () => 'trusted-server-cookie-token-001',
        requestId: 'req_resolver_01',
      });

      expect(capturedHeaders?.get('authorization')).toBe('Bearer trusted-server-cookie-token-001');

      // Using global server credential resolver
      setServerCredentialResolver(() => 'global-server-session-token-002');

      await serverApiRequest({
        operation: 'getMe',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.me,
        outputSchema: MakeSchema,
        authMode: 'S',
        requestId: 'req_resolver_02',
      });

      expect(capturedHeaders?.get('authorization')).toBe('Bearer global-server-session-token-002');
    });

    it('does not send Authorization in Public mode (P) even if credentialResolver is present', async () => {
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(`${BASE_URL}/v1/taxonomy/makes`, ({ request }) => {
          capturedHeaders = new Headers(request.headers);
          return HttpResponse.json({ data: [SampleMake] });
        })
      );

      await serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        credentialResolver: () => 'token-should-not-be-used',
        requestId: 'req_public_auth_ignore',
      });

      expect(capturedHeaders?.get('authorization')).toBeNull();
    });
  });

  // ── 10. Adapter Failures Caught as Typed 502 UPSTREAM_CONTRACT_MISMATCH (Issue 3) ──

  describe('Adapter Exception Handling', () => {
    it('catches adapter failures and emits typed 502 UPSTREAM_CONTRACT_MISMATCH with the same requestId', async () => {
      server.use(
        http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
          // Upstream returns non-array object where array is expected by adaptBareArray
          return HttpResponse.json({ invalidProperty: 'not-an-array' });
        })
      );

      const warnSpy = vi.spyOn(console, 'warn');

      await expect(
        serverApiRequest({
          operation: 'getMakes',
          method: 'GET',
          endpoint: UPSTREAM_ENDPOINTS.makes,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          adapter: adaptBareArray,
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(502);
        expect(apiErr.body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
        expect(apiErr.body.error.requestId).toBe(FIXED_REQUEST_ID);
        expect(apiErr.body.error.message).toContain('adaptation');
        return true;
      });

      expect(warnSpy).toHaveBeenCalled();
      const record = warnSpy.mock.calls
        .flat()
        .filter((arg): arg is string => typeof arg === 'string')
        .map((line) => {
          try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; }
        })
        .find((entry) => entry?.operation === 'getMakes' && entry.status === 502);
      expect(record).toMatchObject({
        level: 'warn',
        operation: 'getMakes',
        status: 502,
        requestId: FIXED_REQUEST_ID,
        schemaIssuePaths: ['data'],
      });
      expect(JSON.stringify(record)).not.toContain('invalidProperty');

      warnSpy.mockRestore();
    });

    it('catches generic Error thrown by custom adapter and emits typed 502 without leaking raw payload', async () => {
      server.use(
        http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
          return HttpResponse.json({ someData: 'sensitive-secret-content-123' });
        })
      );

      const customFailingAdapter = () => {
        throw new Error('Custom adapter failed parsing');
      };

      const warnSpy = vi.spyOn(console, 'warn');

      await expect(
        serverApiRequest({
          operation: 'getMakes',
          method: 'GET',
          endpoint: UPSTREAM_ENDPOINTS.makes,
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          adapter: customFailingAdapter,
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(502);
        expect(apiErr.body.error.code).toBe('UPSTREAM_CONTRACT_MISMATCH');
        expect(apiErr.body.error.requestId).toBe(FIXED_REQUEST_ID);
        expect(JSON.stringify(apiErr.body)).not.toContain('sensitive-secret-content-123');
        return true;
      });

      warnSpy.mockRestore();
    });
  });

  // ── 11. Input Schema Pre-Validation (Issue 4) ──────────────────────────────

  describe('Input Schema Pre-Validation', () => {
    it('validates inputSchema even when input is undefined and returns typed 400 BAD_REQUEST', async () => {
      const requiredInputSchema = z.object({
        slug: z.string().min(1, 'Slug is required'),
      });

      await expect(
        serverApiRequest({
          operation: 'getMake',
          method: 'GET',
          endpoint: UPSTREAM_ENDPOINTS.makes,
          inputSchema: requiredInputSchema,
          // input is undefined!
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        expect(apiErr.body.error.fieldErrors.length).toBeGreaterThan(0);
        return true;
      });
    });

    it('rejects invalid input with 400 BAD_REQUEST before making network call', async () => {
      const inputSchema = z.object({
        slug: z.string().min(3),
      });

      await expect(
        serverApiRequest({
          operation: 'getMake',
          method: 'GET',
          endpoint: UPSTREAM_ENDPOINTS.makes,
          inputSchema,
          input: { slug: 'a' }, // invalid: min 3 chars required
          outputSchema: MakeListResponseSchema,
          authMode: 'P',
          requestId: FIXED_REQUEST_ID,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(ApiContractError);
        const apiErr = err as ApiContractError;
        expect(apiErr.body.error.status).toBe(400);
        expect(apiErr.body.error.code).toBe('BAD_REQUEST');
        expect(apiErr.body.error.fieldErrors.length).toBeGreaterThan(0);
        expect(apiErr.body.error.fieldErrors[0]?.field).toBe('slug');
        return true;
      });
    });
  });

  // ── 12. Mutation Headers and Idempotency ────────────────────────────────────

  it('forwards Content-Type, Authorization from resolver, and Idempotency-Key for Protected mutation (Profile M)', async () => {
    let capturedHeaders: Headers | undefined;
    let capturedBody: unknown;

    server.use(
      http.post(`${BASE_URL}/v1/listings/lst_test_01/favorite`, async ({ request }) => {
        capturedHeaders = new Headers(request.headers);
        capturedBody = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );

    const inputData = { active: true };

    await serverApiRequest({
      operation: 'favoriteListing',
      method: 'POST',
      endpoint: () => UPSTREAM_ENDPOINTS.addFavorite('lst_test_01'),
      input: inputData,
      outputSchema: MutationAckResponseSchema,
      authMode: 'M',
      credentialResolver: () => 'token-mut-123',
      idempotencyKey: 'idem-key-abc-789',
      requestId: 'req_mut_01',
    });

    expect(capturedHeaders?.get('authorization')).toBe('Bearer token-mut-123');
    expect(capturedHeaders?.get('content-type')).toBe('application/json');
    expect(capturedHeaders?.get('idempotency-key')).toBe('idem-key-abc-789');
    expect(capturedHeaders?.get('x-request-id')).toBe('req_mut_01');
    expect(capturedBody).toEqual(inputData);
  });

  // ── 13. 204 No Content & 202 Acknowledgement ────────────────────────────────

  it('handles 204 No Content and returns valid MutationAckResponse', async () => {
    server.use(
      http.delete(`${BASE_URL}/v1/files/fl_123`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await serverApiRequest({
      operation: 'deleteFile',
      method: 'DELETE',
      endpoint: () => UPSTREAM_ENDPOINTS.deleteFile('fl_123'),
      outputSchema: MutationAckResponseSchema,
      authMode: 'M',
      credentialResolver: () => 'token-123',
      requestId: 'req_delete_01',
    });

    expect(result).toEqual({ ok: true });
  });

  it('handles 202 Accepted empty body and returns valid MutationAckResponse', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/notifications/read-all`, () => {
        return new HttpResponse('', { status: 202, headers: { 'Content-Type': 'application/json' } });
      })
    );

    const result = await serverApiRequest({
      operation: 'markAllNotificationsRead',
      method: 'POST',
      endpoint: UPSTREAM_ENDPOINTS.markAllNotificationsRead,
      outputSchema: MutationAckResponseSchema,
      authMode: 'M',
      credentialResolver: () => 'token-123',
      requestId: 'req_read_all_01',
    });

    expect(result).toEqual({ ok: true });
  });

  // ── 14. Non-2xx Error Normalization via normalizeOperationError ────────────

  it('normalizes upstream 404, 429 with retry-after, and 500 with stack/SQL redaction', async () => {
    // 404 Not Found
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Make not found' } },
          { status: 404, headers: { 'x-request-id': 'req_404_test' } }
        );
      })
    );

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: 'req_404_test',
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(404);
      expect(apiErr.body.error.code).toBe('NOT_FOUND');
      expect(apiErr.body.error.requestId).toBe('req_404_test');
      return true;
    });

    // 429 Rate Limited with Retry-After
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
          {
            status: 429,
            headers: {
              'Retry-After': '45',
              'x-request-id': 'req_429_test',
            },
          }
        );
      })
    );

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: 'req_429_test',
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(429);
      expect(apiErr.body.error.code).toBe('RATE_LIMITED');
      expect(apiErr.body.error.retryAfterSeconds).toBe(45);
      return true;
    });

    // 500 with sensitive SQL and stack traces
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'SELECT * FROM users WHERE id = 1 error at /var/app/index.js:12:4',
              stack: 'Error: database exploded\n    at query (/app/db.js:10:5)',
              sql: 'SELECT * FROM secrets',
            },
          },
          { status: 500, headers: { 'x-request-id': 'req_500_test' } }
        );
      })
    );

    await expect(
      serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        requestId: 'req_500_test',
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiContractError);
      const apiErr = err as ApiContractError;
      expect(apiErr.body.error.status).toBe(500);
      expect(apiErr.body.error.code).toBe('INTERNAL_ERROR');
      // Verify sensitive SQL/stack traces are completely stripped
      const serialized = JSON.stringify(apiErr.body);
      expect(serialized).not.toContain('SELECT * FROM');
      expect(serialized).not.toContain('/var/app/index.js');
      expect(serialized).not.toContain('database exploded');
      return true;
    });
  });

  // ── 15. OUT-01 Adapters Integration ────────────────────────────────────────

  describe('OUT-01 Adapters Integration', () => {
    it('adaptBareArray: adapts upstream bare array into { data: [...] }', async () => {
      server.use(
        http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
          // Upstream returns a bare array directly: [SampleMake]
          return HttpResponse.json([SampleMake]);
        })
      );

      const result = await serverApiRequest({
        operation: 'getMakes',
        method: 'GET',
        endpoint: UPSTREAM_ENDPOINTS.makes,
        outputSchema: MakeListResponseSchema,
        authMode: 'P',
        adapter: adaptBareArray,
        requestId: FIXED_REQUEST_ID,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.slug).toBe('toyota');
    });

    it('adaptWrappedRows: adapts upstream { rows: [...], count: 1 } into { data: [...], meta: { total: 1 } }', () => {
      const rawWrapped = {
        rows: [SampleMake],
        count: 1,
      };

      const adapted = adaptWrappedRows(rawWrapped);
      expect(adapted.data).toHaveLength(1);
      expect(adapted.meta?.total).toBe(1);

      // Verify nested under data
      const rawNested = {
        data: {
          rows: [SampleMake],
          count: 5,
        },
      };
      const adaptedNested = adaptWrappedRows(rawNested);
      expect(adaptedNested.data).toHaveLength(1);
      expect(adaptedNested.meta?.total).toBe(5);
    });

    it('adapt204Acknowledgement: adapts empty or undefined inputs into { ok: true }', () => {
      expect(adapt204Acknowledgement(null, 204)).toEqual({ ok: true });
      expect(adapt204Acknowledgement(undefined, 204)).toEqual({ ok: true });
      expect(adapt204Acknowledgement('', 204)).toEqual({ ok: true });
      expect(adapt204Acknowledgement({ ok: true }, 200)).toEqual({ ok: true });
    });

    it('adaptNullableTotalsAndReasons: normalizes undefined total and rejectionReason to null', () => {
      const rawListing: Record<string, unknown> = {
        publicId: 'lst_01',
        title: 'Toyota Corolla',
        meta: { hasMore: false, page: 1, limit: 20 }, // total and nextCursor missing
        rejectionReason: undefined,
        kycRejectionReason: undefined,
        leadsCount: undefined,
      };

      const adapted = adaptNullableTotalsAndReasons(rawListing);
      const meta = adapted.meta as Record<string, unknown>;
      expect(meta.total).toBeNull();
      expect(meta.nextCursor).toBeNull();
      expect(adapted.rejectionReason).toBeNull();
      expect(adapted.kycRejectionReason).toBeNull();
      expect(adapted.leadsCount).toBeNull();
    });

    it('stripDeviceToken: strips device tokens and internal numeric IDs from registration response', () => {
      const rawDevice = {
        id: 12345,
        userId: 67890,
        publicId: 'dev_pub_01',
        token: 'fcm_secret_push_token_9999',
        deviceToken: 'apns_secret_token_8888',
        platform: 'WEB' as const,
        appVersion: '1.0.0',
        locale: 'ar' as const,
        lastSeenAt: '2026-01-01T12:00:00.000Z',
        createdAt: '2026-01-01T12:00:00.000Z',
      };

      const stripped = stripDeviceToken(rawDevice) as Record<string, unknown>;

      // Token and internal IDs are completely removed
      expect(stripped.token).toBeUndefined();
      expect(stripped.deviceToken).toBeUndefined();
      expect(stripped.id).toBeUndefined();
      expect(stripped.userId).toBeUndefined();

      // Public fields remain intact and validate against schema
      const validated = DeviceRegistrationResponseSchema.parse({ data: stripped });
      expect(validated.data.publicId).toBe('dev_pub_01');
      expect(validated.data.platform).toBe('WEB');
    });

    it('stripNumericIds: recursively strips internal numeric IDs', () => {
      const complexObject = {
        id: 1,
        publicId: 'pub_01',
        listingId: 2,
        vendorId: 3,
        name: 'test',
        nested: {
          id: 4,
          userId: 5,
          slug: 'nested-slug',
        },
      };

      const stripped = stripNumericIds(complexObject);
      expect(stripped).toEqual({
        publicId: 'pub_01',
        name: 'test',
        nested: {
          slug: 'nested-slug',
        },
      });
    });

    it('adaptTypeAnyNotification: converts Type.Any string title/body to localized objects and strips numeric IDs', () => {
      const rawNotification = {
        id: 44,
        userId: 88,
        publicId: 'ntf_01h7x9k3p0000000000000001',
        type: 'PRICE_DROP',
        title: 'تم تخفيض السعر', // string instead of localized object!
        body: 'تم تخفيض السعر بنسبة 10%',
        createdAt: '2026-01-01T12:00:00.000Z',
      };

      const adapted = adaptTypeAnyNotification(rawNotification);
      const parsed = NotificationResponseSchema.parse({ data: adapted });

      expect(parsed.data.publicId).toBe('ntf_01h7x9k3p0000000000000001');
      expect(parsed.data.title).toEqual({ ar: 'تم تخفيض السعر', en: 'تم تخفيض السعر' });
      expect(parsed.data.body).toEqual({
        ar: 'تم تخفيض السعر بنسبة 10%',
        en: 'تم تخفيض السعر بنسبة 10%',
      });
      expect(parsed.data.readAt).toBeNull();
      expect(parsed.data.data).toBeNull();
    });

    it('adaptCountryConfig: normalizes nested country config', () => {
      const rawConfig = {
        code: 'EG',
        currency: 'EGP',
        config: {
          currencySymbol: 'ج.م',
          phoneFormat: '+20 1x xxx xxxx',
          legalDisclaimer: 'Disclaimer text',
          defaultInterestRate: 0.15,
        },
      };

      const adapted = adaptCountryConfig(rawConfig);
      const parsed = CountryConfigResponseSchema.parse(adapted);

      expect(parsed.data.code).toBe('EG');
      expect(parsed.data.currency).toBe('EGP');
      expect(parsed.data.currencySymbol).toBe('ج.م');
      expect(parsed.data.phoneFormat).toBe('+20 1x xxx xxxx');
      expect(parsed.data.defaultInterestRate).toBe(0.15);
    });
  });

  // ── 16. serverApiRequestSafe Union Variant ─────────────────────────────────

  it('serverApiRequestSafe returns { ok: true, data } on success and { ok: false, error } on failure', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/taxonomy/makes`, () => {
        return HttpResponse.json({ data: [SampleMake] });
      }),
      http.get(`${BASE_URL}/v1/me`, () => {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Not found' } },
          { status: 404 }
        );
      })
    );

    // Success case
    const okResult = await serverApiRequestSafe({
      operation: 'getMakes',
      method: 'GET',
      endpoint: UPSTREAM_ENDPOINTS.makes,
      outputSchema: MakeListResponseSchema,
      authMode: 'P',
    });

    expect(okResult.ok).toBe(true);
    if (okResult.ok) {
      expect(okResult.data.data[0]?.slug).toBe('toyota');
    }

    // Failure case (returns ok: false, does not throw)
    const failResult = await serverApiRequestSafe({
      operation: 'getMe',
      method: 'GET',
      endpoint: UPSTREAM_ENDPOINTS.me,
      outputSchema: MakeSchema,
      authMode: 'P',
    });

    expect(failResult.ok).toBe(false);
    if (!failResult.ok) {
      expect(failResult.error.status).toBe(404);
      expect(failResult.error.code).toBe('NOT_FOUND');
    }
  });
});
