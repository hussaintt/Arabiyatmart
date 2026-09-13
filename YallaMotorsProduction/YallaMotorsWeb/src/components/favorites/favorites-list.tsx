'use client';

import * as React from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { AlertCircle, Heart, Loader2, RefreshCcw, Search } from 'lucide-react';
import { browserApiRequest } from '@/lib/api/browser';
import { BFF_ENDPOINTS } from '@/lib/api/endpoints';
import { ListingCursorResponseSchema } from '@/lib/api/schemas/listing';
import { normalizeCursorMeta } from '@/lib/api/pagination';
import { queryKeys } from '@/lib/query/keys';
import { ListingCard } from '@/components/listing/listing-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';
import type { ListingCard as ListingCardType, ListingCursorResponse } from '@/types/listing';

interface RemovedFavorite {
  listing: ListingCardType;
  pageIndex: number;
  itemIndex: number;
  wasOnlyItemOnNonFirstPage: boolean;
}

export interface FavoritesListProps {
  initialPage: ListingCursorResponse;
  locale: AppLocale;
  limit?: 20 | 50 | 100 | undefined;
}

export function FavoritesList({ initialPage, locale, limit = 20 }: FavoritesListProps) {
  const ar = locale === 'ar';
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => queryKeys.favorites({ limit }), [limit]);
  const removed = React.useRef(new Map<string, RemovedFavorite>());

  const query = useInfiniteQuery({
    queryKey,
    staleTime: 60_000,
    initialPageParam: null as string | null,
    initialData: { pages: [initialPage], pageParams: [null] },
    queryFn: async ({ pageParam }): Promise<ListingCursorResponse> => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (typeof pageParam === 'string' && pageParam) params.set('cursor', pageParam);
      const response = await browserApiRequest({
        path: `${BFF_ENDPOINTS.meFavorites()}?${params.toString()}`,
        outputSchema: ListingCursorResponseSchema,
      });
      return { ...response, meta: normalizeCursorMeta(response.meta) };
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined,
  });

  const data = query.data as InfiniteData<ListingCursorResponse, string | null>;
  const listings = React.useMemo(() => {
    const unique = new Map<string, ListingCardType>();
    for (const page of data.pages) {
      for (const listing of page.data) {
        if (!unique.has(listing.publicId)) unique.set(listing.publicId, listing);
      }
    }
    return Array.from(unique.values());
  }, [data.pages]);

  const optimisticallyRemove = (publicId: string) => {
    queryClient.setQueryData<InfiniteData<ListingCursorResponse, string | null>>(
      queryKey,
      (current) => {
        if (!current || removed.current.has(publicId)) return current;
        let snapshot: RemovedFavorite | null = null;
        const pages = current.pages.map((page, pageIndex) => {
          const itemIndex = page.data.findIndex((item) => item.publicId === publicId);
          if (itemIndex < 0) return page;
          snapshot = {
            listing: page.data[itemIndex]!,
            pageIndex,
            itemIndex,
            wasOnlyItemOnNonFirstPage: pageIndex > 0 && page.data.length === 1,
          };
          return { ...page, data: page.data.filter((item) => item.publicId !== publicId) };
        });
        if (snapshot) removed.current.set(publicId, snapshot);
        return { ...current, pages };
      }
    );
  };

  const rollbackRemoval = (publicId: string) => {
    const snapshot = removed.current.get(publicId);
    if (!snapshot) return;
    queryClient.setQueryData<InfiniteData<ListingCursorResponse, string | null>>(
      queryKey,
      (current) => {
        if (!current || current.pages.some((page) => page.data.some((item) => item.publicId === publicId))) return current;
        const pages = [...current.pages];
        const target = pages[snapshot.pageIndex];
        if (!target) return current;
        const items = [...target.data];
        items.splice(Math.min(snapshot.itemIndex, items.length), 0, snapshot.listing);
        pages[snapshot.pageIndex] = { ...target, data: items };
        return { ...current, pages };
      }
    );
    removed.current.delete(publicId);
  };

  const commitRemoval = async (publicId: string, favorited: boolean) => {
    if (favorited) {
      rollbackRemoval(publicId);
      return;
    }
    const snapshot = removed.current.get(publicId);
    removed.current.delete(publicId);
    if (snapshot?.wasOnlyItemOnNonFirstPage) await query.refetch();
  };

  if (listings.length === 0 && !query.isFetchingNextPage) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center" data-testid="favorites-empty">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" aria-hidden />
        <h2 className="mt-4 text-lg font-bold">{ar ? 'لا توجد سيارات محفوظة' : 'No saved vehicles yet'}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{ar ? 'احفظ السيارات التي تعجبك لتجدها هنا بسهولة.' : 'Save vehicles you like and they will appear here.'}</p>
        <Button asChild className="mt-6"><Link href="/search" locale={locale}><Search className="me-2 h-4 w-4" />{ar ? 'تصفح السيارات' : 'Browse vehicles'}</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="favorites-list">
      {query.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{ar ? 'تعذّر تحميل المزيد من المفضلة.' : 'More favorites could not be loaded.'}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCcw className="me-2 h-4 w-4" />{ar ? 'إعادة المحاولة' : 'Retry'}</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.publicId}
            listing={{ ...listing, isFavorited: true }}
            locale={locale}
            onFavoriteOptimisticToggle={(favorited) => { if (!favorited) optimisticallyRemove(listing.publicId); }}
            onFavoriteRollback={(favorited) => { if (favorited) rollbackRemoval(listing.publicId); }}
            onFavoriteToggle={(favorited) => { void commitRemoval(listing.publicId, favorited); }}
          />
        ))}
      </div>

      <div className="flex min-h-12 items-center justify-center" aria-live="polite">
        {query.hasNextPage ? (
          <Button type="button" variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} data-testid="favorites-load-more">
            {query.isFetchingNextPage ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {query.isFetchingNextPage ? (ar ? 'جاري التحميل...' : 'Loading…') : (ar ? 'تحميل المزيد' : 'Load more')}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="favorites-end">{ar ? 'وصلت إلى نهاية القائمة' : 'You have reached the end'}</p>
        )}
      </div>
    </div>
  );
}
