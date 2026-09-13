'use client';

import * as React from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { formatDigits, formatMoneyFromCents } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { TrimSummary } from '@/types/taxonomy';

export interface TrimTableProps {
  trims: readonly TrimSummary[];
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

type SortField = 'default' | 'price_asc' | 'price_desc' | 'power' | 'year';

export function TrimTable({
  trims,
  locale = 'ar',
  className,
}: TrimTableProps) {
  const isArabic = locale === 'ar';
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;
  const [sortField, setSortField] = React.useState<SortField>('default');

  const sortedTrims = React.useMemo(() => {
    if (sortField === 'default') return trims;
    const copy = [...trims];
    switch (sortField) {
      case 'price_asc':
        return copy.sort((a, b) => (a.officialPriceCents ?? 0) - (b.officialPriceCents ?? 0));
      case 'price_desc':
        return copy.sort((a, b) => (b.officialPriceCents ?? 0) - (a.officialPriceCents ?? 0));
      case 'power':
        return copy.sort((a, b) => (b.powerHp ?? 0) - (a.powerHp ?? 0));
      case 'year':
        return copy.sort((a, b) => b.modelYear - a.modelYear);
      default:
        return copy;
    }
  }, [trims, sortField]);

  if (!trims || trims.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed bg-card/60 p-8 text-center space-y-2"
        data-testid="trims-empty"
      >
        <p className="text-sm font-semibold text-foreground">
          {isArabic ? 'لا توجد فئات مسجلة لهذا الموديل حالياً' : 'No trims currently registered for this model'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="trim-table-container">
      {/* Header with Sort Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div className="space-y-0.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            {isArabic ? 'فئات وأسعار الموديل' : 'Trims & Pricing'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? `إجمالي ${formatDigits(trims.length, locale)} فئات متوفرة بالمواصفات والأسعار`
              : `Total of ${formatDigits(trims.length, locale)} trims with complete specs`}
          </p>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="relative inline-flex items-center">
            <ArrowUpDown className="absolute start-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="h-8 rounded-lg border bg-card ps-8 pe-3 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              aria-label={isArabic ? 'ترتيب الفئات' : 'Sort trims'}
              data-testid="trim-sort-select"
            >
              <option value="default">{isArabic ? 'الترتيب الافتراضي' : 'Default Order'}</option>
              <option value="price_asc">{isArabic ? 'السعر: الأقل أولاً' : 'Price: Low to High'}</option>
              <option value="price_desc">{isArabic ? 'السعر: الأعلى أولاً' : 'Price: High to Low'}</option>
              <option value="power">{isArabic ? 'القوة الحصانية' : 'Horsepower (HP)'}</option>
              <option value="year">{isArabic ? 'سنة الموديل' : 'Model Year'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 1. Mobile View: Labeled Stacked Cards (< md) */}
      <div className="grid grid-cols-1 gap-3.5 md:hidden" data-testid="trim-mobile-cards">
        {sortedTrims.map((trim) => {
          const trimName = trim.name
            ? isArabic
              ? trim.name.ar ?? trim.name.en ?? trim.publicId
              : trim.name.en ?? trim.name.ar ?? trim.publicId
            : trim.publicId;

          const formattedPrice =
            trim.officialPriceCents !== null && trim.officialPriceCents > 0
              ? formatMoneyFromCents(trim.officialPriceCents, trim.currency || 'EGP', locale)
              : null;

          return (
            <article
              key={trim.publicId}
              className="rounded-xl border bg-card p-4 shadow-xs space-y-3"
              data-testid={`trim-card-${trim.publicId}`}
            >
              <div className="flex items-start justify-between gap-2 border-b pb-2">
                <div>
                  <h3 className="font-bold text-sm text-foreground" dir="auto">
                    {trimName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {isArabic ? `موديل ${trim.modelYear}` : `Model ${trim.modelYear}`}
                  </p>
                </div>

                {formattedPrice ? (
                  <div className="text-end">
                    <div className="text-[10px] text-muted-foreground">{isArabic ? 'السعر الرسمي' : 'Official Price'}</div>
                    <div className="text-sm font-extrabold text-foreground">{formattedPrice}</div>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground italic">
                    {isArabic ? 'غير محدد' : 'N/A'}
                  </span>
                )}
              </div>

              {/* Specifications Key-Value List */}
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[10px] text-muted-foreground">{isArabic ? 'سعة المحرك' : 'Engine'}</dt>
                  <dd className="font-semibold text-foreground">
                    {trim.engineCc ? `${formatDigits(trim.engineCc, locale)} CC` : '-'}
                  </dd>
                </div>

                <div>
                  <dt className="text-[10px] text-muted-foreground">{isArabic ? 'القوة الحصانية' : 'Power'}</dt>
                  <dd className="font-semibold text-foreground">
                    {trim.powerHp ? `${formatDigits(trim.powerHp, locale)} HP` : '-'}
                  </dd>
                </div>

                <div>
                  <dt className="text-[10px] text-muted-foreground">{isArabic ? 'ناقل الحركة' : 'Transmission'}</dt>
                  <dd className="font-semibold text-foreground">
                    {trim.transmission ?? '-'}
                  </dd>
                </div>

                <div>
                  <dt className="text-[10px] text-muted-foreground">{isArabic ? 'نوع الوقود' : 'Fuel'}</dt>
                  <dd className="font-semibold text-foreground">
                    {trim.fuelType ?? '-'}
                  </dd>
                </div>
              </dl>

              {/* Action */}
              <div className="pt-2 border-t flex items-center justify-between">
                <Button asChild variant="default" size="sm" className="w-full text-xs font-semibold gap-1">
                  <Link href={`/catalogue/trims/${trim.publicId}`} locale={locale}>
                    <span>{isArabic ? 'عرض المواصفات الكاملة' : 'Full Specifications'}</span>
                    <ChevronIcon className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* 2. Tablet & Desktop View: Semantic Table with Sticky Header (>= md) */}
      <div className="hidden md:block overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse" data-testid="trim-desktop-table">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs text-muted-foreground border-b uppercase text-[11px] font-bold">
              <tr>
                <th scope="col" className="py-3 px-4 text-start font-bold">
                  {isArabic ? 'الفئة' : 'Trim'}
                </th>
                <th scope="col" className="py-3 px-3 text-start font-bold">
                  {isArabic ? 'السنة' : 'Year'}
                </th>
                <th scope="col" className="py-3 px-3 text-start font-bold">
                  {isArabic ? 'المحرك والقوة' : 'Engine & Power'}
                </th>
                <th scope="col" className="py-3 px-3 text-start font-bold">
                  {isArabic ? 'ناقل الحركة' : 'Transmission'}
                </th>
                <th scope="col" className="py-3 px-4 text-start font-bold">
                  {isArabic ? 'السعر الرسمي' : 'Official Price'}
                </th>
                <th scope="col" className="py-3 px-4 text-end font-bold">
                  {isArabic ? 'التفاصيل' : 'Details'}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60 text-foreground">
              {sortedTrims.map((trim) => {
                const trimName = trim.name
                  ? isArabic
                    ? trim.name.ar ?? trim.name.en ?? trim.publicId
                    : trim.name.en ?? trim.name.ar ?? trim.publicId
                  : trim.publicId;

                const formattedPrice =
                  trim.officialPriceCents !== null && trim.officialPriceCents > 0
                    ? formatMoneyFromCents(trim.officialPriceCents, trim.currency || 'EGP', locale)
                    : null;

                return (
                  <tr
                    key={trim.publicId}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`trim-row-${trim.publicId}`}
                  >
                    <td className="py-3.5 px-4 font-bold" dir="auto">
                      <Link
                        href={`/catalogue/trims/${trim.publicId}`}
                        locale={locale}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {trimName}
                      </Link>
                    </td>

                    <td className="py-3.5 px-3 text-muted-foreground font-medium">
                      {trim.modelYear}
                    </td>

                    <td className="py-3.5 px-3 font-medium">
                      <span>{trim.engineCc ? `${formatDigits(trim.engineCc, locale)} CC` : '-'}</span>
                      {trim.powerHp ? (
                        <span className="text-muted-foreground ms-1">
                          ({formatDigits(trim.powerHp, locale)} HP)
                        </span>
                      ) : null}
                    </td>

                    <td className="py-3.5 px-3 text-muted-foreground font-medium">
                      {trim.transmission ?? '-'}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-foreground">
                      {formattedPrice ?? (
                        <span className="text-muted-foreground font-normal italic">
                          {isArabic ? 'غير محدد' : 'N/A'}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-end">
                      <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs font-semibold gap-1">
                        <Link href={`/catalogue/trims/${trim.publicId}`} locale={locale}>
                          <span>{isArabic ? 'المواصفات' : 'Specs'}</span>
                          <ChevronIcon className="h-3 w-3" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
