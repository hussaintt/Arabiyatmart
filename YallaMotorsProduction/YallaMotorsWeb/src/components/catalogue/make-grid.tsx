import * as React from 'react';
import Image from 'next/image';
import { Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { Make } from '@/types/taxonomy';

export interface MakeGridProps {
  makes: readonly Make[];
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function MakeGrid({
  makes,
  locale = 'ar',
  className,
}: MakeGridProps) {
  const isArabic = locale === 'ar';
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  if (!makes || makes.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed bg-card/60 p-8 sm:p-12 text-center space-y-3"
        data-testid="make-grid-empty"
      >
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Car className="h-6 w-6 opacity-60" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          {isArabic ? 'لا توجد ماركات سيارات متاحة حالياً' : 'No car makes currently available'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4',
        className
      )}
      data-testid="make-grid"
    >
      {makes.map((make) => {
        const makeName = isArabic ? make.name.ar : make.name.en;
        const countFormatted =
          make.activeListingCount !== null && make.activeListingCount !== undefined
            ? formatDigits(make.activeListingCount, locale)
            : null;

        return (
          <Link
            key={make.publicId || make.slug}
            href={`/catalogue/makes/${make.slug}`}
            locale={locale}
            className="group relative flex flex-col items-center justify-between rounded-xl border bg-card p-4 text-center shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-primary"
            data-testid={`make-card-${make.slug}`}
          >
            {/* Logo container with reserved dimensions */}
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border bg-muted/40 p-1 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              {make.logoUrl ? (
                <Image
                  src={make.logoUrl}
                  alt={makeName}
                  fill
                  sizes="64px"
                  className="object-contain p-1.5"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                  {makeName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Make Name & Counts */}
            <div className="space-y-1 w-full min-w-0">
              <h3
                dir="auto"
                className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors"
              >
                {makeName}
              </h3>

              {countFormatted !== null ? (
                <p className="text-[11px] text-muted-foreground truncate">
                  {isArabic ? `${countFormatted} سيارة` : `${countFormatted} cars`}
                </p>
              ) : null}
            </div>

            {/* Hover indicator */}
            <div className="mt-2 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              <span>{isArabic ? 'تصفح' : 'View'}</span>
              <ChevronIcon className="h-3 w-3" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
