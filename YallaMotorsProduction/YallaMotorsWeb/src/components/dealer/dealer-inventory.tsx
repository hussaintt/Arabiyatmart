'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Car, ArrowRight, ArrowLeft, ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/listing/listing-card';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { CursorMeta } from '@/types/common';
import type { DealerInventoryParams } from '@/types/dealer';
import type { ListingCard as ListingCardType } from '@/types/listing';

export interface DealerInventoryProps {
  listings: readonly ListingCardType[];
  meta: CursorMeta;
  dealerSlug: string;
  currentParams: DealerInventoryParams;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function DealerInventory({
  listings,
  meta,
  dealerSlug: _unusedDealerSlug,
  currentParams,
  locale = 'ar',
  className,
}: DealerInventoryProps) {
  void _unusedDealerSlug;
  const isArabic = locale === 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Helper to build URL with modified query parameters
  const createQueryUrl = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Always reset cursor when changing filters
      if (!('cursor' in updates)) {
        params.delete('cursor');
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const handleFilterChange = (key: string, value: string | null) => {
    const nextUrl = createQueryUrl({ [key]: value });
    router.push(nextUrl);
  };

  const handleResetFilters = () => {
    router.push(pathname);
  };

  const hasActiveFilters = Boolean(
    currentParams.condition || currentParams.sort || currentParams.cursor
  );

  return (
    <div className={cn('space-y-6', className)} data-testid="dealer-inventory">
      {/* Inventory Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b">
        <div className="space-y-0.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Car className="h-5 w-5 text-primary shrink-0" />
            <span>{isArabic ? 'سيارات المعرض المتاحة' : 'Available Showroom Inventory'}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? `عرض ${listings.length} سيارة متاحة للتسليم الفوري`
              : `Showing ${listings.length} cars ready for immediate delivery`}
          </p>
        </div>

        {/* Filter Controls (Condition & Sort) */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto" data-testid="dealer-inventory-filters">
          {/* Condition Filter */}
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleFilterChange('condition', null)}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors',
                !currentParams.condition
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              data-testid="filter-condition-all"
            >
              {isArabic ? 'الكل' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('condition', 'NEW')}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors',
                currentParams.condition === 'NEW'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              data-testid="filter-condition-new"
            >
              {isArabic ? 'جديد' : 'New'}
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('condition', 'USED')}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors',
                currentParams.condition === 'USED'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              data-testid="filter-condition-used"
            >
              {isArabic ? 'مستعمل' : 'Used'}
            </button>
          </div>

          {/* Sort Selection */}
          <div className="relative inline-flex items-center">
            <ArrowUpDown className="absolute start-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={currentParams.sort ?? 'newest'}
              onChange={(e) => handleFilterChange('sort', e.target.value === 'newest' ? null : e.target.value)}
              className="h-8 rounded-lg border bg-card ps-7 pe-3 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              aria-label={isArabic ? 'ترتيب السيارات' : 'Sort listings'}
              data-testid="dealer-inventory-sort"
            >
              <option value="newest">{isArabic ? 'الأحدث' : 'Newest'}</option>
              <option value="price_asc">{isArabic ? 'الأقل سعراً' : 'Price: Low to High'}</option>
              <option value="price_desc">{isArabic ? 'الأعلى سعراً' : 'Price: High to Low'}</option>
            </select>
          </div>

          {/* Reset Filters button if active */}
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label={isArabic ? 'إلغاء التصفية' : 'Reset filters'}
              data-testid="dealer-inventory-reset-btn"
            >
              <X className="h-3.5 w-3.5 me-1" />
              <span>{isArabic ? 'إلغاء التصفية' : 'Reset'}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Listings Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
      {listings.length > 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          data-testid="dealer-listings-grid"
        >
          {listings.map((listing) => (
            <div key={listing.publicId} className="h-full">
              <ListingCard
                listing={listing}
                locale={locale}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div
          className="rounded-2xl border border-dashed bg-card/60 p-8 sm:p-12 text-center space-y-4"
          data-testid="dealer-inventory-empty"
        >
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Car className="h-7 w-7 opacity-60" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-bold text-base sm:text-lg text-foreground">
              {isArabic
                ? 'لا توجد سيارات معروضة لهذا المعرض حالياً'
                : 'No vehicles currently listed by this showroom'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {hasActiveFilters
                ? isArabic
                  ? 'لم نتمكن من العثور على سيارات تطابق الفلاتر المحددة. جرب إلغاء بعض الفلاتر.'
                  : 'No vehicles matched your selected filters. Try adjusting or clearing filters.'
                : isArabic
                  ? 'لم يقم المعرض بإضافة سيارات بعد، يرجى التحقق مرة أخرى قريباً.'
                  : 'This dealership has not added inventory yet. Please check back soon.'}
            </p>
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="font-semibold"
            >
              {isArabic ? 'عرض كافة سيارات المعرض' : 'View all showroom cars'}
            </Button>
          ) : null}
        </div>
      )}

      {/* Pagination Controls */}
      {(meta.hasMore || currentParams.cursor) ? (
        <nav
          aria-label={isArabic ? 'صفحات سيارات المعرض' : 'Dealer inventory pagination'}
          className="flex items-center justify-center gap-4 pt-6 border-t"
          data-testid="dealer-inventory-pagination"
        >
          {currentParams.cursor ? (
            <Button asChild variant="outline" size="sm" className="gap-1 font-semibold">
              <Link href={createQueryUrl({ cursor: null })} locale={locale}>
                {isArabic ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                <span>{isArabic ? 'الصفحة الأولى' : 'First Page'}</span>
              </Link>
            </Button>
          ) : null}

          {meta.hasMore && meta.nextCursor ? (
            <Button asChild variant="default" size="sm" className="gap-1 font-semibold bg-primary text-primary-foreground">
              <Link href={createQueryUrl({ cursor: meta.nextCursor })} locale={locale}>
                <span>{isArabic ? 'الصفحة التالية' : 'Next Page'}</span>
                {isArabic ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
