import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { defaultLocale, isAppLocale, type AppLocale } from '@/i18n/config';
import { ConnectivityStatus } from '@/components/layout/connectivity-status';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

export const metadata = { robots: { index: false, follow: true } };
export default async function LocaleNotFound({ params }: { params?: Promise<{ locale?: string }> }) {
  const raw = params ? (await params).locale : defaultLocale;
  const locale = isAppLocale(raw) ? raw : defaultLocale;
  const appLocale = locale as AppLocale;
  const t = await getTranslations({ locale, namespace: 'error' });
  return (
    <>
      <SiteHeader locale={appLocale} />
      <ConnectivityStatus locale={appLocale} />
      <main className="flex min-h-[60vh] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-5xl font-black tracking-tight text-primary">
            404
          </div>
          <h1 className="mt-6 text-2xl font-black text-foreground sm:text-3xl">{t('notFoundTitle')}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('notFoundMessage')}
          </p>
          <Link
            className="mt-8 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
            href="/"
            locale={appLocale}
          >
            {t('goHome')}
          </Link>
        </div>
      </main>
      <SiteFooter locale={appLocale} />
      <MobileNav locale={appLocale} />
    </>
  );
}
