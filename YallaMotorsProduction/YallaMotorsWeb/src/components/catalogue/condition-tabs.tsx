'use client';

import * as React from 'react';
import { Sparkles, History, Car } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { CarCondition } from '@/types/listing';

export interface ConditionTabsProps {
  makeSlug: string;
  currentCondition?: CarCondition | undefined;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function ConditionTabs({
  makeSlug,
  currentCondition,
  locale = 'ar',
  className,
}: ConditionTabsProps) {
  const isArabic = locale === 'ar';

  const tabs: Array<{
    id: CarCondition | 'ALL';
    condition: CarCondition | undefined;
    label: { ar: string; en: string };
    icon: typeof Car;
    href: string;
    testId: string;
  }> = [
    {
      id: 'ALL',
      condition: undefined,
      label: { ar: 'كافة الحالات', en: 'All Vehicles' },
      icon: Car,
      href: `/catalogue/makes/${makeSlug}`,
      testId: 'condition-tab-all',
    },
    {
      id: 'NEW',
      condition: 'NEW',
      label: { ar: 'سيارات جديدة (زيرو)', en: 'Brand New' },
      icon: Sparkles,
      href: `/catalogue/makes/${makeSlug}?condition=NEW`,
      testId: 'condition-tab-new',
    },
    {
      id: 'USED',
      condition: 'USED',
      label: { ar: 'سيارات مستعملة', en: 'Pre-Owned' },
      icon: History,
      href: `/catalogue/makes/${makeSlug}?condition=USED`,
      testId: 'condition-tab-used',
    },
  ];

  return (
    <nav
      aria-label={isArabic ? 'تصفية حالة السيارة' : 'Filter vehicle condition'}
      className={cn(
        'inline-flex items-center gap-1.5 p-1 rounded-xl border bg-muted/50 text-xs font-semibold overflow-x-auto max-w-full',
        className
      )}
      data-testid="condition-tabs"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive =
          tab.id === 'ALL'
            ? !currentCondition
            : currentCondition === tab.condition;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            locale={locale}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all duration-150 whitespace-nowrap focus:outline-hidden focus:ring-2 focus:ring-primary',
              isActive
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50 font-medium'
            )}
            data-testid={tab.testId}
          >
            <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'opacity-70')} />
            <span>{isArabic ? tab.label.ar : tab.label.en}</span>
          </Link>
        );
      })}
    </nav>
  );
}
