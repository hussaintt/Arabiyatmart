import * as React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { locales, isAppLocale, type AppLocale } from '@/i18n/config';
import { connection } from 'next/server';
import { getHomePageDataWithStatus } from '@/server/queries/home';
import { MarketplaceHero } from '@/components/home/marketplace-hero';
import { HomeInventory } from '@/components/home/home-inventory';
import { BrandDiscovery, ShoppingCollections, OwnershipTools, SellCarSection, HomeFaq } from '@/components/home/home-discovery';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { SpotlightSection } from '@/components/home/spotlight-section';
import { DealerStrip } from '@/components/home/dealer-strip';
import { Reveal } from '@/components/ui/reveal';
import { canonicalizePublicUrl } from '@/lib/metadata';
import { serverEnv } from '@/lib/env/server';
import type { HomePageData } from '@/types/home';
import { Skeleton } from '@/components/ui/skeleton';
import '@/components/home/home.css';

export const revalidate = 300;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface MarketplaceHomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: MarketplaceHomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'عربيات مارت | سيارات جديدة ومستعملة للبيع في مصر'
    : 'Arabiyatmart | New & Used Cars for Sale in Egypt';
  const description = isArabic
    ? 'اكتشف سيارات جديدة ومستعملة للبيع في مصر. قارن الموديلات والأسعار، تواصل مع المالك أو المعرض مباشرة، وأعلن عن سيارتك على عربيات مارت.'
    : 'Find new and used cars for sale in Egypt. Compare models and prices, connect with owners and dealers, or list your car on Arabiyatmart.';

  const canonicalUrl = `/${locale}`;
  const ogImageUrl = `${serverEnv.SITE_ORIGIN}/images/og-home-${locale}.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ar: '/ar',
        en: '/en',
        'x-default': '/ar',
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      locale: isArabic ? 'ar_EG' : 'en_US',
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title, type: 'image/jpeg' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function MarketplaceHomePage({
  params,
}: MarketplaceHomePageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale as AppLocale;
  setRequestLocale(locale);

  // 2. Structured JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Arabiyatmart',
    url: canonicalizePublicUrl(`/${locale}`),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${canonicalizePublicUrl(`/${locale}/search`)}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <main className="marketplace-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Suspense fallback={<HomeLoadingSkeleton />}>
        <HomeContent locale={locale} />
      </Suspense>
    </main>
  );
}

// ── Async data-fetching Server Component ─────────────────

async function HomeContent({ locale }: { locale: AppLocale }) {
  let unavailable = { latest: false, popular: false };

  // 1. Parallel, safe ISR data fetch with internal degradation
  let data: HomePageData;
  try {
    const homeResult = await getHomePageDataWithStatus(locale);
    data = homeResult.data;
    unavailable = { latest: homeResult.degradedReasons?.includes('latest') ?? false, popular: homeResult.degradedReasons?.includes('featured') ?? false };
    if (homeResult.isDegraded) {
      // Avoid normal-duration public caching of outage-generated empty data
      try { await connection(); } catch { /* no-op outside Next.js request context */ }
    }
  } catch {
    unavailable = { latest: true, popular: true };
    // If backend is unreachable (e.g. during build-time prerendering or upstream outage),
    // degrade gracefully to empty listings so the build and page remain resilient
    try { await connection(); } catch { /* no-op outside Next.js request context */ }
    data = {
      banners: [],
      spotlight: [],
      featuredListings: [],
      latestListings: [],
      featuredDealers: [],
      settings: {
        finance: { annualRate: 0.15, downPaymentFraction: 0.2, tenorMonths: 60 },
        support: { termsUrl: null, privacyUrl: null, supportEmail: null, supportPhone: null },
      },
    };
  }

  return (
    <>
      <MarketplaceHero spotlight={data.spotlight} locale={locale} />
      <div className="home-container">
        <BrandDiscovery locale={locale} />
        <Reveal><HomeInventory latest={data.latestListings} popular={data.featuredListings} unavailable={unavailable} locale={locale} /></Reveal>
      </div>
      <div className="home-soft-section"><div className="home-container"><Reveal><ShoppingCollections locale={locale} /></Reveal></div></div>
      <div className="home-container">
        {data.spotlight.length > 0 && <Reveal className="home-live-section"><SpotlightSection spotlight={data.spotlight.slice(0, 5)} locale={locale} /></Reveal>}
        {data.featuredDealers.length > 0 && <Reveal className="home-live-section"><DealerStrip dealers={data.featuredDealers.slice(0, 4)} locale={locale} /></Reveal>}
        <Reveal><OwnershipTools locale={locale} /></Reveal>
        <SellCarSection locale={locale} />
        <Reveal><HomeFaq locale={locale} /></Reveal>
        {data.banners.length > 0 && <Reveal className="home-promotions"><BannerCarousel banners={data.banners} locale={locale} /></Reveal>}
      </div>
    </>
  );
}

// ── Loading Skeleton ─────────────────

function HomeLoadingSkeleton() {
  return (
    <div className="home-container home-loading" data-testid="home-loading-skeleton" aria-busy="true" aria-label="Loading / جارٍ التحميل">
      <Skeleton className="home-loading-hero" />
      <Skeleton className="home-loading-search" />
      <div className="grid grid-cols-3 gap-5 border-b py-8 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="home-section space-y-7">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-11 w-56" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-4 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
