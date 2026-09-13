'use client';

import type { ReactNode } from 'react';
import type { SafeSession } from '@/types/auth';
import type { DehydratedState } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { QueryProvider } from './query-provider';
import { SessionProvider } from './session-provider';
import { ToastProvider } from './toast-provider';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';

export function AppProviders({ children, initialSession, dehydratedState }: { children: ReactNode; initialSession?: SafeSession | null; dehydratedState?: DehydratedState }) {
  return <MotionConfig reducedMotion="user"><QueryProvider {...(dehydratedState !== undefined ? { dehydratedState } : {})}><SessionProvider {...(initialSession !== undefined ? { initialSession } : {})}><ToastProvider><AnalyticsProvider>{children}</AnalyticsProvider></ToastProvider></SessionProvider></QueryProvider></MotionConfig>;
}
