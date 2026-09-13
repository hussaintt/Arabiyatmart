'use client';

import * as React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ListingSort } from '@/types/listing';
import { ALLOWED_SORTS, DEFAULT_SORT } from '@/lib/search/defaults';

export interface SortControlProps {
  value?: ListingSort | undefined;
  onSortChange: (sort: ListingSort) => void;
  locale?: AppLocale | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function SortControl({
  value = DEFAULT_SORT,
  onSortChange,
  locale = 'ar',
  disabled = false,
  className,
}: SortControlProps) {
  const isArabic = locale === 'ar';

  const sortOptions: { value: ListingSort; label: string }[] = [
    { value: 'newest', label: isArabic ? 'أحدث الإعلانات' : 'Newest' },
    { value: 'price_asc', label: isArabic ? 'السعر: من الأقل للأعلى' : 'Price: Low to High' },
    { value: 'price_desc', label: isArabic ? 'السعر: من الأعلى للأقل' : 'Price: High to Low' },
    { value: 'year_desc', label: isArabic ? 'سنة الصنع: الأحدث' : 'Year: Newest' },
    { value: 'mileage_asc', label: isArabic ? 'المسافة: الأقل' : 'Mileage: Lowest' },
    { value: 'most_viewed', label: isArabic ? 'الأكثر مشاهدة' : 'Most Viewed' },
  ];

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const val = event.target.value as ListingSort;
    if (ALLOWED_SORTS.includes(val)) {
      onSortChange(val);
    }
  };

  return (
    <div
      className={cn('relative inline-flex items-center min-w-0', className)}
      data-testid="sort-control"
    >
      <label htmlFor="search-sort-select" className="sr-only">
        {isArabic ? 'ترتيب النتائج' : 'Sort results'}
      </label>
      <div className="relative flex items-center w-full">
        <ArrowUpDown className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <select
          id="search-sort-select"
          aria-label={isArabic ? 'ترتيب النتائج' : 'Sort results'}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'h-10 w-full rounded-lg border border-input bg-card ps-9 pe-8 py-2 text-xs sm:text-sm font-medium text-foreground shadow-xs',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer text-start'
          )}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ▼
        </span>
      </div>
    </div>
  );
}
