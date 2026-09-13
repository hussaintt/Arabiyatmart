import { type AppLocale, defaultLocale } from "./config";

// ── Numerals and Digits ──────────────────────────────────────────────────────

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"] as const;

const ARABIC_TO_WESTERN_DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/**
 * Converts Western digits (0-9) to Eastern Arabic-Indic numerals (٠-٩).
 */
export function toArabicDigits(input: string | number | bigint): string {
  return String(input).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

/**
 * Converts Eastern Arabic-Indic numerals (٠-٩) to Western Latin digits (0-9).
 */
export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (char) => ARABIC_TO_WESTERN_DIGIT_MAP[char] ?? char);
}

/**
 * Converts digits in input based on the requested locale.
 */
export function formatDigits(input: string | number | bigint, locale: AppLocale): string {
  return locale === "ar" ? toArabicDigits(input) : toWesternDigits(String(input));
}

// ── Currency and Money ───────────────────────────────────────────────────────

/**
 * Validates that an input is a safe integer minor units (cents) value.
 * Rejects non-finite numbers, floating-point numbers, unsafe integers, and non-numeric types
 * with field-specific errors. Never truncates floating money or turns invalid monetary input into zero.
 */
export function validateMoneyCents(cents: unknown, field = "priceCents"): bigint {
  if (typeof cents === "bigint") {
    return cents;
  }

  if (typeof cents !== "number") {
    throw new TypeError(
      `Invalid ${field}: expected integer cents as number or bigint, received ${typeof cents === "object" ? JSON.stringify(cents) : String(cents)}`
    );
  }

  if (!Number.isFinite(cents)) {
    throw new TypeError(
      `Invalid ${field}: expected a finite numeric integer for money cents, received ${cents}`
    );
  }

  if (!Number.isInteger(cents)) {
    throw new TypeError(
      `Invalid ${field}: floating-point monetary values are prohibited; expected integer minor units (cents), received ${cents}`
    );
  }

  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(
      `Invalid ${field}: integer cents value exceeds safe integer bounds: ${cents}`
    );
  }

  return BigInt(cents);
}

/**
 * Minor unit exponent per currency (e.g. 2 for EGP/USD, 3 for KWD, 0 for JPY).
 */
export function getCurrencyDecimalPlaces(currencyCode: string): number {
  switch (currencyCode.toUpperCase()) {
    case "BHD":
    case "KWD":
    case "OMR":
      return 3;
    case "JPY":
    case "CLP":
    case "KRW":
      return 0;
    default:
      return 2;
  }
}

/**
 * Returns localized currency label/symbol.
 */
export function getCurrencyLabel(currencyCode: string, locale: AppLocale = defaultLocale): string {
  const upper = currencyCode.trim().toUpperCase();
  const isArabic = locale === "ar";

  switch (upper) {
    case "EGP":
      return isArabic ? "ج.م" : "EGP";
    case "SAR":
      return isArabic ? "ر.س" : "SAR";
    case "AED":
      return isArabic ? "د.إ" : "AED";
    case "KWD":
      return isArabic ? "د.ك" : "KWD";
    case "BHD":
      return isArabic ? "د.ب" : "BHD";
    case "OMR":
      return isArabic ? "ر.ع" : "OMR";
    case "QAR":
      return isArabic ? "ر.ق" : "QAR";
    case "USD":
      return isArabic ? "دولار" : "USD";
    case "EUR":
      return isArabic ? "يورو" : "EUR";
    case "GBP":
      return isArabic ? "جنيه إسترليني" : "GBP";
    default:
      return upper;
  }
}

export interface MoneyParts {
  isNegative: boolean;
  wholeUnits: bigint;
  fractionUnits: bigint;
  decimalPlaces: number;
  formattedAmount: string;
  currencySymbol: string;
  currencyCode: string;
  fullFormatted: string;
}

export interface FormatMoneyOptions {
  currency?: string | undefined;
  locale?: AppLocale | undefined;
  showDecimals?: boolean | undefined;
  useArabicDigits?: boolean | undefined;
  field?: string | undefined;
}

/**
 * Splits integer minor units (cents) into integer whole and fraction components
 * without performing any floating-point division or multiplication.
 * Rejects non-safe-integer, non-finite, and floating-point inputs.
 */
