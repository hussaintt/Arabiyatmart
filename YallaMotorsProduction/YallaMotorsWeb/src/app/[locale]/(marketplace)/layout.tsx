import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAppLocale } from '@/i18n/config';
import { ConnectivityStatus } from '@/components/layout/connectivity-status';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { NavigationProgressProvider } from '@/components/layout/navigation-progress';

export default async function MarketplaceLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  return <NavigationProgressProvider><SiteHeader locale={locale} /><ConnectivityStatus locale={locale} /><div id="main-content" className="min-h-screen pb-20 sm:pb-0">{children}</div><SiteFooter locale={locale} /><MobileNav locale={locale} /></NavigationProgressProvider>;
}
