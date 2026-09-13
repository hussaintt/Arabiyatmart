import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getIdempotencyStore, RedisIdempotencyStore } from '@/lib/security/idempotency';
import { serverEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const headers = new Headers({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Type': 'application/json',
  });

  const now = new Date().toISOString();
  const isProduction = serverEnv.APP_ENV === 'production';

  try {
    const store = getIdempotencyStore();

    if (isProduction && !(store instanceof RedisIdempotencyStore)) {
      return NextResponse.json(
        {
          status: 'degraded',
          ready: false,
          error: 'Production requires Redis idempotency store',
          timestamp: now,
        },
        { status: 503, headers }
      );
    }

    // Perform minimal round-trip acquire/release probe
    const probeId = crypto.randomUUID();
    const probeKey = `__readiness_probe__:${probeId}`;
    const ownerToken = `probe_token_${probeId}`;

    const reservation = await store.reserve({
      key: probeKey,
      fingerprint: 'readiness',
      operation: 'probe',
      idempotencyKey: probeId,
      requestHash: 'probe_hash',
      lockTimeoutMs: 5000,
      ownerToken,
    });

    if (!reservation.reserved) {
      return NextResponse.json(
        {
          status: 'degraded',
          ready: false,
          error: 'Idempotency reservation probe failed',
          timestamp: now,
        },
        { status: 503, headers }
      );
    }

    // Clean up probe key immediately
    await store.release(probeKey, ownerToken);

    return NextResponse.json(
      {
        status: 'ready',
        ready: true,
        driver: store instanceof RedisIdempotencyStore ? 'redis' : 'memory',
        timestamp: now,
      },
      { status: 200, headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Readiness check failed';
    return NextResponse.json(
      {
        status: 'degraded',
        ready: false,
        error: message,
        timestamp: now,
      },
      { status: 503, headers }
    );
  }
}
