import * as React from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Building2, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { DealerDirectoryItem } from '@/types/dealer';
import type { AppLocale } from '@/i18n/config';

export interface DealerStripProps {
  dealers: DealerDirectoryItem[];
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function DealerStrip({
  dealers,
  locale = 'ar',
  className,
}: DealerStripProps) {
  if (!dealers || dealers.length === 0) {
    return null;
  }

  const isArabic = locale === 'ar';
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;

  return (
    <section
      className={cn('space-y-4', className)}
      data-testid="dealer-strip"
      aria-labelledby="dealers-heading"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="dealers-heading"
            className="text-xl sm:text-2xl font-black text-foreground tracking-tight"
          >
            {isArabic ? 'تعرّف على معارض السيارات' : 'Meet the dealerships'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isArabic
              ? 'اكتشف المعارض والسيارات المتاحة لديهم وتواصل مباشرة'
              : 'Explore the showrooms, browse their cars, and connect directly'}
          </p>
        </div>

        <Link
          href="/dealers"
          locale={locale}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-primary hover:underline"
        >
          <span>{isArabic ? 'جميع المعارض' : 'All Showrooms'}</span>
          <ArrowIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Responsive Dealer Cards */}
      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible sm:pb-0">
        {dealers.map((dealer) => {
          const displayName = isArabic ? dealer.displayName.ar : dealer.displayName.en;
          const city = dealer.cityName
            ? isArabic
              ? dealer.cityName.ar
              : dealer.cityName.en
            : null;
          const count = formatDigits(dealer.activeListingCount, locale);

          return (
            <Link
              key={dealer.publicId}
              href={`/dealers/${dealer.slug}`}
              locale={locale}
              className="group relative flex items-center gap-3.5 min-w-[240px] sm:min-w-0 flex-1 snap-start rounded-xl border bg-card p-4 text-card-foreground shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {/* Dealer Logo or Avatar */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                {dealer.logoUrl ? (
                  <Image
                    src={dealer.logoUrl}
                    alt={displayName}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground opacity-60" />
                )}
              </div>

              {/* Dealer Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {displayName}
                  </h3>
                  {dealer.isVerified ? (
                    <span
                      title={isArabic ? 'معرض موثق' : 'Verified Dealership'}
                      aria-label={isArabic ? 'معرض موثق' : 'Verified Dealership'}
                      className="inline-flex items-center"
                    >
                      <ShieldCheck
                        className="h-3.5 w-3.5 shrink-0 text-success"
                      />
                    </span>
                  ) : null}
                </div>

                {city ? (
                  <p className="text-xs text-muted-foreground truncate">{city}</p>
                ) : null}

                <p className="text-[11px] font-medium text-primary mt-1">
                  {isArabic ? `${count} سيارة متاحة` : `${count} vehicles`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
