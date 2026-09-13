'use client';

import { useEffect, useState } from 'react';

export function ConnectivityStatus({ locale }: { locale: 'ar' | 'en' }) {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (online !== false) return null;
  return <div role="status" className="bg-warning px-4 py-2 text-center text-sm font-semibold text-warning-foreground">{locale === 'ar' ? 'أنت غير متصل بالإنترنت. قد تكون بعض البيانات قديمة.' : 'You are offline. Some information may be out of date.'}</div>;
}

