import * as React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Building2, ChevronLeft, ChevronRight, Home, Scale, Tag, Car, ShieldCheck } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { ApiContractError, PublicIdSchema } from '@/lib/api/schemas/common';
import { getCatalogueTrim, getTrimDealers } from '@/server/queries/catalogue';
import { TrimSpecifications } from '@/components/catalogue/trim-specifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoneyFromCents } from '@/i18n/format';
import type { CatalogueTrimDetailResponse, TrimDealer } from '@/types/taxonomy';

export const revalidate = 3600;

interface CatalogueTrimPageProps {
  params: Promise<{ locale: string; publicId: string }>;
}

export async function generateMetadata({
  params,
}: CatalogueTrimPageProps): Promise<Metadata> {
  const { locale, publicId } = await params;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const idParsed = PublicIdSchema.safeParse(publicId);
  if (!idParsed.success) {
    return {
      title: isArabic ? 'فئة سيارة | عربيات مارت' : 'Car Trim | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const trimRes = await getCatalogueTrim({ publicId: idParsed.data }, validLocale).catch(() => null);
  if (!trimRes) {
    return {
      title: isArabic ? 'فئة غير موجودة | عربيات مارت' : 'Trim Not Found | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const trim = trimRes.data;
  const trimName = isArabic ? trim.name.ar : trim.name.en;
  const modelAncestry = trim.generation.model;
  const modelName = modelAncestry.name
    ? isArabic
      ? modelAncestry.name.ar ?? modelAncestry.name.en ?? modelAncestry.slug
      : modelAncestry.name.en ?? modelAncestry.name.ar ?? modelAncestry.slug
    : modelAncestry.slug;
  const makeAncestry = modelAncestry.make;
  const makeName = makeAncestry.name
    ? isArabic
      ? makeAncestry.name.ar ?? makeAncestry.name.en ?? makeAncestry.slug
      : makeAncestry.name.en ?? makeAncestry.name.ar ?? makeAncestry.slug
    : makeAncestry.slug;

  const title = isArabic
    ? `مواصفات وسعر ${makeName} ${modelName} ${trimName} ${trim.modelYear} | عربيات مارت`
    : `${makeName} ${modelName} ${trimName} ${trim.modelYear} Specs & Price | Arabiyatmart`;

  const description = isArabic
    ? `تعرف على المواصفات الرسمية الكاملة والأسعار لفئة ${makeName} ${modelName} ${trimName} موديل ${trim.modelYear} في مصر.`
    : `Complete technical specifications, performance figures, and official prices for ${makeName} ${modelName} ${trimName} ${trim.modelYear} in Egypt.`;

  const canonical = `/${validLocale}/catalogue/trims/${trim.publicId}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: `/ar/catalogue/trims/${trim.publicId}`,
        en: `/en/catalogue/trims/${trim.publicId}`,
        'x-default': `/ar/catalogue/trims/${trim.publicId}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      type: 'website',
      images: [{ url: '/images/og-default.jpg', width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function CatalogueTrimPage({
  params,
}: CatalogueTrimPageProps) {
  const { locale, publicId } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const validLocale: AppLocale = locale;
  const isArabic = validLocale === 'ar';

  const idParsed = PublicIdSchema.safeParse(publicId);
  if (!idParsed.success) {
    notFound();
  }

  // Concurrently fetch trim details and dealers offering this trim (must 404 only on true absence, propagate server/network errors)
  let trim: CatalogueTrimDetailResponse['data'];
  let dealers: TrimDealer[] = [];

  try {
    const [trimRes, dealersRes] = await Promise.all([
      getCatalogueTrim({ publicId: idParsed.data }, validLocale),
      getTrimDealers({ publicId: idParsed.data, limit: 8 }, validLocale).catch(() => ({ data: [] })),
    ]);
    trim = trimRes.data;
    dealers = dealersRes.data;
  } catch (error) {
    if (
      error instanceof ApiContractError &&
      (error.body.error.status === 404 || error.body.error.code === 'NOT_FOUND')
    ) {
      notFound();
    }
    throw error;
  }

  const trimName = isArabic ? trim.name.ar : trim.name.en;
  const modelAncestry = trim.generation.model;
  const modelName = modelAncestry.name
    ? isArabic
      ? modelAncestry.name.ar ?? modelAncestry.name.en ?? modelAncestry.slug
      : modelAncestry.name.en ?? modelAncestry.name.ar ?? modelAncestry.slug
    : modelAncestry.slug;
  const makeAncestry = modelAncestry.make;
  const makeName = makeAncestry.name
    ? isArabic
      ? makeAncestry.name.ar ?? makeAncestry.name.en ?? makeAncestry.slug
      : makeAncestry.name.en ?? makeAncestry.name.ar ?? makeAncestry.slug
    : makeAncestry.slug;

  const formattedOfficialPrice =
    trim.officialPriceCents !== null && trim.officialPriceCents > 0
      ? formatMoneyFromCents(trim.officialPriceCents, trim.currency || 'EGP', validLocale)
      : null;

  const formattedMarketPrice =
    trim.marketPriceCents !== null && trim.marketPriceCents > 0
      ? formatMoneyFromCents(trim.marketPriceCents, trim.currency || 'EGP', validLocale)
      : null;

  // JSON-LD Product & BreadcrumbList
  // Omit unsupported availability when dealer stock is 0
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: isArabic ? 'الرئيسية' : 'Home',
            item: `https://arabiyatmart.com/${validLocale}`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: isArabic ? 'ماركات السيارات' : 'Car Makes',
            item: `https://arabiyatmart.com/${validLocale}/catalogue/makes`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: makeName,
            item: `https://arabiyatmart.com/${validLocale}/catalogue/makes/${makeAncestry.slug}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: modelName,
            item: `https://arabiyatmart.com/${validLocale}/catalogue/models/${modelAncestry.publicId}`,
          },
          {
            '@type': 'ListItem',
            position: 5,
            name: trimName,
            item: `https://arabiyatmart.com/${validLocale}/catalogue/trims/${trim.publicId}`,
          },
        ],
      },
      {
        '@type': 'Product',
        name: `${makeName} ${modelName} ${trimName} ${trim.modelYear}`,
        category: 'Vehicle',
        url: `https://arabiyatmart.com/${validLocale}/catalogue/trims/${trim.publicId}`,
        ...(trim.officialPriceCents !== null && trim.officialPriceCents > 0
          ? {
              offers: {
                '@type': 'Offer',
                priceCurrency: trim.currency || 'EGP',
                price: (trim.officialPriceCents / 100).toFixed(0),
                ...(dealers.length > 0
                  ? { availability: 'https://schema.org/InStock' }
                  : {}),
              },
            }
          : {}),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Product & BreadcrumbList JSON-LD */}
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
            href="/catalogue/makes"
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            <span>{isArabic ? 'ماركات السيارات' : 'Car Makes'}</span>
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <Link
            href={`/catalogue/makes/${makeAncestry.slug}`}
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            <span dir="auto">{makeName}</span>
          </Link>

          {isArabic ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}

          <Link
            href={`/catalogue/models/${modelAncestry.publicId}`}
            locale={validLocale}
            className="transition-colors hover:text-foreground"
          >
            <span dir="auto">{modelName}</span>
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
            {trimName}
          </span>
        </nav>

        {/* Trim Header Overview */}
        <header
          className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          data-testid="trim-header"
        >
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="soft" className="bg-primary/10 text-primary font-bold text-xs">
                {isArabic ? `موديل ${trim.modelYear}` : `Model Year ${trim.modelYear}`}
              </Badge>
              <span className="text-xs text-muted-foreground font-semibold">
                {makeName} • {modelName}
              </span>
            </div>

            <h1
              dir="auto"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight"
              data-testid="trim-title"
            >
              {makeName} {modelName} {trimName}
            </h1>
          </div>

          <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row items-stretch md:items-end gap-4">
            {/* Price block */}
            <div className="space-y-0.5 text-start md:text-end">
              {formattedOfficialPrice ? (
                <>
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 md:justify-end">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span>{isArabic ? 'السعر الرسمي' : 'Official Price'}</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight" data-testid="trim-official-price">
                    {formattedOfficialPrice}
                  </div>
                  {formattedMarketPrice ? (
                    <div className="text-xs text-muted-foreground">
                      {isArabic ? 'سعر السوق التقريبي:' : 'Est. Market:'} {formattedMarketPrice}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-muted-foreground italic py-2" data-testid="trim-price-unavailable">
                  {isArabic ? 'السعر غير محدد حالياً' : 'Price currently unlisted'}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="default" className="font-semibold gap-1.5">
                <Link
                  href={`/compare?trimIds=${trim.publicId}`}
                  locale={validLocale}
                  data-testid="trim-compare-btn"
                >
                  <Scale className="h-4 w-4 text-primary" />
                  <span>{isArabic ? 'مقارنة الفئة' : 'Compare'}</span>
                </Link>
              </Button>

              <Button asChild variant="default" size="default" className="font-semibold gap-1.5">
                <Link
                  href={`/search?makeSlug=${makeAncestry.slug}&modelSlug=${modelAncestry.slug}`}
                  locale={validLocale}
                >
                  <Car className="h-4 w-4" />
                  <span>{isArabic ? 'سيارات معروضة' : 'View Cars'}</span>
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Grouped Specifications Section */}
        <section aria-label={isArabic ? 'المواصفات الفنية الكاملة' : 'Full Technical Specifications'}>
          <TrimSpecifications
            trim={trim}
            locale={validLocale}
          />
        </section>

        {/* Authorized Dealers Stocking Section */}
        <section
          className="rounded-2xl border bg-card p-6 shadow-xs space-y-4"
          aria-label={isArabic ? 'المعارض المعتمدة' : 'Certified Showrooms'}
          data-testid="trim-dealers-section"
        >
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2 font-bold text-base sm:text-lg text-foreground">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <h2>{isArabic ? 'المعارض المعتمدة التي تتوفر لديها الفئة' : 'Showrooms stocking this trim'}</h2>
            </div>
            {dealers.length > 0 ? (
              <span className="text-xs text-muted-foreground font-medium">
                {dealers.length} {isArabic ? 'معرض' : 'dealers'}
              </span>
            ) : null}
          </div>

          {dealers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dealers.map((dealer) => {
                const dealerName = dealer.displayName
                  ? isArabic
                    ? dealer.displayName.ar ?? dealer.displayName.en ?? dealer.slug
                    : dealer.displayName.en ?? dealer.displayName.ar ?? dealer.slug
                  : dealer.slug;

                const dealerPrice =
                  dealer.startingPriceCents !== null && dealer.startingPriceCents > 0
                    ? formatMoneyFromCents(dealer.startingPriceCents, dealer.currency || 'EGP', validLocale)
                    : null;

                return (
                  <Link
                    key={dealer.publicId}
                    href={`/dealers/${dealer.slug}`}
                    locale={validLocale}
                    className="group flex flex-col justify-between rounded-xl border bg-muted/20 p-4 shadow-xs hover:border-primary/40 hover:shadow-md transition-all focus:outline-hidden focus:ring-2 focus:ring-primary"
                    data-testid={`trim-dealer-card-${dealer.slug}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-card p-1 flex items-center justify-center">
                          {dealer.logoUrl ? (
                            <Image
                              src={dealer.logoUrl}
                              alt={dealerName}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-primary/60" />
                          )}
                        </div>

                        {dealer.isVerified ? (
                          <Badge variant="soft" className="text-[10px] bg-primary/10 text-primary font-semibold">
                            <ShieldCheck className="h-3 w-3 me-0.5 inline" />
                            {isArabic ? 'معتمد' : 'Verified'}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors" dir="auto">
                          {dealerName}
                        </h4>
                        {dealer.cityName ? (
                          <p className="text-[11px] text-muted-foreground">
                            {isArabic ? dealer.cityName.ar : dealer.cityName.en}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t flex items-center justify-between text-xs">
                      <span className="text-[11px] text-muted-foreground">
                        {dealer.listingCount} {isArabic ? 'سيارة' : 'cars'}
                      </span>
                      {dealerPrice ? (
                        <span className="font-bold text-foreground">{dealerPrice}</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Explicitly Empty Dealer State per Acceptance Criteria */
            <div
              className="rounded-xl border border-dashed bg-muted/20 p-8 text-center space-y-2"
              data-testid="trim-dealers-empty"
            >
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Building2 className="h-5 w-5 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {isArabic
                  ? 'لا تتوفر هذه الفئة لدى المعارض حالياً'
                  : 'Currently not in stock at certified showrooms'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isArabic
                  ? 'يمكنك متابعة المعارض أو البحث عن سيارات مماثلة في سوق السيارات المستعملة والجديدة.'
                  : 'Check back soon or explore marketplace listings for available vehicles.'}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
