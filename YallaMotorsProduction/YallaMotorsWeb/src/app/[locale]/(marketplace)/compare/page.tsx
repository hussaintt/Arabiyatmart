import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import type { Locale } from '@/types/common';
import { serverEnv } from '@/lib/env/server';
import type {
  CompareItemKind,
  CompareItemRef,
  ComparisonItem,
  ComparePageData,
} from '@/types/compare';
import {
  parseCompareUrlItems,
  ComparePageDataSchema,
} from '@/lib/api/schemas/compare';
import { getListingBatch } from '@/server/queries/listings';
import { getTrimBatch } from '@/server/queries/taxonomy';
import { formatMoneyFromCents, formatNumber } from '@/i18n/format';
import type { ListingCard } from '@/types/listing';
import type { Trim } from '@/types/taxonomy';
import { CompareEmpty } from '@/components/compare/compare-empty';
import { CompareTable, CompareStoreBridge } from '@/components/compare/compare-table';
import { ComparePicker } from '@/components/compare/compare-picker';

export const dynamic = 'force-dynamic';

interface ComparePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function normalizeCanonicalItems(rawItem: unknown): {
  canonicalItems: CompareItemRef[];
  mode: CompareItemKind | null;
  canonicalQuery: string;
} {
  const parsed = parseCompareUrlItems(rawItem);
  if (parsed.length === 0) {
    return { canonicalItems: [], mode: null, canonicalQuery: '' };
  }

  // Enforce one mode (determined by the first valid item)
  const mode = parsed[0]!.kind;
  const singleMode = parsed.filter((it) => it.kind === mode);

  // Deduplicate and cap at 3 selections
  const seen = new Set<string>();
  const canonicalItems: CompareItemRef[] = [];
  for (const item of singleMode) {
    const key = `${item.kind}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      canonicalItems.push(item);
    }
    if (canonicalItems.length >= 3) break;
  }

  const queryParams = new URLSearchParams();
  for (const it of canonicalItems) {
    queryParams.append('item', `${it.kind}:${it.id}`);
  }

  return {
    canonicalItems,
    mode,
    canonicalQuery: queryParams.toString(),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as Locale;

  const rawSearchParams = await searchParams;
  const { canonicalQuery } = normalizeCanonicalItems(rawSearchParams.item);

  const title = locale === 'ar' ? 'مقارنة السيارات | عربيات مارت' : 'Compare Vehicles | Arabiyat Mart';
  const description =
    locale === 'ar'
      ? 'قارن بين مواصفات وأسعار وميزات حتى 3 سيارات جنبًا إلى جنب.'
      : 'Compare specs, prices, and features of up to 3 vehicles side by side.';

  const canonical = canonicalQuery
    ? `${serverEnv.SITE_ORIGIN}/${locale}/compare?${canonicalQuery}`
    : `${serverEnv.SITE_ORIGIN}/${locale}/compare`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      title,
      description,
      url: canonical,
    },
  };
}

function projectListingToComparisonItem(listing: ListingCard, locale: Locale): ComparisonItem {
  const makeName = listing.makeName[locale] || listing.makeName.ar;
  const modelName = listing.modelName[locale] || listing.modelName.ar;
  const subtitle = `${makeName} ${modelName} ${listing.year}`;

  return {
    id: listing.publicId,
    title: listing.title,
    subtitle,
    detailRoute: `/${locale}/listing/${listing.slug}`,
    imageUrl: listing.coverImageUrl,
    priceCents: listing.priceCents,
    powerHp: null,
    warrantyYears: null,
    engineCc: null,
    mileageKm: listing.mileageKm,
    seats: null,
    transmission: listing.transmission,
    fuelType: listing.fuelType,
    bodyType: listing.bodyType,
  };
}

function projectTrimToComparisonItem(trim: Trim, locale: Locale): ComparisonItem {
  const trimName = trim.name[locale] || trim.name.ar;
  const subtitle = `${trim.modelYear}`;

  return {
    id: trim.publicId,
    title: trimName,
    subtitle,
    detailRoute: `/${locale}/catalogue/trims/${trim.publicId}`,
    imageUrl: null,
    priceCents: trim.officialPriceCents ?? trim.marketPriceCents,
    powerHp: trim.powerHp,
    warrantyYears: trim.warrantyYears,
    engineCc: trim.engineCc,
    mileageKm: null,
    seats: trim.seats,
    transmission: trim.transmission,
    fuelType: trim.fuelType,
    bodyType: null,
  };
}

function buildComparisonSpecRows(items: ComparisonItem[], locale: Locale) {
  const isAr = locale === 'ar';

  return [
    {
      label: isAr ? 'السعر' : 'Price',
      display: items.map((item) =>
        item.priceCents !== null
          ? formatMoneyFromCents(item.priceCents, 'EGP', locale)
          : '-'
      ),
      numeric: items.map((item) => item.priceCents),
      better: 'lower' as const,
    },
    {
      label: isAr ? 'سنة الصنع' : 'Year',
      display: items.map((item) => {
        const match = item.subtitle?.match(/\b(19\d\d|20\d\d)\b/);
        return match ? match[1]! : '-';
      }),
      numeric: items.map((item) => {
        const match = item.subtitle?.match(/\b(19\d\d|20\d\d)\b/);
        return match ? parseInt(match[1]!, 10) : null;
      }),
      better: 'higher' as const,
    },
    {
      label: isAr ? 'المسافة المقطوعة' : 'Mileage',
      display: items.map((item) =>
        item.mileageKm !== null
          ? `${formatNumber(item.mileageKm, locale)} ${isAr ? 'كم' : 'km'}`
          : '-'
      ),
      numeric: items.map((item) => item.mileageKm),
      better: 'lower' as const,
    },
    {
      label: isAr ? 'ناقل الحركة' : 'Transmission',
      display: items.map((item) => {
        if (!item.transmission) return '-';
        switch (item.transmission) {
          case 'AUTOMATIC':
            return isAr ? 'أوتوماتيك' : 'Automatic';
          case 'MANUAL':
            return isAr ? 'يدوي' : 'Manual';
          case 'CVT':
            return 'CVT';
          case 'DCT':
            return 'DCT';
          default:
            return item.transmission;
        }
      }),
      numeric: items.map(() => null),
      better: 'none' as const,
    },
    {
      label: isAr ? 'نوع الوقود' : 'Fuel Type',
      display: items.map((item) => {
        if (!item.fuelType) return '-';
        switch (item.fuelType) {
          case 'PETROL':
            return isAr ? 'بنزين' : 'Petrol';
          case 'DIESEL':
            return isAr ? 'ديزل' : 'Diesel';
          case 'HYBRID':
            return isAr ? 'هجين' : 'Hybrid';
          case 'ELECTRIC':
            return isAr ? 'كهربائي' : 'Electric';
          case 'GAS':
            return isAr ? 'غاز' : 'Gas';
          default:
            return item.fuelType;
        }
      }),
      numeric: items.map(() => null),
      better: 'none' as const,
    },
    {
      label: isAr ? 'سعة المحرك' : 'Engine Capacity',
      display: items.map((item) =>
        item.engineCc !== null
          ? `${formatNumber(item.engineCc, locale)} ${isAr ? 'سي سي' : 'cc'}`
          : '-'
      ),
      numeric: items.map((item) => item.engineCc),
      better: 'higher' as const,
    },
    {
      label: isAr ? 'القوة الحصانية' : 'Horsepower',
      display: items.map((item) =>
        item.powerHp !== null
          ? `${formatNumber(item.powerHp, locale)} ${isAr ? 'حصان' : 'hp'}`
          : '-'
      ),
      numeric: items.map((item) => item.powerHp),
      better: 'higher' as const,
    },
    {
      label: isAr ? 'نوع الهيكل' : 'Body Type',
      display: items.map((item) => {
        if (!item.bodyType) return '-';
        switch (item.bodyType) {
          case 'SEDAN':
            return isAr ? 'سيدان' : 'Sedan';
          case 'SUV':
            return 'SUV';
          case 'HATCHBACK':
            return isAr ? 'هاتشباك' : 'Hatchback';
          case 'CROSSOVER':
            return isAr ? 'كروس أوفر' : 'Crossover';
          case 'COUPE':
            return isAr ? 'كوبيه' : 'Coupe';
          case 'PICKUP':
            return isAr ? 'بيك أب' : 'Pickup';
          case 'VAN':
          case 'MINIVAN':
            return isAr ? 'فان' : 'Van';
          case 'CONVERTIBLE':
            return isAr ? 'كابريوليه' : 'Convertible';
          case 'WAGON':
            return isAr ? 'ستيشن' : 'Wagon';
          default:
            return item.bodyType;
        }
      }),
      numeric: items.map(() => null),
      better: 'none' as const,
    },
    {
      label: isAr ? 'الضمان' : 'Warranty',
      display: items.map((item) =>
        item.warrantyYears !== null
          ? `${item.warrantyYears} ${isAr ? 'سنوات' : 'years'}`
          : '-'
      ),
      numeric: items.map((item) => item.warrantyYears),
      better: 'higher' as const,
    },
    {
      label: isAr ? 'عدد المقاعد' : 'Seats',
      display: items.map((item) =>
        item.seats !== null ? `${item.seats}` : '-'
      ),
      numeric: items.map((item) => item.seats),
      better: 'none' as const,
    },
  ];
}

export default async function ComparePage({ params, searchParams }: ComparePageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const rawSearchParams = await searchParams;
  const { canonicalItems, mode, canonicalQuery } = normalizeCanonicalItems(
    rawSearchParams.item
  );

  const canonicalUrl = canonicalQuery
    ? `/${locale}/compare?${canonicalQuery}`
    : `/${locale}/compare`;

  const isAr = locale === 'ar';

  if (canonicalItems.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <CompareStoreBridge
          initialItems={[]}
          initialMode={null}
          canonicalUrl={canonicalUrl}
        />
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {isAr ? 'مقارنة السيارات' : 'Compare Vehicles'}
          </h1>
        </div>
        <CompareEmpty locale={locale} />
      </main>
    );
  }

  const comparisonItems: ComparisonItem[] = [];
  const unavailableItems: CompareItemRef[] = [];

  if (mode === 'listing') {
    const slugs = canonicalItems.map((it) => it.id);
    try {
      const response = await getListingBatch({ slugs }, locale);
      const bySlug = new Map(response.data.map((card) => [card.slug, card]));

      for (const itemRef of canonicalItems) {
        const found = bySlug.get(itemRef.id);
        if (found) {
          comparisonItems.push(projectListingToComparisonItem(found, locale));
        } else {
          unavailableItems.push(itemRef);
        }
      }
    } catch {
      // If batch fails entirely, mark all requested as unavailable
      unavailableItems.push(...canonicalItems);
    }
  } else if (mode === 'trim') {
    const publicIds = canonicalItems.map((it) => it.id);
    try {
      const response = await getTrimBatch({ publicIds }, locale);
      const byId = new Map(response.data.map((trim) => [trim.publicId, trim]));

      for (const itemRef of canonicalItems) {
        const found = byId.get(itemRef.id);
        if (found) {
          comparisonItems.push(projectTrimToComparisonItem(found, locale));
        } else {
          unavailableItems.push(itemRef);
        }
      }
    } catch {
      unavailableItems.push(...canonicalItems);
    }
  }

  const rows = buildComparisonSpecRows(comparisonItems, locale);
  const comparePageData: ComparePageData = {
    items: comparisonItems,
    rows,
  };

  // Validate data contract
  ComparePageDataSchema.parse(comparePageData);

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <CompareStoreBridge
        initialItems={canonicalItems}
        initialMode={mode}
        canonicalUrl={canonicalUrl}
      />

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAr ? 'مقارنة السيارات' : 'Compare Vehicles'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAr
              ? 'مقارنة المواصفات والأسعار جنبًا إلى جنب'
              : 'Side-by-side specifications and price comparison'}
          </p>
        </div>
      </div>

      {comparisonItems.length === 0 && unavailableItems.length === 0 ? (
        <CompareEmpty locale={locale} />
      ) : (
        <CompareTable
          data={comparePageData}
          requestedItems={canonicalItems}
          unavailableItems={unavailableItems}
          locale={locale}
        />
      )}

      <ComparePicker
        locale={locale}
        mode={mode}
        currentItems={canonicalItems}
      />
    </main>
  );
}
