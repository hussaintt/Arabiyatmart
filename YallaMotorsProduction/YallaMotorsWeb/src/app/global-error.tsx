'use client';

import { useEffect, useRef } from 'react';
import { reportSafeBoundaryError } from '@/lib/observability/client-error';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alertRef.current?.focus();
    const digest = error.digest && /^[a-zA-Z0-9_-]{4,80}$/.test(error.digest) ? error.digest : null;
    reportSafeBoundaryError({ boundary: 'global', digest });
  }, [error.digest]);
  return (
    <html lang="ar" dir="rtl"><body><main className="flex min-h-screen items-center justify-center p-6"><div ref={alertRef} tabIndex={-1} role="alert" className="max-w-lg rounded-xl border p-8 text-center"><h1 className="text-2xl font-bold">حدث خطأ غير متوقع</h1><p className="mt-3 text-muted-foreground">تعذر عرض الصفحة. حاول مرة أخرى.</p><button className="mt-6 rounded-md bg-primary px-5 py-3 text-primary-foreground" onClick={reset}>إعادة المحاولة</button></div></main></body></html>
  );
}
