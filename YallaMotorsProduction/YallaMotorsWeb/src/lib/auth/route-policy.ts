import type { AppLocale } from '@/i18n/config';

export type RouteAccess = 'public' | 'guest' | 'authenticated' | 'verified-phone' | 'vendor-staff' | 'vendor-manager';

const PUBLIC_PATTERNS = [
  /^\/$/, /^\/search\/?$/, /^\/listing\/[^/]+\/?$/, /^\/catalogue(?:\/.*)?$/,
  /^\/dealers(?:\/.*)?$/, /^\/compare\/?$/, /^\/forbidden\/?$/,
];
const GUEST_PATTERNS = [/^\/login\/?$/, /^\/register\/?$/];
const OPEN_RECOVERY_PATTERNS = [/^\/forgot-password\/?$/, /^\/reset-password\/?$/];
const AUTHENTICATED_PATTERNS = [
  /^\/favorites\/?$/, /^\/profile(?:\/.*)?$/, /^\/notifications\/?$/,
  /^\/saved-searches\/?$/, /^\/verify-email\/?$/, /^\/register-success\/?$/,
  /^\/best-offer\/[^/]+\/?$/, /^\/me\/(?:listings|leads)(?:\/.*)?$/,
];

export function stripLocale(pathname: string): { locale: AppLocale | null; path: string } {
  const match = pathname.match(/^\/(ar|en)(?=\/|$)/);
  if (!match) return { locale: null, path: pathname || '/' };
  const path = pathname.slice(match[0].length) || '/';
  return { locale: match[1] as AppLocale, path: path.startsWith('/') ? path : `/${path}` };
}

export function classifyRoute(pathname: string): RouteAccess | 'not-found' {
  const { path } = stripLocale(pathname);
  if (PUBLIC_PATTERNS.some((pattern) => pattern.test(path))) return 'public';
  if (GUEST_PATTERNS.some((pattern) => pattern.test(path))) return 'guest';
  if (OPEN_RECOVERY_PATTERNS.some((pattern) => pattern.test(path))) return 'public';
  if (/^\/sell\/?$/.test(path)) return 'verified-phone';
  if (/^\/me\/dashboard\/?$/.test(path)) return 'vendor-manager';
  if (AUTHENTICATED_PATTERNS.some((pattern) => pattern.test(path))) return 'authenticated';
  return 'not-found';
}

export function isProtectedAccess(access: RouteAccess | 'not-found'): boolean {
  return access === 'authenticated' || access === 'verified-phone' || access === 'vendor-staff' || access === 'vendor-manager';
}

export function localizedPath(locale: AppLocale, path: string): string {
  const normalized = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/g, '')}`;
  return `/${locale}${normalized}`;
}

export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  '/home': '/',
  '/connection': '/',
  '/explore': '/search',
};
