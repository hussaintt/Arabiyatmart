'use client';

export interface SafeBoundaryEvent {
  boundary: 'global' | 'locale' | 'marketplace' | 'auth' | 'account';
  digest: string | null;
}

/**
 * Emits only a bounded correlation digest; raw errors, stacks, cookies, query params,
 * and messages never leave the boundary. Dispatches window event for local testing and
 * transports event to BFF telemetry endpoint.
 */
export function reportSafeBoundaryError(event: SafeBoundaryEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SafeBoundaryEvent>('arabiyatmart:boundary-error', { detail: event }),
  );

  try {
    const payload = JSON.stringify({
      boundary: event.boundary,
      digest: event.digest ? String(event.digest).slice(0, 128) : null,
      locale: typeof document !== 'undefined' ? (document.documentElement.lang || 'en') : 'en',
      timestamp: new Date().toISOString(),
    });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/bff/telemetry/boundary-error', blob);
    } else if (typeof fetch === 'function') {
      fetch('/api/bff/telemetry/boundary-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Non-fatal telemetry transport failure
  }
}
