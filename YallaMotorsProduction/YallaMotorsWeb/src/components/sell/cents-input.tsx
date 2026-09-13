"use client";

import * as React from "react";
import {
  formatDigits,
  getCurrencyLabel,
  parseCentsToParts,
  toWesternDigits,
  validateMoneyCents,
} from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/config";

export interface CentsInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  onBlur?: () => void;
  currency?: string;
  locale?: AppLocale;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  className?: string;
}

const MAX_CENTS = 999_999_999_99n; // 999,999,999.99 in minor units

/**
 * Converts a raw string input to integer cents using strict BigInt math.
 * Never uses floating-point arithmetic.
 */
function parseRawStringToCents(raw: string): bigint | null {
  const normalized = toWesternDigits(raw).replace(/,/g, "").trim();
  if (!normalized) return null;

  // Strict validation: only digits and optional single decimal point
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    throw new Error("INVALID_MONEY_FORMAT");
  }

  const [wholeStr = "0", fractionStr = ""] = normalized.split(".");
  const paddedFraction = fractionStr.padEnd(2, "0").slice(0, 2);

  const cents = BigInt(wholeStr) * 100n + BigInt(paddedFraction);
  if (cents > MAX_CENTS) {
    throw new Error("MONEY_OVERFLOW");
  }

  return cents;
}

export function CentsInput({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  currency = "EGP",
  locale = "ar",
  placeholder,
  disabled = false,
  required = false,
  error = null,
  className,
}: CentsInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [rawText, setRawText] = React.useState<string>("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const ar = locale === "ar";
  const currencySymbol = getCurrencyLabel(currency, locale);

  const prevValueRef = React.useRef(value);

  // Sync display text when value changes from outside while not focused
  React.useEffect(() => {
    if (isFocused) return;
    if (prevValueRef.current === value && rawText !== "") return;
    prevValueRef.current = value;

    if (value === null || value === undefined) {
      setRawText("");
      setLocalError(null);
      return;
    }
    try {
      validateMoneyCents(value);
      const parts = parseCentsToParts(value, {
        currency,
        locale,
        showDecimals: value % 100 !== 0,
      });
      setRawText(parts.formattedAmount);
      setLocalError(null);
    } catch {
      setRawText("");
    }
  }, [value, isFocused, currency, locale, rawText]);

  const handleFocus = () => {
    if (disabled) return;
    setIsFocused(true);
    if (value !== null && value !== undefined) {
      // In edit mode: show major units (e.g. 250000 or 250000.50) without commas
      const whole = BigInt(value) / 100n;
      const remainder = BigInt(value) % 100n;
      const editStr =
        remainder > 0n
          ? `${whole.toString()}.${remainder.toString().padStart(2, "0")}`
          : whole.toString();
      setRawText(formatDigits(editStr, locale));
    } else {
      setRawText("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    setRawText(inputVal);

    if (!inputVal.trim()) {
      setLocalError(null);
      onChange(null);
      return;
    }

    try {
      const centsBigInt = parseRawStringToCents(inputVal);
      if (centsBigInt === null) {
        setLocalError(null);
        onChange(null);
      } else {
        setLocalError(null);
        onChange(Number(centsBigInt));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "MONEY_OVERFLOW") {
        setLocalError(ar ? "المبلغ يتجاوز الحد الأقصى المسموح به" : "Amount exceeds maximum allowed limit");
      } else {
        setLocalError(ar ? "صيغة السعر غير صحيحة" : "Invalid price format");
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();

    if (!rawText.trim()) {
      setRawText("");
      setLocalError(null);
      onChange(null);
      return;
    }

    try {
      const centsBigInt = parseRawStringToCents(rawText);
      if (centsBigInt === null) {
        setRawText("");
        setLocalError(null);
        onChange(null);
      } else {
        const centsNum = Number(centsBigInt);
        onChange(centsNum);
        const parts = parseCentsToParts(centsNum, {
          currency,
          locale,
          showDecimals: centsNum % 100 !== 0,
        });
        setRawText(parts.formattedAmount);
        setLocalError(null);
      }
    } catch {
      // Keep invalid raw text and local error visible
    }
  };

  const displayError = error ?? localError;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
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
        </label>
      ) : null}

      <div className="relative flex items-center">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          required={required}
          value={rawText}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            placeholder ??
            (ar ? "أدخل السعر..." : "Enter price...")
          }
          aria-invalid={Boolean(displayError)}
          aria-describedby={displayError && id ? `${id}-error` : undefined}
          className={cn(
            "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "pe-14", // space for currency badge
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 text-start font-medium",
            displayError ? "border-destructive focus:ring-destructive" : "",
          )}
          data-testid={`cents-input-${id ?? "price"}`}
        />
        <div
          className="pointer-events-none absolute end-3 flex items-center text-xs font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {currencySymbol}
        </div>
      </div>

      {displayError ? (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="text-xs text-destructive mt-0.5"
          data-testid="cents-input-error"
        >
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
