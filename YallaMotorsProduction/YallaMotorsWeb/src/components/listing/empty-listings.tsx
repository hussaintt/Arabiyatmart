import * as React from 'react';
import { Car, Search } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';

export interface EmptyListingsProps {
  title?: string | undefined;
  description?: string | undefined;
  actionHref?: string | undefined;
  actionLabel?: string | undefined;
  locale?: AppLocale | undefined;
  className?: string | undefined;
  icon?: ('car' | 'search') | undefined;
  headingLevel?: 2 | 3 | undefined;
}

export function EmptyListings({
  title,
  description,
  actionHref,
  actionLabel,
  locale = 'ar',
  className,
  icon = 'car',
  headingLevel = 3,
}: EmptyListingsProps) {
  const isArabic = locale === 'ar';
  const displayTitle =
    title ?? (isArabic ? 'لا توجد سيارات معروضة' : 'No vehicles found');
  const displayDescription =
    description ??
    (isArabic
      ? 'لم نتمكن من العثور على أي سيارات تطابق المعايير المحددة. جرب توسيع خيارات البحث.'
      : 'We could not find any vehicles matching your criteria. Try adjusting your search filters.');

  const IconComponent = icon === 'search' ? Search : Car;

  return (
    <div
      className={cn(
        'flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-xs',
        className
      )}
      data-testid="empty-listings"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/80 text-muted-foreground mb-4">
        <IconComponent className="h-8 w-8 opacity-70" />
      </div>

      {headingLevel === 2 ? (
        <h2 className="text-lg font-bold text-foreground mb-2">{displayTitle}</h2>
      ) : (
        <h3 className="text-lg font-bold text-foreground mb-2">{displayTitle}</h3>
      )}

      <p className="max-w-md text-sm text-muted-foreground mb-6 leading-relaxed">
        {displayDescription}
      </p>

      {actionHref && actionLabel ? (
        <Button asChild variant="default" size="default">
          <Link prefetch={false} href={actionHref} locale={locale}>
            {actionLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
