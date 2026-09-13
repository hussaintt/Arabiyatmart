import 'server-only';

import type { Metadata } from 'next';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';

const CANONICAL_PUBLIC_QUERY_KEYS = new Set([
  'q', 'makeSlug', 'modelSlug', 'yearMin', 'yearMax', 'priceMin', 'priceMax', 'mileageMax',
  'cityId', 'areaId', 'condition', 'fuelType', 'transmission', 'bodyType', 'sellerType',
  'vehicleType', 'hasWarranty', 'isNegotiable', 'installmentAvailable', 'exchangeAccepted',
  'isVerified', 'sort',
]);

function normalizedPath(path: string): string {
  if (path !== path.trim() || /[?#\\\u0000-\u001f]/.test(path)) throw new Error('Metadata path must be a clean relative pathname');
  const value = path.startsWith('/') ? path : `/${path}`;
  const normalized = value.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  let decoded = normalized;
  for (let index = 0; index < 3; index += 1) {
    try { decoded = decodeURIComponent(decoded); }
    catch { throw new Error('Metadata path contains malformed encoding'); }
    if (/^[^/]|[\\\u0000-\u001f]/.test(decoded) || decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
      throw new Error('Metadata path contains an unsafe segment');
    }
  }
  return normalized;
}

export function canonicalizePublicUrl(
  path: string,
  query?: URLSearchParams | Record<string, string | number | boolean | null | undefined>,
  allowedQueryKeys: ReadonlySet<string> = CANONICAL_PUBLIC_QUERY_KEYS
): string {
  const url = new URL(normalizedPath(path), serverEnv.SITE_ORIGIN);
  const source = query instanceof URLSearchParams ? [...query.entries()] : Object.entries(query ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)] as const);
  const counts = new Map<string, number>();
  for (const [key] of source) counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const [key, value] of source.sort(([a], [b]) => a.localeCompare(b))) {
    if (!value || !allowedQueryKeys.has(key) || counts.get(key) !== 1) continue;
    if (/[^\x20-\x7E]/.test(value) || value.length > 160) continue;
    url.searchParams.set(key, value);
  }
  url.hash = '';
  return url.toString();
}

export function localizedAlternates(pathWithoutLocale: string, query?: Record<string, string | number | boolean | null | undefined>, allowedQueryKeys?: ReadonlySet<string>) {
  const path = normalizedPath(pathWithoutLocale).replace(/^\/(?:ar|en)(?=\/|$)/, '') || '/';
  const ar = canonicalizePublicUrl(`/ar${path === '/' ? '' : path}`, query, allowedQueryKeys);
  return {
    ar,
    en: canonicalizePublicUrl(`/en${path === '/' ? '' : path}`, query, allowedQueryKeys),
    'x-default': ar,
  };
}

function approvedImage(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, serverEnv.SITE_ORIGIN);
    const allowed = [new URL(serverEnv.SITE_ORIGIN).origin, serverEnv.MEDIA_CDN_ORIGIN ? new URL(serverEnv.MEDIA_CDN_ORIGIN).origin : null].filter(Boolean);
    const safeProtocol = url.protocol === 'https:' || (serverEnv.APP_ENV !== 'production' && url.protocol === 'http:');
    return safeProtocol && allowed.includes(url.origin) ? url.toString() : undefined;
  } catch { return undefined; }
}

export interface BuildLocalizedMetadataOptions {
  locale: AppLocale;
  path: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  imageDimensions?: { width: number; height: number };
  imageAlt?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  noindex?: boolean;
  allowedQueryKeys?: readonly string[];
}

export function buildLocalizedMetadata(options: BuildLocalizedMetadataOptions): Metadata {
  if (!isAppLocale(options.locale)) throw new Error('Unsupported metadata locale');
  const allowedQueryKeys = options.allowedQueryKeys ? new Set(options.allowedQueryKeys) : CANONICAL_PUBLIC_QUERY_KEYS;
  const canonical = canonicalizePublicUrl(options.path, options.query, allowedQueryKeys);
  const image = approvedImage(options.imageUrl) ?? approvedImage('/images/og-default.jpg');
  const isArabic = options.locale === 'ar';

  const ogImages = image
    ? [
        options.imageDimensions
          ? {
              url: image,
              width: options.imageDimensions.width,
              height: options.imageDimensions.height,
              alt: options.imageAlt ?? options.title,
              type: 'image/png',
            }
          : { url: image },
      ]
    : [];

  return {
    title: options.title,
    description: options.description,
    alternates: { canonical, languages: localizedAlternates(options.path, options.query, allowedQueryKeys) },
    robots: options.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: isArabic ? 'ar_EG' : 'en_US',
      url: canonical,
      title: options.title,
      description: options.description,
      siteName: isArabic ? 'عربيات مارت' : 'Arabiyatmart',
      ...(ogImages.length > 0 ? { images: ogImages } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: options.title,
      description: options.description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
