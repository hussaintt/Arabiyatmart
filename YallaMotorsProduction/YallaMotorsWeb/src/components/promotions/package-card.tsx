import * as React from 'react';
import { Check, Crown, Sparkles, Zap, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDigits, formatMoneyFromCents } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { PromotionPackage } from '@/types/lead';
import type { PromotionTier } from '@/types/listing';

interface PackageCardProps {
  pkg: PromotionPackage;
  locale: AppLocale;
  isSelected?: boolean;
  onSelect?: (tier: PromotionTier) => void;
  disabled?: boolean;
}

export function PackageCard({
  pkg,
  locale,
  isSelected = false,
  onSelect,
  disabled = false,
}: PackageCardProps) {
  const ar = locale === 'ar';
  const isExtra = pkg.tier === 'EXTRA_PREMIUM';

  const tierTitle = isExtra
    ? (ar ? 'باقة إكسترا مميز' : 'Extra Premium Package')
    : (ar ? 'باقة مميز' : 'Premium Package');

  const tierDescription = isExtra
    ? (ar ? 'أقصى درجات الظهور مع صدارة نتائج البحث والصفحة الرئيسية' : 'Maximum visibility with top search placement and homepage feature')
    : (ar ? 'ظهور متقدم يجذب مشترين جادين بشكل أسرع' : 'Enhanced visibility to reach serious car buyers faster');

  const formattedPrice = formatMoneyFromCents(pkg.priceCents, pkg.currency, locale);
  const formattedDays = formatDigits(pkg.durationDays, locale);

  return (
    <Card
      data-testid={`package-card-${pkg.tier}`}
      className={cn(
        'relative flex flex-col justify-between transition-all duration-200 border-2',
        isSelected
          ? 'border-primary shadow-lg ring-2 ring-primary/20'
          : isExtra
          ? 'border-amber-500/40 hover:border-amber-500/70'
          : 'border-border hover:border-muted-foreground/40',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      {isExtra && (
        <div className="absolute -top-3 start-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold shadow-sm px-3 py-0.5 text-xs">
            <Sparkles className="me-1 h-3 w-3" />
            {ar ? 'الأكثر تميزاً' : 'Most Popular'}
          </Badge>
        </div>
      )}

      <CardHeader className={cn('pb-4', isExtra && 'pt-6')}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            {isExtra ? (
              <Crown className="h-5 w-5 text-amber-500 shrink-0" />
            ) : (
              <Zap className="h-5 w-5 text-primary shrink-0" />
            )}
            <span>{tierTitle}</span>
          </CardTitle>
          <Badge variant={isSelected ? 'default' : 'secondary'} className="text-xs uppercase">
            {pkg.tier}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground mt-1.5">
          {tierDescription}
        </CardDescription>

        <div className="mt-4 pt-3 border-t border-border flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-foreground tracking-tight" data-testid={`package-price-${pkg.tier}`}>
            {formattedPrice}
          </span>
          <span className="text-sm text-muted-foreground">
            / {formattedDays} {ar ? 'يوم' : 'days'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-6 flex-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {ar ? 'المزايا المشمولة:' : 'Package Benefits:'}
        </p>
        <ul className="space-y-2.5 text-sm">
          {pkg.highlightedCard && (
            <li className="flex items-start gap-2 text-foreground">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{ar ? 'تمييز بصري للبطاقة بألوان ملفتة' : 'Highlighted visual card in search results'}</span>
            </li>
          )}
          {pkg.homepageSlot && (
            <li className="flex items-start gap-2 text-foreground">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{ar ? 'ظهور حصري في سلايدر الصفحة الرئيسية' : 'Spotlight placement on homepage'}</span>
            </li>
          )}
          {pkg.performanceStats && (
            <li className="flex items-start gap-2 text-foreground">
              <BarChart3 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{ar ? 'لوحة إحصائيات متقدمة لعدد المشاهدات والطلبات' : 'Advanced analytics on views and leads'}</span>
            </li>
          )}
          {pkg.placements && pkg.placements.length > 0 && pkg.placements.map((placement, idx) => (
            <li key={idx} className="flex items-start gap-2 text-foreground">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{placement}</span>
            </li>
          ))}
          {pkg.autoRenewEveryDays && (
            <li className="flex items-start gap-2 text-muted-foreground text-xs">
              <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                {ar
                  ? `تجديد تلقائي كل ${formatDigits(pkg.autoRenewEveryDays, locale)} يوم`
                  : `Auto-renews every ${formatDigits(pkg.autoRenewEveryDays, locale)} days`}
              </span>
            </li>
          )}
        </ul>
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          type="button"
          className="w-full font-medium"
          variant={isSelected ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onSelect?.(pkg.tier)}
          data-testid={`select-tier-button-${pkg.tier}`}
        >
          {isSelected
            ? (ar ? '✓ الباقة المحددة' : '✓ Selected')
            : (ar ? 'اختيار هذه الباقة' : 'Select Package')}
        </Button>
      </CardFooter>
    </Card>
  );
}
