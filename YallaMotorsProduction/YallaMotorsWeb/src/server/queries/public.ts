import 'server-only';

import type { z } from 'zod';
import { serverApiRequest, type UpstreamEndpointBuilder } from '@/lib/api/server';
import type { CachePolicy } from '@/lib/cache/policy';
import type { Locale } from '@/types/common';

export function publicQuery<T>(options: {
  operation: string;
  endpoint: UpstreamEndpointBuilder;
  outputSchema: z.ZodType<T>;
  locale: Locale;
  cachePolicy: CachePolicy;
  query?: object;
  adapter?: (raw: unknown) => unknown;
}): Promise<T> {
  return serverApiRequest({ operation: options.operation, method: 'GET', endpoint: options.endpoint, outputSchema: options.outputSchema, authMode: 'P', locale: options.locale, cachePolicy: options.cachePolicy, query: options.query as Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>> | undefined, adapter: options.adapter });
}
