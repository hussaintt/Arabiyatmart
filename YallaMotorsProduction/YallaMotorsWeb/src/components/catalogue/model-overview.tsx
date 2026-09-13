import * as React from 'react';
import Image from 'next/image';
import { Car, Tag, Layers } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDigits, formatMoneyFromCents } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ModelPage } from '@/types/taxonomy';

export interface ModelOverviewProps {
  model: ModelPage;
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

export function ModelOverview({
  model,
  locale = 'ar',
  className,
}: ModelOverviewProps) {
  const isArabic = locale === 'ar';
  const makeName = model.make.name
    ? isArabic
      ? model.make.name.ar ?? model.make.name.en ?? model.make.slug
      : model.make.name.en ?? model.make.name.ar ?? model.make.slug
    : model.make.slug;

  const modelName = model.name
    ? isArabic
      ? model.name.ar ?? model.name.en ?? model.slug
      : model.name.en ?? model.name.ar ?? model.slug
    : model.slug;

  const formattedPrice =
    model.startingPriceCents !== null && model.startingPriceCents > 0
      ? formatMoneyFromCents(model.startingPriceCents, model.currency || 'EGP', locale)
      : null;

  const bodyTypeConfig = model.bodyType ? BODY_TYPE_LABELS[model.bodyType] : undefined;
  const bodyTypeLabel = bodyTypeConfig
    ? isArabic
      ? bodyTypeConfig.ar
      : bodyTypeConfig.en
    : model.bodyType ?? null;

  return (
    <div
      className={cn('space-y-6 rounded-2xl border bg-card p-6 shadow-xs text-card-foreground', className)}
      data-testid="model-overview"
    >
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b">
        <div className="flex items-center gap-4 min-w-0">
          {/* Make Logo Container */}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border bg-muted/40 p-2 flex items-center justify-center">
            {model.make.logoUrl ? (
              <Image
                src={model.make.logoUrl}
                alt={makeName}
                fill
                priority
                sizes="80px"
                className="object-contain p-2"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                {makeName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/catalogue/makes/${model.make.slug}`}
                locale={locale}
                className="text-xs sm:text-sm font-semibold text-primary hover:underline"
              >
                {makeName}
              </Link>
              {bodyTypeLabel ? (
                <Badge variant="soft" className="text-[11px] bg-muted text-muted-foreground font-medium">
                  {bodyTypeLabel}
                </Badge>
              ) : null}
            </div>

            <h1
              dir="auto"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight truncate"
              data-testid="model-title"
            >
              {makeName} {modelName}
            </h1>
          </div>
        </div>

        {/* Pricing & Actions */}
        <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row items-stretch md:items-end gap-3">
          {formattedPrice ? (
            <div className="space-y-0.5 text-start md:text-end">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 md:justify-end">
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span>{isArabic ? 'السعر الرسمي يبدأ من' : 'Starting from'}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight" data-testid="model-starting-price">
                {formattedPrice}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic py-2" data-testid="model-price-unavailable">
              {isArabic ? 'الأسعار تحدد حسب الفئة والمواصفات' : 'Prices vary by trim and availability'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button asChild variant="default" size="default" className="font-semibold gap-2">
              <Link
                href={`/search?makeSlug=${model.make.slug}&modelSlug=${model.slug}`}
                locale={locale}
              >
                <Car className="h-4 w-4" />
                <span>{isArabic ? 'السيارات المعروضة' : 'View Listings'}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Generations Summary */}
      {model.generations.length > 0 ? (
        <div className="space-y-3" data-testid="model-generations-section">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span>{isArabic ? 'أجيال وموديلات السيارة' : 'Generations'}</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {model.generations.map((gen) => (
              <div
                key={gen.publicId}
                className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs"
              >
                <span className="font-bold text-foreground">{gen.name}</span>
                <span className="text-muted-foreground">
                  ({gen.startYear} - {gen.endYear || (isArabic ? 'الآن' : 'Present')})
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background">
                  {formatDigits(gen.trimCount, locale)} {isArabic ? 'فئات' : 'trims'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
