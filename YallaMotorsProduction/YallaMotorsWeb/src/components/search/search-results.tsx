import * as React from 'react';
import { ListingGrid } from '@/components/listing/listing-grid';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { buildSearchUrl, type ParsedSearchParams } from '@/lib/search/params';
import { cn } from '@/lib/utils';
import type { ListingSearchResponse } from '@/types/search';
import type { AppLocale } from '@/i18n/config';

export interface SearchResultsProps {
  results: ListingSearchResponse;
  currentParams: ParsedSearchParams;
  locale?: AppLocale | undefined;
  pathname?: string | undefined;
  className?: string | undefined;
}

export function SearchResults({
  results,
  currentParams,
  locale = 'ar',
  pathname = '/search',
  className,
}: SearchResultsProps) {
  const isArabic = locale === 'ar';
  const { data: listings, meta } = results;

  const total = meta.total;
  const page = meta.page;
  const limit = meta.limit;
  const totalPages = total !== null && total !== undefined
    ? Math.max(1, Math.ceil(total / limit))
    : meta.hasMore
    ? page + 1
    : page;

  // Generate pagination page numbers
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (page > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={cn('space-y-8 min-w-0', className)} data-testid="search-results">
      {/* 1. Results Grid or Empty State */}
      <ListingGrid
        listings={listings}
        locale={locale}
        columns={3}
        priorityCount={3}
        emptyTitle={isArabic ? 'لم نجد سيارات تطابق بحثك' : 'No matching vehicles found'}
        emptyDescription={
          isArabic
            ? 'جرب تعديل أو إزالة بعض الفلاتر للوصول إلى خيارات أكثر للسيارات المعروضة.'
            : 'Try adjusting or removing some filters to discover more available vehicles.'
        }
        emptyActionHref="/search"
        emptyActionLabel={isArabic ? 'عرض كل السيارات' : 'View all vehicles'}
        emptyHeadingLevel={2}
      />

      {/* 2. Accessible URL-driven Pagination */}
      {totalPages > 1 && (
        <div className="pt-4 border-t border-border">
          <Pagination>
            <PaginationContent>
              {/* Previous page link */}
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    href={buildSearchUrl(pathname, {
                      ...currentParams,
                      page: page - 1,
                    })}
                    label={isArabic ? 'السابق' : 'Previous'}
                  />
                </PaginationItem>
              )}

              {/* Numbered page links */}
              {pageNumbers.map((p, idx) => {
                if (p === 'ellipsis') {
                  return (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                const isActive = p === page;
                return (
                  <PaginationItem key={`page-${p}`}>
                    <PaginationLink
                      href={buildSearchUrl(pathname, {
                        ...currentParams,
                        page: p,
                      })}
                      isActive={isActive}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {/* Next page link */}
              {(meta.hasMore || page < totalPages) && (
                <PaginationItem>
                  <PaginationNext
                    href={buildSearchUrl(pathname, {
                      ...currentParams,
                      page: page + 1,
                    })}
                    label={isArabic ? 'التالي' : 'Next'}
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
