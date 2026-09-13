import * as React from 'react';
import Image from 'next/image';
import { Building2, ShieldCheck, MapPin, Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { DealerDirectoryItem } from '@/types/dealer';

export interface DealerCardProps {
  readonly dealer: DealerDirectoryItem;
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

export function DealerCard({
  dealer,
  locale = 'ar',
  className,
}: DealerCardProps) {
  const isArabic = locale === 'ar';
  const displayName = isArabic ? dealer.displayName.ar : dealer.displayName.en;
  const cityName = dealer.cityName
    ? isArabic
      ? dealer.cityName.ar
      : dealer.cityName.en
    : null;

  const countFormatted = formatDigits(dealer.activeListingCount, locale);
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  return (
    <article
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary',
        className
      )}
      data-testid={`dealer-card-${dealer.slug}`}
    >
      <div className="space-y-4">
        {/* Top Header: Logo + Badges */}
        <div className="flex items-start justify-between gap-3">
          {/* Logo or Fallback */}
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
            {dealer.logoUrl ? (
              <Image
                src={dealer.logoUrl}
                alt={displayName}
                fill
                sizes="64px"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-primary/5 text-primary">
                <Building2 className="h-8 w-8 opacity-60" />
              </div>
            )}
          </div>

          {/* Verified Badge */}
          {dealer.isVerified ? (
            <Badge
              variant="soft"
              className="bg-primary/10 text-primary font-semibold text-xs shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 me-1 inline-block" />
              {isArabic ? 'معرض معتمد' : 'Verified'}
            </Badge>
          ) : null}
        </div>

        {/* Dealer Identity */}
        <div className="space-y-1">
          <h3
            dir="auto"
            className="font-bold text-base sm:text-lg text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1"
          >
            <Link
              href={`/dealers/${dealer.slug}`}
              locale={locale}
              dir="auto"
              className="focus:outline-hidden after:absolute after:inset-0 after:z-10"
            >
              {displayName}
            </Link>
          </h3>

          {cityName ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{cityName}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer: Listing Count + Action */}
      <div className="pt-4 mt-4 border-t flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Car className="h-4 w-4 shrink-0 text-primary" />
          <span>
            {dealer.activeListingCount > 0
              ? `${countFormatted} ${isArabic ? 'سيارة معروضة' : 'cars listed'}`
              : isArabic
                ? 'لا توجد سيارات حالياً'
                : 'No cars listed'}
          </span>
        </div>

        <span className="inline-flex items-center gap-0.5 font-bold text-primary group-hover:underline">
          <span>{isArabic ? 'عرض المعرض' : 'View'}</span>
          <ChevronIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
