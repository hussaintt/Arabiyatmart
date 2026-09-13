import * as React from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Car } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { formatMoneyFromCents, formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { SpotlightItem } from '@/types/taxonomy';
import type { AppLocale } from '@/i18n/config';

export interface SpotlightSectionProps {
  spotlight: SpotlightItem[];
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function SpotlightSection({
  spotlight,
  locale = 'ar',
  className,
}: SpotlightSectionProps) {
  if (!spotlight || spotlight.length === 0) {
    return null;
  }

  const isArabic = locale === 'ar';
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;

  return (
    <section
      className={cn('space-y-4', className)}
      data-testid="spotlight-section"
      aria-labelledby="spotlight-heading"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="spotlight-heading"
            className="text-xl sm:text-2xl font-black text-foreground tracking-tight"
          >
            {isArabic ? 'أبرز موديلات السيارات' : 'Featured Car Models'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isArabic
              ? 'تصفح الموديلات وقارن أسعار السيارات المتاحة'
              : 'Explore models and compare available car prices'}
          </p>
        </div>

        <Link
          href="/catalogue/makes"
          locale={locale}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-primary hover:underline"
        >
          <span>{isArabic ? 'دليل السيارات' : 'Car Guide'}</span>
          <ArrowIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Responsive Cards: Mobile swipe-safe horizontal rail, Tablet/Desktop grid */}
      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible sm:pb-0">
        {spotlight.map((item) => {
          const make = isArabic ? item.makeName.ar ?? item.makeSlug : item.makeName.en ?? item.makeSlug;
          const model = isArabic ? item.modelName.ar ?? item.modelSlug : item.modelName.en ?? item.modelSlug;
          const formattedPrice = item.startingPriceCents
            ? `${isArabic ? 'يبدأ من' : 'From'} ${formatMoneyFromCents(item.startingPriceCents, item.currency, locale)}`
            : null;
          const count = formatDigits(item.activeNewListingCount, locale);

          return (
            <Link
              key={item.modelPublicId}
              href={`/search?makeSlug=${item.makeSlug}&modelSlug=${item.modelSlug}`}
              locale={locale}
              className="group relative flex flex-col justify-between min-w-[200px] sm:min-w-0 flex-1 snap-start rounded-xl border bg-card p-4 text-card-foreground shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="space-y-3">
                {/* Make Logo or Placeholder */}
                <div className="flex items-center justify-between">
                  {item.makeLogoUrl ? (
                    <div className="relative h-8 w-8 overflow-hidden">
                      <Image
                        src={item.makeLogoUrl}
                        alt={make}
                        fill
                        sizes="32px"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Car className="h-4 w-4 opacity-70" />
                    </div>
                  )}

                  {item.bodyType ? (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                      {item.bodyType}
                    </span>
                  ) : null}
                </div>

                {/* Model and Make names */}
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                    {model}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">{make}</p>
                </div>
              </div>

              {/* Price and Listing Count */}
              <div className="mt-4 pt-3 border-t text-xs">
                {formattedPrice ? (
                  <p className="font-bold text-primary truncate">{formattedPrice}</p>
                ) : (
                  <p className="text-muted-foreground">{isArabic ? 'السعر عند الطلب' : 'Price on request'}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isArabic ? `${count} سيارة متاحة` : `${count} available`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
