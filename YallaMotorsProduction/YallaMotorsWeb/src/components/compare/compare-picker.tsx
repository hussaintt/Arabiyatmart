"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types/common";
import type { CompareItemKind, CompareItemRef } from "@/types/compare";
import type { VehicleSearchSuggestion } from "@/types/saved-search";
import { VehicleSearchSuggestionResponseSchema } from "@/lib/api/schemas/saved-search";
import { CompareItemRefSchema } from "@/lib/api/schemas/compare";
import { browserApiRequest } from "@/lib/api/browser";
import { useCompareStore } from "@/stores/compare-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2, Car, AlertCircle } from "lucide-react";

export function extractComparisonRef(
  item: VehicleSearchSuggestion,
  mode: CompareItemKind | null,
): CompareItemRef | null {
  const parsed = CompareItemRefSchema.safeParse(item.comparisonRef);
  if (!parsed.success || (mode && parsed.data.kind !== mode)) return null;
  return parsed.data;
}

interface ComparePickerProps {
  locale: Locale;
  mode: CompareItemKind | null;
  currentItems: CompareItemRef[];
}

export function ComparePicker({
  locale,
  mode,
  currentItems,
}: ComparePickerProps) {
  const isAr = locale === "ar";
  const router = useRouter();
  const { isPickerOpen, closePicker, searchQuery, setSearchQuery } =
    useCompareStore();

  const [suggestions, setSuggestions] = React.useState<
    VehicleSearchSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const [error, setError] = React.useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listboxRef = React.useRef<HTMLUListElement | null>(null);

  // Focus input when picker opens
  React.useEffect(() => {
    if (isPickerOpen) {
      setError(null);
      setActiveIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSuggestions([]);
      setIsLoading(false);
    }
  }, [isPickerOpen]);

  // Fetch suggestions with debounce and abort
  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!isPickerOpen || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams({
          q: trimmed,
          locale,
        });

        const response = await browserApiRequest({
          path: `/api/bff/search/suggest?${queryParams.toString()}`,
          outputSchema: VehicleSearchSuggestionResponseSchema,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setSuggestions(response.data);
          setIsLoading(false);
          setActiveIndex(-1);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          // Don't show network abort errors
          if ((err as Error)?.name !== "AbortError") {
            setError(
              isAr ? "تعذر جلب الاقتراحات" : "Failed to fetch suggestions",
            );
          }
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, isPickerOpen, locale, isAr]);

  const commitSelection = React.useCallback(
    (itemRef: CompareItemRef) => {
      const activeMode = mode ?? itemRef.kind;
      if (itemRef.kind !== activeMode) return;

      const exists = currentItems.some(
        (existing) =>
          existing.kind === itemRef.kind && existing.id === itemRef.id,
      );

      if (exists) {
        setError(
          isAr
            ? "هذا العنصر مضاف بالفعل للمقارنة"
            : "This item is already being compared",
        );
        return;
      }

      if (currentItems.length >= 3) {
        setError(
          isAr
            ? "الحد الأقصى للمقارنة هو 3 سيارات"
            : "You can compare up to 3 vehicles at a time",
        );
        return;
      }

      const updated = [...currentItems, itemRef].slice(0, 3);
      const params = new URLSearchParams();
      for (const item of updated) {
        params.append("item", `${item.kind}:${item.id}`);
      }

      closePicker();
      router.push(`/${locale}/compare?${params.toString()}`);
    },
    [mode, currentItems, isAr, locale, closePicker, router],
  );

  const handleSelectSuggestion = (suggestion: VehicleSearchSuggestion) => {
    setError(null);
    const ref = extractComparisonRef(suggestion, mode);

    if (!ref) {
      setError(
        isAr
          ? "هذا الاقتراح تصنيف عام (ماركة/موديل) ولا تتوفر سيارة للمقارنة حالياً حتى يوفرها نظام الاقتراحات."
          : "No comparable vehicle is available for this category suggestion until provided by the suggestion API.",
      );
      return;
    }

    commitSelection(ref);
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      const selected = suggestions[activeIndex];
      if (selected) {
        handleSelectSuggestion(selected);
        return;
      }
    }

    // Direct / free-text submission is strictly prohibited.
    // Raw query text must NEVER become URL state or an unvalidated listing slug.
    setError(
      isAr
        ? "لا يمكن إضافة نص البحث مباشرة، يرجى اختيار سيارة معتمدة للمقارنة من القائمة"
        : "Direct text entry cannot be compared; please select an approved comparable vehicle from the list",
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePicker();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        const selected = suggestions[activeIndex];
        if (selected) {
          handleSelectSuggestion(selected);
          return;
        }
      }
      handleDirectSubmit(e);
    }
  };

  if (!isPickerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "إضافة سيارة للمقارنة" : "Add vehicle to compare"}
      data-testid="compare-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-lg">
              {isAr ? "إضافة سيارة للمقارنة" : "Add Vehicle to Compare"}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePicker}
            aria-label={isAr ? "إغلاق" : "Close"}
            data-testid="close-picker-button"
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleDirectSubmit} className="space-y-4">
          <div className="relative">
            <Search
              className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-autocomplete="list"
              aria-controls="compare-suggestions-list"
              aria-activedescendant={
                activeIndex >= 0
                  ? `suggestion-option-${activeIndex}`
                  : undefined
              }
              value={searchQuery}
              onChange={(e) => {
                setActiveIndex(-1);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isAr
                  ? "ابحث باسم الماركة أو الموديل (مثل تويوتا، كورولا)..."
                  : "Search by make or model (e.g. Toyota, Corolla)..."
              }
              data-testid="compare-picker-input"
              className="ps-10 pe-10 h-12 text-base"
              autoComplete="off"
            />
            {isLoading && (
              <Loader2
                className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>

          {error && (
            <div
              className="flex items-center gap-2 text-sm text-destructive font-medium px-1"
              role="alert"
              data-testid="compare-picker-error"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {suggestions.length > 0 && (
            <ul
              ref={listboxRef}
              id="compare-suggestions-list"
              role="listbox"
              aria-label={isAr ? "اقتراحات السيارات" : "Vehicle suggestions"}
              data-testid="compare-suggestions-list"
              className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border/50 py-1"
            >
              {suggestions.map((item, idx) => {
                const hasRef = Boolean(extractComparisonRef(item, mode));
                return (
                  <li
                    key={`${item.type}-${item.makeSlug}-${item.modelSlug || "all"}-${idx}`}
                    id={`suggestion-option-${idx}`}
                    role="option"
                    aria-selected={activeIndex === idx}
                    onClick={() => handleSelectSuggestion(item)}
                    data-testid={`suggestion-item-${idx}`}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer text-sm transition-colors ${
                      activeIndex === idx
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Car
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase">
                      {hasRef ? item.comparisonRef?.kind : item.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {searchQuery.trim().length >= 2 &&
            !isLoading &&
            suggestions.length === 0 && (
              <div
                className="text-center py-6 text-muted-foreground text-sm"
                data-testid="no-suggestions-message"
              >
                {isAr
                  ? "لا توجد نتائج مطابقة"
                  : "No matching suggestions found"}
              </div>
            )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closePicker}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            {activeIndex >= 0 && activeIndex < suggestions.length && (
              <Button type="submit" data-testid="picker-submit-button">
                {isAr ? "إضافة للمقارنة" : "Add to Compare"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
