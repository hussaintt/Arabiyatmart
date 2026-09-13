import * as React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Building2, ChevronLeft, ChevronRight, Home, ShieldCheck, Tag, Car, Globe } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { ApiContractError, SlugSchema } from '@/lib/api/schemas/common';
import { getMakeDealers, getModelsWithPrices } from '@/server/queries/catalogue';
import { listMakes } from '@/server/queries/taxonomy';
import { ConditionTabs } from '@/components/catalogue/condition-tabs';
import { ModelPriceCard } from '@/components/catalogue/model-price-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDigits } from '@/i18n/format';
import type { CarCondition } from '@/types/listing';

interface MakeCataloguePageProps {
  params: Promise<{ locale: string; makeSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: MakeCataloguePageProps): Promise<Metadata> {
  const { locale, makeSlug } = await params;
  const sp = await searchParams;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const slugParsed = SlugSchema.safeParse(makeSlug);
  if (!slugParsed.success) {
    return {
      title: isArabic ? 'ماركة سيارات | عربيات مارت' : 'Car Make | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const makesRes = await listMakes(validLocale).catch(() => ({ data: [] }));
  const matchingMake = makesRes.data.find((m) => m.slug === slugParsed.data);

  if (!matchingMake) {
    return {
      title: isArabic ? 'ماركة غير موجودة | عربيات مارت' : 'Brand Not Found | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const makeName = isArabic ? matchingMake.name.ar : matchingMake.name.en;
  const condition =
    typeof sp.condition === 'string' && (sp.condition === 'NEW' || sp.condition === 'USED')
      ? (sp.condition as CarCondition)
      : undefined;

  const conditionSuffix = condition === 'NEW'
    ? isArabic ? 'الجديدة (زيرو)' : 'Brand New'
    : condition === 'USED'
      ? isArabic ? 'المستعملة' : 'Used'
      : '';

  const title = isArabic
    ? `أسعار وموديلات سيارات ${makeName} ${conditionSuffix} في مصر | عربيات مارت`.replace(/\s+/g, ' ')
    : `${makeName} ${conditionSuffix} Models & Prices in Egypt | Arabiyatmart`.replace(/\s+/g, ' ');

  const description = isArabic
    ? `تصفح أسعار وفئات سيارات ${makeName} ${conditionSuffix} في مصر، مع تفاصيل المواصفات الرسمية ومعارض الوكلاء المعتمدين.`
    : `Explore ${makeName} ${conditionSuffix} car models, specifications, and prices from certified dealers across Egypt.`;

  const canonical = `/${validLocale}/catalogue/makes/${matchingMake.slug}${condition ? `?condition=${condition}` : ''}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: `/ar/catalogue/makes/${matchingMake.slug}${condition ? `?condition=${condition}` : ''}`,
        en: `/en/catalogue/makes/${matchingMake.slug}${condition ? `?condition=${condition}` : ''}`,
        'x-default': `/ar/catalogue/makes/${matchingMake.slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      type: 'website',
      images: [{ url: matchingMake.logoUrl ?? '/images/og-default.jpg', alt: makeName }],
    },
  };
}

export default async function MakeCataloguePage({
  params,
  searchParams,
}: MakeCataloguePageProps) {
  const { locale, makeSlug } = await params;
  const sp = await searchParams;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const validLocale: AppLocale = locale;
  const isArabic = validLocale === 'ar';

  const slugParsed = SlugSchema.safeParse(makeSlug);
  if (!slugParsed.success) {
    notFound();
  }

  // Canonicalize condition: only 'NEW' or 'USED' are valid, anything else defaults to undefined
  const validCondition: CarCondition | undefined =
    typeof sp.condition === 'string' && (sp.condition === 'NEW' || sp.condition === 'USED')
      ? sp.condition
      : undefined;

  // Fetch make list to verify existence and metadata (propagate server/network errors, 404 only on true unknown make)
  let makesRes;
  try {
    makesRes = await listMakes(validLocale);
  } catch (error) {
    if (
      error instanceof ApiContractError &&
      (error.body.error.status === 404 || error.body.error.code === 'NOT_FOUND')
    ) {
      notFound();
    }
    throw error;
  }
  const matchingMake = makesRes.data.find((m) => m.slug === slugParsed.data);

  if (!matchingMake) {
    notFound();
  }

  const makeName = isArabic ? matchingMake.name.ar : matchingMake.name.en;

  // Concurrently fetch models with prices and make dealers
  const [modelsRes, dealersRes] = await Promise.all([
    getModelsWithPrices(
      { makeSlug: slugParsed.data, condition: validCondition },
      validLocale
    ).catch(() => ({ data: [] })),
    getMakeDealers(
      { makeSlug: slugParsed.data, limit: 8 },
      validLocale
    ).catch(() => ({ data: [] })),
  ]);

  const models = modelsRes.data;
  const dealers = dealersRes.data;

  // JSON-LD BreadcrumbList
  const jsonLd = {
    '@context': 'https://schema.org',
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
        item: `https://arabiyatmart.com/${validLocale}/catalogue/makes/${matchingMake.slug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* BreadcrumbList JSON-LD */}
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

          <span
            aria-current="page"
            className="font-semibold text-foreground truncate"
            dir="auto"
          >
            {makeName}
          </span>
        </nav>

        {/* Brand Header Banner */}
        <header
          className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
          data-testid="make-header"
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Make Logo with reserved dimensions and fallback */}
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-muted/30 p-2 flex items-center justify-center">
              {matchingMake.logoUrl ? (
                <Image
                  src={matchingMake.logoUrl}
                  alt={makeName}
                  fill
                  priority
                  sizes="80px"
                  className="object-contain p-2"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-extrabold text-xl">
                  {makeName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  dir="auto"
                  className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight"
                  data-testid="make-title"
                >
                  {makeName}
                </h1>

                {matchingMake.countryOfOrigin ? (
                  <Badge variant="soft" className="text-xs font-semibold gap-1 bg-muted">
                    <Globe className="h-3 w-3" />
                    <span>{matchingMake.countryOfOrigin}</span>
                  </Badge>
                ) : null}
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                {isArabic
                  ? `استعرض أسعار وموديلات سيارات ${makeName} المتوفرة في السوق المصري.`
                  : `Browse models, specifications, and prices for ${makeName} vehicles.`}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button asChild variant="default" size="default" className="font-semibold gap-2">
              <Link
                href={`/search?makeSlug=${matchingMake.slug}${validCondition ? `&condition=${validCondition}` : ''}`}
                locale={validLocale}
              >
                <Car className="h-4 w-4" />
                <span>{isArabic ? 'تصفح السيارات المعروضة' : 'View Marketplace Cars'}</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* Condition Tabs (New, Used, All) */}
        <section aria-label={isArabic ? 'تصفية حسب الحالة' : 'Filter by condition'}>
          <ConditionTabs
            makeSlug={matchingMake.slug}
            currentCondition={validCondition}
            locale={validLocale}
          />
        </section>

        {/* Models Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
        <section
          className="space-y-4"
          aria-label={isArabic ? `موديلات ${makeName}` : `${makeName} Models`}
        >
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2 font-bold text-base sm:text-lg text-foreground">
              <Tag className="h-4 w-4 text-primary shrink-0" />
              <h2>{isArabic ? `موديلات وفئات ${makeName}` : `${makeName} Models & Trims`}</h2>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {formatDigits(models.length, validLocale)} {isArabic ? 'موديل' : 'models'}
            </span>
          </div>

          {models.length > 0 ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              data-testid="models-grid"
            >
              {models.map((model) => (
                <ModelPriceCard
                  key={model.publicId || model.slug}
                  model={model}
                  makeSlug={matchingMake.slug}
                  condition={validCondition}
                  locale={validLocale}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-dashed bg-card/60 p-8 sm:p-12 text-center space-y-3"
              data-testid="models-empty-state"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Car className="h-6 w-6 opacity-60" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-bold text-base text-foreground">
                  {isArabic
                    ? `لا توجد موديلات متاحة حالياً لسيارات ${makeName} بهذه الحالة`
                    : `No ${makeName} models currently available for this condition`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? 'جرب اختيار حالة أخرى أو استعراض كافة الموديلات المتاحة.'
                    : 'Try selecting a different condition tab to view available models.'}
                </p>
              </div>

              {validCondition ? (
                <Button asChild variant="outline" size="sm" className="font-semibold">
                  <Link href={`/catalogue/makes/${matchingMake.slug}`} locale={validLocale}>
                    {isArabic ? 'عرض كافة الموديلات' : 'View all models'}
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </section>

        {/* Authorized Dealers Section (Graceful degradation if empty) */}
        {dealers.length > 0 ? (
          <section
            className="space-y-4 pt-6 border-t"
            aria-label={isArabic ? `معارض وتجار ${makeName}` : `${makeName} Dealers`}
            data-testid="make-dealers-section"
          >
            <div className="flex items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-2 font-bold text-base sm:text-lg text-foreground">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <h2>{isArabic ? `معارض توفر سيارات ${makeName}` : `Showrooms offering ${makeName}`}</h2>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {dealers.length} {isArabic ? 'معرض' : 'dealers'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dealers.map((dealer) => {
                const dealerName = dealer.displayName
                  ? isArabic
                    ? dealer.displayName.ar ?? dealer.displayName.en ?? dealer.slug
                    : dealer.displayName.en ?? dealer.displayName.ar ?? dealer.slug
                  : dealer.slug;

                return (
                  <Link
                    key={dealer.publicId}
                    href={`/dealers/${dealer.slug}`}
                    locale={validLocale}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs hover:border-primary/40 hover:shadow-md transition-all focus:outline-hidden focus:ring-2 focus:ring-primary"
                    data-testid={`make-dealer-card-${dealer.slug}`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted/40 p-1 flex items-center justify-center">
                      {dealer.logoUrl ? (
                        <Image
                          src={dealer.logoUrl}
                          alt={dealerName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-primary/60" />
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors" dir="auto">
                          {dealerName}
                        </span>
                        {dealer.isVerified ? (
                          <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                        ) : null}
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        {dealer.listingCount} {isArabic ? 'سيارة متاحة' : 'cars listed'}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
