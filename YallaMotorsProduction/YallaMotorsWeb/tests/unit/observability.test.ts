import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSafeLogRecord, hashPublicId } from '@/lib/observability/logger';
import {
  correlatedHeaders,
  getObservabilityState,
  getTraceContext,
  initializeObservability,
  resetObservabilityForTests,
  runWithTrace,
} from '@/lib/observability/tracing';
import {
  AnalyticsEventSchema,
  canonicalizeAnalyticsRoute,
  parseAnalyticsEvent,
} from '@/lib/analytics/events';
import {
  PrivacySafeAnalyticsClient,
  type AnalyticsConsent,
} from '@/lib/analytics/client';

describe('privacy-safe observability', () => {
  it('copies only allowed log fields and hashes public identifiers', () => {
    const canaries = ['Bearer secret-token', 'buyer@example.com', '+201001234567', 'private lead text'];
    const record = createSafeLogRecord({
      level: 'warn',
      operation: 'createLead',
      routeTemplate: '/api/bff/leads',
      status: 422,
      durationMs: 12.7,
      requestId: 'req_safe_12345678',
      userPublicId: 'usr_public_1',
      vendorPublicId: 'vnd_public_1',
      schemaIssuePaths: ['data.phone', 'items[0].status'],
      ...({ body: canaries, headers: { authorization: canaries[0] }, stack: canaries[3] } as object),
    });
    const serialized = JSON.stringify(record);
    for (const canary of canaries) expect(serialized).not.toContain(canary);
    expect(Object.keys(record).sort()).toEqual([
      'durationMs', 'environment', 'level', 'operation', 'release', 'requestId',
      'routeTemplate', 'schemaIssuePaths', 'status', 'timestamp', 'userHash', 'vendorHash',
    ].sort());
    expect(record.userHash).toBe(hashPublicId('usr_public_1'));
    expect(record.vendorHash).not.toBe('vnd_public_1');
  });

  it('initializes once without retaining exporter secrets', () => {
    resetObservabilityForTests();
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const first = initializeObservability({ environment: 'staging', release: 'release_59', serviceName: 'web' });
    const second = initializeObservability({ environment: 'production', release: 'other', serviceName: 'other' });
    expect(second).toBe(first);
    expect(getObservabilityState()).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(/dsn|token|password|endpoint/i);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('propagates one request ID across simulated BFF, refresh, and upstream hops', async () => {
    const requestId = 'req_correlation_12345678';
    await runWithTrace({ requestId, routeTemplate: '/api/bff/[...path]' }, async () => {
      expect(getTraceContext()?.requestId).toBe(requestId);
      const bffHeaders = correlatedHeaders();
      const refreshHeaders = correlatedHeaders(bffHeaders.get('X-Request-Id') ?? undefined);
      const upstreamHeaders = correlatedHeaders(refreshHeaders.get('X-Request-Id') ?? undefined);
      expect(upstreamHeaders.get('X-Request-Id')).toBe(requestId);
    });
  });
});

describe('privacy-safe analytics', () => {
  it('uses canonical templates and never retains query or dynamic route values', () => {
    expect(canonicalizeAnalyticsRoute('/en/listing/private-slug?phone=20100')).toBe('/[locale]/listing/[slug]');
    expect(canonicalizeAnalyticsRoute('/ar/me/leads/lead_public_1')).toBe('/[locale]/me/leads/[publicId]');
    expect(canonicalizeAnalyticsRoute('/en/unknown/private')).toBeNull();
  });

  it('rejects unknown fields, contact text, and all price-offer events', () => {
    expect(parseAnalyticsEvent({ name: 'price_offer', amount: 500_000 })).toBeNull();
    expect(parseAnalyticsEvent({ name: 'listing_contact', listingId: 'lst_1', channel: 'phone', outcome: 'initiated', phone: '+201001234567' })).toBeNull();
    expect(() => AnalyticsEventSchema.parse({ name: 'lead_outcome', operation: 'create', outcome: 'succeeded', note: 'private text' })).toThrow();
  });

  it('honors consent and DNT, then retries a bounded offline queue', async () => {
    let consent: AnalyticsConsent = 'unset';
    let dnt = false;
    let online = true;
    let failures = 1;
    const sent: unknown[] = [];
    const client = new PrivacySafeAnalyticsClient({
      configured: () => true,
      consent: () => consent,
      doNotTrack: () => dnt,
      online: () => online,
      transport: { send: async (event) => {
        if (failures-- > 0) throw new Error('offline');
        sent.push(event);
      } },
    });
    const event = { name: 'page_view', route: '/[locale]/search', locale: 'en' } as const;
    expect(await client.track(event)).toBe(false);
    consent = 'granted';
    dnt = true;
    expect(await client.track(event)).toBe(false);
    dnt = false;
    online = false;
    expect(await client.track(event)).toBe(false);
    expect(client.pendingCount()).toBe(1);
    online = true;
    await client.flush();
    expect(client.pendingCount()).toBe(1);
    await client.flush();
    expect(sent).toEqual([event]);
    expect(client.pendingCount()).toBe(0);
  });

  it('contains no server observability secret names in the browser analytics module', () => {
    const source = readFileSync(new URL('../../src/lib/analytics/client.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/SENTRY_DSN|JWT_ACCESS_SECRET|INTERNAL_API_SECRET|OTEL_EXPORTER_OTLP_TRACES_ENDPOINT/);
    expect(source).toContain('NEXT_PUBLIC_ANALYTICS_ENDPOINT');
  });
});
