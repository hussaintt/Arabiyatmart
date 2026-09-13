import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logSafeEvent } from '@/lib/observability/logger';
import { getOrCreateRequestId } from '@/lib/api/request-id';

export const dynamic = 'force-dynamic';

const BoundaryErrorPayloadSchema = z.object({
  boundary: z.enum(['global', 'locale', 'marketplace', 'auth', 'account', 'sell', 'vendor', 'search']).default('global'),
  digest: z.string().max(128).nullable().optional(),
  locale: z.string().max(10).optional(),
  timestamp: z.string().max(64).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request.headers);

  try {
    const text = await request.text();
    if (text.length > 4096) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const json = JSON.parse(text);
    const parsed = BoundaryErrorPayloadSchema.safeParse(json);

    if (!parsed.success) {
      logSafeEvent({
        level: 'warn',
        operation: 'boundary_error_invalid_payload',
        routeTemplate: '/api/bff/telemetry/boundary-error',
        status: 400,
        requestId,
      });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    logSafeEvent({
      level: 'error',
      operation: `client_boundary_error_${parsed.data.boundary}`,
      routeTemplate: '/api/bff/telemetry/boundary-error',
      status: 500,
      requestId,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
