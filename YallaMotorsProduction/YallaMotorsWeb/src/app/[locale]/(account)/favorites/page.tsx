import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { requireSession } from '@/lib/auth/guards';
import { getFavorites } from '@/server/queries/favorites';
import { queryKeys } from '@/lib/query/keys';
import { makeQueryClient } from '@/lib/query/client';
import { QueryHydrationBoundary } from '@/lib/query/hydration';
import { FavoritesList } from '@/components/favorites/favorites-list';
import type { AppLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';
const PAGE_LIMIT = 20 as const;

interface FavoritesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: FavoritesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'السيارات المفضلة | عربيات مارت' : 'Favorite Vehicles | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/favorites` },
  };
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  await requireSession(`/${locale}/favorites`, locale);
  const firstPage = await getFavorites({ limit: PAGE_LIMIT });
  const queryClient = makeQueryClient();
  queryClient.setQueryData(queryKeys.favorites({ limit: PAGE_LIMIT }), {
    pages: [firstPage],
    pageParams: [null],
  });
  const ar = locale === 'ar';

  return (
    <div className="space-y-6" data-testid="favorites-page">
      <header>
        <p className="text-sm font-semibold text-primary">{ar ? 'حسابي' : 'My account'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{ar ? 'السيارات المفضلة' : 'Favorite vehicles'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ar ? 'قائمتك الخاصة من السيارات التي حفظتها.' : 'Your private shortlist of saved vehicles.'}</p>
      </header>
      <QueryHydrationBoundary queryClient={queryClient}>
        <FavoritesList initialPage={firstPage} locale={locale} limit={PAGE_LIMIT} />
      </QueryHydrationBoundary>
    </div>
  );
}

