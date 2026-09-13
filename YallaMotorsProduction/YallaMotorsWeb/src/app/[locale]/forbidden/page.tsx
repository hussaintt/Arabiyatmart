import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isAppLocale, locales } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Metadata } from 'next';
import { serverEnv } from '@/lib/env/server';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'غير مصرح | عربيات مارت' : 'Access Denied | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/forbidden` },
  };
}


export default async function ForbiddenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'error' });
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-primary">403</p>
      <h1 className="mt-3 text-3xl font-bold">{t('forbiddenTitle')}</h1>
      <p className="mt-3 text-muted-foreground">{t('forbiddenMessage')}</p>
      <Link className="mt-6 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground" href="/" locale={locale}>{t('goHome')}</Link>
    </main>
  );
}
