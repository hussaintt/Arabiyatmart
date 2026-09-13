export const locales = ["ar", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "ar";

export const LOCALE_COOKIE_NAME = "am_locale";

export type Direction = "rtl" | "ltr";

export interface LocaleConfig {
  readonly code: AppLocale;
  readonly name: string;
  readonly nativeName: string;
  readonly dir: Direction;
  readonly lang: string;
  readonly defaultCurrency: string;
  readonly timeZone: string;
}

export const localeConfigs: Record<AppLocale, LocaleConfig> = {
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
    lang: "ar",
    defaultCurrency: "EGP",
    timeZone: "Africa/Cairo",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    lang: "en",
    defaultCurrency: "EGP",
    timeZone: "Africa/Cairo",
  },
};

/**
 * Validates whether an arbitrary input string matches a supported application locale.
 * Initial locale is never inferred from client storage (localStorage/sessionStorage);
 * canonical URL routing with server-side cookie/header fallback is authoritative.
 */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function getLocaleDirection(locale: AppLocale): Direction {
  return localeConfigs[locale]?.dir ?? (locale === "ar" ? "rtl" : "ltr");
}

export function getLocaleConfig(locale: AppLocale): LocaleConfig {
  return localeConfigs[locale] ?? localeConfigs[defaultLocale];
}
