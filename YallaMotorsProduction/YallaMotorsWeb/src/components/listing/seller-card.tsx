import * as React from 'react';
import Image from 'next/image';
import { Star, ShieldCheck, User, Building2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ListingDetail, ListingImage } from '@/types/listing';

export interface SellerCardProps {
  readonly listing:
    | ListingDetail
    | (Omit<ListingDetail, 'features' | 'images'> & {
        readonly features?: readonly string[] | null | undefined;
        readonly images?: readonly ListingImage[] | undefined;
      });
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

export function SellerCard({
  listing,
  locale = 'ar',
  className,
}: SellerCardProps) {
  const isArabic = locale === 'ar';
  const isDealer = listing.sellerType === 'DEALER' && listing.vendor !== null;
  const vendor = listing.vendor;

  return (
    <aside
      aria-label={isArabic ? 'معلومات البائع' : 'Seller information'}
      className={cn('rounded-xl border bg-card p-5 shadow-xs space-y-4', className)}
      data-testid="seller-card"
    >
      <div className="flex items-center justify-between pb-2 border-b">
        <h3 className="font-bold text-sm sm:text-base text-foreground">
          {isArabic ? 'معلومات البائع' : 'Seller Information'}
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {isDealer
            ? (isArabic ? 'معرض سيارات' : 'Dealership')
            : (isArabic ? 'بائع فردي' : 'Private Seller')}
        </span>
      </div>

      {isDealer && vendor ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {/* Dealer Logo or Fallback */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
              {vendor.logoUrl ? (
                <Image
                  src={vendor.logoUrl}
                  alt={isArabic ? vendor.displayName.ar : vendor.displayName.en}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground" />
              )}
            </div>

            {/* Dealer Info */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-base text-foreground truncate">
                  {isArabic ? vendor.displayName.ar : vendor.displayName.en}
                </h4>
                {vendor.isVerified ? (
                  <Badge variant="soft" className="bg-primary/10 text-primary text-[11px] font-semibold">
                    <ShieldCheck className="h-3 w-3 me-1 inline-block" />
                    {isArabic ? 'معتمد' : 'Verified'}
                  </Badge>
                ) : null}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center text-amber-500 font-bold">
                  <Star className="h-3.5 w-3.5 fill-amber-500 me-0.5" />
                  <span>{vendor.ratingAverage > 0 ? vendor.ratingAverage.toFixed(1) : '5.0'}</span>
                </div>
                <span>•</span>
                <span>
                  {vendor.reviewCount}{' '}
                  {isArabic ? 'تقييم' : 'reviews'}
                </span>
              </div>
            </div>
          </div>

          {/* Link to Dealer Inventory */}
          <Link
            href={`/dealers/${vendor.slug}`}
            locale={locale}
            className="flex items-center justify-between rounded-lg bg-muted/60 p-3 text-xs sm:text-sm font-semibold text-primary transition-colors hover:bg-muted"
          >
            <span>{isArabic ? 'تصفح كافة سيارات المعرض' : 'Browse dealership inventory'}</span>
            {isArabic ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Link>
        </div>
      ) : (
        /* Private Seller */
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm sm:text-base text-foreground">
                {isArabic ? 'بائع خاص' : 'Private Seller'}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {isArabic ? listing.city.name.ar : listing.city.name.en}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
