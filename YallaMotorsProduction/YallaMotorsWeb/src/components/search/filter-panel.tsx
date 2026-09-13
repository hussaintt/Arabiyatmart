'use client';

import * as React from 'react';
import { Search, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ParsedSearchParams } from '@/lib/search/params';
import type {
  Area,
  City,
  Make,
  VehicleModel,
} from '@/types/taxonomy';
import type {
  BodyType,
  CarCondition,
  FuelType,
  SellerType,
  Transmission,
} from '@/types/listing';
import {
  ALLOWED_BODY_TYPES,
  ALLOWED_FUEL_TYPES,
  ALLOWED_SELLER_TYPES,
  ALLOWED_TRANSMISSIONS,
  YEAR_MAX_BOUND,
  YEAR_MIN_BOUND,
} from '@/lib/search/defaults';
import { fetchAreas, fetchModels } from '@/lib/search/options';

export interface FilterPanelProps {
  values: ParsedSearchParams;
  onChange: (changes: Partial<ParsedSearchParams>) => void;
  makes?: Make[] | undefined;
  models?: VehicleModel[] | undefined;
  cities?: City[] | undefined;
  locale?: AppLocale | undefined;
  className?: string | undefined;
  isMobile?: boolean | undefined;
}

export function FilterPanel({
  values,
  onChange,
  makes = [],
  models: initialModels = [],
  cities = [],
  locale = 'ar',
  className,
  isMobile = false,
}: FilterPanelProps) {
  const isArabic = locale === 'ar';

  // Dynamic models based on selected make
  const [models, setModels] = React.useState<VehicleModel[]>(initialModels);
  const [isLoadingModels, setIsLoadingModels] = React.useState(false);

  React.useEffect(() => {
    if (initialModels.length > 0) {
      setModels(initialModels);
    }
  }, [initialModels]);

  // Dynamic areas based on selected city
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = React.useState(false);

  // Free text query local state
  const [keywordInput, setKeywordInput] = React.useState(values.q ?? '');

  React.useEffect(() => {
    setKeywordInput(values.q ?? '');
  }, [values.q]);

  // Load models when makeSlug changes
  React.useEffect(() => {
    if (!values.makeSlug) {
      setModels([]);
      return;
    }

    const controller = new AbortController();
    setIsLoadingModels(true);

    fetchModels(values.makeSlug, { signal: controller.signal })
      .then((loadedModels) => {
        setModels(loadedModels);
        setIsLoadingModels(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setModels([]);
          setIsLoadingModels(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [values.makeSlug]);

  // Load areas when cityId changes
  React.useEffect(() => {
    if (!values.cityId) {
      setAreas([]);
      return;
    }

    const controller = new AbortController();
    setIsLoadingAreas(true);

    fetchAreas(values.cityId, { signal: controller.signal })
      .then((loadedAreas) => {
        setAreas(loadedAreas);
        setIsLoadingAreas(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAreas([]);
          setIsLoadingAreas(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [values.cityId]);

  // Year options list (descending from current/max to min bound)
  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = React.useMemo(() => {
    const list: number[] = [];
    const maxYear = Math.min(currentYear + 1, YEAR_MAX_BOUND);
    for (let y = maxYear; y >= YEAR_MIN_BOUND; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Price conversion (cents <-> EGP)
  const [priceMinInput, setPriceMinInput] = React.useState(
    values.priceMin !== undefined ? String(Math.round(values.priceMin / 100)) : ''
  );
  const [priceMaxInput, setPriceMaxInput] = React.useState(
    values.priceMax !== undefined ? String(Math.round(values.priceMax / 100)) : ''
  );

  React.useEffect(() => {
    setPriceMinInput(
      values.priceMin !== undefined ? String(Math.round(values.priceMin / 100)) : ''
    );
    setPriceMaxInput(
      values.priceMax !== undefined ? String(Math.round(values.priceMax / 100)) : ''
    );
  }, [values.priceMin, values.priceMax]);

  const handlePriceCommit = () => {
    const minVal = priceMinInput.trim() ? Number(priceMinInput.trim()) : undefined;
    const maxVal = priceMaxInput.trim() ? Number(priceMaxInput.trim()) : undefined;

    const minCents = minVal !== undefined && !isNaN(minVal) && minVal >= 0
      ? Math.round(minVal * 100)
      : undefined;
    const maxCents = maxVal !== undefined && !isNaN(maxVal) && maxVal >= 0
      ? Math.round(maxVal * 100)
      : undefined;

    onChange({
      priceMin: minCents,
      priceMax: maxCents,
    });
  };

  return (
    <div
      className={cn('space-y-6 min-w-0 text-start', className)}
      data-testid="filter-panel"
    >
      {/* Panel Header */}
      {!isMobile && (
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {isArabic ? 'تصفية النتائج' : 'Filter Results'}
            </h2>
          </div>
        </div>
      )}

      {/* 1. Keyword Search */}
      <div className="space-y-2">
        <Label htmlFor="filter-q-input" className="text-xs font-bold text-foreground">
          {isArabic ? 'كلمات البحث' : 'Keyword'}
        </Label>
        <div className="relative">
          <Input
            id="filter-q-input"
            type="search"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const trimmed = keywordInput.trim();
                onChange({ q: trimmed.length >= 2 ? trimmed : undefined });
              }
            }}
            onBlur={() => {
              const trimmed = keywordInput.trim();
              onChange({ q: trimmed.length >= 2 ? trimmed : undefined });
            }}
            placeholder={isArabic ? 'ماركة، موديل، مواصفات...' : 'Make, model, specs...'}
            className="h-10 text-xs sm:text-sm ps-3 pe-9"
          />
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <Separator />

      {/* 2. Condition Toggle */}
      <div className="space-y-2">
        <Label className="text-xs font-bold text-foreground">
          {isArabic ? 'حالة السيارة' : 'Condition'}
        </Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChange({ condition: undefined })}
            className={cn(
              'rounded-md py-1.5 transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              values.condition === undefined
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isArabic ? 'الكل' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => onChange({ condition: 'USED' as CarCondition })}
            className={cn(
              'rounded-md py-1.5 transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              values.condition === 'USED'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isArabic ? 'مستعمل' : 'Used'}
          </button>
          <button
            type="button"
            onClick={() => onChange({ condition: 'NEW' as CarCondition })}
            className={cn(
              'rounded-md py-1.5 transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              values.condition === 'NEW'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isArabic ? 'جديد (زيرو)' : 'New'}
          </button>
        </div>
      </div>

      <Separator />

      {/* 3. Make & Model */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-make-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'الماركة' : 'Make'}
          </Label>
          <div className="relative">
            <select
              id="filter-make-select"
              aria-label={isArabic ? 'الماركة' : 'Make'}
              value={values.makeSlug ?? ''}
              onChange={(e) => {
                const makeSlug = e.target.value || undefined;
                onChange({ makeSlug, modelSlug: undefined });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none text-start"
            >
              <option value="">{isArabic ? 'جميع الماركات' : 'All Makes'}</option>
              {makes.map((make) => (
                <option key={make.slug} value={make.slug}>
                  {isArabic ? make.name.ar : make.name.en}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Model select (dependent on make) */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-model-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'الموديل' : 'Model'}
          </Label>
          <div className="relative">
            <select
              id="filter-model-select"
              aria-label={isArabic ? 'الموديل' : 'Model'}
              value={values.modelSlug ?? ''}
              disabled={!values.makeSlug || isLoadingModels}
              onChange={(e) => {
                const modelSlug = e.target.value || undefined;
                onChange({ modelSlug });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer appearance-none text-start"
            >
              <option value="">
                {isLoadingModels
                  ? isArabic
                    ? 'جاري التحميل...'
                    : 'Loading models...'
                  : !values.makeSlug
                  ? isArabic
                    ? 'اختر الماركة أولاً'
                    : 'Select make first'
                  : isArabic
                  ? 'جميع الموديلات'
                  : 'All Models'}
              </option>
              {models.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {isArabic ? model.name.ar : model.name.en}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Separator />

      {/* 4. Price Range */}
      <div className="space-y-2">
        <Label className="text-xs font-bold text-foreground">
          {isArabic ? 'نطاق السعر (جنيه مصري)' : 'Price Range (EGP)'}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Input
              type="number"
              min={0}
              placeholder={isArabic ? 'الحد الأدنى' : 'Min Price'}
              value={priceMinInput}
              onChange={(e) => setPriceMinInput(e.target.value)}
              onBlur={handlePriceCommit}
              onKeyDown={(e) => e.key === 'Enter' && handlePriceCommit()}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <Input
              type="number"
              min={0}
              placeholder={isArabic ? 'الحد الأقصى' : 'Max Price'}
              value={priceMaxInput}
              onChange={(e) => setPriceMaxInput(e.target.value)}
              onBlur={handlePriceCommit}
              onKeyDown={(e) => e.key === 'Enter' && handlePriceCommit()}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* 5. Year Range */}
      <div className="space-y-2">
        <Label className="text-xs font-bold text-foreground">
          {isArabic ? 'سنة الصنع' : 'Year Range'}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              aria-label={isArabic ? 'سنة الصنع من' : 'Year from'}
              value={values.yearMin ?? ''}
              onChange={(e) => {
                const yearMin = e.target.value ? Number(e.target.value) : undefined;
                onChange({ yearMin });
              }}
              className="h-9 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'من سنة' : 'From'}</option>
              {yearOptions.map((year) => (
                <option key={`ymin-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <div className="relative">
            <select
              aria-label={isArabic ? 'سنة الصنع إلى' : 'Year to'}
              value={values.yearMax ?? ''}
              onChange={(e) => {
                const yearMax = e.target.value ? Number(e.target.value) : undefined;
                onChange({ yearMax });
              }}
              className="h-9 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'إلى سنة' : 'To'}</option>
              {yearOptions.map((year) => (
                <option key={`ymax-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Separator />

      {/* 6. Mileage Max */}
      <div className="space-y-1.5">
        <Label htmlFor="filter-mileage-select" className="text-xs font-bold text-foreground">
          {isArabic ? 'أقصى مسافة مقطوعة (كم)' : 'Max Mileage (km)'}
        </Label>
        <div className="relative">
          <select
            id="filter-mileage-select"
            aria-label={isArabic ? 'أقصى مسافة مقطوعة' : 'Max mileage'}
            value={values.mileageMax ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onChange({ mileageMax: val });
            }}
            className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
          >
            <option value="">{isArabic ? 'أي مسافة' : 'Any Mileage'}</option>
            <option value="10000">10,000 كم</option>
            <option value="30000">30,000 كم</option>
            <option value="50000">50,000 كم</option>
            <option value="80000">80,000 كم</option>
            <option value="100000">100,000 كم</option>
            <option value="150000">150,000 كم</option>
            <option value="200000">200,000 كم</option>
          </select>
          <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <Separator />

      {/* 7. Location (City & Area) */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-city-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'المحافظة' : 'City / Governorate'}
          </Label>
          <div className="relative">
            <select
              id="filter-city-select"
              aria-label={isArabic ? 'المحافظة' : 'City'}
              value={values.cityId ?? ''}
              onChange={(e) => {
                const cityId = e.target.value ? Number(e.target.value) : undefined;
                onChange({ cityId, areaId: undefined });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'جميع المحافظات' : 'All Cities'}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {isArabic ? city.name.ar : city.name.en}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Area Select */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-area-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'المنطقة' : 'Area'}
          </Label>
          <div className="relative">
            <select
              id="filter-area-select"
              aria-label={isArabic ? 'المنطقة' : 'Area'}
              value={values.areaId ?? ''}
              disabled={!values.cityId || isLoadingAreas}
              onChange={(e) => {
                const areaId = e.target.value ? Number(e.target.value) : undefined;
                onChange({ areaId });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer text-start"
            >
              <option value="">
                {isLoadingAreas
                  ? isArabic
                    ? 'جاري التحميل...'
                    : 'Loading areas...'
                  : !values.cityId
                  ? isArabic
                    ? 'اختر المحافظة أولاً'
                    : 'Select city first'
                  : isArabic
                  ? 'جميع المناطق'
                  : 'All Areas'}
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {isArabic ? area.name.ar : area.name.en}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Separator />

      {/* 8. Transmission & Fuel Type */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-trans-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'ناقل الحركة' : 'Transmission'}
          </Label>
          <div className="relative">
            <select
              id="filter-trans-select"
              aria-label={isArabic ? 'ناقل الحركة' : 'Transmission'}
              value={values.transmission ?? ''}
              onChange={(e) => {
                const transmission = (e.target.value || undefined) as Transmission | undefined;
                onChange({ transmission });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'الكل' : 'All'}</option>
              {ALLOWED_TRANSMISSIONS.map((t) => (
                <option key={t} value={t}>
                  {t === 'MANUAL'
                    ? isArabic
                      ? 'يدوي (مانيوال)'
                      : 'Manual'
                    : t === 'AUTOMATIC'
                    ? isArabic
                      ? 'أوتوماتيك'
                      : 'Automatic'
                    : t}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-fuel-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'نوع الوقود' : 'Fuel Type'}
          </Label>
          <div className="relative">
            <select
              id="filter-fuel-select"
              aria-label={isArabic ? 'نوع الوقود' : 'Fuel Type'}
              value={values.fuelType ?? ''}
              onChange={(e) => {
                const fuelType = (e.target.value || undefined) as FuelType | undefined;
                onChange({ fuelType });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'الكل' : 'All'}</option>
              {ALLOWED_FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f === 'PETROL'
                    ? isArabic
                      ? 'بنزين'
                      : 'Petrol'
                    : f === 'DIESEL'
                    ? isArabic
                      ? 'ديزل / سولار'
                      : 'Diesel'
                    : f === 'HYBRID'
                    ? isArabic
                      ? 'هجين (هايبرد)'
                      : 'Hybrid'
                    : f === 'ELECTRIC'
                    ? isArabic
                      ? 'كهرباء'
                      : 'Electric'
                    : f === 'GAS'
                    ? isArabic
                      ? 'غاز طبيعي'
                      : 'Natural Gas'
                    : f}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Separator />

      {/* 9. Body Type & Seller Type */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-body-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'نوع الهيكل' : 'Body Type'}
          </Label>
          <div className="relative">
            <select
              id="filter-body-select"
              aria-label={isArabic ? 'نوع الهيكل' : 'Body Type'}
              value={values.bodyType ?? ''}
              onChange={(e) => {
                const bodyType = (e.target.value || undefined) as BodyType | undefined;
                onChange({ bodyType });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'جميع الأنواع' : 'All Body Types'}</option>
              {ALLOWED_BODY_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-seller-select" className="text-xs font-bold text-foreground">
            {isArabic ? 'نوع البائع' : 'Seller Type'}
          </Label>
          <div className="relative">
            <select
              id="filter-seller-select"
              aria-label={isArabic ? 'نوع البائع' : 'Seller Type'}
              value={values.sellerType ?? ''}
              onChange={(e) => {
                const sellerType = (e.target.value || undefined) as SellerType | undefined;
                onChange({ sellerType });
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-start"
            >
              <option value="">{isArabic ? 'الكل' : 'All'}</option>
              {ALLOWED_SELLER_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s === 'DEALER'
                    ? isArabic
                      ? 'معرض سيارات'
                      : 'Dealer'
                    : isArabic
                    ? 'بائع فردي'
                    : 'Private Seller'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Separator />

      {/* 10. Additional Options & Verification */}
      <div className="space-y-3">
        <Label className="text-xs font-bold text-foreground">
          {isArabic ? 'خيارات إضافية' : 'Additional Options'}
        </Label>

        {/* isVerified */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-verified-checkbox"
            checked={values.isVerified ?? false}
            onCheckedChange={(checked) =>
              onChange({ isVerified: checked === true ? true : undefined })
            }
          />
          <label
            htmlFor="filter-verified-checkbox"
            className="text-xs font-medium text-foreground cursor-pointer"
          >
            {isArabic ? 'إعلانات معتمدة ومفحوصة فقط' : 'Verified Listings Only'}
          </label>
        </div>

        {/* hasWarranty */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-warranty-checkbox"
            checked={values.hasWarranty ?? false}
            onCheckedChange={(checked) =>
              onChange({ hasWarranty: checked === true ? true : undefined })
            }
          />
          <label
            htmlFor="filter-warranty-checkbox"
            className="text-xs font-medium text-foreground cursor-pointer"
          >
            {isArabic ? 'سارية تحت الضمان' : 'Under Warranty'}
          </label>
        </div>

        {/* installmentAvailable */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-installment-checkbox"
            checked={values.installmentAvailable ?? false}
            onCheckedChange={(checked) =>
              onChange({ installmentAvailable: checked === true ? true : undefined })
            }
          />
          <label
            htmlFor="filter-installment-checkbox"
            className="text-xs font-medium text-foreground cursor-pointer"
          >
            {isArabic ? 'إمكانية التقسيط متاحة' : 'Installment Available'}
          </label>
        </div>

        {/* isNegotiable */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-negotiable-checkbox"
            checked={values.isNegotiable ?? false}
            onCheckedChange={(checked) =>
              onChange({ isNegotiable: checked === true ? true : undefined })
            }
          />
          <label
            htmlFor="filter-negotiable-checkbox"
            className="text-xs font-medium text-foreground cursor-pointer"
          >
            {isArabic ? 'السعر قابل للتفاوض' : 'Negotiable Price'}
          </label>
        </div>

        {/* exchangeAccepted */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-exchange-checkbox"
            checked={values.exchangeAccepted ?? false}
            onCheckedChange={(checked) =>
              onChange({ exchangeAccepted: checked === true ? true : undefined })
            }
          />
          <label
            htmlFor="filter-exchange-checkbox"
            className="text-xs font-medium text-foreground cursor-pointer"
          >
            {isArabic ? 'إمكانية البدل مقبولة' : 'Exchange Accepted'}
          </label>
        </div>
      </div>
    </div>
  );
}
