'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { reportSafeBoundaryError } from '@/lib/observability/client-error';

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');
  const ref = useRef<HTMLDivElement>(null);
  const digest = error.digest && /^[a-zA-Z0-9_-]{4,80}$/.test(error.digest) ? error.digest : null;
  useEffect(() => {
    ref.current?.focus();
    reportSafeBoundaryError({ boundary: 'locale', digest });
  }, [digest]);
  return <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4"><div ref={ref} tabIndex={-1} role="alert" className="w-full rounded-xl border bg-card p-8 text-center"><h1 className="text-2xl font-bold">{t('genericTitle')}</h1><p className="mt-3 text-muted-foreground">{t('genericMessage')}</p>{digest ? <p className="mt-3 text-xs text-muted-foreground">Reference: {digest}</p> : null}<button className="mt-6 rounded-md bg-primary px-5 py-3 text-primary-foreground" onClick={reset}>{t('retryButton')}</button></div></main>;
}
