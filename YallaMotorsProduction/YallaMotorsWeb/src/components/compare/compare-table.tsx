'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/types/common';
import type { CompareItemKind, CompareItemRef, ComparePageData } from '@/types/compare';
import { useCompareStore } from '@/stores/compare-store';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Plus,
  Car,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface CompareTableProps {
  data: ComparePageData;
  requestedItems: CompareItemRef[];
  unavailableItems: CompareItemRef[];
  locale: Locale;
}

export function CompareTable({
  data,
  requestedItems,
  unavailableItems,
  locale,
}: CompareTableProps) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const { openPicker } = useCompareStore();

  // Mobile item toggle index
  const [mobileActiveItemIndex, setMobileActiveItemIndex] = React.useState<number>(0);

  const totalSlots = data.items.length + unavailableItems.length;
  const canAddMore = totalSlots < 3;

  const handleRemove = (itemRefToRemove: CompareItemRef) => {
    const remaining = requestedItems.filter(
      (item) => !(item.kind === itemRefToRemove.kind && item.id === itemRefToRemove.id)
    );

    if (remaining.length === 0) {
      router.push(`/${locale}/compare`);
      return;
    }

    const params = new URLSearchParams();
    for (const item of remaining) {
      params.append('item', `${item.kind}:${item.id}`);
    }
    router.push(`/${locale}/compare?${params.toString()}`);
  };

  return (
    <div className="space-y-6" data-testid="compare-workspace">
      {/* Mobile Selector / Tab Controls */}
      <div className="md:hidden flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-xl border border-border">
        <span className="text-xs font-medium text-muted-foreground px-2">
          {isAr ? 'عرض السيارة:' : 'View Vehicle:'}
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {data.items.map((item, idx) => (
            <Button
              key={item.id}
              variant={mobileActiveItemIndex === idx ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMobileActiveItemIndex(idx)}
              data-testid={`mobile-item-tab-${idx}`}
              className="h-8 text-xs shrink-0 max-w-[140px] truncate"
            >
              {item.title}
            </Button>
          ))}
          {unavailableItems.map((item, idx) => {
            const index = data.items.length + idx;
            return (
              <Button
                key={`unavail-${item.id}`}
                variant={mobileActiveItemIndex === index ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setMobileActiveItemIndex(index)}
                className="h-8 text-xs shrink-0 text-destructive border-destructive/30"
              >
                {isAr ? 'غير متاح' : 'Unavailable'}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main Table / Grid Container with Horizontal Scroll */}
      <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto snap-x snap-mandatory">
          <table className="w-full text-sm text-start border-collapse min-w-[640px] md:min-w-[768px]">
            {/* Header: Item Cards */}
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th
                  scope="col"
                  className="sticky start-0 z-20 w-[160px] sm:w-[200px] md:w-[240px] p-4 text-start bg-card/95 backdrop-blur border-e border-border align-top"
                >
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-base text-foreground">
                      {isAr ? 'المواصفات' : 'Specifications'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isAr
                        ? `${totalSlots} من 3 سيارات`
                        : `${totalSlots} of 3 vehicles`}
                    </span>
                    {canAddMore && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openPicker()}
                        data-testid="add-compare-slot"
                        className="mt-2 w-full gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                      >
                        <Plus className="h-4 w-4" />
                        {isAr ? 'إضافة سيارة' : 'Add Vehicle'}
                      </Button>
                    )}
                  </div>
                </th>

                {/* Compared Available Items */}
                {data.items.map((item) => {
                  const itemRef = requestedItems.find(
                    (req) =>
                      req.id === item.id ||
                      (item.detailRoute && item.detailRoute.includes(req.id))
                  ) ?? { kind: 'listing', id: item.id };

                  return (
                    <th
                      key={item.id}
                      scope="col"
                      data-testid={`compare-column-${item.id}`}
                      className="w-[240px] sm:w-[280px] md:w-[320px] p-4 align-top border-e border-border last:border-e-0 snap-start"
                    >
                      <div className="flex flex-col h-full justify-between gap-4">
                        {/* Remove button */}
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(itemRef)}
                            aria-label={`${isAr ? 'إزالة' : 'Remove'} ${item.title}`}
                            data-testid={`remove-compare-${item.id}`}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Image */}
                        <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/50">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.title}
                              fill
                              sizes="(max-width: 768px) 240px, 320px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                              <Car className="h-8 w-8 stroke-[1.5]" aria-hidden="true" />
                              <span className="text-xs">
                                {isAr ? 'لا توجد صورة' : 'No photo'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Title and Subtitle */}
                        <div className="text-start space-y-1">
                          <h4 className="font-bold text-base text-foreground line-clamp-1">
                            {item.title}
                          </h4>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {item.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Detail Link */}
                        {item.detailRoute && (
                          <Link href={item.detailRoute} className="w-full">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full gap-1.5 text-xs"
                            >
                              {isAr ? 'عرض التفاصيل' : 'View Details'}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* Unavailable Items */}
                {unavailableItems.map((unavail) => (
                  <th
                    key={`unavail-${unavail.kind}-${unavail.id}`}
                    scope="col"
                    data-testid={`unavailable-column-${unavail.id}`}
                    className="w-[240px] sm:w-[280px] md:w-[320px] p-4 align-top border-e border-border last:border-e-0 bg-destructive/5 snap-start"
                  >
                    <div className="flex flex-col h-full justify-between gap-4">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(unavail)}
                          aria-label={`${isAr ? 'إزالة' : 'Remove'} ${unavail.id}`}
                          data-testid={`remove-unavailable-${unavail.id}`}
                          className="h-8 w-8 text-destructive hover:bg-destructive/20 rounded-full"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <span className="font-semibold text-sm text-destructive">
                          {isAr ? 'هذا العنصر غير متاح' : 'Item Unavailable'}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {isAr
                            ? 'لم نتمكن من العثور على هذه السيارة أو تمت إزالتها.'
                            : 'This vehicle could not be found or was removed.'}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(unavail)}
                        className="w-full text-xs text-destructive border-destructive/30"
                      >
                        {isAr ? 'إزالة من المقارنة' : 'Remove Item'}
                      </Button>
                    </div>
                  </th>
                ))}

                {/* Empty Add Slot */}
                {canAddMore && (
                  <th
                    scope="col"
                    className="hidden lg:table-cell w-[240px] sm:w-[280px] md:w-[320px] p-4 align-middle text-center border-dashed border-border"
                  >
                    <button
                      type="button"
                      onClick={() => openPicker()}
                      data-testid="add-compare-column-button"
                      className="flex flex-col items-center justify-center w-full h-[260px] rounded-xl border-2 border-dashed border-muted hover:border-primary/50 bg-muted/10 hover:bg-primary/5 transition-colors p-6 group cursor-pointer"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-colors mb-3">
                        <Plus className="h-6 w-6" />
                      </div>
                      <span className="font-medium text-sm text-muted-foreground group-hover:text-foreground">
                        {isAr ? 'إضافة سيارة للمقارنة' : 'Add vehicle to compare'}
                      </span>
                      <span className="text-xs text-muted-foreground/80 mt-1">
                        {isAr ? 'حتى 3 سيارات' : 'Up to 3 vehicles'}
                      </span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            {/* Body: Spec Rows */}
            <tbody className="divide-y divide-border/60">
              {data.rows.map((row, rowIdx) => {
                // Find best numeric value if 'higher' or 'lower'
                let bestNumeric: number | null = null;
                if (row.better === 'higher') {
                  const validNumerics = row.numeric.filter(
                    (n): n is number => n !== null && Number.isFinite(n)
                  );
                  if (validNumerics.length > 0) {
                    bestNumeric = Math.max(...validNumerics);
                  }
                } else if (row.better === 'lower') {
                  const validNumerics = row.numeric.filter(
                    (n): n is number => n !== null && Number.isFinite(n)
                  );
                  if (validNumerics.length > 0) {
                    bestNumeric = Math.min(...validNumerics);
                  }
                }

                return (
                  <tr
                    key={`row-${row.label}-${rowIdx}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Row Label Cell (Sticky) */}
                    <th
                      scope="row"
                      className="sticky start-0 z-10 p-4 text-start font-medium text-muted-foreground bg-card/95 backdrop-blur border-e border-border text-sm"
                    >
                      {row.label}
                    </th>

                    {/* Display values for available items */}
                    {row.display.map((val, colIdx) => {
                      const numVal = row.numeric[colIdx];
                      const isBest =
                        row.better !== 'none' &&
                        bestNumeric !== null &&
                        numVal === bestNumeric &&
                        // Don't highlight if all items have the same number
                        row.numeric.some((other) => other !== numVal && other !== null);

                      return (
                        <td
                          key={`cell-${colIdx}-${row.label}`}
                          className={`p-4 text-center border-e border-border last:border-e-0 text-sm font-medium ${
                            isBest ? 'bg-primary/5 text-primary font-bold' : 'text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{val || '-'}</span>
                            {isBest && (
                              <Badge
                                variant="outline"
                                className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20"
                              >
                                {isAr ? 'الأفضل' : 'Best'}
                              </Badge>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Unavailable item cells */}
                    {unavailableItems.map((unavail) => (
                      <td
                        key={`unavail-cell-${unavail.id}-${row.label}`}
                        className="p-4 text-center border-e border-border last:border-e-0 text-muted-foreground bg-destructive/5 text-sm"
                      >
                        -
                      </td>
                    ))}

                    {/* Extra column spacer for empty slot if present */}
                    {canAddMore && (
                      <td className="hidden lg:table-cell p-4 text-center text-muted-foreground/40 text-sm border-dashed">
                        -
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export interface CompareStoreBridgeProps {
  initialItems: CompareItemRef[];
  initialMode: CompareItemKind | null;
  canonicalUrl: string;
}

export function CompareStoreBridge({
  initialItems,
  initialMode,
  canonicalUrl,
}: CompareStoreBridgeProps) {
  const router = useRouter();
  const setInitialState = useCompareStore((s) => s.setInitialState);
  const reset = useCompareStore((s) => s.reset);
  const mode = useCompareStore((s) => s.mode);

  // Synchronize initial state
  React.useEffect(() => {
    setInitialState(initialItems, initialMode);
  }, [initialItems, initialMode, setInitialState]);

  // Reset store on route mode change
  React.useEffect(() => {
    if (mode !== null && initialMode !== null && mode !== initialMode) {
      reset();
    }
  }, [initialMode, mode, reset]);

  // Canonicalize URL in browser if current query doesn't match canonical URL
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== canonicalUrl && window.location.search.length > 0) {
        router.replace(canonicalUrl);
      }
    }
  }, [canonicalUrl, router]);

  return null;
}
