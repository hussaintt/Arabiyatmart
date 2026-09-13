import * as React from 'react';
import {
  CheckCircle2,
  Gauge,
  Sparkles,
  Shield,
  Car,
} from 'lucide-react';
import { formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ListingDetail, ListingImage } from '@/types/listing';

export interface SpecificationGroupsProps {
  readonly listing:
    | ListingDetail
    | (Omit<ListingDetail, 'features' | 'images'> & {
        readonly features?: readonly string[] | null | undefined;
        readonly images?: readonly ListingImage[] | undefined;
      });
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

interface SpecItem {
  readonly label: string;
  readonly value: string;
}

interface SpecGroup {
  readonly id: string;
  readonly title: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly items: readonly SpecItem[];
}

const DRIVETRAIN_LABELS: Record<string, { ar: string; en: string }> = {
  FWD: { ar: 'دفع أمامي (FWD)', en: 'Front-Wheel Drive (FWD)' },
  RWD: { ar: 'دفع خلفي (RWD)', en: 'Rear-Wheel Drive (RWD)' },
  AWD: { ar: 'دفع كلي / رباعي (AWD)', en: 'All-Wheel Drive (AWD)' },
};

const TRANSMISSION_LABELS: Record<string, { ar: string; en: string }> = {
  AUTOMATIC: { ar: 'أوتوماتيك', en: 'Automatic' },
  MANUAL: { ar: 'يدوي', en: 'Manual' },
  CVT: { ar: 'سي في تي (CVT)', en: 'CVT' },
  DCT: { ar: 'دي سي تي (DCT)', en: 'DCT' },
};

const FUEL_LABELS: Record<string, { ar: string; en: string }> = {
  PETROL: { ar: 'بنزين', en: 'Petrol' },
  DIESEL: { ar: 'ديزل', en: 'Diesel' },
  HYBRID: { ar: 'هايبرد (هجين)', en: 'Hybrid' },
  ELECTRIC: { ar: 'كهربائي', en: 'Electric' },
  GAS: { ar: 'غاز طبيعي', en: 'Gas' },
};

const BODY_LABELS: Record<string, { ar: string; en: string }> = {
  SEDAN: { ar: 'سيدان', en: 'Sedan' },
  HATCHBACK: { ar: 'هاتشباك', en: 'Hatchback' },
  SUV: { ar: 'دفع رباعي (SUV)', en: 'SUV' },
  CROSSOVER: { ar: 'كروس أوفر', en: 'Crossover' },
  COUPE: { ar: 'كوبيه', en: 'Coupe' },
  PICKUP: { ar: 'بيك أب', en: 'Pickup' },
  VAN: { ar: 'فان', en: 'Van' },
  MINIVAN: { ar: 'ميني فان', en: 'Minivan' },
  CONVERTIBLE: { ar: 'كابريوليه', en: 'Convertible' },
  WAGON: { ar: 'ستيشن واجن', en: 'Wagon' },
};

const CONDITION_GRADE_LABELS: Record<string, { ar: string; en: string }> = {
  EXCELLENT: { ar: 'ممتازة', en: 'Excellent' },
  VERY_GOOD: { ar: 'جيدة جداً', en: 'Very Good' },
  GOOD: { ar: 'جيدة', en: 'Good' },
  FAIR: { ar: 'مقبولة', en: 'Fair' },
  NEEDS_WORK: { ar: 'تحتاج صيانة', en: 'Needs Work' },
};

export function SpecificationGroups({
  listing,
  locale = 'ar',
  className,
}: SpecificationGroupsProps) {
  const isArabic = locale === 'ar';

  const groups: readonly SpecGroup[] = React.useMemo(() => {
    const list: SpecGroup[] = [];

    // Group 1: Engine & Performance
    const engineItems: SpecItem[] = [];
    if (listing.engineCc) {
      engineItems.push({
        label: isArabic ? 'سعة المحرك' : 'Engine Capacity',
        value: `${formatDigits(listing.engineCc, locale)} ${isArabic ? 'سي سي' : 'cc'}`,
      });
    }
    if (listing.powerHp) {
      engineItems.push({
        label: isArabic ? 'القوة الحصانية' : 'Horsepower',
        value: `${formatDigits(listing.powerHp, locale)} ${isArabic ? 'حصان' : 'hp'}`,
      });
    }
    if (listing.transmission) {
      engineItems.push({
        label: isArabic ? 'ناقل الحركة' : 'Transmission',
        value: TRANSMISSION_LABELS[listing.transmission]?.[locale] ?? listing.transmission,
      });
    }
    if (listing.fuelType) {
      engineItems.push({
        label: isArabic ? 'نوع الوقود' : 'Fuel Type',
        value: FUEL_LABELS[listing.fuelType]?.[locale] ?? listing.fuelType,
      });
    }
    if (listing.drivetrain) {
      engineItems.push({
        label: isArabic ? 'نظام الدفع' : 'Drivetrain',
        value: DRIVETRAIN_LABELS[listing.drivetrain]?.[locale] ?? listing.drivetrain,
      });
    }
    if (engineItems.length > 0) {
      list.push({
        id: 'engine',
        title: isArabic ? 'المحرك والأداء' : 'Engine & Performance',
        icon: Gauge,
        items: engineItems,
      });
    }

    // Group 2: Body & Dimensions
    const bodyItems: SpecItem[] = [];
    if (listing.bodyType) {
      bodyItems.push({
        label: isArabic ? 'نوع الهيكل' : 'Body Type',
        value: BODY_LABELS[listing.bodyType]?.[locale] ?? listing.bodyType,
      });
    }
    if (listing.seats) {
      bodyItems.push({
        label: isArabic ? 'عدد المقاعد' : 'Seats',
        value: `${formatDigits(listing.seats, locale)} ${isArabic ? 'مقاعد' : 'seats'}`,
      });
    }
    if (listing.colorExterior) {
      bodyItems.push({
        label: isArabic ? 'اللون الخارجي' : 'Exterior Color',
        value: listing.colorExterior,
      });
    }
    if (listing.colorInterior) {
      bodyItems.push({
        label: isArabic ? 'اللون الداخلي' : 'Interior Color',
        value: listing.colorInterior,
      });
    }
    if (bodyItems.length > 0) {
      list.push({
        id: 'body',
        title: isArabic ? 'الهيكل والتصميم' : 'Body & Styling',
        icon: Car,
        items: bodyItems,
      });
    }

    // Group 3: Condition & Warranty
    const conditionItems: SpecItem[] = [];
    conditionItems.push({
      label: isArabic ? 'حالة المركبة' : 'Condition',
      value: listing.condition === 'NEW' ? (isArabic ? 'جديد' : 'New') : (isArabic ? 'مستعمل' : 'Used'),
    });
    if (listing.conditionGrade) {
      conditionItems.push({
        label: isArabic ? 'درجة الحالة' : 'Condition Grade',
        value: CONDITION_GRADE_LABELS[listing.conditionGrade]?.[locale] ?? listing.conditionGrade,
      });
    }
    conditionItems.push({
      label: isArabic ? 'سنة الصنع' : 'Year',
      value: formatDigits(listing.year, locale),
    });
    conditionItems.push({
      label: isArabic ? 'المسافة المقطوعة' : 'Mileage',
      value: `${formatDigits(listing.mileageKm.toLocaleString(isArabic ? 'ar-EG' : 'en-US'), locale)} ${isArabic ? 'كم' : 'km'}`,
    });
    conditionItems.push({
      label: isArabic ? 'حالة الضمان' : 'Warranty',
      value: listing.hasWarranty ? (isArabic ? 'ساري' : 'Active') : (isArabic ? 'لا يوجد ضمان' : 'None'),
    });
    conditionItems.push({
      label: isArabic ? 'سجل الصيانة' : 'Service History',
      value: listing.hasServiceHistory ? (isArabic ? 'صيانة منتظمة' : 'Regular Service') : (isArabic ? 'غير متوفر' : 'Not available'),
    });
    if (listing.registrationStatus) {
      conditionItems.push({
        label: isArabic ? 'حالة الترخيص' : 'Registration',
        value: listing.registrationStatus,
      });
    }
    list.push({
      id: 'condition',
      title: isArabic ? 'الحالة والضمان' : 'Condition & Warranty',
      icon: Shield,
      items: conditionItems,
    });

    return list;
  }, [listing, locale, isArabic]);

  const hasFeatures = listing.features && listing.features.length > 0;

  return (
    <div
      aria-label={isArabic ? 'مواصفات وتجهيزات السيارة' : 'Vehicle specifications and features'}
      className={cn('space-y-6', className)}
      data-testid="specification-groups"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
        {isArabic ? 'المواصفات الفنية والتفاصيل' : 'Technical Specifications'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.id}
              className="rounded-xl border bg-card p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-foreground">
                  {group.title}
                </h3>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:text-sm">
                {group.items.map((item, idx) => (
                  <div key={`${group.id}-item-${idx}`} className="flex flex-col min-w-0">
                    <dt className="text-muted-foreground text-xs">{item.label}</dt>
                    <dd className="font-medium text-foreground truncate">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {/* Features & Equipment */}
      {hasFeatures ? (
        <div className="rounded-xl border bg-card p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base text-foreground">
              {isArabic ? 'الميزات والتجهيزات' : 'Features & Equipment'}
            </h3>
          </div>

          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {listing.features!.map((feature, idx) => (
              <li
                key={`feature-${idx}`}
                className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs sm:text-sm text-foreground"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
