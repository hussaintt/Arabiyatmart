import * as React from 'react';
import { Gauge, ShieldCheck, Users, Sparkles } from 'lucide-react';
import { formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { Trim } from '@/types/taxonomy';

export interface TrimSpecificationsProps {
  trim: Trim;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function TrimSpecifications({
  trim,
  locale = 'ar',
  className,
}: TrimSpecificationsProps) {
  const isArabic = locale === 'ar';

  // Group 1: Engine & Performance
  const engineSpecs: Array<{ label: { ar: string; en: string }; value: string | null }> = [
    {
      label: { ar: 'سعة المحرك', en: 'Engine Displacement' },
      value: trim.engineCc ? `${formatDigits(trim.engineCc, locale)} CC` : null,
    },
    {
      label: { ar: 'القوة الحصانية القصوى', en: 'Max Horsepower' },
      value: trim.powerHp ? `${formatDigits(trim.powerHp, locale)} ${isArabic ? 'حصان' : 'HP'}` : null,
    },
    {
      label: { ar: 'العزم الأقصى للدوران', en: 'Max Torque' },
      value: trim.torqueNm ? `${formatDigits(trim.torqueNm, locale)} ${isArabic ? 'نيوتن.متر' : 'Nm'}` : null,
    },
    {
      label: { ar: 'نوع الوقود المستخدم', en: 'Fuel Type' },
      value: trim.fuelType ?? null,
    },
    {
      label: { ar: 'نوع ناقل الحركة', en: 'Transmission Type' },
      value: trim.transmission ?? null,
    },
    {
      label: { ar: 'منظومة الدفع والجر', en: 'Drivetrain System' },
      value: trim.drivetrain ?? null,
    },
    {
      label: { ar: 'معدل استهلاك الوقود', en: 'Fuel Economy' },
      value: trim.fuelEconomyKmL ? `${formatDigits(trim.fuelEconomyKmL, locale)} ${isArabic ? 'كم/لتر' : 'km/L'}` : null,
    },
  ];

  // Group 2: Dimensions & Capacity
  const dimensionSpecs: Array<{ label: { ar: string; en: string }; value: string | null }> = [
    {
      label: { ar: 'عدد المقاعد والركاب', en: 'Seating Capacity' },
      value: trim.seats ? `${formatDigits(trim.seats, locale)} ${isArabic ? 'مقاعد' : 'Seats'}` : null,
    },
    {
      label: { ar: 'سنة الموديل وتاريخ الإصدار', en: 'Model Release Year' },
      value: trim.modelYear ? formatDigits(trim.modelYear, locale) : null,
    },
  ];

  // Group 3: Warranty
  const warrantySpecs: Array<{ label: { ar: string; en: string }; value: string | null }> = [
    {
      label: { ar: 'مدة الضمان المعتمد (سنوات)', en: 'Warranty Duration (Years)' },
      value: trim.warrantyYears ? `${formatDigits(trim.warrantyYears, locale)} ${isArabic ? 'سنوات' : 'Years'}` : null,
    },
    {
      label: { ar: 'مسافة الضمان المعتمد (كيلومتر)', en: 'Warranty Mileage (KM)' },
      value: trim.warrantyKm ? `${formatDigits(trim.warrantyKm, locale)} ${isArabic ? 'كم' : 'KM'}` : null,
    },
  ];

  // Group 4: Additional raw specs from JSON
  const additionalSpecs: Array<{ label: string; value: string }> = [];
  if (trim.specs && typeof trim.specs === 'object' && !Array.isArray(trim.specs)) {
    for (const [key, val] of Object.entries(trim.specs)) {
      if (val !== null && val !== undefined && val !== '') {
        const displayKey = key.replace(/_/g, ' ');
        const displayVal = typeof val === 'boolean'
          ? val ? (isArabic ? 'نعم' : 'Yes') : (isArabic ? 'لا' : 'No')
          : String(val);
        additionalSpecs.push({ label: displayKey, value: displayVal });
      }
    }
  }

  const renderSpecList = (
    specs: Array<{ label: { ar: string; en: string } | string; value: string | null }>,
    testId: string
  ) => {
    const validSpecs = specs.filter((s) => s.value !== null);
    if (validSpecs.length === 0) return null;

    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs" data-testid={testId}>
        {validSpecs.map((spec, index) => {
          const labelText = typeof spec.label === 'string'
            ? spec.label
            : isArabic ? spec.label.ar : spec.label.en;

          return (
            <div
              key={index}
              className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/50 min-w-0"
            >
              <dt className="text-muted-foreground font-medium truncate shrink-0 max-w-[65%]" dir="auto">
                {labelText}
              </dt>
              <dd className="font-bold text-foreground truncate text-end break-all" dir="auto">
                {spec.value}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  };

  return (
    <div className={cn('space-y-6', className)} data-testid="trim-specifications">
      {/* Engine & Performance */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-foreground border-b pb-3">
          <Gauge className="h-4 w-4 text-primary shrink-0" />
          <h2>{isArabic ? 'المحرك والأداء ومنظومة الحركة' : 'Engine, Performance & Drivetrain'}</h2>
        </div>
        {renderSpecList(engineSpecs, 'specs-engine')}
      </section>

      {/* Dimensions & Capacity */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-foreground border-b pb-3">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <h2>{isArabic ? 'السعة والأبعاد وسنة الإصدار' : 'Capacity & Release Year'}</h2>
        </div>
        {renderSpecList(dimensionSpecs, 'specs-dimensions')}
      </section>

      {/* Warranty & Guarantee */}
      {warrantySpecs.some((s) => s.value !== null) ? (
        <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-foreground border-b pb-3">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <h2>{isArabic ? 'شروط وضمان الوكيل الرسمي' : 'Official Warranty & Coverage'}</h2>
          </div>
          {renderSpecList(warrantySpecs, 'specs-warranty')}
        </section>
      ) : null}

      {/* Additional Features / Equipment */}
      {additionalSpecs.length > 0 ? (
        <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-foreground border-b pb-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <h2>{isArabic ? 'المواصفات والتجهيزات الإضافية' : 'Additional Equipment & Options'}</h2>
          </div>
          {renderSpecList(additionalSpecs, 'specs-additional')}
        </section>
      ) : null}
    </div>
  );
}
