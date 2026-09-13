import type { Instrumentation } from 'next';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeObservability } = await import('@/lib/observability/tracing');
    initializeObservability({
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
      release: process.env.RELEASE ?? 'unreleased',
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'yalla-motors-web',
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const [{ logSafeEvent }, { isValidRequestId }] = await Promise.all([
    import('@/lib/observability/logger'),
    import('@/lib/api/request-id'),
  ]);
  const incomingId = request.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && isValidRequestId(incomingId) ? incomingId : undefined;
  const status = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
  logSafeEvent({
    level: 'error',
    operation: `next.${context.routeType}`,
    ...(context.routePath ? { routeTemplate: context.routePath } : {}),
    status,
    ...(requestId ? { requestId } : {}),
  });
};
