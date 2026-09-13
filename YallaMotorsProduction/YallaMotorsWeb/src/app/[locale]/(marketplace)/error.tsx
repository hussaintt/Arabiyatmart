'use client';

import { RouteError } from '@/components/layout/route-error';

export default function MarketplaceError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} boundary="marketplace" />;
}
