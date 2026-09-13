"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompositionState, useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/config";

export interface VehicleComboboxItem {
  publicId: string;
  name: string;
  slug?: string | undefined;
  sublabel?: string | null | undefined;
}

export interface VehicleComboboxProps {
  id?: string;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  items: readonly VehicleComboboxItem[];
  value: string | null;
  onSelect: (publicId: string | null) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: AppLocale;
  required?: boolean;
  className?: string;
}

export function VehicleCombobox({
  id,
  label,
  placeholder,
  searchPlaceholder,
  emptyText,
  items,
  value,
  onSelect,
  disabled = false,
  isLoading = false,
  error = null,
  onRetry,
  locale = "ar",
  required = false,
  className,
}: VehicleComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const { isComposing, compositionProps } = useCompositionState();
  const debouncedSearch = useDebouncedValue(search, 200, { isComposing });

  const ar = locale === "ar";
  const defaultPlaceholder = placeholder ?? (ar ? "اختر..." : "Select...");
  const defaultSearchPlaceholder =
    searchPlaceholder ?? (ar ? "بحث..." : "Search...");
  const defaultEmptyText =
    emptyText ?? (ar ? "لا توجد نتائج مطابقة." : "No matching results.");

  const selectedItem = React.useMemo(
    () => items.find((item) => item.publicId === value),
    [items, value],
  );

  const filteredItems = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(q)),
    );
  }, [items, debouncedSearch]);

  const handleOpen = () => {
    if (disabled || isLoading) return;
    setSearch("");
    setOpen(true);
  };

  const handleSelect = (publicId: string) => {
    if (publicId === value) {
      onSelect(null);
    } else {
      onSelect(publicId);
    }
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground flex items-center justify-between"
      >
        <span>
          {label}
          {required ? (
            <span className="text-destructive ms-1" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        {isLoading ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {ar ? "جارِ التحميل..." : "Loading..."}
          </span>
        ) : null}
      </label>

      <div className="relative">
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={`combobox-list-${id ?? "items"}`}
          aria-haspopup="dialog"
          aria-required={required}
          aria-label={label}
          disabled={disabled || isLoading}
          onClick={handleOpen}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 text-start transition-colors",
            error ? "border-destructive focus:ring-destructive" : "",
            !selectedItem ? "text-muted-foreground" : "text-foreground",
          )}
          data-testid={`combobox-${id ?? label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : defaultPlaceholder}
          </span>
          <div className="flex items-center gap-1 ms-2 shrink-0">
            {selectedItem && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={ar ? "إلغاء التحديد" : "Clear selection"}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(null);
                  }
                }}
                className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between text-xs text-destructive mt-0.5"
        >
          <span>{error}</span>
          {onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-3 w-3 me-1" />
              {ar ? "إعادة المحاولة" : "Retry"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 overflow-hidden sm:max-w-md"
          data-testid={`combobox-dialog-${id ?? "items"}`}
        >
          <DialogHeader className="p-4 pb-0 border-b border-border text-start">
            <DialogTitle className="text-base font-semibold">
              {label}
            </DialogTitle>
          </DialogHeader>
          <Command className="overflow-hidden" shouldFilter={false}>
            <CommandInput
              placeholder={defaultSearchPlaceholder}
              value={search}
              onValueChange={setSearch}
              {...compositionProps}
              onKeyDown={(e) => {
                // Prevent Enter during IME composition from triggering form submission
                if (isComposing || e.nativeEvent.isComposing) {
                  e.stopPropagation();
                }
              }}
              data-testid="combobox-search-input"
            />
            <CommandList
              id={`combobox-list-${id ?? "items"}`}
              className="max-h-72 overflow-y-auto p-1"
            >
              {isLoading ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  {ar ? "جارِ التحميل..." : "Loading items..."}
                </div>
              ) : filteredItems.length === 0 ? (
                <CommandEmpty className="p-4 text-center text-sm text-muted-foreground">
                  {defaultEmptyText}
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredItems.map((item) => {
                    const isSelected = item.publicId === value;
                    return (
                      <CommandItem
                        key={item.publicId}
                        value={item.publicId}
                        onSelect={() => handleSelect(item.publicId)}
                        className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                        data-testid={`combobox-item-${item.publicId}`}
                      >
                        <div className="flex flex-col text-start">
                          <span className="font-medium text-sm">
                            {item.name}
                          </span>
                          {item.sublabel ? (
                            <span className="text-xs text-muted-foreground">
                              {item.sublabel}
                            </span>
                          ) : null}
                        </div>
                        {isSelected ? (
                          <Check className="h-4 w-4 text-primary shrink-0 ms-2" />
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
