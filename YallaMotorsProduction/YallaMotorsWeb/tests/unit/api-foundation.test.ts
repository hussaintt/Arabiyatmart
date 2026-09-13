import { describe, it, expect } from 'vitest';
import {
  UPSTREAM_ENDPOINTS,
  BFF_ENDPOINTS,
  encodePathSegment,
  isAllowedBffPath,
} from '@/lib/api/endpoints';
import {
  getOrCreateRequestId,
  isValidRequestId,
  generateRequestId,
} from '@/lib/api/request-id';
import {
  encodePageParams,
  decodePageParams,
  encodeCursorParams,
  decodeCursorParams,
  normalizePageMeta,
  normalizeCursorMeta,
  ALLOWED_LIMITS,
} from '@/lib/api/pagination';
import {
  normalizeOperationError,
  createOperationError,
  mapToHttpStatus,
  parseRetryAfter,
  sanitizeDetails,
} from '@/lib/api/error';
import { OperationErrorSchema } from '@/lib/api/schemas/common';
import {
  parseApprovedUrl,
  isApprovedImageUrl,
  isApprovedBackendUrl,
  isSafeRedirectTarget,
  isSafeContactUrl,
  sanitizeContactUrl,
} from '@/lib/security/external-url';

describe('Endpoint Registry and Path Builders (endpoints.ts)', () => {
  it('encodes individual path segments and handles special/RTL characters', () => {
    expect(encodePathSegment('camry-2024')).toBe('camry-2024');
    expect(encodePathSegment('مرسيدس بنز')).toBe(
      encodeURIComponent('مرسيدس بنز')
    );
    expect(encodePathSegment(123)).toBe('123');
  });

  it('rejects empty segments and path traversal attempts', () => {
    expect(() => encodePathSegment('')).toThrow('Path segment cannot be empty');
    expect(() => encodePathSegment('   ')).toThrow('Path segment cannot be empty');
    expect(() => encodePathSegment('..')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('.')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('../admin')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('folder/file')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('folder\\file')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('foo\0bar')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('%2e%2e')).toThrow('Invalid path segment');
    expect(() => encodePathSegment('%2Fadmin')).toThrow('Invalid path segment');
  });

  it('builds valid upstream Fastify endpoints', () => {
    expect(UPSTREAM_ENDPOINTS.login()).toBe('/v1/auth/login');
    expect(UPSTREAM_ENDPOINTS.register()).toBe('/v1/auth/register');
    expect(UPSTREAM_ENDPOINTS.me()).toBe('/v1/me');
    expect(UPSTREAM_ENDPOINTS.listings()).toBe('/v1/listings');
    expect(UPSTREAM_ENDPOINTS.listing('toyota-corolla')).toBe(
      '/v1/listings/toyota-corolla'
    );
    expect(UPSTREAM_ENDPOINTS.listingSimilar('toyota-corolla')).toBe(
      '/v1/listings/toyota-corolla/similar'
    );
    expect(UPSTREAM_ENDPOINTS.dealers()).toBe('/v1/dealers');
    expect(UPSTREAM_ENDPOINTS.dealer('al-futtaim')).toBe(
      '/v1/dealers/al-futtaim'
    );
    expect(UPSTREAM_ENDPOINTS.models('toyota')).toBe(
      '/v1/taxonomy/makes/toyota/models'
    );
    expect(UPSTREAM_ENDPOINTS.dashboardOverview('vnd_123')).toBe(
      '/v1/vendors/vnd_123/analytics/overview'
    );
  });

  it('builds valid BFF endpoints', () => {
    expect(BFF_ENDPOINTS.session()).toBe('/api/bff/session');
    expect(BFF_ENDPOINTS.me()).toBe('/api/bff/me');
    expect(BFF_ENDPOINTS.listings()).toBe('/api/bff/listings');
    expect(BFF_ENDPOINTS.listing('toyota-corolla')).toBe(
      '/api/bff/listings/toyota-corolla'
    );
    expect(BFF_ENDPOINTS.favoriteListing('lst_pub_123')).toBe(
      '/api/bff/listings/lst_pub_123/favorite'
    );
  });

  it('validates allowed BFF paths and rejects unauthorized/malicious paths', () => {
    expect(isAllowedBffPath('/api/bff/session')).toBe(true);
    expect(isAllowedBffPath('/api/bff/listings')).toBe(true);
    expect(isAllowedBffPath('/api/bff/listings/corolla-2024')).toBe(true);
    expect(isAllowedBffPath('/api/bff/listings/corolla-2024/similar')).toBe(true);
    expect(isAllowedBffPath('/api/bff/dealers')).toBe(true);
    expect(isAllowedBffPath('/api/bff/me/dashboard')).toBe(true);

    // Rejected: unknown endpoints
    expect(isAllowedBffPath('/api/bff/non-existent-endpoint')).toBe(false);
    expect(isAllowedBffPath('/api/admin')).toBe(false);
    expect(isAllowedBffPath('')).toBe(false);

    // Regression: reject query strings or hash fragments
    expect(isAllowedBffPath('/api/bff/session?param=1')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/foo#x')).toBe(false);

    // Regression: reject raw and percent-encoded directory traversal and separators
    expect(isAllowedBffPath('/api/bff/listings/..')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/../admin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%2e%2e')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%2e%2e/admin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%2Fadmin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%2fadmin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%5cadmin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%00admin')).toBe(false);

    // Regression: reject double/iteratively encoded directory traversal and separators
    expect(isAllowedBffPath('/api/bff/listings/%252Fadmin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%252fadmin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%252e%252e')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%252e%252e/admin')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings/%255cadmin')).toBe(false);

    // Regression: reject leading or trailing whitespace rather than silently accepting/trimming
    expect(isAllowedBffPath(' /api/bff/session')).toBe(false);
    expect(isAllowedBffPath('/api/bff/session ')).toBe(false);
    expect(isAllowedBffPath('\t/api/bff/listings')).toBe(false);
    expect(isAllowedBffPath('/api/bff/listings\n')).toBe(false);
  });
});

