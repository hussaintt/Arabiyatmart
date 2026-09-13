import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { requireSession } from '@/lib/auth/guards';
import { getMyListings } from '@/server/queries/my-listings';
import { MyListingsList } from '@/components/my-listings/my-listings-list';
import type { AppLocale } from '@/i18n/config';
import type { MyListing } from '@/types/listing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MyListingsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: MyListingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'إعلاناتي | عربيات مارت' : 'My Listings | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/me/listings` },
  };
}

export default async function MyListingsPage({ params, searchParams }: MyListingsPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);

  await requireSession(`/${locale}/me/listings`, locale);

  const query = await searchParams;
  const statusParam = typeof query.status === 'string' ? query.status.toUpperCase() : 'ALL';

  let listings: MyListing[] = [];

  try {
    const response = await getMyListings({
      status: statusParam !== 'ALL' ? statusParam : undefined,
    });
    listings = response.data;
  } catch {
    // If backend returns 404 or empty, degrade gracefully to empty list
    listings = [];
  }

  return (
    <div className="space-y-6" data-testid="my-listings-page">
      <MyListingsList
        initialItems={listings}
        initialStatus={statusParam}
        locale={locale}
      />
    </div>
  );
}
