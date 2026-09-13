import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ArrowRight, Car, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { isAppLocale } from '@/i18n/config';
import { formatMoneyFromCents } from '@/i18n/format';
import { serverEnv } from '@/lib/env/server';
import { requireSession } from '@/lib/auth/guards';
import { getMyListings } from '@/server/queries/my-listings';
import { listPromotionPackages } from '@/server/queries/promotions';
import { listMyPromotions } from '@/server/queries/promotions-private';
import { PromotionPurchase } from '@/components/promotions/promotion-purchase';
import type { AppLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface BestOfferPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: BestOfferPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'ترقية الإعلان | عربيات مارت' : 'Promote Listing | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/best-offer/${slug}` },
  };
}

export default async function BestOfferPage({ params }: BestOfferPageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);

  const ar = locale === 'ar';
  const ArrowBackIcon = ar ? ArrowRight : ArrowLeft;
  const ChevronBackIcon = ar ? ChevronRight : ChevronLeft;

  // 1. Guard session
  await requireSession(`/${locale}/best-offer/${slug}`, locale);

  // 2. Fetch user's listings and verify listing ownership without leaking non-owner details
  let listing = null;
  try {
    const myListingsRes = await getMyListings({ limit: 100 });
    listing = myListingsRes.data.find(
      (item) => item.slug === slug || item.publicId === slug
    );
  } catch {
    listing = null;
  }

  // Strict non-owner guard: return 404 to avoid leaking listing existence or details
  if (!listing) {
    notFound();
  }

  // 3. Fetch packages and existing promotions in parallel
  const [packagesRes, myPromotionsRes] = await Promise.all([
    listPromotionPackages(locale).catch(() => ({ data: [] })),
    listMyPromotions().catch(() => ({ data: [] })),
  ]);

  const existingPromotions = myPromotionsRes.data.filter(
    (p) => p.listing?.publicId === listing.publicId || p.listing?.slug === listing.slug
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8" data-testid="best-offer-page">
      {/* Breadcrumb / Back Link */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/me/listings`}
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowBackIcon className="h-4 w-4" />
          <span>{ar ? 'إعلاناتي' : 'My Listings'}</span>
        </Link>
        <ChevronBackIcon className="h-3 w-3" />
        <span className="text-foreground font-medium truncate max-w-xs">{listing.title}</span>
        <ChevronBackIcon className="h-3 w-3" />
        <span className="text-primary font-semibold">{ar ? 'ترقية الإعلان' : 'Promote'}</span>
      </nav>

      {/* Listing Mini Hero / Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-24 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
            {listing.coverImageUrl ? (
              <Image
                src={listing.coverImageUrl}
                alt={listing.title}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <Car className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground line-clamp-1">{listing.title}</h1>
            <p className="text-sm font-semibold text-primary mt-0.5">
              {formatMoneyFromCents(listing.priceCents, listing.currency, locale)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>{ar ? 'إعلان موثق ملكيتك له' : 'Verified Ownership'}</span>
        </div>
      </div>

      {/* Promotion Packages Workflow */}
      <PromotionPurchase
        packages={packagesRes.data}
        listing={{
          publicId: listing.publicId,
          slug: listing.slug,
          title: listing.title,
          priceCents: listing.priceCents,
          currency: listing.currency,
          coverImageUrl: listing.coverImageUrl,
        }}
        existingPromotions={existingPromotions}
        locale={locale}
      />
    </div>
  );
}
