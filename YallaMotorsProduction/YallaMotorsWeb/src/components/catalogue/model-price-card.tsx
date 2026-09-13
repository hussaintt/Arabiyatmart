import * as React from 'react';
import { Car, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { formatDigits, formatMoneyFromCents } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { CarCondition } from '@/types/listing';
import type { ModelWithPrice } from '@/types/taxonomy';

export interface ModelPriceCardProps {
  model: ModelWithPrice;
  makeSlug: string;
  condition?: CarCondition | undefined;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

const BODY_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  SEDAN: { ar: 'سيدان', en: 'Sedan' },
  SUV: { ar: 'دفع رباعي (SUV)', en: 'SUV' },
  CROSSOVER: { ar: 'كروس أوفر', en: 'Crossover' },
  HATCHBACK: { ar: 'هاتشباك', en: 'Hatchback' },
  COUPE: { ar: 'كوبيه', en: 'Coupe' },
  PICKUP: { ar: 'بيك أب', en: 'Pickup' },
  VAN: { ar: 'فان', en: 'Van' },
  MINIVAN: { ar: 'ميني فان', en: 'Minivan' },
  CONVERTIBLE: { ar: 'كابريوليه', en: 'Convertible' },
  WAGON: { ar: 'ستيشن واجن', en: 'Wagon' },
};

export function ModelPriceCard({
  model,
  makeSlug: _unusedMakeSlug,
  condition: _unusedCondition,
  locale = 'ar',
  className,
}: ModelPriceCardProps) {
  void _unusedMakeSlug;
  void _unusedCondition;
  const isArabic = locale === 'ar';
  const modelName = model.name
    ? isArabic
      ? model.name.ar ?? model.name.en ?? model.slug
      : model.name.en ?? model.name.ar ?? model.slug
    : model.slug;

  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  const formattedPrice =
    model.startingPriceCents !== null && model.startingPriceCents > 0
      ? formatMoneyFromCents(model.startingPriceCents, model.currency || 'EGP', locale)
      : null;

  const formattedListingCount = formatDigits(model.activeListingCount, locale);

  const bodyTypeConfig = model.bodyType ? BODY_TYPE_LABELS[model.bodyType] : undefined;
  const bodyTypeLabel = bodyTypeConfig
    ? isArabic
      ? bodyTypeConfig.ar
      : bodyTypeConfig.en
    : model.bodyType ?? null;

  return (
    <article
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md focus-within:ring-2 focus-within:ring-primary',
        className
      )}
      data-testid={`model-card-${model.slug}`}
    >
      <div className="space-y-3">
        {/* Header: Model Title + Body Type Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3
              dir="auto"
              className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug"
            >
              <Link
                href={`/catalogue/models/${model.publicId}`}
                locale={locale}
                className="focus:outline-hidden after:absolute after:inset-0 after:z-10"
              >
                {modelName}
              </Link>
            </h3>

            {bodyTypeLabel ? (
              <Badge variant="soft" className="text-[11px] font-medium bg-muted text-muted-foreground">
                {bodyTypeLabel}
              </Badge>
            ) : null}
          </div>

          <div className="h-9 w-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0">
            <Car className="h-5 w-5 opacity-70" />
          </div>
        </div>

        {/* Price Information */}
        <div className="pt-2">
          {formattedPrice ? (
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Tag className="h-3 w-3 text-primary" />
                <span>{isArabic ? 'يبدأ من' : 'Starting from'}</span>
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight" data-testid="model-starting-price">
                {formattedPrice}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic" data-testid="model-price-unavailable">
              {isArabic ? 'السعر يحدد حسب الفئة والمواصفات' : 'Price depends on trim and condition'}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Listing count + Explore CTA */}
      <div className="pt-4 mt-4 border-t flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">
          {model.activeListingCount > 0
            ? `${formattedListingCount} ${isArabic ? 'سيارة معروضة' : 'cars listed'}`
            : isArabic
              ? 'لا توجد سيارات معروضة حالياً'
              : 'No cars listed currently'}
        </span>

        <span className="inline-flex items-center gap-0.5 font-bold text-primary group-hover:underline">
          <span>{isArabic ? 'التفاصيل والأسعار' : 'Details & trims'}</span>
          <ChevronIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
