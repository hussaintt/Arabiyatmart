import * as React from 'react';
import Image from 'next/image';
import { Calendar, Clock3, Gauge, MapPin, ShieldCheck, Car } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from './favorite-button';
import { ContactActions } from './contact-actions';
import { formatDate, formatMoneyFromCents, formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { ListingCard as ListingCardType } from '@/types/listing';
import type { AppLocale } from '@/i18n/config';

export interface ListingCardProps {
  listing: ListingCardType;
  locale?: AppLocale | undefined;
  priority?: boolean | undefined;
  className?: string | undefined;
  showContactActions?: boolean | undefined;
  contactPhone?: string | null | undefined;
  contactWhatsapp?: string | null | undefined;
  onFavoriteToggle?: ((favorited: boolean) => void) | undefined;
  onFavoriteOptimisticToggle?: ((favorited: boolean) => void) | undefined;
  onFavoriteRollback?: ((favorited: boolean) => void) | undefined;
}

export function ListingCard({
  listing,
  locale = 'ar',
  priority = false,
  className,
  showContactActions = false,
  contactPhone,
  contactWhatsapp,
  onFavoriteToggle,
  onFavoriteOptimisticToggle,
  onFavoriteRollback,
}: ListingCardProps) {
  const isArabic = locale === 'ar';
  const make = isArabic ? listing.makeName.ar : listing.makeName.en;
  const model = isArabic ? listing.modelName.ar : listing.modelName.en;
  const city = isArabic ? listing.cityName.ar : listing.cityName.en;

  const displayTitle = listing.title || `${make} ${model} ${listing.year}`;
  const formattedPrice = formatMoneyFromCents(listing.priceCents, listing.currency, locale);
  const formattedMileage = `${formatDigits(listing.mileageKm.toLocaleString(isArabic ? 'ar-EG' : 'en-US'), locale)} ${isArabic ? 'كم' : 'km'}`;
  const formattedYear = formatDigits(listing.year, locale);
  const postedDate = listing.publishedAt ? formatDate(listing.publishedAt, locale) : null;

  const isDealer = listing.sellerType === 'DEALER';
  const sellerLabel = isDealer
    ? (isArabic ? 'معرض سيارات' : 'Dealership')
    : (isArabic ? 'بائع فردي' : 'Private Seller');

  return (
    <article
      className={cn(
        'group relative flex flex-col h-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40',
        className
      )}
      data-testid={`listing-card-${listing.publicId}`}
    >
      {/* 1. Media Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {listing.coverImageUrl ? (
          <Image
            src={listing.coverMediumUrl ?? listing.coverImageUrl}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/70 text-muted-foreground">
            <Car className="h-10 w-10 opacity-40" />
            <span className="text-xs">{isArabic ? 'لا توجد صورة' : 'No photo'}</span>
          </div>
        )}

        {/* Gradient overlay for badges/actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

        {/* Top Badges (Start side) */}
        <div className="absolute top-2.5 start-2.5 z-10 flex flex-wrap gap-1.5 max-w-[70%] pointer-events-none">
          {listing.isFeatured ? (
            <Badge variant="soft" className="bg-primary text-primary-foreground font-bold text-[11px] shadow-sm">
              {isArabic ? 'مميز' : 'Featured'}
            </Badge>
          ) : null}
          {listing.condition === 'NEW' ? (
            <Badge variant="success" className="font-bold text-[11px] shadow-sm">
              {isArabic ? 'جديد' : 'New'}
            </Badge>
          ) : null}
          {listing.isSellerVerified ? (
            <Badge variant="soft" className="bg-white/90 text-primary-dark font-medium text-[11px] shadow-sm backdrop-blur-xs">
              <ShieldCheck className="h-3 w-3 me-1 inline-block" />
              {isArabic ? 'موثق' : 'Verified'}
            </Badge>
          ) : null}
        </div>

        {/* Favorite Button (End side) - z-20 to ensure it is above the stretched link */}
        <div className="absolute top-2.5 end-2.5 z-20">
          <FavoriteButton
            listingId={listing.publicId}
            slug={listing.slug}
            initialFavorited={listing.isFavorited}
            locale={locale}
            onToggle={onFavoriteToggle}
            onOptimisticToggle={onFavoriteOptimisticToggle}
            onRollback={onFavoriteRollback}
          />
        </div>

        {/* Seller Type pill at bottom-start of image */}
        <div className="absolute bottom-2 start-2.5 z-10 pointer-events-none">
          <span className="inline-flex items-center rounded-sm bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
            {sellerLabel}
          </span>
        </div>
      </div>

      {/* 2. Card Body Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Title and Stretched Link (no nested button inside a) */}
        <h3 className="font-bold text-base text-foreground leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
          <Link
            href={`/listing/${listing.slug}`}
            locale={locale}
            className="focus:outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
          >
            {/* Accessible stretched link overlays entire card, but below z-20 buttons */}
            <span className="absolute inset-0 z-0" aria-hidden="true" />
            {displayTitle}
          </Link>
        </h3>

        {/* Price & Negotiation */}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="font-black text-lg text-primary">
            {formattedPrice}
          </span>
          {listing.isNegotiable ? (
            <span className="text-xs text-muted-foreground shrink-0">
              {isArabic ? 'قابل للتفاوض' : 'Negotiable'}
            </span>
          ) : null}
        </div>

        {/* Specs Ribbon: Year, Mileage, Location */}
        <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 min-w-0" title={formattedYear}>
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
            <span className="truncate">{formattedYear}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0" title={formattedMileage}>
            <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
            <span className="truncate">{formattedMileage}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0" title={city}>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
            <span className="truncate">{city}</span>
          </div>
        </div>

        {postedDate ? (
          <div
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            data-testid="listing-posted-date"
          >
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isArabic ? `تاريخ النشر: ${postedDate}` : `Posted: ${postedDate}`}</span>
          </div>
        ) : null}

        {/* Optional Interactive Footer (Contact Actions) - z-20 to sit above stretched link */}
        {showContactActions && (contactPhone || contactWhatsapp) ? (
          <div className="mt-4 pt-3 border-t relative z-20">
            <ContactActions
              phone={contactPhone}
              whatsapp={contactWhatsapp}
              variant="compact"
              locale={locale}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