describe('Request ID & Correlation (request-id.ts)', () => {
  it('validates safe request IDs', () => {
    expect(isValidRequestId('req_01H1234567890')).toBe(true);
    expect(isValidRequestId('cuid-cm1234567890')).toBe(true);
    expect(isValidRequestId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);

    // Invalid: CRLF, whitespace, control chars, symbols
    expect(isValidRequestId('req_123\r\nSet-Cookie: bad=1')).toBe(false);
    expect(isValidRequestId('req 123')).toBe(false);
    expect(isValidRequestId('<script>')).toBe(false);
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId('a'.repeat(129))).toBe(false);
  });

  it('extracts valid X-Request-Id from Headers or objects', () => {
    const headers = new Headers({ 'X-Request-Id': 'req_safe_001' });
    expect(getOrCreateRequestId(headers)).toBe('req_safe_001');

    const lowerHeaders = new Headers({ 'x-request-id': 'req_safe_002' });
    expect(getOrCreateRequestId(lowerHeaders)).toBe('req_safe_002');

    const objHeaders = { 'x-request-id': 'req_safe_003' };
    expect(getOrCreateRequestId(objHeaders)).toBe('req_safe_003');

    const upperObj = { 'X-Request-Id': 'req_safe_004' };
    expect(getOrCreateRequestId(upperObj)).toBe('req_safe_004');
  });

  it('generates a UUID when X-Request-Id is missing or malicious', () => {
    const missing = getOrCreateRequestId(null);
    expect(isValidRequestId(missing)).toBe(true);

    const malicious = getOrCreateRequestId({
      'x-request-id': 'injected\r\nX-Injected: true',
    });
    expect(malicious).not.toContain('injected');
    expect(isValidRequestId(malicious)).toBe(true);

    const empty = getOrCreateRequestId(new Headers({ 'x-request-id': '' }));
    expect(isValidRequestId(empty)).toBe(true);
  });

  it('generates a valid UUID via generateRequestId', () => {
    const id = generateRequestId();
    expect(isValidRequestId(id)).toBe(true);
  });
});

