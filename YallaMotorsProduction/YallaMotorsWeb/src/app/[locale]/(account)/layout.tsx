import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAppLocale } from '@/i18n/config';
import { requireSession } from '@/lib/auth/guards';
import { AccountSidebar } from '@/components/layout/account-sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountTabletNav } from '@/components/layout/account-tablet-nav';
import { NavigationProgressProvider } from '@/components/layout/navigation-progress';

export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  await requireSession(`/${locale}/profile`, locale);
  return <NavigationProgressProvider><SiteHeader locale={locale} /><main id="main-content" className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-24 sm:px-6 sm:pb-8 lg:flex-row lg:gap-8 lg:px-8"><AccountTabletNav locale={locale} /><AccountSidebar locale={locale} /><div className="min-w-0 flex-1">{children}</div></main><MobileNav locale={locale} /></NavigationProgressProvider>;
}
