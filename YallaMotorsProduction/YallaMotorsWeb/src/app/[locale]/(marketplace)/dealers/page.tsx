import * as React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Building2, ChevronLeft, ChevronRight, Home, ArrowRight, ArrowLeft } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { DealerListParamsSchema } from '@/lib/api/schemas/dealer';
import { listDealers } from '@/server/queries/dealers';
import { listCities } from '@/server/queries/locations';
import { DealerCard } from '@/components/dealer/dealer-card';
import { DealerDirectoryFilters } from '@/components/dealer/dealer-directory-filters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DealerListParams } from '@/types/dealer';

interface DealersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: DealersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const title = isArabic
    ? 'معارض وتجار السيارات المعتمدة في مصر | عربيات مارت'
    : 'Certified Car Showrooms & Dealers in Egypt | Arabiyatmart';
  const description = isArabic
    ? 'تصفح قائمة أكبر وأوثق معارض وتجار السيارات في مصر، واطلع على السيارات المعروضة والعروض الحصرية.'
    : 'Browse certified car showrooms and trusted automotive dealers across Egypt with active inventory.';

  const rawCityId = typeof sp.cityId === 'string' ? parseInt(sp.cityId, 10) : undefined;
  const rawCursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;
  const hasFilterOrCursor = (rawCityId !== undefined && !Number.isNaN(rawCityId)) || rawCursor !== undefined;

  return {
    title,
    description,
    robots: hasFilterOrCursor
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical: `/${validLocale}/dealers`,
      languages: {
        ar: '/ar/dealers',
        en: '/en/dealers',
        'x-default': '/ar/dealers',
      },
    },
    openGraph: {
      title,
      description,
      url: `/${validLocale}/dealers`,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      type: 'website',
      images: [{ url: '/images/og-default.jpg', width: 1200, height: 630, alt: title }],
    },
  };
}

function DealersLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8 w-full">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2 py-1">
        <Skeleton className="h-4 w-12 rounded-sm" />
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-24 rounded-sm" />
      </div>

      {/* Heading Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 sm:w-80 rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
      </div>

      {/* 12-Column Responsive Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Filter Rail Skeleton (3 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b">
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        {/* Directory Content Skeleton (9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>

          {/* 9 Directory Card Skeletons in 1/2/3 responsive columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={`dealer-card-skeleton-${idx}`}
                className="rounded-xl border border-border bg-card p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
                <div className="pt-4 border-t flex items-center justify-between">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-4 w-12 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function DealersContent({ locale, validParams }: { locale: AppLocale; validParams: DealerListParams }) {
  const isArabic = locale === 'ar';

  // Concurrently fetch dealers and Egyptian cities
  const [dealersRes, citiesRes] = await Promise.all([
    listDealers(validParams, locale).catch(() => ({
      data: [],
      meta: { hasMore: false, nextCursor: null },
    })),
    listCities({ code: 'EG' }, locale).catch(() => ({
      data: [],
    })),
  ]);

  const dealers = dealersRes.data;
  const meta = dealersRes.meta;
  const cities = citiesRes.data;

  // Selected city object
  const selectedCity = validParams.cityId ? cities.find((c) => c.id === validParams.cityId) : null;
  const selectedCityName = selectedCity ? (isArabic ? selectedCity.name.ar : selectedCity.name.en) : null;

  // Pagination query helpers
  const buildPageUrl = (newCursor: string | null) => {
    const p = new URLSearchParams();
    if (validParams.cityId) p.set('cityId', String(validParams.cityId));
    if (newCursor) p.set('cursor', newCursor);
    const qs = p.toString();
    return qs ? `/dealers?${qs}` : '/dealers';
  };

  // JSON-LD ItemList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: isArabic ? 'معارض السيارات المعتمدة' : 'Certified Car Showrooms',
    numberOfItems: dealers.length,
    itemListElement: dealers.map((dealer, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'AutoDealer',
        name: isArabic ? dealer.displayName.ar : dealer.displayName.en,
        url: `https://arabiyatmart.com/${locale}/dealers/${dealer.slug}`,
      },
    })),
  };

  return (
    <>
      {/* ItemList Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label={isArabic ? 'مسار التنقل' : 'Breadcrumbs'}
          className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap py-1 scrollbar-none"
        >
          <Link
            href="/"
            locale={locale}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
            <span>{isArabic ? 'الرئيسية' : 'Home'}</span>
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <span
            aria-current="page"
            className="font-semibold text-foreground truncate"
          >
            {isArabic ? 'معارض السيارات' : 'Car Dealerships'}
          </span>
        </nav>

        {/* Directory Page Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
            {isArabic ? 'دليل معارض وتجار السيارات' : 'Certified Dealership Directory'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {isArabic
              ? 'تصفح قائمة معارض السيارات المعتمدة والموثقة في مصر، واطلع على السيارات المتاحة للتسليم الفوري من أكبر الشركات والوكلاء.'
              : 'Discover certified and verified automotive dealerships in Egypt. Browse trusted inventories ready for immediate delivery.'}
          </p>
        </div>

        {/* 12-Column Responsive Layout: 3-column filter rail + 9-column directory grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Filter Rail (Bounded 3-4 cols on desktop) */}
          <aside className="lg:col-span-4 xl:col-span-3 min-w-0">
            <DealerDirectoryFilters
              cities={cities}
              selectedCityId={validParams.cityId}
              totalDealers={dealers.length}
              locale={locale}
            />
          </aside>

          {/* Directory Content (8-9 cols on desktop) */}
          <section
            className="lg:col-span-8 xl:col-span-9 min-w-0 space-y-6"
            aria-label={isArabic ? 'قائمة معارض السيارات' : 'Showrooms list'}
          >
            {/* Filter Summary Bar */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b">
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                {selectedCityName ? (
                  <>
                    {isArabic ? 'المعارض في ' : 'Showrooms in '}
                    <span className="text-primary">{selectedCityName}</span>
                  </>
                ) : (
                  <span>{isArabic ? 'كافة المعارض المسجلة' : 'All Registered Showrooms'}</span>
                )}
              </span>

              <span className="text-xs text-muted-foreground font-medium">
                {isArabic
                  ? `${dealers.length} معرض متاح`
                  : `${dealers.length} dealerships`}
              </span>
            </div>

            {/* Dealer Cards Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
            {dealers.length > 0 ? (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
                data-testid="dealer-directory-grid"
              >
                {dealers.map((dealer) => (
                  <DealerCard
                    key={dealer.publicId}
                    dealer={dealer}
                    locale={locale}
                  />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div
                className="rounded-2xl border bg-card/60 p-8 sm:p-12 text-center space-y-4"
                data-testid="dealer-empty-state"
              >
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="h-8 w-8 opacity-60" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h2 className="font-bold text-base sm:text-lg text-foreground">
                    {isArabic
                      ? 'لا توجد معارض سيارات مسجلة في هذه المدينة'
                      : 'No dealerships found in this city'}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {isArabic
                      ? 'جرب اختيار مدينة أخرى أو قم بإلغاء التصفية لعرض جميع المعارض في مصر.'
                      : 'Try selecting a different city or clear the filter to view all dealerships in Egypt.'}
                  </p>
                </div>
                {validParams.cityId ? (
                  <Button asChild variant="outline" size="sm" className="font-semibold">
                    <Link href="/dealers" locale={locale}>
                      {isArabic ? 'عرض جميع المعارض' : 'View all showrooms'}
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}

            {/* Pagination Controls */}
            {(meta.hasMore || validParams.cursor) ? (
              <nav
                aria-label={isArabic ? 'صفحات الدليل' : 'Directory pagination'}
                className="flex items-center justify-center gap-4 pt-6 border-t"
              >
                {validParams.cursor ? (
                  <Button asChild variant="outline" size="sm" className="gap-1 font-semibold">
                    <Link href={buildPageUrl(null)} locale={locale}>
                      {isArabic ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                      <span>{isArabic ? 'الصفحة الأولى' : 'First Page'}</span>
                    </Link>
                  </Button>
                ) : null}

                {meta.hasMore && meta.nextCursor ? (
                  <Button asChild variant="default" size="sm" className="gap-1 font-semibold bg-primary text-primary-foreground">
                    <Link href={buildPageUrl(meta.nextCursor)} locale={locale}>
                      <span>{isArabic ? 'الصفحة التالية' : 'Next Page'}</span>
                      {isArabic ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    </Link>
                  </Button>
                ) : null}
              </nav>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}

export default async function DealersPage({
  params,
  searchParams,
}: DealersPageProps) {
  const { locale } = await params;
  const sp = await searchParams;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const validLocale: AppLocale = locale;

  // Parse and validate query params (fast sync logic)
  const rawCityId = typeof sp.cityId === 'string' ? parseInt(sp.cityId, 10) : undefined;
  const rawCursor = typeof sp.cursor === 'string' && sp.cursor.trim().length > 0 ? sp.cursor.trim() : undefined;

  const candidateParams: DealerListParams = {
    limit: 24,
    ...(rawCityId !== undefined && !Number.isNaN(rawCityId) && rawCityId > 0 ? { cityId: rawCityId } : {}),
    ...(rawCursor ? { cursor: rawCursor } : {}),
  };

  const parsed = DealerListParamsSchema.safeParse(candidateParams);
  const validParams: DealerListParams = parsed.success ? parsed.data : { limit: 24 };

  // Use suspense key to trigger fallback on param changes
  const suspenseKey = JSON.stringify(validParams);

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <Suspense key={suspenseKey} fallback={<DealersLoadingSkeleton />}>
        <DealersContent locale={validLocale} validParams={validParams} />
      </Suspense>
    </div>
  );
}