export function parseCentsToParts(
  cents: number | bigint,
  options: {
    currency?: string | undefined;
    locale?: AppLocale | undefined;
    showDecimals?: boolean | undefined;
    useArabicDigits?: boolean | undefined;
    field?: string | undefined;
  } = {}
): MoneyParts {
  const field = options.field ?? "priceCents";
  const rawBigInt = validateMoneyCents(cents, field);

  const currencyCode = (options.currency ?? "EGP").trim().toUpperCase();
  const locale = options.locale ?? defaultLocale;
  const decimalPlaces = getCurrencyDecimalPlaces(currencyCode);

  const isNegative = rawBigInt < 0n;
  const absCents = isNegative ? -rawBigInt : rawBigInt;

  let divisor = 1n;
  for (let i = 0; i < decimalPlaces; i++) {
    divisor *= 10n;
  }

  const wholeUnits = absCents / divisor;
  const fractionUnits = absCents % divisor;

  // Add thousand separators to whole units using integer grouping
  const wholeStr = wholeUnits.toString();
  const groupedWhole = addThousandSeparators(wholeStr);

  const showDecimals =
    options.showDecimals !== undefined
      ? options.showDecimals
      : decimalPlaces > 0 && fractionUnits > 0n;

  let formattedAmount = groupedWhole;
  if (showDecimals && decimalPlaces > 0) {
    const fractionStr = fractionUnits.toString().padStart(decimalPlaces, "0");
    formattedAmount = `${groupedWhole}.${fractionStr}`;
  }

  if (isNegative) {
    formattedAmount = `-${formattedAmount}`;
  }

  if (options.useArabicDigits && locale === "ar") {
    formattedAmount = toArabicDigits(formattedAmount);
  }

  const currencySymbol = getCurrencyLabel(currencyCode, locale);
  const fullFormatted = `${formattedAmount} ${currencySymbol}`;

  return {
    isNegative,
    wholeUnits,
    fractionUnits,
    decimalPlaces,
    formattedAmount,
    currencySymbol,
    currencyCode,
    fullFormatted,
  };
}

/**
 * Formats an integer minor units (cents) amount into a localized money string
 * strictly using integer math with no floating-point currency representation.
 */
export function formatMoney(
  cents: number | bigint,
  options?: FormatMoneyOptions
): string {
  const parts = parseCentsToParts(cents, options);
  return parts.fullFormatted;
}

/**
 * Convenience helper for money formatting from integer cents.
 */
export function formatMoneyFromCents(
  cents: number | bigint,
  currency = "EGP",
  locale: AppLocale = defaultLocale,
  showDecimals?: boolean,
  field = "priceCents"
): string {
  return formatMoney(cents, { currency, locale, showDecimals, field });
}

function addThousandSeparators(value: string): string {
  const parts = value.split(".");
  const whole = parts[0] ?? "";
  const fraction = parts[1];

  let formatted = "";
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) {
      formatted += ",";
    }
    formatted += whole[i];
  }

  if (fraction !== undefined) {
    return `${formatted}.${fraction}`;
  }
  return formatted;
}

// ── Numbers ──────────────────────────────────────────────────────────────────

/**
 * Formats a number with locale-aware number formatting.
 */
export function formatNumber(
  value: number | bigint,
  locale: AppLocale = defaultLocale,
  options?: Intl.NumberFormatOptions
): string {
  const tag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(tag, options).format(value);
}

// ── Dates and Times ──────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = "Africa/Cairo";

function toValidDate(date: Date | string | number, fieldName = "date"): Date {
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new TypeError(`Invalid ${fieldName}: Date is invalid NaN`);
    }
    return date;
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new TypeError(`Invalid ${fieldName}: unable to parse "${String(date)}" as a valid Date`);
  }
  return parsed;
}

/**
 * Formats a date using the application standard time zone (Africa/Cairo).
 */
export function formatDate(
  date: Date | string | number,
  locale: AppLocale = defaultLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toValidDate(date, "date");
  const tag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}

/**
 * Formats a time using the application standard time zone (Africa/Cairo).
 */
export function formatTime(
  date: Date | string | number,
  locale: AppLocale = defaultLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toValidDate(date, "date");
  const tag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    timeZone: DEFAULT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(d);
}

/**
 * Formats a date and time using the application standard time zone (Africa/Cairo).
 */
export function formatDateTime(
  date: Date | string | number,
  locale: AppLocale = defaultLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toValidDate(date, "date");
  const tag = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(d);
}

/**
 * Formats a date relative to an explicit, required reference time (baseDate).
 * Requires an explicit reference time to ensure deterministic rendering
 * and eliminate server/client hydration mismatches.
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date | string | number,
  locale: AppLocale = defaultLocale
): string {
  const d = toValidDate(date, "date");
  const base = toValidDate(baseDate, "baseDate");
  const diffSeconds = Math.round((d.getTime() - base.getTime()) / 1000);
  const tag = locale === "ar" ? "ar-EG" : "en-US";
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });

  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) {
    return rtf.format(diffSeconds, "second");
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
}