describe('Pagination Encoding, Decoding, and Invariants (pagination.ts)', () => {
  it('encodes and decodes valid page parameters with default bounds', () => {
    const encoded = encodePageParams({ page: 2, limit: 20 });
    expect(encoded.get('page')).toBe('2');
    expect(encoded.get('limit')).toBe('20');

    const decoded = decodePageParams('?page=2&limit=20');
    expect(decoded).toEqual({ page: 2, limit: 20 });

    const fromObj = decodePageParams({ page: '3', limit: '50' });
    expect(fromObj).toEqual({ page: 3, limit: 50 });
  });

  it('encodes and decodes valid cursor parameters', () => {
    const encoded = encodeCursorParams({ cursor: 'cur_abc123', limit: 50 });
    expect(encoded.get('cursor')).toBe('cur_abc123');
    expect(encoded.get('limit')).toBe('50');

    const decoded = decodeCursorParams('?cursor=cur_abc123&limit=50');
    expect(decoded).toEqual({ cursor: 'cur_abc123', limit: 50 });
  });

  it('never fabricates a missing cursor', () => {
    const encoded = encodeCursorParams({ limit: 20 });
    expect(encoded.has('cursor')).toBe(false);

    const decoded = decodeCursorParams('?limit=20');
    expect(decoded.cursor).toBeUndefined();
  });

  it('rejects repeated scalar parameters to prevent HTTP parameter pollution', () => {
    expect(() => decodePageParams('?page=1&page=2')).toThrow(
      'Repeated parameter "page"'
    );
    expect(() => decodePageParams('?limit=10&limit=20')).toThrow(
      'Repeated parameter "limit"'
    );
    expect(() => decodeCursorParams('?cursor=cur1&cursor=cur2')).toThrow(
      'Repeated parameter "cursor"'
    );
  });

  it('does not silently change or clamp invalid requested limits', () => {
    expect(() => encodePageParams({ limit: 0 })).toThrow('Invalid limit parameter');
    expect(() => encodePageParams({ limit: -5 })).toThrow('Invalid limit parameter');
    expect(() => encodePageParams({ limit: 101 })).toThrow('exceeds maximum');

    expect(() => decodePageParams('?limit=0')).toThrow('Invalid limit query value');
    expect(() => decodePageParams('?limit=150')).toThrow('exceeds maximum');
    expect(() => decodePageParams('?limit=abc')).toThrow('Invalid limit query value');

    expect(() => decodePageParams('?page=0')).toThrow('Invalid page query value');
    expect(() => decodePageParams('?page=-1')).toThrow('Invalid page query value');
    expect(() => decodePageParams('?page=abc')).toThrow('Invalid page query value');
  });

  it('enforces Phase 2 explicit allowed-limit sets without silent coercion', () => {
    // 1. Listing & Dealer limits: 12 | 20 | 24 | 40
    for (const valid of ALLOWED_LIMITS.LISTINGS) {
      expect(decodePageParams(`?limit=${valid}`, ALLOWED_LIMITS.LISTINGS)).toEqual({
        limit: valid,
      });
      expect(
        encodePageParams({ limit: valid }, ALLOWED_LIMITS.LISTINGS).get('limit')
      ).toBe(String(valid));
    }
    // Unsupported values for listings/dealers must throw, NOT silently clamp to 12 or 20
    expect(() =>
      decodePageParams('?limit=10', ALLOWED_LIMITS.LISTINGS)
    ).toThrow('Unsupported limit value 10');
    expect(() =>
      decodePageParams('?limit=15', ALLOWED_LIMITS.LISTINGS)
    ).toThrow('Unsupported limit value 15');
    expect(() =>
      decodePageParams('?limit=50', ALLOWED_LIMITS.LISTINGS)
    ).toThrow('Unsupported limit value 50');
    expect(() =>
      decodePageParams('?limit=100', ALLOWED_LIMITS.LISTINGS)
    ).toThrow('Unsupported limit value 100');

    // 2. Notifications & Leads limits: 20 | 40 | 80
    for (const valid of ALLOWED_LIMITS.NOTIFICATIONS) {
      expect(
        decodeCursorParams(`?cursor=cur1&limit=${valid}`, ALLOWED_LIMITS.NOTIFICATIONS)
      ).toEqual({
        cursor: 'cur1',
        limit: valid,
      });
    }
    expect(() =>
      decodeCursorParams('?cursor=cur1&limit=12', ALLOWED_LIMITS.NOTIFICATIONS)
    ).toThrow('Unsupported limit value 12');
    expect(() =>
      decodeCursorParams('?cursor=cur1&limit=50', ALLOWED_LIMITS.NOTIFICATIONS)
    ).toThrow('Unsupported limit value 50');

  });

  it('normalizes valid page meta', () => {
    const meta = normalizePageMeta({
      total: 100,
      page: 1,
      limit: 20,
      hasMore: true,
    });
    expect(meta.total).toBe(100);
    expect(meta.hasMore).toBe(true);
  });

  it('enforces FAV-01: refuses to fabricate missing cursor when hasMore is true', () => {
    const valid = normalizeCursorMeta({
      hasMore: true,
      nextCursor: 'cur_next_123',
    });
    expect(valid.nextCursor).toBe('cur_next_123');

    const validEnd = normalizeCursorMeta({
      hasMore: false,
      nextCursor: null,
    });
    expect(validEnd.hasMore).toBe(false);
    expect(validEnd.nextCursor).toBeNull();

    // Violation of FAV-01: hasMore: true with null nextCursor
    expect(() =>
      normalizeCursorMeta({
        hasMore: true,
        nextCursor: null,
      })
    ).toThrow('FAV-01');
  });
});

