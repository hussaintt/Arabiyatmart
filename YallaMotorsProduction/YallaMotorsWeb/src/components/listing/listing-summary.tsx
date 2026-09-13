import * as React from 'react';
import {
  Calendar,
  Gauge,
  MapPin,
  ShieldCheck,
  Fuel,
  Car,
  Settings2,
  AlertCircle,
  Tag,
  CreditCard,
  ArrowLeftRight,
  Clock3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoneyFromCents, formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ListingDetail, ListingImage } from '@/types/listing';

export interface ListingSummaryProps {
  readonly listing:
    | ListingDetail
    | (Omit<ListingDetail, 'features' | 'images'> & {
        readonly features?: readonly string[] | null | undefined;
        readonly images?: readonly ListingImage[] | undefined;
      });
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

/**
 * Strips all HTML/XML tags, script/style blocks, and dangerous markup from untrusted text,
 * returning sanitized plain text safe for rendering and SEO descriptions.
 */
export function sanitizePlainText(input: string | null | undefined): string | null {
  if (!input) return null;
  // 1. Remove script blocks and their content
  let text = input.replace(/<\s*script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '');
  // 2. Remove style blocks and their content
  text = text.replace(/<\s*style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style\s*>/gi, '');
  // 3. Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // 4. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // 5. Decode common HTML entities to pure text
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // 6. Normalize whitespace: preserve single newlines, collapse consecutive spaces
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t\f\r]+/g, ' ').trim())
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1]?.length !== 0))
    .join('\n')
    .trim();

  return text.length > 0 ? text : null;
}

