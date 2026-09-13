'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';

const paths = ['/profile', '/favorites', '/saved-searches', '/notifications', '/me/listings', '/me/leads', '/me/dashboard'] as const;

export function AccountTabletNav({ locale }: { locale: AppLocale }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const labels = locale === 'ar'
    ? ['الملف الشخصي', 'المفضلة', 'البحث المحفوظ', 'الإشعارات', 'إعلاناتي', 'طلبات التواصل', 'لوحة التحكم']
    : ['Profile', 'Favorites', 'Saved searches', 'Notifications', 'My listings', 'Buyer inquiries', 'Dashboard'];
  return <section className="w-full sm:block lg:hidden">
    <button type="button" className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 font-semibold" aria-expanded={open} aria-controls="tablet-account-navigation" onClick={() => setOpen((value) => !value)}>{locale === 'ar' ? 'قائمة الحساب' : 'Account navigation'}<ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden /></button>
    {open ? <nav id="tablet-account-navigation" aria-label={locale === 'ar' ? 'قائمة الحساب' : 'Account navigation'} className="mt-2 grid grid-cols-2 gap-2 rounded-lg border bg-card p-2">{paths.map((href, index) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} locale={locale} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:text-primary">{labels[index]}</Link>; })}</nav> : null}
  </section>;
}
