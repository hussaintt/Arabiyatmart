import * as React from 'react';
import type { Locale } from '@/types/common';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { GitCompare, Car, Sparkles } from 'lucide-react';

interface CompareEmptyProps {
  locale: Locale;
}

export function CompareEmpty({ locale }: CompareEmptyProps) {
  const isAr = locale === 'ar';
  return (
    <div
      data-testid="compare-empty-state"
      className="flex flex-col items-center justify-center min-h-[400px] px-4 py-12 text-center rounded-2xl border border-dashed border-border bg-card/40"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
        <GitCompare className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">
        {isAr ? 'لم تختر أي سيارات للمقارنة بعد' : 'No vehicles selected for comparison yet'}
      </h2>
      <p className="text-muted-foreground max-w-md mb-8 text-sm leading-relaxed">
        {isAr
          ? 'يمكنك مقارنة حتى 3 سيارات أو فئات جنبًا إلى جنب لمساعدتك في اتخاذ القرار المناسب.'
          : 'You can compare up to 3 vehicles or trims side by side to help you make the right choice.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/search">
          <Button className="gap-2">
            <Car className="h-4 w-4" aria-hidden="true" />
            {isAr ? 'تصفح السيارات المعروضة' : 'Browse Listings'}
          </Button>
        </Link>
        <Link href="/catalogue/makes">
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {isAr ? 'دليل السيارات والفئات' : 'Car Catalogue'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