/**
 * Serializes JSON-LD payload into a string safely escaped for embedding inside inline
 * HTML <script type="application/ld+json"> tags. Replaces '<', '>', and '&' with
 * unicode escapes so injection of '</script>' is impossible.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

const TRANSMISSION_LABELS: Record<string, { ar: string; en: string }> = {
  AUTOMATIC: { ar: 'أوتوماتيك', en: 'Automatic' },
  MANUAL: { ar: 'يدوي', en: 'Manual' },
  CVT: { ar: 'سي في تي (CVT)', en: 'CVT' },
  DCT: { ar: 'دي سي تي (DCT)', en: 'DCT' },
};

const FUEL_LABELS: Record<string, { ar: string; en: string }> = {
  PETROL: { ar: 'بنزين', en: 'Petrol' },
  DIESEL: { ar: 'ديزل', en: 'Diesel' },
  HYBRID: { ar: 'هايبرد', en: 'Hybrid' },
  ELECTRIC: { ar: 'كهربائي', en: 'Electric' },
  GAS: { ar: 'غاز طبيعي', en: 'Gas' },
};

const BODY_LABELS: Record<string, { ar: string; en: string }> = {
  SEDAN: { ar: 'سيدان', en: 'Sedan' },
  HATCHBACK: { ar: 'هاتشباك', en: 'Hatchback' },
  SUV: { ar: 'دفع رباعي (SUV)', en: 'SUV' },
  CROSSOVER: { ar: 'كروس أوفر', en: 'Crossover' },
  COUPE: { ar: 'كوبيه', en: 'Coupe' },
  PICKUP: { ar: 'بيك أب', en: 'Pickup' },
  VAN: { ar: 'فان', en: 'Van' },
  MINIVAN: { ar: 'ميني فان', en: 'Minivan' },
  CONVERTIBLE: { ar: 'كابريوليه', en: 'Convertible' },
  WAGON: { ar: 'ستيشن واجن', en: 'Wagon' },
};

const CONDITION_GRADE_LABELS: Record<string, { ar: string; en: string }> = {
  EXCELLENT: { ar: 'حالة ممتازة', en: 'Excellent' },
  VERY_GOOD: { ar: 'جيدة جداً', en: 'Very Good' },
  GOOD: { ar: 'جيدة', en: 'Good' },
  FAIR: { ar: 'مقبولة', en: 'Fair' },
  NEEDS_WORK: { ar: 'تحتاج صيانة', en: 'Needs Work' },
};

export function ListingSummary({
  listing,
  locale = 'ar',
  className,
}: ListingSummaryProps) {
  const isArabic = locale === 'ar';

  const make = isArabic ? listing.make.name.ar : listing.make.name.en;
  const model = isArabic ? listing.model.name.ar : listing.model.name.en;
  const city = isArabic ? listing.city.name.ar : listing.city.name.en;
  const area = listing.area ? (isArabic ? listing.area.name.ar : listing.area.name.en) : null;
  const fullLocation = area ? `${city}، ${area}` : city;

  const displayTitle = listing.title || `${make} ${model} ${listing.year}`;
  const formattedPrice = formatMoneyFromCents(listing.priceCents, listing.currency, locale);
  const formattedMileage = `${formatDigits(listing.mileageKm.toLocaleString(isArabic ? 'ar-EG' : 'en-US'), locale)} ${isArabic ? 'كم' : 'km'}`;
  const formattedYear = formatDigits(listing.year, locale);
  const postedDate = listing.publishedAt ? formatDate(listing.publishedAt, locale) : null;

  const transmissionLabel = TRANSMISSION_LABELS[listing.transmission]?.[locale] ?? listing.transmission;
  const fuelLabel = FUEL_LABELS[listing.fuelType]?.[locale] ?? listing.fuelType;
  const bodyLabel = BODY_LABELS[listing.bodyType]?.[locale] ?? listing.bodyType;
  const conditionGradeLabel = listing.conditionGrade
    ? CONDITION_GRADE_LABELS[listing.conditionGrade]?.[locale] ?? listing.conditionGrade
    : null;

  const isSold = listing.status === 'SOLD';
  const isSellerVerified = listing.vendor ? listing.vendor.isVerified : false;

  return (
    <article
      aria-label={isArabic ? 'ملخص إعلان السيارة' : 'Vehicle listing summary'}
      className={cn('space-y-6', className)}
      data-testid="listing-summary"
    >
      {/* Sold Banner if status === SOLD */}
      {isSold ? (
        <div
          data-testid="sold-banner"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive"
        >
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div>
            <h2 className="font-bold text-base sm:text-lg">
              {isArabic ? 'تم بيع هذه المركبة' : 'This vehicle has been sold'}
            </h2>
            <p className="text-xs sm:text-sm text-destructive/80">
              {isArabic
                ? 'لم يعد هذا الإعلان متاحاً للشراء. يمكنك تصفح السيارات المشابهة أدناه.'
                : 'This listing is no longer available for purchase. You can browse similar vehicles below.'}
            </p>
          </div>
        </div>
      ) : null}

      {/* Badges & Meta Row */}
      <div className="flex flex-wrap items-center gap-2">
        {listing.featuredUntil ? (
          <Badge variant="soft" className="bg-primary text-primary-foreground font-bold text-xs">
            {isArabic ? 'إعلان مميز' : 'Featured'}
          </Badge>
        ) : null}

        <Badge variant={listing.condition === 'NEW' ? 'success' : 'outline'} className="font-semibold text-xs">
          {listing.condition === 'NEW' ? (isArabic ? 'جديد بالكامل' : 'Brand New') : (isArabic ? 'مستعمل' : 'Used')}
        </Badge>

        {conditionGradeLabel ? (
          <Badge variant="secondary" className="text-xs font-medium">
            {conditionGradeLabel}
          </Badge>
        ) : null}

        {isSellerVerified ? (
          <Badge variant="soft" className="bg-primary/10 text-primary font-medium text-xs">
            <ShieldCheck className="h-3.5 w-3.5 me-1 inline-block" />
            {isArabic ? 'بائع موثق' : 'Verified Seller'}
          </Badge>
        ) : null}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight tracking-tight">
          {displayTitle}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span>{fullLocation}</span>
          </span>
          {postedDate ? (
            <span className="inline-flex items-center gap-2 font-medium" data-testid="listing-posted-date">
              <Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{isArabic ? `تاريخ النشر: ${postedDate}` : `Posted: ${postedDate}`}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Price Block */}
      <div className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-primary">
              {formattedPrice}
            </span>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {listing.isNegotiable
                ? (isArabic ? '(قابل للتفاوض)' : '(Negotiable)')
                : (isArabic ? '(سعر نهائي)' : '(Fixed Price)')}
            </span>
          </div>

          {listing.trim?.officialPriceCents ? (
            <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              <span>
                {isArabic ? 'السعر الرسمي للوكيل:' : 'Official dealer price:'}{' '}
                <span className="font-semibold text-foreground">
                  {formatMoneyFromCents(listing.trim.officialPriceCents, listing.currency, locale)}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        {/* Commercial Highlights */}
        {(listing.installmentAvailable || listing.exchangeAccepted) ? (
          <div className="flex flex-wrap gap-3 pt-2 border-t text-xs text-muted-foreground">
            {listing.installmentAvailable ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <CreditCard className="h-4 w-4 text-primary" />
                {isArabic ? 'إمكانية التقسيط متوفرة' : 'Installment available'}
              </span>
            ) : null}
            {listing.exchangeAccepted ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
                {isArabic ? 'إمكانية البدل متوفرة' : 'Exchange accepted'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Key Facts Grid (Tablet 2-col, Desktop 3-col) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Year */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isArabic ? 'سنة الصنع' : 'Year'}</p>
            <p className="font-bold text-sm sm:text-base text-foreground truncate">{formattedYear}</p>
          </div>
        </div>

        {/* Mileage */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
            <Gauge className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isArabic ? 'المسافة المقطوعة' : 'Mileage'}</p>
            <p className="font-bold text-sm sm:text-base text-foreground truncate">{formattedMileage}</p>
          </div>
        </div>

        {/* Transmission */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isArabic ? 'ناقل الحركة' : 'Transmission'}</p>
            <p className="font-bold text-sm sm:text-base text-foreground truncate">{transmissionLabel}</p>
          </div>
        </div>

        {/* Fuel Type */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
            <Fuel className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isArabic ? 'نوع الوقود' : 'Fuel Type'}</p>
            <p className="font-bold text-sm sm:text-base text-foreground truncate">{fuelLabel}</p>
          </div>
        </div>

        {/* Body Type */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
            <Car className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isArabic ? 'نوع الهيكل' : 'Body Type'}</p>
            <p className="font-bold text-sm sm:text-base text-foreground truncate">{bodyLabel}</p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isArabic ? 'المدينة' : 'Location'}</p>
            <p className="font-bold text-sm sm:text-base text-foreground truncate">{city}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
