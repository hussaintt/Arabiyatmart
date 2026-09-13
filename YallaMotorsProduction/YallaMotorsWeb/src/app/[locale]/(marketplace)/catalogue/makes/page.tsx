import * as React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChevronLeft, ChevronRight, Home, Sparkles } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { listMakes } from '@/server/queries/taxonomy';
import { MakeGrid } from '@/components/catalogue/make-grid';
import { Skeleton } from '@/components/ui/skeleton';

interface MakesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: MakesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const title = isArabic
    ? 'دليل ماركات السيارات في مصر | الأسعار والموديلات | عربيات مارت'
    : 'Car Makes & Brands Directory in Egypt | Arabiyatmart';
  const description = isArabic
    ? 'تصفح كافة ماركات السيارات المتوفرة في السوق المصري، واكتشف الموديلات والأسعار الرسمية والمواصفات من الوكلاء المعتمدين.'
    : 'Browse all car brands and makes available in Egypt. Discover official models, prices, and specifications.';

  return {
    title,
    description,
    alternates: {
      canonical: `/${validLocale}/catalogue/makes`,
      languages: {
        ar: '/ar/catalogue/makes',
        en: '/en/catalogue/makes',
        'x-default': '/ar/catalogue/makes',
      },
    },
    openGraph: {
      title,
      description,
      url: `/${validLocale}/catalogue/makes`,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      type: 'website',
      images: [{ url: '/images/og-default.jpg', width: 1200, height: 630, alt: title }],
    },
  };
}

function MakesLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8 w-full">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2 py-1">
        <Skeleton className="h-4 w-12 rounded-sm" />
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-20 rounded-sm" />
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-24 rounded-sm" />
      </div>

      {/* Heading Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-48 rounded-full mb-2" />
        <Skeleton className="h-9 w-64 sm:w-80 rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
      </div>

      {/* Makes Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={`make-skeleton-${i}`} className="flex flex-col items-center justify-center p-4 border rounded-xl bg-card space-y-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function MakesContent({ locale }: { locale: AppLocale }) {
  const isArabic = locale === 'ar';
  const makesRes = await listMakes(locale).catch(() => ({ data: [] }));
  const makes = makesRes.data;

  // JSON-LD BreadcrumbList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: isArabic ? 'الرئيسية' : 'Home',
        item: `https://arabiyatmart.com/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: isArabic ? 'دليل السيارات' : 'Catalogue',
        item: `https://arabiyatmart.com/${locale}/catalogue/makes`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: isArabic ? 'ماركات السيارات' : 'Car Makes',
        item: `https://arabiyatmart.com/${locale}/catalogue/makes`,
      },
    ],
  };

  return (
    <>
      {/* Breadcrumbs JSON-LD */}
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
            {isArabic ? 'ماركات السيارات' : 'Car Makes'}
          </span>
        </nav>

        {/* Page Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isArabic ? 'دليل السيارات وماركات السوق' : 'Vehicle Brands & Catalogue'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
            {isArabic ? 'دليل ماركات وتوكيلات السيارات' : 'Automotive Brands Directory'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {isArabic
              ? 'اختر الماركة التي تبحث عنها للاطلاع على كافة الموديلات، الفئات، والأسعار الرسمية، مع إمكانية استعراض سيارات المعارض المعتمدة.'
              : 'Choose a car brand to explore all available models, trim specifications, and official market prices.'}
          </p>
        </div>

        {/* Makes Grid */}
        <section aria-label={isArabic ? 'قائمة ماركات السيارات' : 'Car makes list'}>
          <MakeGrid
            makes={makes}
            locale={locale}
          />
        </section>
      </main>
    </>
  );
}

export default async function MakesPage({
  params,
}: MakesPageProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const validLocale: AppLocale = locale;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <Suspense fallback={<MakesLoadingSkeleton />}>
        <MakesContent locale={validLocale} />
      </Suspense>
    </div>
  );
}
