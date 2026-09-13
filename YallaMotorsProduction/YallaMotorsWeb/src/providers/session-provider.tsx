'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeSessionSchema, SessionResponseSchema } from '@/lib/api/schemas/auth';
import { browserApiRequest } from '@/lib/api/browser';
import { queryKeys } from '@/lib/query/keys';
import type { SafeSession } from '@/types/auth';

interface SessionContextValue {
  session: SafeSession | null;
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  refetch: () => Promise<SafeSession | null>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children, initialSession }: { children: ReactNode; initialSession?: SafeSession | null }) {
  const validatedInitialSession = initialSession == null ? initialSession : SafeSessionSchema.parse(initialSession);
  const result = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => browserApiRequest({ path: '/api/bff/session', outputSchema: SessionResponseSchema }),
    ...(validatedInitialSession !== undefined ? { initialData: { data: validatedInitialSession } } : {}),
    staleTime: 30_000,
  });
  const session = result.data?.data ?? null;
  const value: SessionContextValue = {
    session,
    status: result.isPending ? 'loading' : result.isError ? 'error' : session ? 'authenticated' : 'anonymous',
    refetch: async () => (await result.refetch()).data?.data ?? null,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function useResetSession(): () => void {
  const client = useQueryClient();
  return () => {
    client.removeQueries({ queryKey: queryKeys.me() });
    client.removeQueries({ queryKey: ['vendor'] });
    client.removeQueries({ queryKey: ['favorites'] });
    client.removeQueries({ queryKey: ['saved-searches'] });
    client.removeQueries({ queryKey: ['leads'] });
    client.removeQueries({ queryKey: ['dashboard'] });
    client.removeQueries({ queryKey: ['notifications'] });
  };
}
