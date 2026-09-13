import 'server-only';
import { serverEnv } from '@/lib/env/server';
import { resolveMarketplaceMedia } from '@/lib/api/marketplace-media';

export function adaptMarketplaceMedia(raw: unknown): unknown {
  return resolveMarketplaceMedia(raw, serverEnv.MEDIA_CDN_ORIGIN ?? serverEnv.BACKEND_API_ORIGIN);
}
