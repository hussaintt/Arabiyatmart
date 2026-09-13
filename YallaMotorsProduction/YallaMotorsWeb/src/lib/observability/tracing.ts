import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { REQUEST_ID_HEADER, getOrCreateRequestId, isValidRequestId } from '@/lib/api/request-id';
import { logSafeEvent, type SafeLogLevel } from './logger';

export interface TraceContext {
  readonly requestId: string;
  readonly routeTemplate?: string;
  readonly userPublicId?: string | null;
  readonly vendorPublicId?: string | null;
}

export interface ObservabilityState {
  readonly environment: string;
  readonly release: string;
  readonly serviceName: string;
  readonly initializedAt: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();
const STATE_KEY = Symbol.for('arabiyatmart.observability.state');

function globalState(): typeof globalThis & { [STATE_KEY]?: ObservabilityState } {
  return globalThis as typeof globalThis & { [STATE_KEY]?: ObservabilityState };
}

export function initializeObservability(input: {
  readonly environment?: string;
  readonly release?: string;
  readonly serviceName?: string;
} = {}): ObservabilityState {
  const root = globalState();
  if (root[STATE_KEY]) return root[STATE_KEY];
  const state: ObservabilityState = Object.freeze({
    environment: input.environment ?? 'development',
    release: input.release ?? 'unreleased',
    serviceName: input.serviceName ?? 'yalla-motors-web',
    initializedAt: new Date().toISOString(),
  });
  root[STATE_KEY] = state;
  logSafeEvent({ level: 'info', operation: 'observability.initialize' });
  return state;
}

export function getObservabilityState(): ObservabilityState | undefined {
  return globalState()[STATE_KEY];
}

export function runWithTrace<T>(context: TraceContext, callback: () => T): T {
  const requestId = isValidRequestId(context.requestId) ? context.requestId.trim() : getOrCreateRequestId();
  return traceStorage.run({ ...context, requestId }, callback);
}

export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

export function correlatedHeaders(requestId = getTraceContext()?.requestId): Headers {
  const headers = new Headers();
  headers.set(REQUEST_ID_HEADER, requestId && isValidRequestId(requestId) ? requestId : getOrCreateRequestId());
  return headers;
}

export async function withObservedSpan<T>(
  input: { readonly operation: string; readonly routeTemplate?: string; readonly level?: SafeLogLevel },
  callback: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  const context = getTraceContext();
  const routeTemplate = input.routeTemplate ?? context?.routeTemplate;
  try {
    const result = await callback();
    logSafeEvent({
      level: input.level ?? 'info',
      operation: input.operation,
      ...(routeTemplate ? { routeTemplate } : {}),
      durationMs: performance.now() - startedAt,
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(context?.userPublicId ? { userPublicId: context.userPublicId } : {}),
      ...(context?.vendorPublicId ? { vendorPublicId: context.vendorPublicId } : {}),
    });
    return result;
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    logSafeEvent({
      level: 'error',
      operation: input.operation,
      ...(routeTemplate ? { routeTemplate } : {}),
      status,
      durationMs: performance.now() - startedAt,
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(context?.userPublicId ? { userPublicId: context.userPublicId } : {}),
      ...(context?.vendorPublicId ? { vendorPublicId: context.vendorPublicId } : {}),
    });
    throw error;
  }
}

export function resetObservabilityForTests(): void {
  delete globalState()[STATE_KEY];
}
