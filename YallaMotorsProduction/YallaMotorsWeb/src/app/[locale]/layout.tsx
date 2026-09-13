import type { ReactNode } from "react";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { isAppLocale, getLocaleDirection, type AppLocale } from "@/i18n/config";
import { AppProviders } from '@/providers/app-providers';
import { buildLocalizedMetadata } from '@/lib/metadata';

const cairo = localFont({
  src: "../../../public/fonts/Cairo-VariableFont.ttf",
  variable: "--font-cairo",
  display: "swap",
  weight: "100 900",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const isArabic = locale === "ar";
  return buildLocalizedMetadata({
    locale,
    path: `/${locale}`,
    title: isArabic ? "عربيات مارت" : "Arabiyatmart",
    description: isArabic ? "أكبر سوق موثوق للسيارات في مصر" : "Egypt's premier automotive marketplace",
  });
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const appLocale = locale as AppLocale;

  // Enable static rendering
  setRequestLocale(appLocale);

  const messages = await getMessages();
  const dir = getLocaleDirection(appLocale);
  const isArabic = appLocale === 'ar';

  return (
    <html lang={appLocale} dir={dir} className={cairo.variable}>
      <body className={`min-h-screen antialiased ${cairo.className}`}>
        <noscript>
          <main className="mx-auto max-w-2xl space-y-5 px-4 py-10 text-center">
            <h1 className="text-2xl font-black">{isArabic ? 'عربيات مارت - سوق السيارات في مصر' : 'Arabiyatmart - Automotive Marketplace in Egypt'}</h1>
            <p>{isArabic ? 'يمكنك تصفح السيارات والمعارض ودليل السيارات بدون تفعيل JavaScript.' : 'You can browse vehicles, dealers, and the car catalogue without enabling JavaScript.'}</p>
            <nav aria-label={isArabic ? 'روابط السوق' : 'Marketplace links'} className="flex flex-wrap justify-center gap-4">
              <a href={`/${appLocale}/search`}>{isArabic ? 'بحث السيارات' : 'Search cars'}</a>
              <a href={`/${appLocale}/catalogue/makes`}>{isArabic ? 'دليل السيارات' : 'Car guide'}</a>
              <a href={`/${appLocale}/dealers`}>{isArabic ? 'المعارض' : 'Dealers'}</a>
            </nav>
          </main>
        </noscript>
        <NextIntlClientProvider messages={messages} locale={appLocale}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
