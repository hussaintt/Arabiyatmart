/**
 * Deliberate and cache-safe locale negotiation for middleware and server runtime.
 * Implements Phase 2 Task 2.2:
 * 1. Verified signed locale cookie precedence (am_locale).
 * 2. Supported Accept-Language header negotiation (ar | en) with quality (q) ranking.
 * 3. Arabic-first default fallback (defaultLocale = 'ar').
 * 4. Safe for Edge runtime (no Node built-ins, uses crypto.subtle via locale-cookie).
 */

import { defaultLocale, isAppLocale, type AppLocale } from '@/i18n/config';
import { verifyLocalePreference } from '@/lib/auth/locale-cookie';

export interface AcceptLanguageCandidate {
  locale: AppLocale;
  q: number;
  order: number;
}

/**
 * Parses an RFC 9110 / RFC 4647 Accept-Language header string.
 * Extracts candidate preferences, matches them against supported locales (ar, en),
 * weights by quality factor (q), and returns the best matching AppLocale or null.
 */
export function parseAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header || typeof header !== 'string') return null;

  const raw = header.trim();
  if (!raw || raw === '*') return null;

  const parts = raw.split(',');
  const candidates: AcceptLanguageCandidate[] = [];

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]?.trim();
    if (!part) continue;

    const [tagPart, ...paramParts] = part.split(';');
    const tag = tagPart?.trim().toLowerCase() ?? '';
    if (!tag || tag === '*') continue;

    // Parse quality factor (q=0.0 - 1.0), defaulting to 1.0
    let q = 1.0;
    for (const param of paramParts) {
      const trimmedParam = param.trim();
      if (trimmedParam.startsWith('q=')) {
        const qVal = parseFloat(trimmedParam.slice(2).trim());
        if (!Number.isNaN(qVal)) {
          q = Math.max(0, Math.min(1, qVal));
        }
      }
    }

    // Ignore explicitly rejected languages (q=0)
    if (q <= 0) continue;

    // Match language tag to supported application locales
    // e.g. 'ar', 'ar-eg', 'ar-sa' -> 'ar'; 'en', 'en-us', 'en-gb' -> 'en'
    let matched: AppLocale | null = null;
    if (tag === 'ar' || tag.startsWith('ar-')) {
      matched = 'ar';
    } else if (tag === 'en' || tag.startsWith('en-')) {
      matched = 'en';
    }

    if (matched && isAppLocale(matched)) {
      candidates.push({ locale: matched, q, order: index });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by q descending, then by original order ascending (stable precedence)
  candidates.sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    return a.order - b.order;
  });

  const topCandidate = candidates[0];
  return topCandidate ? topCandidate.locale : null;
}

export interface NegotiateLocaleOptions {
  cookie?: string | null | undefined;
  acceptLanguage?: string | null | undefined;
  secret?: string | undefined;
}

/**
 * Resolves the active locale with approved precedence:
 * 1. Verified signed cookie ('am_locale')
 * 2. Supported Accept-Language header ('ar' | 'en')
 * 3. Default locale ('ar')
 */
export async function resolveNegotiatedLocale(
  options: NegotiateLocaleOptions = {}
): Promise<AppLocale> {
  // 1. Check verified signed cookie precedence
  if (options.cookie) {
    const cookieLocale = await verifyLocalePreference(options.cookie, options.secret);
    if (cookieLocale && isAppLocale(cookieLocale)) {
      return cookieLocale;
    }
  }

  // 2. Check supported Accept-Language header
  if (options.acceptLanguage) {
    const headerLocale = parseAcceptLanguage(options.acceptLanguage);
    if (headerLocale && isAppLocale(headerLocale)) {
      return headerLocale;
    }
  }

  // 3. Arabic-first default
  return defaultLocale;
}
