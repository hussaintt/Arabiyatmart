'use client';

import { useEffect, type ReactNode } from 'react';
import { canonicalizeAnalyticsRoute } from '@/lib/analytics/events';
import { flushAnalytics, trackAnalytics } from '@/lib/analytics/client';

export function AnalyticsProvider({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    let lastRoute: string | null = null;
    const trackRoute = () => {
      const pathname = window.location.pathname;
      const route = canonicalizeAnalyticsRoute(pathname);
      if (!route || lastRoute === route) return;
      lastRoute = route;
      const locale = pathname.split('/')[1];
      if (locale === 'ar' || locale === 'en') trackAnalytics({ name: 'page_view', route, locale });
    };
    const flush = () => void flushAnalytics();
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      trackRoute();
    };
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      trackRoute();
    };
    trackRoute();
    window.addEventListener('popstate', trackRoute);
    window.addEventListener('online', flush);
    window.addEventListener('arabiyatmart:analytics-consent', flush);
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', trackRoute);
      window.removeEventListener('online', flush);
      window.removeEventListener('arabiyatmart:analytics-consent', flush);
    };
  }, []);

  return children;
}
