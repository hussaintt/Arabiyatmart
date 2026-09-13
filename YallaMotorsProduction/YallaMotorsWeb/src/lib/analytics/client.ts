'use client';

import { parseAnalyticsEvent, type AnalyticsEvent } from './events';

export const ANALYTICS_CONSENT_KEY = 'arabiyatmart.analytics.consent.v1';
export type AnalyticsConsent = 'granted' | 'denied' | 'unset';

export interface AnalyticsTransport {
  send(event: AnalyticsEvent): Promise<void>;
}

export interface AnalyticsRuntime {
  readonly configured: () => boolean;
  readonly consent: () => AnalyticsConsent;
  readonly doNotTrack: () => boolean;
  readonly online: () => boolean;
  readonly transport: AnalyticsTransport;
}

export class PrivacySafeAnalyticsClient {
  private readonly queue: AnalyticsEvent[] = [];
  private flushing = false;

  constructor(private readonly runtime: AnalyticsRuntime) {}

  async track(input: unknown): Promise<boolean> {
    const event = parseAnalyticsEvent(input);
    if (!event || !this.allowed()) return false;
    if (!this.runtime.online()) {
      this.enqueue(event);
      return false;
    }
    try {
      await this.runtime.transport.send(event);
      return true;
    } catch {
      this.enqueue(event);
      return false;
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.allowed() || !this.runtime.online()) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const event = this.queue[0];
        if (!event) break;
        try {
          await this.runtime.transport.send(event);
          this.queue.shift();
        } catch {
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  pendingCount(): number {
    return this.queue.length;
  }

  private allowed(): boolean {
    return this.runtime.configured() && this.runtime.consent() === 'granted' && !this.runtime.doNotTrack();
  }

  private enqueue(event: AnalyticsEvent): void {
    if (this.queue.length >= 50) this.queue.shift();
    this.queue.push(event);
  }
}

function analyticsEndpoint(): string | null {
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && endpoint?.startsWith('/api/') ? endpoint : null;
}

function browserConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'unset';
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : 'unset';
}

function browserDnt(): boolean {
  if (typeof navigator === 'undefined') return false;
  const value = navigator.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack;
  return value === '1' || value === 'yes';
}

const browserClient = new PrivacySafeAnalyticsClient({
  configured: () => typeof window !== 'undefined' && analyticsEndpoint() !== null,
  consent: browserConsent,
  doNotTrack: browserDnt,
  online: () => typeof navigator !== 'undefined' && navigator.onLine,
  transport: {
    async send(event) {
      const endpoint = analyticsEndpoint();
      if (!endpoint) throw new Error('Analytics is not configured');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        credentials: 'same-origin',
        keepalive: true,
      });
      if (!response.ok) throw new Error('Analytics transport failed');
    },
  },
});

export function getAnalyticsConsent(): AnalyticsConsent {
  return browserConsent();
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unset'>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  window.dispatchEvent(new CustomEvent('arabiyatmart:analytics-consent', { detail: consent }));
  if (consent === 'granted') void browserClient.flush();
}

export function trackAnalytics(event: AnalyticsEvent): void {
  if (typeof window !== 'undefined') void browserClient.track(event);
}

export function flushAnalytics(): Promise<void> {
  return browserClient.flush();
}
