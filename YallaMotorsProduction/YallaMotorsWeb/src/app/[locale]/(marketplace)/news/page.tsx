import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { NewsPlaceholder } from '@/components/home/news-placeholder';

interface NewsPageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const ar = locale === 'ar';
  const title = ar ? 'أخبار السيارات | عربيات مارت' : 'Car News | Arabiyatmart';
  const description = ar ? 'قسم أخبار السيارات من عربيات مارت.' : 'Automotive news from Arabiyatmart.';
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/news`, languages: { ar: '/ar/news', en: '/en/news' } },
    openGraph: { title, description, url: `/${locale}/news`, type: 'website' },
  };
}

export default async function NewsPage({ params }: NewsPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as AppLocale;
  setRequestLocale(locale);
  return <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"><NewsPlaceholder locale={locale} fullPage /></main>;
}
