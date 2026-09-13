import * as React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { isAppLocale, type AppLocale } from '@/i18n/config';
import { SearchShell } from '@/components/search/search-shell';
import { SearchResults } from '@/components/search/search-results';
import { searchListings } from '@/server/queries/listings';
import { listMakes } from '@/server/queries/taxonomy';
import { listCities } from '@/server/queries/locations';
import {
  canonicalizeSearchParams,
  searchParamsToApiInput,
  serializeSearchParams,
  buildSearchUrl,
  type ParsedSearchParams,
} from '@/lib/search/params';
import { queryKeys } from '@/lib/query/keys';
import { getQueryClient } from '@/lib/query/client';
import { QueryHydrationBoundary } from '@/lib/query/hydration';
import { Skeleton } from '@/components/ui/skeleton';
import type { ListingSearchResponse } from '@/types/search';
import type { CityListResponse, MakeListResponse } from '@/types/taxonomy';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function isNonCanonical(
  raw: Record<string, string | string[] | undefined>,
  canonical: ParsedSearchParams
): boolean {
  const canonicalQuery = serializeSearchParams(canonical);

  const rawPairs: string[] = [];
  for (const [key, val] of Object.entries(raw)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      for (const v of val) {
        rawPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    } else {
      rawPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  }
  rawPairs.sort();
  const rawQuery = rawPairs.join('&');

  return rawQuery !== canonicalQuery;
}

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as AppLocale;
  const isArabic = locale === 'ar';

  const raw = await searchParams;
  const parsed = canonicalizeSearchParams(raw);

  const hasFilters = Object.keys(parsed).some(
    (k) =>
      k !== 'panel' &&
      k !== 'filter' &&
      parsed[k as keyof ParsedSearchParams] !== undefined
  );

  const makeName = parsed.makeSlug ? parsed.makeSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;

  let title = isArabic ? 'بحث عن سيارات للبيع' : 'Search Cars for Sale';
  if (parsed.makeSlug && parsed.modelSlug && parsed.condition) {
    const condText =
      parsed.condition === 'NEW'
        ? isArabic
          ? 'جديدة'
          : 'New'
        : isArabic
        ? 'مستعملة'
        : 'Used';
    title = isArabic
      ? `سيارات ${makeName} ${parsed.modelSlug} ${condText} للبيع`
      : `${condText} ${makeName} ${parsed.modelSlug} Cars for Sale`;
  } else if (parsed.makeSlug && parsed.modelSlug) {
    title = isArabic
      ? `سيارات ${makeName} ${parsed.modelSlug} للبيع`
      : `${makeName} ${parsed.modelSlug} Cars for Sale`;
  } else if (parsed.makeSlug) {
    title = isArabic
      ? `سيارات ${makeName} للبيع`
      : `${makeName} Cars for Sale`;
  } else if (parsed.condition) {
    const condText =
      parsed.condition === 'NEW'
        ? isArabic
          ? 'جديدة'
          : 'New'
        : isArabic
        ? 'مستعملة'
        : 'Used';
    title = isArabic ? `سيارات ${condText} للبيع` : `${condText} Cars for Sale`;
  } else if (parsed.q) {
    title = isArabic ? `بحث عن "${parsed.q}"` : `Search for "${parsed.q}"`;
  }

  const fullTitle = isArabic ? `${title} | عربيات مارت` : `${title} | Arabiyatmart`;

  const description = isArabic
    ? 'ابحث عن سيارات للبيع في مصر بأفضل الأسعار. تصفح آلاف الإعلانات للسيارات الجديدة والمستعملة من معارض وبائعين موثوقين.'
    : 'Find cars for sale in Egypt at the best prices. Browse thousands of new and used car listings from trusted dealers and private sellers.';

  const canonicalFilterParams: Partial<ParsedSearchParams> = { ...parsed };
  delete canonicalFilterParams.page;
  delete canonicalFilterParams.limit;
  delete canonicalFilterParams.panel;
  delete canonicalFilterParams.filter;
  const canonicalQuery = serializeSearchParams(canonicalFilterParams);
  const canonicalUrl = canonicalQuery
    ? `/${locale}/search?${canonicalQuery}`
    : `/${locale}/search`;

  return {
    title: fullTitle,
    description,
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ar: '/ar/search',
        en: '/en/search',
        'x-default': '/ar/search',
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: 'Arabiyatmart',
      locale: isArabic ? 'ar_EG' : 'en_US',
      type: 'website',
      images: [{ url: '/images/og-default.jpg', width: 1200, height: 630, alt: fullTitle }],
    },
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale as AppLocale;
  setRequestLocale(locale);

  const raw = await searchParams;
  const canonical = canonicalizeSearchParams(raw);

  // Redirect non-canonical URLs to single deterministic URL once
  if (isNonCanonical(raw, canonical)) {
    redirect(buildSearchUrl(`/${locale}/search`, canonical));
  }
  
  return (
    <Suspense fallback={<SearchLoadingSkeleton />}>
      <SearchContent canonical={canonical} locale={locale} />
    </Suspense>
  );
}

