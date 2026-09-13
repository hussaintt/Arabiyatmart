'use client';

import { Link, usePathname } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';

export function LocaleSwitcher({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const alternate = locale === 'ar' ? 'en' : 'ar';
  return <Link className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted" href={pathname || '/'} locale={alternate} hrefLang={alternate}>{alternate === 'ar' ? 'العربية' : 'EN'}</Link>;
}
