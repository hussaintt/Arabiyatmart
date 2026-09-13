/**
 * Query Hydration Boundary for React Server Components (RSC).
 *
 * Implements Phase 1 Section 4.4 and TASK-012:
 * - Classified as RSC: executes on the server and serializes dehydrated state to client islands.
 * - Wraps TanStack Query's HydrationBoundary without requiring client-side providers in RSC scope.
 */

import type { ReactNode } from 'react';
import {
  HydrationBoundary,
  type DehydratedState,
  type HydrateOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { dehydrateSafe } from './client';

export interface QueryHydrationBoundaryProps {
  readonly children: ReactNode;
  readonly state?: DehydratedState | null | undefined;
  readonly queryClient?: QueryClient | undefined;
  readonly options?: HydrateOptions | undefined;
}

/**
 * Server-only RSC boundary that passes dehydrated TanStack Query state to client components.
 */
export function QueryHydrationBoundary({
  children,
  state,
  queryClient,
  options,
}: QueryHydrationBoundaryProps) {
  const dehydratedState = state ?? (queryClient ? dehydrateSafe(queryClient) : undefined);

  if (!dehydratedState) {
    return <>{children}</>;
  }

  if (options !== undefined) {
    return (
      <HydrationBoundary state={dehydratedState} options={options}>
        {children}
      </HydrationBoundary>
    );
  }

  return (
    <HydrationBoundary state={dehydratedState}>
      {children}
    </HydrationBoundary>
  );
}
