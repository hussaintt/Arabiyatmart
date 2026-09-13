import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { ListingSlugParamsSchema } from '@/lib/api/schemas/listing';
import { ApiContractError } from '@/lib/api/schemas/common';
import { getListing, getSimilarListings } from '@/server/queries/listings';
import { ListingGallery } from '@/components/listing/listing-gallery';
import {
  ListingSummary,
  sanitizePlainText,
  serializeJsonLd,
} from '@/components/listing/listing-summary';
import { SpecificationGroups } from '@/components/listing/specification-groups';
import { SellerCard } from '@/components/listing/seller-card';
import { ListingActionPanel } from '@/components/listing/listing-action-panel';
import { ListingGrid } from '@/components/listing/listing-grid';
import { formatMoneyFromCents } from '@/i18n/format';
import { serverEnv } from '@/lib/env/server';
import type { ListingDetail } from '@/types/listing';

export const revalidate = 60;

interface ListingPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const parsedSlug = ListingSlugParamsSchema.safeParse({ slug });
  if (!parsedSlug.success) {
    return { title: isArabic ? 'الإعلان غير موجود' : 'Listing Not Found' };
  }

  try {
    const res = await getListing({ slug: parsedSlug.data.slug }, validLocale);
    const listing = res.data;
    const make = isArabic ? listing.make.name.ar : listing.make.name.en;
    const model = isArabic ? listing.model.name.ar : listing.model.name.en;
    const title = `${listing.title} | ${isArabic ? 'عربيات مارت' : 'Arabiyatmart'}`;
    const formattedPrice = formatMoneyFromCents(listing.priceCents, listing.currency, validLocale);
    const description = `${make} ${model} ${listing.year} - ${formattedPrice} - ${isArabic ? listing.city.name.ar : listing.city.name.en}`;
    const firstImage = listing.images.find((img) => img.isCover) ?? listing.images[0];
    const rawImageUrl = firstImage?.largeUrl ?? firstImage?.mediumUrl ?? firstImage?.url;
    const canonical = `/${validLocale}/listing/${slug}`;
    const ogImageUrl = rawImageUrl
      ? (rawImageUrl.startsWith('http') ? rawImageUrl : `${serverEnv.SITE_ORIGIN}${rawImageUrl}`)
      : `${serverEnv.SITE_ORIGIN}/images/og-default.jpg`;

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: {
          ar: `/ar/listing/${slug}`,
          en: `/en/listing/${slug}`,
          'x-default': `/ar/listing/${slug}`,
        },
      },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: isArabic ? 'الإعلان غير موجود' : 'Listing Not Found' };
  }
}

