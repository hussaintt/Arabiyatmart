'use client';

import * as React from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { FilterPanel } from './filter-panel';
import { MobileFilterDrawer } from './mobile-filter-drawer';
import { SortControl } from './sort-control';
import { ActiveFilters } from './active-filters';
import {
  applyFilterChange,
  buildSearchUrl,
  type ParsedSearchParams,
} from '@/lib/search/params';
import type { AppLocale } from '@/i18n/config';
import type { City, Make, VehicleModel } from '@/types/taxonomy';
import type { ListingSort } from '@/types/listing';
import { cn } from '@/lib/utils';
import { trackAnalytics } from '@/lib/analytics/client';

export interface SearchShellProps {
  initialParams: ParsedSearchParams;
  totalResults: number | null;
  makes?: Make[] | undefined;
  models?: VehicleModel[] | undefined;
  cities?: City[] | undefined;
  locale?: AppLocale | undefined;
  children: React.ReactNode;
}

export function SearchShell({
  initialParams,
  totalResults,
  makes = [],
  models = [],
  cities = [],
  locale = 'ar',
  children,
}: SearchShellProps) {
  const isArabic = locale === 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  // Current committed params reflect the URL state
  const currentParams = initialParams;

  // Race condition prevention: monotonic sequence counter
  const latestSeqRef = React.useRef(0);

  const navigateWithParams = React.useCallback(
    (nextParams: ParsedSearchParams) => {
      const seq = ++latestSeqRef.current;
      const url = buildSearchUrl(pathname, nextParams);

      startTransition(() => {
        if (seq === latestSeqRef.current) {
          router.replace(url, { scroll: false });
        }
      });
    },
    [pathname, router]
  );

  const handleFilterChange = (changes: Partial<ParsedSearchParams>) => {
    const next = applyFilterChange(currentParams, changes);
    const key = Object.keys(changes)[0] ?? 'all';
    const filter = key === 'q' ? 'query' : key === 'makeSlug' ? 'make' : key === 'modelPublicId' ? 'model' : key.startsWith('price') ? 'price' : key.startsWith('year') ? 'year' : key.startsWith('mileage') ? 'mileage' : key === 'cityId' ? 'location' : key === 'sellerType' ? 'seller' : key === 'sort' ? 'sort' : 'all';
    trackAnalytics({ name: 'search_filter', action: 'apply', filter, outcome: 'succeeded' });
    navigateWithParams(next);
  };

  const handleRemoveFilter = (key: keyof ParsedSearchParams) => {
    const next = applyFilterChange(currentParams, { [key]: undefined });
    trackAnalytics({ name: 'search_filter', action: 'clear', filter: 'all', outcome: 'succeeded' });
    navigateWithParams(next);
  };

  const handleClearAll = () => {
    trackAnalytics({ name: 'search_filter', action: 'clear', filter: 'all', outcome: 'succeeded' });
    navigateWithParams({});
  };

  const handleSortChange = (sort: ListingSort) => {
    const next = applyFilterChange(currentParams, { sort });
    trackAnalytics({ name: 'search_filter', action: 'sort', filter: 'sort', outcome: 'succeeded' });
    navigateWithParams(next);
  };

  return (
    <div className="w-full space-y-6" data-testid="search-shell">
      {/* Mobile / Tablet Top Toolbar */}
      <div
        className="lg:hidden flex flex-col gap-3 p-3 rounded-xl border border-border bg-card shadow-xs"
        role="region"
        aria-label={isArabic ? 'أدوات البحث' : 'Search controls'}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Mobile Filter Drawer Button */}
          <MobileFilterDrawer
            currentParams={currentParams}
            onApply={navigateWithParams}
            makes={makes}
            models={models}
            cities={cities}
            locale={locale}
          />

          {/* Sort Control */}
          <div className="flex-1 max-w-[200px]">
            <SortControl
              value={currentParams.sort}
              onSortChange={handleSortChange}
              locale={locale}
            />
          </div>
        </div>

        {/* Active Filters on Mobile */}
        <ActiveFilters
          params={currentParams}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAll}
          makes={makes}
          models={models}
          cities={cities}
          locale={locale}
        />
      </div>

      {/* Main Layout: Desktop 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Desktop Sticky Sidebar (3 Columns / ~280-320px) */}
        <aside
          className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-20 rounded-2xl border border-border bg-card p-5 shadow-xs max-h-[calc(100vh-6rem)] overflow-y-auto min-w-0"
          aria-label={isArabic ? 'فلاتر البحث الجانبية' : 'Search filters sidebar'}
        >
          <FilterPanel
            values={currentParams}
            onChange={handleFilterChange}
            makes={makes}
            models={models}
            cities={cities}
            locale={locale}
          />
        </aside>

        {/* Main Content Area (9 Columns) */}
        <main className="col-span-1 lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
          {/* Desktop Content Header: Results Count + Sort Control */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-border">
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                {isArabic ? 'نتائج البحث عن سيارات' : 'Search Results'}
              </h1>
              {totalResults !== null && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isArabic
                    ? `تم العثور على ${totalResults.toLocaleString('ar-EG')} سيارة`
                    : `Found ${totalResults.toLocaleString('en-US')} vehicles`}
                </p>
              )}
            </div>

            <div className="hidden w-56 shrink-0 lg:block">
              <SortControl
                value={currentParams.sort}
                onSortChange={handleSortChange}
                locale={locale}
              />
            </div>
          </div>

          {/* Desktop Active Filters Bar */}
          <div className="hidden lg:block">
            <ActiveFilters
              params={currentParams}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={handleClearAll}
              makes={makes}
              models={models}
              cities={cities}
              locale={locale}
            />
          </div>

          {/* Results Area with loading indicator overlay if pending */}
          <div className={cn('transition-opacity duration-150', isPending && 'opacity-60')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
