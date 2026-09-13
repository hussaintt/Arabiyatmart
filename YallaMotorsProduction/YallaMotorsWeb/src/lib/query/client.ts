/**
 * TanStack Query Client Configuration and Factory.
 *
 * Implements Phase 1 Section 4.4/4.5 and Phase 2 Sections 3.1-3.6:
 * - Server-per-request and browser-singleton client management.
 * - Sensible default stale and garbage-collection timings.
 * - Strictly disabled automatic mutation retries to prevent duplicate submissions.
 * - Dehydrated error redaction preventing stack traces and sensitive payloads from leaking to browser HTML.
 */

import {
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
  type DehydrateOptions,
  type DehydratedState,
} from '@tanstack/react-query';
import { z } from 'zod';
import { sanitizeDetails } from '@/lib/api/error';

export const DEFAULT_QUERY_STALE_TIME = 60 * 1000; // 60 seconds
export const DEFAULT_QUERY_GC_TIME = 5 * 60 * 1000; // 5 minutes

const SerializableJsonSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(SerializableJsonSchema),
  z.record(z.string(), SerializableJsonSchema),
]));

export const SafeDehydratedStateSchema = z.object({
  mutations: z.array(z.object({
    state: z.record(z.string(), SerializableJsonSchema),
  }).catchall(SerializableJsonSchema)),
  queries: z.array(z.object({
    queryHash: z.string().min(1),
    queryKey: SerializableJsonSchema,
    state: z.record(z.string(), SerializableJsonSchema),
  }).catchall(SerializableJsonSchema)),
}).strict();

export function parseSafeDehydratedState(state: unknown): DehydratedState {
  return SafeDehydratedStateSchema.parse(state) as unknown as DehydratedState;
}

/**
 * Sanitizes and redacts an error payload before serialization into dehydrated state.
 */
export function redactErrorForDehydration(error: unknown): unknown {
  if (error === null || error === undefined) {
    return null;
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(errObj)) {
      if (/^(stack|sql|query|token|secret|password|cookie|authorization)$/i.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeDetails(value);
    }

    if (error instanceof Error && !sanitized['message']) {
      sanitized['message'] = sanitizeDetails(error.message);
    }

    return sanitized;
  }

  if (typeof error === 'string') {
    return sanitizeDetails(error);
  }

  return 'An error occurred';
}

/**
 * Constructs a new TanStack QueryClient with secure defaults.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_QUERY_STALE_TIME,
        gcTime: DEFAULT_QUERY_GC_TIME,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status: number }).status;
            if (typeof status === 'number' && status >= 400 && status < 500) {
              return false;
            }
          }
          return true;
        },
      },
      mutations: {
        // Disabled automatic mutation retry to prevent duplicate actions
        retry: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query),
        shouldRedactErrors: () => true,
      },
    },
  });
}

/**
 * Safely dehydrates a QueryClient while ensuring all errors in query states are redacted.
 */
export function dehydrateSafe(client: QueryClient, options?: DehydrateOptions): DehydratedState {
  const state = dehydrate(client, {
    shouldRedactErrors: () => true,
    ...options,
  });

  for (const q of state.queries) {
    if (q.state.error) {
      (q.state as { error: unknown }).error = redactErrorForDehydration(q.state.error);
    }
  }

  return parseSafeDehydratedState(state);
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Returns a QueryClient instance:
 * - On the server: always returns a fresh instance per request.
 * - On the browser: returns the singleton instance.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

/**
 * Resets the browser QueryClient singleton.
 * Useful for logout, account switching, or isolated test teardown.
 */
export function resetBrowserQueryClient(): void {
  if (browserQueryClient) {
    browserQueryClient.clear();
    browserQueryClient = undefined;
  }
}
