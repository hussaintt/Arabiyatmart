import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChevronLeft, ChevronRight, Home, Car}  from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { ApiContractError, PublicIdSchema } from '@/lib/api/schemas/common';
import { getCatalogueModel } from '@/server/queries/catalogue';
import { ModelOverview } from '@/components/catalogue/model-overview';
import { TrimTable } from '@/components/catalogue/trim-table';
import { Button } from '@/components/ui/button';
import type { ModelPage } from '@/types/taxonomy';

export const revalidate = 3600;

interface CatalogueModelPageProps {
  params: Promise<{ locale: string; publicId: string }>;
}

export async function generateMetadata({
  params,
}: CatalogueModelPageProps): Promise<Metadata> {
  const { locale, publicId } = await params;
  const validLocale: AppLocale = isAppLocale(locale) ? locale : 'ar';
  const isArabic = validLocale === 'ar';

  const idParsed = PublicIdSchema.safeParse(publicId);
  if (!idParsed.success) {
    return {
      title: isArabic ? 'موديل سيارة | عربيات مارت' : 'Car Model | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const modelRes = await getCatalogueModel({ publicId: idParsed.data }, validLocale).catch(() => null);
  if (!modelRes) {
    return {
      title: isArabic ? 'موديل غير موجود | عربيات مارت' : 'Model Not Found | Arabiyatmart',
      robots: { index: false, follow: false },
    };
  }

  const model = modelRes.data;
  const makeName = model.make.name
    ? isArabic
      ? model.make.name.ar ?? model.make.name.en ?? model.make.slug
      : model.make.name.en ?? model.make.name.ar ?? model.make.slug
    : model.make.slug;

  const modelName = model.name
    ? isArabic
      ? model.name.ar ?? model.name.en ?? model.slug
      : model.name.en ?? model.name.ar ?? model.slug
    : model.slug;

  const title = isArabic
    ? `أسعار وفئات سيارات ${makeName} ${modelName} في مصر | عربيات مارت`
    : `${makeName} ${modelName} Trims & Prices in Egypt | Arabiyatmart`;

  const description = isArabic
    ? `اطلع على أحدث أسعار ومواصفات فئات ${makeName} ${modelName} في السوق المصري مع إمكانية مقارنة الفئات وتصفح السيارات المعروضة.`
    : `Discover latest prices, trim specifications, and marketplace availability for ${makeName} ${modelName} in Egypt.`;

  const canonical = `/${validLocale}/catalogue/models/${model.publicId}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: `/ar/catalogue/models/${model.publicId}`,
        en: `/en/catalogue/models/${model.publicId}`,
        'x-default': `/ar/catalogue/models/${model.publicId}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      type: 'website',
      images: [{ url: model.make.logoUrl ?? '/images/og-default.jpg', alt: `${makeName} ${modelName}` }],
    },
  };
}

export default async function CatalogueModelPage({
  params,
}: CatalogueModelPageProps) {
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

  let model: ModelPage;
  try {
    const modelRes = await getCatalogueModel({ publicId: idParsed.data }, validLocale);
    model = modelRes.data;
  } catch (error) {
    if (
      error instanceof ApiContractError &&
      (error.body.error.status === 404 || error.body.error.code === 'NOT_FOUND')
    ) {
      notFound();
    }
    throw error;
  }
  const makeName = model.make.name
    ? isArabic
      ? model.make.name.ar ?? model.make.name.en ?? model.make.slug
      : model.make.name.en ?? model.make.name.ar ?? model.make.slug
    : model.make.slug;

  const modelName = model.name
    ? isArabic
      ? model.name.ar ?? model.name.en ?? model.slug
      : model.name.en ?? model.name.ar ?? model.slug
    : model.slug;

  // JSON-LD BreadcrumbList & Product structured data
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
            item: `https://arabiyatmart.com/${validLocale}/catalogue/makes/${model.make.slug}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: modelName,
            item: `https://arabiyatmart.com/${validLocale}/catalogue/models/${model.publicId}`,
          },
        ],
      },
      {
        '@type': 'Product',
        name: `${makeName} ${modelName}`,
        category: 'Vehicle',
        url: `https://arabiyatmart.com/${validLocale}/catalogue/models/${model.publicId}`,
        ...(model.make.logoUrl ? { image: model.make.logoUrl } : {}),
        ...(model.startingPriceCents !== null && model.startingPriceCents > 0
          ? {
              offers: {
                '@type': 'AggregateOffer',
                priceCurrency: model.currency || 'EGP',
                lowPrice: (model.startingPriceCents / 100).toFixed(0),
              },
            }
          : {}),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Breadcrumbs & Product JSON-LD */}
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
            href={`/catalogue/makes/${model.make.slug}`}
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

          <span
            aria-current="page"
            className="font-semibold text-foreground truncate"
            dir="auto"
          >
            {modelName}
          </span>
        </nav>

        {/* Model Overview Section */}
        <ModelOverview
          model={model}
          locale={validLocale}
        />

        {/* Trims & Prices Section */}
        <section aria-label={isArabic ? 'فئات وأسعار الموديل' : 'Trims and pricing'}>
          <TrimTable
            trims={model.trims}
            locale={validLocale}
          />
        </section>

        {/* Related Marketplace Inventory CTA */}
        <section
          className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
          aria-label={isArabic ? 'سيارات معروضة للبيع' : 'Marketplace listings'}
        >
          <div className="space-y-1 text-center sm:text-start">
            <h3 className="font-bold text-base sm:text-lg text-foreground">
              {isArabic
                ? `هل تبحث عن سيارة ${makeName} ${modelName} للبيع؟`
                : `Looking for a ${makeName} ${modelName} for sale?`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isArabic
                ? 'تصفح السيارات الجديدة والمستعملة المعروضة للتسليم الفوري من التجار والأفراد.'
                : 'Browse available new and used cars ready for immediate delivery across Egypt.'}
            </p>
          </div>

          <Button asChild variant="default" size="default" className="font-semibold gap-2 shrink-0">
            <Link
              href={`/search?makeSlug=${model.make.slug}&modelSlug=${model.slug}`}
              locale={validLocale}
            >
              <Car className="h-4 w-4" />
              <span>{isArabic ? 'استعراض السيارات المعروضة' : 'Browse Inventory'}</span>
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
