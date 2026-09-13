'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ParsedSearchParams } from '@/lib/search/params';
import type { City, Make, VehicleModel } from '@/types/taxonomy';
import { ALLOWED_BOOLEAN_FILTER_KEYS } from '@/lib/search/defaults';

export interface ActiveFiltersProps {
  params: ParsedSearchParams;
  onRemoveFilter: (key: keyof ParsedSearchParams) => void;
  onClearAll: () => void;
  makes?: Make[] | undefined;
  models?: VehicleModel[] | undefined;
  cities?: City[] | undefined;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

interface FilterChip {
  key: keyof ParsedSearchParams;
  label: string;
}

export function ActiveFilters({
  params,
  onRemoveFilter,
  onClearAll,
  makes = [],
  models = [],
  cities = [],
  locale = 'ar',
  className,
}: ActiveFiltersProps) {
  const isArabic = locale === 'ar';

  const chips: FilterChip[] = [];

  // 1. Keyword search (q)
  if (params.q) {
    chips.push({
      key: 'q',
      label: isArabic ? `بحث: "${params.q}"` : `Keyword: "${params.q}"`,
    });
  }

  // 2. Condition
  if (params.condition) {
    chips.push({
      key: 'condition',
      label:
        params.condition === 'NEW'
          ? isArabic
            ? 'جديد (زيرو)'
            : 'New'
          : isArabic
          ? 'مستعمل'
          : 'Used',
    });
  }

  // 3. Make
  if (params.makeSlug) {
    const make = makes.find((m) => m.slug === params.makeSlug);
    const makeName = make
      ? isArabic
        ? make.name.ar
        : make.name.en
      : params.makeSlug;
    chips.push({
      key: 'makeSlug',
      label: isArabic ? `الماركة: ${makeName}` : `Make: ${makeName}`,
    });
  }

  // 4. Model
  if (params.modelSlug) {
    const model = models.find((m) => m.slug === params.modelSlug);
    const modelName = model
      ? isArabic
        ? model.name.ar
        : model.name.en
      : params.modelSlug;
    chips.push({
      key: 'modelSlug',
      label: isArabic ? `الموديل: ${modelName}` : `Model: ${modelName}`,
    });
  }

  // 5. Price range
  if (params.priceMin !== undefined && params.priceMax !== undefined) {
    const minP = Math.round(params.priceMin / 100).toLocaleString(
      isArabic ? 'ar-EG' : 'en-US'
    );
    const maxP = Math.round(params.priceMax / 100).toLocaleString(
      isArabic ? 'ar-EG' : 'en-US'
    );
    chips.push({
      key: 'priceMin',
      label: isArabic
        ? `السعر: ${minP} - ${maxP} ج.م`
        : `Price: ${minP} - ${maxP} EGP`,
    });
  } else if (params.priceMin !== undefined) {
    const minP = Math.round(params.priceMin / 100).toLocaleString(
      isArabic ? 'ar-EG' : 'en-US'
    );
    chips.push({
      key: 'priceMin',
      label: isArabic ? `من ${minP} ج.م` : `From ${minP} EGP`,
    });
  } else if (params.priceMax !== undefined) {
    const maxP = Math.round(params.priceMax / 100).toLocaleString(
      isArabic ? 'ar-EG' : 'en-US'
    );
    chips.push({
      key: 'priceMax',
      label: isArabic ? `حتى ${maxP} ج.م` : `Up to ${maxP} EGP`,
    });
  }

  // 6. Year range
  if (params.yearMin !== undefined && params.yearMax !== undefined) {
    chips.push({
      key: 'yearMin',
      label: isArabic
        ? `السنة: ${params.yearMin} - ${params.yearMax}`
        : `Year: ${params.yearMin} - ${params.yearMax}`,
    });
  } else if (params.yearMin !== undefined) {
    chips.push({
      key: 'yearMin',
      label: isArabic ? `من سنة ${params.yearMin}` : `From ${params.yearMin}`,
    });
  } else if (params.yearMax !== undefined) {
    chips.push({
      key: 'yearMax',
      label: isArabic ? `حتى سنة ${params.yearMax}` : `Up to ${params.yearMax}`,
    });
  }

  // 7. Mileage
  if (params.mileageMax !== undefined) {
    const km = params.mileageMax.toLocaleString(isArabic ? 'ar-EG' : 'en-US');
    chips.push({
      key: 'mileageMax',
      label: isArabic ? `أقصى مسافة: ${km} كم` : `Max mileage: ${km} km`,
    });
  }

  // 8. City
  if (params.cityId !== undefined) {
    const city = cities.find((c) => c.id === params.cityId);
    const cityName = city
      ? isArabic
        ? city.name.ar
        : city.name.en
      : String(params.cityId);
    chips.push({
      key: 'cityId',
      label: isArabic ? `المحافظة: ${cityName}` : `City: ${cityName}`,
    });
  }

  // 9. Transmission
  if (params.transmission) {
    const transMap: Record<string, { ar: string; en: string }> = {
      MANUAL: { ar: 'يدوي (مانيوال)', en: 'Manual' },
      AUTOMATIC: { ar: 'أوتوماتيك', en: 'Automatic' },
      CVT: { ar: 'CVT', en: 'CVT' },
      DCT: { ar: 'ثنائي التعشيق (DCT)', en: 'Dual Clutch (DCT)' },
    };
    const tLabel = transMap[params.transmission]?.[locale] ?? params.transmission;
    chips.push({
      key: 'transmission',
      label: isArabic ? `الناقل: ${tLabel}` : `Transmission: ${tLabel}`,
    });
  }

  // 10. Fuel type
  if (params.fuelType) {
    const fuelMap: Record<string, { ar: string; en: string }> = {
      PETROL: { ar: 'بنزين', en: 'Petrol' },
      DIESEL: { ar: 'ديزل / سولار', en: 'Diesel' },
      HYBRID: { ar: 'هجين (هايبرد)', en: 'Hybrid' },
      ELECTRIC: { ar: 'كهرباء', en: 'Electric' },
      GAS: { ar: 'غاز طبيعي', en: 'Natural Gas' },
    };
    const fLabel = fuelMap[params.fuelType]?.[locale] ?? params.fuelType;
    chips.push({
      key: 'fuelType',
      label: isArabic ? `الوقود: ${fLabel}` : `Fuel: ${fLabel}`,
    });
  }

  // 11. Body type
  if (params.bodyType) {
    chips.push({
      key: 'bodyType',
      label: isArabic ? `الهيكل: ${params.bodyType}` : `Body: ${params.bodyType}`,
    });
  }

  // 12. Seller type
  if (params.sellerType) {
    chips.push({
      key: 'sellerType',
      label:
        params.sellerType === 'DEALER'
          ? isArabic
            ? 'معرض سيارات'
            : 'Dealership'
          : isArabic
          ? 'بائع فردي'
          : 'Private Seller',
    });
  }

  // 13. Booleans
  const boolLabels: Record<string, { ar: string; en: string }> = {
    isVerified: { ar: 'تم التحقق منها', en: 'Verified' },
    hasWarranty: { ar: 'تحت الضمان', en: 'Under Warranty' },
    installmentAvailable: { ar: 'تقسيط متاح', en: 'Installment Available' },
    isNegotiable: { ar: 'قابل للتفاوض', en: 'Negotiable' },
    exchangeAccepted: { ar: 'إمكانية البدل', en: 'Exchange Accepted' },
  };

  for (const boolKey of ALLOWED_BOOLEAN_FILTER_KEYS) {
    if (params[boolKey]) {
      chips.push({
        key: boolKey,
        label: boolLabels[boolKey]?.[locale] ?? boolKey,
      });
    }
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 py-2 min-w-0', className)}
      data-testid="active-filters"
      role="region"
      aria-label={isArabic ? 'الفلاتر النشطة' : 'Active filters'}
    >
      <span className="text-xs font-semibold text-muted-foreground me-1">
        {isArabic ? 'الفلاتر المطبقة:' : 'Applied:'}
      </span>

      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="flex items-center gap-1 ps-2.5 pe-1.5 py-1 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemoveFilter(chip.key)}
            aria-label={
              isArabic
                ? `إزالة الفلتر: ${chip.label}`
                : `Remove filter: ${chip.label}`
            }
            className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 font-bold"
      >
        {isArabic ? 'مسح الكل' : 'Clear all'}
      </Button>
    </div>
  );
}
