'use client';

import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FilterPanel } from './filter-panel';
import { applyFilterChange, type ParsedSearchParams } from '@/lib/search/params';
import type { AppLocale } from '@/i18n/config';
import type { City, Make, VehicleModel } from '@/types/taxonomy';

export interface MobileFilterDrawerProps {
  currentParams: ParsedSearchParams;
  onApply: (applied: ParsedSearchParams) => void;
  makes?: Make[] | undefined;
  models?: VehicleModel[] | undefined;
  cities?: City[] | undefined;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function MobileFilterDrawer({
  currentParams,
  onApply,
  makes = [],
  models = [],
  cities = [],
  locale = 'ar',
  className,
}: MobileFilterDrawerProps) {
  const isArabic = locale === 'ar';
  const [open, setOpen] = React.useState(false);

  // Local draft state for explicit apply/cancel semantics
  const [draft, setDraft] = React.useState<ParsedSearchParams>(currentParams);

  // When opening, reset draft to current committed parameters
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(currentParams);
    }
    setOpen(isOpen);
  };

  const handleDraftChange = (changes: Partial<ParsedSearchParams>) => {
    setDraft((prev) => applyFilterChange(prev, changes));
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(currentParams);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft({});
  };

  // Count active filters in current committed params
  const activeCount = Object.keys(currentParams).filter(
    (k) =>
      k !== 'page' &&
      k !== 'limit' &&
      k !== 'sort' &&
      k !== 'panel' &&
      k !== 'filter' &&
      currentParams[k as keyof ParsedSearchParams] !== undefined
  ).length;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="mobile-filter-trigger"
          className={cn(
            'relative inline-flex items-center gap-1.5 h-10 px-3 text-xs sm:text-sm font-semibold',
            className
          )}
          aria-label={isArabic ? 'فتح فلاتر البحث' : 'Open search filters'}
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>{isArabic ? 'الفلاتر' : 'Filters'}</span>
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-5 px-1.5 py-0 text-[10px] font-bold rounded-full"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side={isArabic ? 'right' : 'left'}
        className="w-full sm:max-w-md flex flex-col p-0 z-50 overflow-hidden"
        data-testid="mobile-filter-drawer"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0 text-start">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <SheetTitle className="text-base font-bold text-foreground">
              {isArabic ? 'تصفية نتائج البحث' : 'Filter Results'}
            </SheetTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-destructive h-8 px-2"
          >
            {isArabic ? 'إعادة ضبط' : 'Reset'}
          </Button>
        </SheetHeader>

        {/* Scrollable Filter Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          <FilterPanel
            values={draft}
            onChange={handleDraftChange}
            makes={makes}
            models={models}
            cities={cities}
            locale={locale}
            isMobile={true}
          />
        </div>

        {/* Drawer Footer with explicit Apply & Cancel actions */}
        <SheetFooter className="p-4 border-t border-border bg-card/80 backdrop-blur-xs flex flex-row gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="flex-1 h-11 text-xs sm:text-sm font-bold"
            data-testid="mobile-filter-cancel"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleApply}
            className="flex-1 h-11 text-xs sm:text-sm font-bold bg-primary text-primary-foreground"
            data-testid="mobile-filter-apply"
          >
            {isArabic ? 'تطبيق الفلاتر' : 'Apply Filters'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
