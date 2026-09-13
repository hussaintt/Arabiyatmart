'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { reportSafeBoundaryError, type SafeBoundaryEvent } from '@/lib/observability/client-error';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  boundary: Exclude<SafeBoundaryEvent['boundary'], 'global' | 'locale'>;
}

export function RouteError({ error, reset, boundary }: RouteErrorProps) {
  const t = useTranslations('error');
  const alertRef = useRef<HTMLDivElement>(null);
  const digest = error.digest && /^[a-zA-Z0-9_-]{4,80}$/.test(error.digest) ? error.digest : null;

  useEffect(() => {
    alertRef.current?.focus();
    reportSafeBoundaryError({ boundary, digest });
  }, [boundary, digest]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center px-4 py-10">
      <div ref={alertRef} tabIndex={-1} role="alert" className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">{t('genericTitle')}</h1>
        <p className="mt-3 text-muted-foreground">{t('genericMessage')}</p>
        {digest ? <p className="mt-3 text-xs text-muted-foreground">Reference: {digest}</p> : null}
        <Button type="button" className="mt-6" onClick={reset}>{t('retryButton')}</Button>
      </div>
    </main>
  );
}