async function SearchContent({ canonical, locale }: { canonical: ParsedSearchParams; locale: AppLocale }) {
  // Convert canonical parameters to API input
  const apiInput = searchParamsToApiInput(canonical);

  // Fetch initial search results and taxonomy data concurrently
  let results: ListingSearchResponse;
  let makesResponse: MakeListResponse;
  let citiesResponse: CityListResponse;

  try {
    const [res, makes, cities] = await Promise.all([
      searchListings(apiInput, locale),
      listMakes(locale).catch(() => ({ data: [] })),
      listCities({ code: 'eg' }, locale).catch(() => ({ data: [] })),
    ]);
    results = res;
    makesResponse = makes;
    citiesResponse = cities;
  } catch {
    results = {
      data: [],
      meta: {
        total: 0,
        page: apiInput.page ?? 1,
        limit: apiInput.limit ?? 20,
        hasMore: false,
      },
    };
    makesResponse = { data: [] };
    citiesResponse = { data: [] };
  }

  // Prepopulate TanStack Query Client for client hydration
  const queryClient = getQueryClient();
  const { page, limit, ...filters } = apiInput;
  const queryKey = queryKeys.listingSearch(filters, page ?? 1, limit ?? 20);

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => Promise.resolve(results),
  });

  const isArabic = locale === 'ar';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: isArabic ? 'نتائج البحث عن سيارات' : 'Car Search Results',
    numberOfItems: results.data.length,
    itemListElement: results.data.map((car, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `/${locale}/listing/${car.slug}`,
      name:
        car.title ||
        (isArabic
          ? `${car.year} ${car.makeName?.ar ?? ''} ${car.modelName?.ar ?? ''}`.trim()
          : `${car.year} ${car.makeName?.en ?? ''} ${car.modelName?.en ?? ''}`.trim()),
    })),
  };

  return (
    <QueryHydrationBoundary queryClient={queryClient}>
      {/* Schema.org ItemList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SearchShell
          initialParams={canonical}
          totalResults={results.meta.total}
          makes={makesResponse.data}
          cities={citiesResponse.data}
          locale={locale}
        >
          <SearchResults
            results={results}
            currentParams={canonical}
            locale={locale}
            pathname={`/${locale}/search`}
          />
        </SearchShell>
      </div>
    </QueryHydrationBoundary>
  );
}

function SearchLoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6" data-testid="search-loading">
      {/* Mobile Toolbar Skeleton */}
      <div className="lg:hidden flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Main Grid: 3-column sidebar + 9-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Desktop Sidebar Skeleton */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 rounded-2xl border border-border bg-card p-5 space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </div>

        {/* Content Area Skeleton */}
        <div className="col-span-1 lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Header Row */}
          <div className="hidden lg:flex items-center justify-between pb-3 border-b border-border">
            <div className="space-y-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-52 rounded-lg" />
          </div>

          {/* Cards Grid Skeleton: 9 cards in 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={`search-card-skeleton-${idx}`}
                className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-xs"
              >
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Skeleton */}
          <div className="pt-4 flex justify-center">
            <Skeleton className="h-10 w-64 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
