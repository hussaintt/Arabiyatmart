import * as React from 'react';
import { ListingCard } from './listing-card';
import { EmptyListings } from './empty-listings';
import { cn } from '@/lib/utils';
import type { ListingCard as ListingCardType } from '@/types/listing';
import type { AppLocale } from '@/i18n/config';

export interface ListingGridProps {
  listings: readonly ListingCardType[] | ListingCardType[];
  locale?: AppLocale | undefined;
  columns?: (3 | 4) | undefined;
  priorityCount?: number | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  emptyActionHref?: string | undefined;
  emptyActionLabel?: string | undefined;
  emptyHeadingLevel?: 2 | 3 | undefined;
  className?: string | undefined;
}

export function ListingGrid({
  listings,
  locale = 'ar',
  columns = 4,
  priorityCount = 4,
  emptyTitle,
  emptyDescription,
  emptyActionHref,
  emptyActionLabel,
  emptyHeadingLevel = 3,
  className,
}: ListingGridProps) {
  if (!listings || listings.length === 0) {
    return (
      <EmptyListings
        locale={locale}
        title={emptyTitle}
        description={emptyDescription}
        actionHref={emptyActionHref}
        actionLabel={emptyActionLabel}
        headingLevel={emptyHeadingLevel}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6',
        columns === 4
          ? 'lg:grid-cols-3 xl:grid-cols-4'
          : 'lg:grid-cols-3',
        className
      )}
      data-testid="listing-grid"
    >
      {listings.map((listing, index) => (
        <div key={listing.publicId} className="h-full">
          <ListingCard
            listing={listing}
            locale={locale}
            priority={index < priorityCount}
          />
        </div>
      ))}
    </div>
  );
}