describe('Normalized Errors (error.ts)', () => {
  it('BDD Acceptance: converts non-2xx upstream response with SQL/stack/Retry-After into safe OperationError', async () => {
    const mockHeaders = new Headers({
      'Content-Type': 'application/json',
      'X-Request-Id': 'req_upstream_corr_01',
      'Retry-After': '120',
    });

    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'DB_QUERY_FAILED',
          message:
            'SELECT * FROM users WHERE password = "secret" syntax error at or near /var/app/src/db.ts:42',
          stack: 'Error: DB failure\n    at query (/var/app/src/db.ts:42:10)',
          details: {
            sql: 'SELECT * FROM users',
            filePath: '/var/app/secrets.env',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.sig',
            safeInfo: 'Customer lookup failed',
          },
        },
      }),
      {
        status: 500,
        headers: mockHeaders,
      }
    );

    const operationError = await normalizeOperationError(mockResponse);

    // Validate with Zod schema
    const parsed = OperationErrorSchema.parse(operationError);
    expect(parsed).toBeDefined();

    // Preserves status and correlation
    expect(operationError.error.status).toBe(500);
    expect(operationError.error.requestId).toBe('req_upstream_corr_01');
    expect(operationError.error.retryAfterSeconds).toBe(120);

    // Strips SQL and file paths from message
    expect(operationError.error.message).not.toContain('SELECT');
    expect(operationError.error.message).not.toContain('/var/app');
    expect(operationError.error.message).toBe('Internal server error');

    // Details sanitized
    const details = operationError.error.details as Record<string, unknown>;
    expect(details).toBeDefined();
    expect(details.sql).toBeUndefined();
    expect(details.filePath).toBeUndefined();
    expect(details.token).toBeUndefined();
    expect(details.safeInfo).toBe('Customer lookup failed');
  });

  it('maps all 12 standard HttpStatus codes correctly', () => {
    const statuses = [
      400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504,
    ] as const;

    for (const status of statuses) {
      expect(mapToHttpStatus(status)).toBe(status);
      const err = createOperationError({ status });
      expect(err.error.status).toBe(status);
      expect(OperationErrorSchema.parse(err)).toBeDefined();
    }
  });

  it('maps RFC 415 to 422', () => {
    expect(mapToHttpStatus(415)).toBe(422);
  });

  it('maps 408 to 504', () => {
    expect(mapToHttpStatus(408)).toBe(504);
  });

  it('parses bounded Retry-After header', () => {
    expect(parseRetryAfter('60')).toBe(60);
    expect(parseRetryAfter('999999')).toBe(86400); // capped at 24h
    expect(parseRetryAfter('-5')).toBeNull();
    expect(parseRetryAfter('invalid-string')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();

    // Valid future date
    const futureDate = new Date(Date.now() + 30000).toUTCString();
    const parsedSeconds = parseRetryAfter(futureDate);
    expect(parsedSeconds).toBeGreaterThan(0);
    expect(parsedSeconds).toBeLessThanOrEqual(35);
  });

  it('replaces HTML error bodies with safe OperationError', async () => {
    const htmlResponse = new Response(
      '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center></body></html>',
      {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }
    );

    const error = await normalizeOperationError(htmlResponse);
    expect(error.error.status).toBe(502);
    expect(error.error.message).toBe('Bad gateway');
    expect(error.error.message).not.toContain('<html');
    expect(OperationErrorSchema.parse(error)).toBeDefined();
  });

  it('maps Fastify validation error objects to typed FieldErrors', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 400,
        error: 'Bad Request',
        validation: [
          {
            instancePath: '/priceCents',
            keyword: 'minimum',
            message: 'must be >= 0',
          },
          {
            instancePath: '/contact/email',
            keyword: 'format',
            message: 'must be a valid email',
          },
        ],
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const error = await normalizeOperationError(response);
    expect(error.error.status).toBe(400);
    expect(error.error.fieldErrors).toHaveLength(2);
    expect(error.error.fieldErrors[0]).toEqual({
      field: 'priceCents',
      code: 'minimum',
      message: 'must be >= 0',
    });
    expect(error.error.fieldErrors[1]).toEqual({
      field: 'contact.email',
      code: 'format',
      message: 'must be a valid email',
    });
  });

  it('sanitizes sensitive details deeply', () => {
    const details = {
      stack: 'Error at /usr/local/bin',
      password: 'mypassword',
      token: 'secret123',
      query: 'SELECT 1',
      nested: {
        sqlQuery: 'INSERT INTO data',
        normalText: 'Clean text',
        bearerToken: 'Bearer abc.def.ghi',
      },
    };

    const sanitized = sanitizeDetails(details) as Record<string, unknown>;
    expect(sanitized.stack).toBeUndefined();
    expect(sanitized.password).toBeUndefined();
    expect(sanitized.token).toBeUndefined();
    expect(sanitized.query).toBeUndefined();

    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.normalText).toBe('Clean text');
    expect(nested.bearerToken).toBe('[REDACTED]');
  });
});