export default async function ListingDetailPage({ params }: ListingPageProps) {
  const { locale, slug } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const parsedSlug = ListingSlugParamsSchema.safeParse({ slug });
  if (!parsedSlug.success) {
    notFound();
  }

  const validLocale: AppLocale = locale;
  const isArabic = validLocale === 'ar';

  let listing: ListingDetail;
  try {
    const res = await getListing({ slug: parsedSlug.data.slug }, validLocale);
    listing = res.data;
  } catch (error) {
    if (
      error instanceof ApiContractError &&
      (error.body.error.status === 404 || error.body.error.code === 'NOT_FOUND')
    ) {
      notFound();
    }
    throw error;
  }

  // Similar inventory (failure degrades gracefully into empty array without erroring page)
  const similarRes = await getSimilarListings(
    { slug: parsedSlug.data.slug },
    validLocale
  ).catch(() => ({ data: [] }));

  const similarListings = similarRes.data
    .filter((item) => item.publicId !== listing.publicId)
    .slice(0, 4);

  const makeName = isArabic ? listing.make.name.ar : listing.make.name.en;
  const modelName = isArabic ? listing.model.name.ar : listing.model.name.en;
  const rawDescription = listing.description?.[validLocale] ?? listing.description?.ar ?? listing.description?.en ?? null;
  const sanitizedDescription = sanitizePlainText(rawDescription);

  // JSON-LD Vehicle structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: listing.title,
    ...(sanitizedDescription ? { description: sanitizedDescription } : {}),
    image: listing.images.map((img) => img.url),
    vehicleModelDate: listing.year,
    mileageFromOdometer: {
      '@type': 'QuantitativeValue',
      value: listing.mileageKm,
      unitCode: 'KMT',
    },
    vehicleTransmission: listing.transmission,
    fuelType: listing.fuelType,
    bodyType: listing.bodyType,
    ...(listing.colorExterior ? { color: listing.colorExterior } : {}),
    brand: {
      '@type': 'Brand',
      name: makeName,
    },
    model: modelName,
    ...(listing.status === 'ACTIVE'
      ? {
          offers: {
            '@type': 'Offer',
            price: (listing.priceCents / 100).toFixed(2),
            priceCurrency: listing.currency,
            availability: 'https://schema.org/InStock',
            itemCondition:
              listing.condition === 'NEW'
                ? 'https://schema.org/NewCondition'
                : 'https://schema.org/UsedCondition',
            seller: {
              '@type': listing.sellerType === 'DEALER' ? 'AutoDealer' : 'Person',
              name: listing.vendor
                ? (isArabic ? listing.vendor.displayName.ar : listing.vendor.displayName.en)
                : (isArabic ? 'بائع خاص' : 'Private Seller'),
            },
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-background pb-40 text-foreground lg:pb-12">
      {/* Product / Vehicle JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label={isArabic ? 'مسار التنقل' : 'Breadcrumbs'}
          className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap py-1 scrollbar-none"
        >
          <Link
            href="/"
            locale={validLocale}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
            <span>{isArabic ? 'الرئيسية' : 'Home'}</span>
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <Link
            href="/search"
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            {isArabic ? 'السيارات' : 'Cars'}
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <Link
            href={`/search?makeSlug=${listing.make.slug}`}
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            {makeName}
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <Link
            href={`/search?makeSlug=${listing.make.slug}&modelSlug=${listing.model.slug}`}
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            {modelName}
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <span
            aria-current="page"
            className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs"
          >
            {listing.year} - {listing.title}
          </span>
        </nav>

        {/* 7 / 5 Desktop Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Primary Content Column (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-8 min-w-0">
            {/* 1. Gallery with Reserved Aspect Ratio */}
            <ListingGallery
              listingPublicId={listing.publicId}
              images={listing.images}
              title={listing.title}
              locale={validLocale}
            />

            {/* 2. Listing Summary (Title, Badges, Price, Key Facts Grid) */}
            <ListingSummary listing={listing} locale={validLocale} />

            {/* 3. Description (Sanitized) */}
            {sanitizedDescription ? (
              <section
                aria-label={isArabic ? 'وصف المركبة' : 'Vehicle description'}
                className="rounded-xl border bg-card p-5 shadow-2xs space-y-3"
              >
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {isArabic ? 'وصف المركبة' : 'Vehicle Description'}
                </h2>
                <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line break-words">
                  {sanitizedDescription}
                </div>
              </section>
            ) : null}

            {/* 4. Grouped Specifications */}
            <SpecificationGroups listing={listing} locale={validLocale} />

            {/* 5. Mobile/Tablet Seller Card (Rendered here on small viewports if needed, or in side column) */}
            <div className="lg:hidden">
              <SellerCard listing={listing} locale={validLocale} />
            </div>

            {/* 6. Similar Inventory */}
            {similarListings.length > 0 ? (
              <section
                aria-label={isArabic ? 'سيارات مشابهة' : 'Similar vehicles'}
                className="space-y-4 pt-4 border-t"
                data-testid="similar-listings-section"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {isArabic ? 'سيارات مشابهة قد تهمك' : 'Similar Vehicles You May Like'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isArabic
                        ? `سيارات أخرى من فئة ${makeName} ${modelName}`
                        : `Other vehicles in the ${makeName} ${modelName} category`}
                    </p>
                  </div>
                  <Link
                    href={`/search?makeSlug=${listing.make.slug}`}
                    locale={validLocale}
                    className="text-xs sm:text-sm font-semibold text-primary hover:underline"
                  >
                    {isArabic ? 'عرض المزيد' : 'View more'}
                  </Link>
                </div>

                <ListingGrid listings={similarListings} locale={validLocale} />
              </section>
            ) : null}
          </div>

          {/* Secondary Action / Seller Rail (5 cols on desktop) */}
          <aside className="hidden lg:sticky lg:top-24 lg:col-span-5 lg:flex lg:max-h-[calc(100vh-7rem)] lg:min-w-0 lg:flex-col lg:space-y-6 lg:overflow-y-auto lg:overscroll-contain lg:pb-2">
            {/* Price and seller information share one sticky rail so they never overlap. */}
            <ListingActionPanel listing={listing} locale={validLocale} />

            {/* Seller Card */}
            <SellerCard listing={listing} locale={validLocale} />
          </aside>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Bar (Clearance protected with pb-24 on page) */}
      <div className="lg:hidden">
        <ListingActionPanel listing={listing} locale={validLocale} />
      </div>
    </div>
  );
}
