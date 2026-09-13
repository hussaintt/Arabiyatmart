'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { makeQueryClient, parseSafeDehydratedState } from '@/lib/query/client';

export function QueryProvider({ children, dehydratedState }: { children: ReactNode; dehydratedState?: DehydratedState }) {
  const [client] = useState(makeQueryClient);
  const safeState = useMemo(
    () => dehydratedState === undefined ? undefined : parseSafeDehydratedState(dehydratedState),
    [dehydratedState]
  );
  return <QueryClientProvider client={client}><HydrationBoundary state={safeState}>{children}</HydrationBoundary></QueryClientProvider>;
}
