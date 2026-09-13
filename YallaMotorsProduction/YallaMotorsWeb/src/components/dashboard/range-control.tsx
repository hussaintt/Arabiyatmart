'use client';

import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';
import type { DashboardRange } from '@/types/dashboard';
import { trackAnalytics } from '@/lib/analytics/client';

export function RangeControl({ range, locale }: { range: DashboardRange; locale: AppLocale }) {
  const ar = locale === 'ar';
  const ranges: { value: DashboardRange; label: string }[] = [
    { value: '7d', label: ar ? '٧ أيام' : '7 days' },
    { value: '30d', label: ar ? '٣٠ يومًا' : '30 days' },
    { value: '90d', label: ar ? '٩٠ يومًا' : '90 days' },
  ];
  return <nav aria-label={ar ? 'الفترة الزمنية' : 'Dashboard date range'} className="inline-flex rounded-lg border bg-card p-1">{ranges.map((item) => <Link key={item.value} href={`/me/dashboard?range=${item.value}`} locale={locale} onClick={() => trackAnalytics({ name: 'dashboard_range', range: item.value })} aria-current={range === item.value ? 'page' : undefined} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground">{item.label}</Link>)}</nav>;
}
