'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MapPin, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { City } from '@/types/taxonomy';

export interface DealerDirectoryFiltersProps {
  readonly cities: readonly City[];
  readonly selectedCityId?: number | undefined;
  readonly totalDealers?: number | undefined;
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

export function DealerDirectoryFilters({
  cities,
  selectedCityId,
  totalDealers,
  locale = 'ar',
  className,
}: DealerDirectoryFiltersProps) {
  const isArabic = locale === 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleCityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const current = new URLSearchParams(searchParams ? searchParams.toString() : '');

    // Reset pagination cursor when filters change
    current.delete('cursor');

    if (value && value !== 'all') {
      current.set('cityId', value);
    } else {
      current.delete('cityId');
    }

    const query = current.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.push(url);
  };

  const handleClearCity = () => {
    const current = new URLSearchParams(searchParams ? searchParams.toString() : '');
    current.delete('cityId');
    current.delete('cursor');
    const query = current.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.push(url);
  };

  const activeCity = cities.find((c) => c.id === selectedCityId);

  return (
    <div
      className={cn('space-y-4', className)}
      data-testid="dealer-directory-filters"
      role="region"
      aria-label={isArabic ? 'تصفية معارض السيارات' : 'Dealer filters'}
    >
      {/* Desktop & Tablet Filter Card */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span>{isArabic ? 'تصفية حسب المدينة' : 'Filter by City'}</span>
          </div>

          {selectedCityId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearCity}
              aria-label={isArabic ? 'إعادة ضبط فلتر المدينة' : 'Clear city filter'}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <X className="h-3.5 w-3.5" />
              <span>{isArabic ? 'إلغاء' : 'Clear'}</span>
            </Button>
          ) : null}
        </div>

        {/* City Select Control */}
        <div className="space-y-1.5">
          <label
            htmlFor="dealer-city-select"
            className="text-xs font-semibold text-muted-foreground block"
          >
            {isArabic ? 'اختر المدينة' : 'Select City'}
          </label>

          <div className="relative">
            <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              id="dealer-city-select"
              aria-label={isArabic ? 'اختر المدينة' : 'Select City'}
              value={selectedCityId ? String(selectedCityId) : 'all'}
              onChange={handleCityChange}
              className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-8 py-2 text-xs sm:text-sm font-medium text-foreground shadow-2xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            >
              <option value="all">
                {isArabic ? 'جميع المدن والمحافظات' : 'All Cities'}
              </option>
              {cities.map((city) => (
                <option key={city.id} value={String(city.id)}>
                  {isArabic ? city.name.ar : city.name.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Pill */}
        {activeCity ? (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {isArabic ? 'المدينة المختارة:' : 'Selected:'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              <span>{isArabic ? activeCity.name.ar : activeCity.name.en}</span>
              <button
                type="button"
                onClick={handleClearCity}
                aria-label={isArabic ? 'إزالة تصفية المدينة' : 'Remove city filter'}
                className="hover:opacity-75 focus:outline-hidden"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        ) : null}

        {typeof totalDealers === 'number' ? (
          <p className="text-xs text-muted-foreground pt-1">
            {isArabic
              ? `${totalDealers} معرض متاح`
              : `${totalDealers} dealerships available`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