describe('External URL & Origin Security (external-url.ts)', () => {
  it('rejects credentials in URLs', () => {
    expect(parseApprovedUrl('https://admin:secret@example.com/api')).toBeNull();
    expect(parseApprovedUrl('http://user@example.com')).toBeNull();
  });

  it('rejects non-HTTP protocols', () => {
    expect(parseApprovedUrl('javascript:alert(1)')).toBeNull();
    expect(parseApprovedUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(parseApprovedUrl('file:///etc/passwd')).toBeNull();
    expect(parseApprovedUrl('ftp://files.example.com')).toBeNull();
  });

  it('rejects protocol-relative URLs and backslash bypasses', () => {
    expect(parseApprovedUrl('//attacker.com/evil')).toBeNull();
    expect(parseApprovedUrl('https://example.com\\attacker.com')).toBeNull();
    expect(parseApprovedUrl('/\\attacker.com')).toBeNull();
    expect(parseApprovedUrl('/%2F%2Fevil.test')).toBeNull();
  });

  it('rejects localhost and loopback interfaces in production', () => {
    expect(
      parseApprovedUrl('https://localhost:4000/api', { isProduction: true })
    ).toBeNull();
    expect(
      parseApprovedUrl('https://127.0.0.1:4000/api', { isProduction: true })
    ).toBeNull();
    expect(
      parseApprovedUrl('https://[::1]:4000/api', { isProduction: true })
    ).toBeNull();

    // Permitted in development
    expect(
      parseApprovedUrl('http://localhost:4000/api', { isProduction: false })
    ).not.toBeNull();
  });

  it('validates approved image hosts', () => {
    expect(
      isApprovedImageUrl('https://images.unsplash.com/photo-1234')
    ).toBe(true);
    expect(
      isApprovedImageUrl('https://api.arabiyatmart.com/uploads/car.jpg')
    ).toBe(true);
    expect(
      isApprovedImageUrl('https://malicious-cdn.com/bad.png')
    ).toBe(false);
  });

  it('validates approved backend URLs', () => {
    const backendOrigin = 'https://api.arabiyatmart.com';
    expect(
      isApprovedBackendUrl('https://api.arabiyatmart.com/v1/listings', {
        backendOrigin,
      })
    ).toBe(true);
    expect(
      isApprovedBackendUrl('https://evil-api.com/v1/listings', {
        backendOrigin,
      })
    ).toBe(false);
  });

  it('validates safe contact URLs and rejects malicious schemes', () => {
    expect(isSafeContactUrl('tel:+971501234567')).toBe(true);
    expect(isSafeContactUrl('tel:0501234567')).toBe(true);
    expect(isSafeContactUrl('mailto:support@arabiyatmart.com')).toBe(true);
    expect(isSafeContactUrl('https://wa.me/971501234567')).toBe(true);
    expect(
      isSafeContactUrl('https://api.whatsapp.com/send?phone=971501234567')
    ).toBe(true);

    // Malicious or invalid
    expect(isSafeContactUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeContactUrl('tel:123\r\nSet-Cookie:bad')).toBe(false);
    expect(isSafeContactUrl('mailto:bad\r\nBcc:victim@test.com')).toBe(false);
    expect(isSafeContactUrl('')).toBe(false);

    expect(sanitizeContactUrl('tel:+971501234567')).toBe('tel:+971501234567');
    expect(sanitizeContactUrl('javascript:evil')).toBeNull();
  });

  it('validates safe redirect targets against open redirect vulnerabilities', () => {
    expect(isSafeRedirectTarget('/ar/dealers')).toBe(true);
    expect(isSafeRedirectTarget('/en/listing/camry-2024')).toBe(true);

    // Open redirect attacks: raw
    expect(isSafeRedirectTarget('//attacker.com')).toBe(false);
    expect(isSafeRedirectTarget('/\\attacker.com')).toBe(false);
    expect(isSafeRedirectTarget('https://evil.com/login')).toBe(false);
    expect(isSafeRedirectTarget('javascript:alert(1)')).toBe(false);

    // Open redirect attacks: percent-encoded separators and traversal
    expect(isSafeRedirectTarget('/%2F%2Fevil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%2f%2fevil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%5c%5cevil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%2e%2e/%2e%2e/evil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%2e%2e')).toBe(false);
    expect(isSafeRedirectTarget('/%00evil.test')).toBe(false);
    expect(isSafeRedirectTarget('/@evil.test')).toBe(false);

    // Regression: reject double/iteratively encoded redirect targets
    expect(isSafeRedirectTarget('/%252F%252Fevil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%252f%252fevil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%255c%255cevil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%252e%252e/%252e%252e/evil.test')).toBe(false);
    expect(isSafeRedirectTarget('/%252e%252e')).toBe(false);
    expect(isSafeRedirectTarget('/%252Fadmin')).toBe(false);

    // Regression: reject leading or trailing whitespace rather than silently accepting/trimming
    expect(isSafeRedirectTarget(' /ar/dealers')).toBe(false);
    expect(isSafeRedirectTarget('/ar/dealers ')).toBe(false);
    expect(isSafeRedirectTarget('\t/en/listing/camry-2024')).toBe(false);
    expect(isSafeRedirectTarget('/en/listing/camry-2024\n')).toBe(false);

    // Allowed absolute URL with explicit allowedOrigins
    expect(
      isSafeRedirectTarget('https://arabiyatmart.com/ar', {
        allowedOrigins: ['https://arabiyatmart.com'],
        isProduction: true,
      })
    ).toBe(true);
  });
});
