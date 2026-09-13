import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { ApiContractError, SlugSchema } from '@/lib/api/schemas/common';
import { DealerInventoryParamsSchema } from '@/lib/api/schemas/dealer';
import { getDealer, getDealerListings } from '@/server/queries/dealers';
import { DealerHeader } from '@/components/dealer/dealer-header';
import { DealerAbout } from '@/components/dealer/dealer-about';
import { DealerInventory } from '@/components/dealer/dealer-inventory';
import type { DealerInventoryParams, DealerProfile } from '@/types/dealer';

export const revalidate = 300;

interface DealerProfilePageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: DealerProfilePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const slugParsed = SlugSchema.safeParse(slug);
  if (!slugParsed.success) {
    return {
      title: isArabic ? 'معرض سيارات | عربيات مارت' : 'Car Dealership | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const dealerRes = await getDealer(slugParsed.data, validLocale).catch(() => null);
  if (!dealerRes) {
    return {
      title: isArabic ? 'معرض غير موجود | عربيات مارت' : 'Dealership Not Found | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const dealer = dealerRes.data;
  const displayName = isArabic ? dealer.displayName.ar : dealer.displayName.en;
  const descriptionText = dealer.description
    ? isArabic
      ? dealer.description.ar
      : dealer.description.en
    : isArabic
      ? `تصفح أحدث سيارات ${displayName} المتاحة للبيع فوري بالأسعار والمواصفات على عربيات مارت.`
      : `Browse active vehicles for sale from ${displayName} with prices and specifications on Arabiyatmart.`;

  const hasFilterOrCursor = Boolean(sp.condition || sp.sort || sp.cursor || sp.makeSlug || sp.modelSlug);

  const ogImages: string[] = [];
  if (dealer.logoUrl) ogImages.push(dealer.logoUrl);
  if (dealer.bannerUrl) ogImages.push(dealer.bannerUrl);

  const title = isArabic
    ? `${displayName} | معارض السيارات | عربيات مارت`
    : `${displayName} | Car Showrooms | Arabiyatmart`;

  return {
    title,
    description: descriptionText,
    robots: hasFilterOrCursor
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical: `/${validLocale}/dealers/${dealer.slug}`,
      languages: {
        ar: `/ar/dealers/${dealer.slug}`,
        en: `/en/dealers/${dealer.slug}`,
        'x-default': `/ar/dealers/${dealer.slug}`,
      },
    },
    openGraph: {
      title,
      description: descriptionText,
      url: `/${validLocale}/dealers/${dealer.slug}`,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      type: 'website',
      images: (ogImages.length > 0 ? ogImages : ['/images/og-default.jpg']).map((img) => ({ url: img, alt: displayName })),
    },
  };
}

export default async function DealerProfilePage({
  params,
  searchParams,
}: DealerProfilePageProps) {
  const { locale, slug } = await params;
  const sp = await searchParams;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const validLocale: AppLocale = locale;
  const isArabic = validLocale === 'ar';

  const slugParsed = SlugSchema.safeParse(slug);
  if (!slugParsed.success) {
    notFound();
  }

  // Parse inventory query parameters
  const candidateParams: DealerInventoryParams = {
    limit: 24,
    ...(typeof sp.condition === 'string' && (sp.condition === 'NEW' || sp.condition === 'USED')
      ? { condition: sp.condition }
      : {}),
    ...(typeof sp.sort === 'string' && (sp.sort === 'newest' || sp.sort === 'price_asc' || sp.sort === 'price_desc')
      ? { sort: sp.sort }
      : {}),
    ...(typeof sp.cursor === 'string' && sp.cursor.trim().length > 0 ? { cursor: sp.cursor.trim() } : {}),
  };

  const inventoryParamsParsed = DealerInventoryParamsSchema.safeParse(candidateParams);
  const validInventoryParams = inventoryParamsParsed.success ? inventoryParamsParsed.data : { limit: 24 as const };

  // Fetch dealer profile (must 404 only on true absence, propagate server/network errors)
  let dealer: DealerProfile;
  try {
    const dealerRes = await getDealer(slugParsed.data, validLocale);
    dealer = dealerRes.data;
  } catch (error) {
    if (
      error instanceof ApiContractError &&
      (error.body.error.status === 404 || error.body.error.code === 'NOT_FOUND')
    ) {
      notFound();
    }
    throw error;
  }
  const displayName = isArabic ? dealer.displayName.ar : dealer.displayName.en;

  // Fetch initial dealer listings (must NOT 404 when inventory is empty)
  // A successful empty response is a real empty showroom. Contract, network,
  // and server failures must reach the route error boundary instead of being
  // misreported to customers as zero inventory.
  const listingsRes = await getDealerListings(dealer.slug, validInventoryParams, validLocale);

  const listings = listingsRes.data;
  const meta = listingsRes.meta;

  // Build JSON-LD LocalBusiness / AutoDealer
  const primaryBranch = dealer.branches[0];
  const primaryPhone = primaryBranch?.phone ?? null;
  const primaryAddress = primaryBranch?.addressLine ?? null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: displayName,
    description: dealer.description ? (isArabic ? dealer.description.ar : dealer.description.en) : undefined,
    url: `https://arabiyatmart.com/${validLocale}/dealers/${dealer.slug}`,
    ...(dealer.logoUrl ? { image: dealer.logoUrl } : {}),
    ...(primaryPhone ? { telephone: primaryPhone } : {}),
    ...(primaryAddress
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: primaryAddress,
          },
        }
      : {}),
    ...(primaryBranch?.lat && primaryBranch?.lng
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: primaryBranch.lat,
            longitude: primaryBranch.lng,
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* AutoDealer Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 sm:space-y-8">
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
            href="/dealers"
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            <span>{isArabic ? 'معارض السيارات' : 'Car Dealerships'}</span>
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <span
            aria-current="page"
            className="font-semibold text-foreground truncate"
            dir="auto"
          >
            {displayName}
          </span>
        </nav>

        {/* Dealer Header */}
        <DealerHeader
          dealer={dealer}
          locale={validLocale}
        />

        {/* Responsive 12-Column Grid:
            Desktop: 8-column main inventory + sticky 320px (4-column) dealer information rail
            Tablet: 2-column profile facts
            Mobile: Stacks content
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Main Inventory Section (8 cols on desktop) */}
          <section
            className="lg:col-span-8 min-w-0"
            aria-label={isArabic ? 'سيارات المعرض المتاحة' : 'Showroom Inventory'}
          >
            <DealerInventory
              listings={listings}
              meta={meta}
              dealerSlug={dealer.slug}
              currentParams={validInventoryParams}
              locale={validLocale}
            />
          </section>

          {/* Sticky 320px Dealer Information Rail (4 cols on desktop) */}
          <aside className="lg:col-span-4 min-w-0 lg:sticky lg:top-20 space-y-6">
            <DealerAbout
              dealer={dealer}
              locale={validLocale}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
