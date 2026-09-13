/**
 * Safe Return-To URL validation and sanitization primitives.
 *
 * Implements Phase 1 Section 2.6/5.3 and TASK-014:
 * - Strictly allowlists relative application paths belonging to known locale routes.
 * - Rejects external URLs, protocol-relative paths (//), backslash traversal (\),
 *   encoded traversal (%2e%2e, %5c, %2f in path), and control characters (\u0000-\u001F).
 * - Prevents auth-loop vulnerabilities by forbidding returnTo from pointing to
 *   login, register, verify-email, reset-password, or API endpoints.
 * - Enforces locale alignment: Arabic ('ar') or English ('en').
 * - Safely falls back to localized application root (e.g. '/ar' or '/en') on invalid input.
 */

export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'ar';

/**
 * Route prefixes that must NEVER be used as a returnTo destination to prevent redirect loops.
 * Evaluated against the parsed pathname.
 */
const AUTH_LOOP_ROUTE_PATTERNS = [
  /^\/(?:ar|en)\/login(?:\/|$)/,
  /^\/(?:ar|en)\/register(?:\/|$)/,
  /^\/(?:ar|en)\/verify-email(?:\/|$)/,
  /^\/(?:ar|en)\/register-success(?:\/|$)/,
  /^\/(?:ar|en)\/forgot-password(?:\/|$)/,
  /^\/(?:ar|en)\/reset-password(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/register(?:\/|$)/,
  /^\/verify-email(?:\/|$)/,
  /^\/forgot-password(?:\/|$)/,
  /^\/reset-password(?:\/|$)/,
];

/**
 * Known valid application route path patterns (per Phase 1 Section 2.2 and 2.3).
 * Evaluated against the parsed pathname (clean of query and hash).
 */
const ALLOWED_APPLICATION_PATH_PATTERNS = [
  // Home
  /^\/(?:ar|en)\/?$/,
  // Marketplace public discovery
  /^\/(?:ar|en)\/search\/?$/,
  /^\/(?:ar|en)\/listing\/[a-zA-Z0-9_.~%-]+\/?$/,
  /^\/(?:ar|en)\/catalogue(?:\/.*)?$/,
  /^\/(?:ar|en)\/dealers(?:\/.*)?$/,
  /^\/(?:ar|en)\/compare\/?$/,
  // Authenticated account & selling
  /^\/(?:ar|en)\/favorites\/?$/,
  /^\/(?:ar|en)\/profile(?:\/.*)?$/,
  /^\/(?:ar|en)\/notifications\/?$/,
  /^\/(?:ar|en)\/saved-searches\/?$/,
  /^\/(?:ar|en)\/sell\/?$/,
  /^\/(?:ar|en)\/best-offer\/[a-zA-Z0-9_.~%-]+\/?$/,
  /^\/(?:ar|en)\/me\/listings(?:\/.*)?$/,
  /^\/(?:ar|en)\/me\/leads(?:\/.*)?$/,
  /^\/(?:ar|en)\/me\/dashboard(?:\/.*)?$/,
  // Error & Status
  /^\/(?:ar|en)\/forbidden\/?$/,
];

/**
 * Checks if a string contains prohibited characters, encodings, or protocol markers.
 * Applies bounded iterative percent-decoding to uncover double- or multi-encoded attacks.
 */
function hasMaliciousPatterns(path: string): boolean {
  // Disallow non-relative paths, protocol-relative paths, and backslash beginnings
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/\\') ||
    path.startsWith('\\')
  ) {
    return true;
  }

  // Split path portion from query and hash
  const qIdx = path.search(/[?#]/);
  const pathOnly = qIdx === -1 ? path : path.slice(0, qIdx);
  const queryAndHash = qIdx === -1 ? '' : path.slice(qIdx);

  // Validate query/hash encoding: preserve valid query encoding and avoid accepting malformed decoding
  if (queryAndHash.length > 0) {
    try {
      decodeURI(queryAndHash);
    } catch {
      return true; // malformed percent-encoding in query or hash
    }
  }

  // Bounded iterative percent-decoding on the path portion (up to 4 iterations)
  const MAX_DECODE_DEPTH = 4;
  let currentPath = pathOnly;
  const decodeLayers: string[] = [currentPath];

  for (let i = 0; i < MAX_DECODE_DEPTH; i++) {
    if (!currentPath.includes('%')) {
      break;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(currentPath);
    } catch {
      return true; // malformed percent-encoding in path
    }
    if (decoded === currentPath) {
      break;
    }
    decodeLayers.push(decoded);
    currentPath = decoded;
  }

  // If after max iterations there are still changing percent-encodings, reject excessive multi-encoding
  if (currentPath.includes('%')) {
    try {
      const further = decodeURIComponent(currentPath);
      if (further !== currentPath) {
        return true;
      }
    } catch {
      return true;
    }
  }

  // Check every layer (raw and all intermediate decoded layers) for malicious patterns
  for (const layer of decodeLayers) {
    // Disallow backslashes and encoded backslashes
    if (layer.includes('\\') || /%5c/i.test(layer)) {
      return true;
    }

    // Disallow encoded slashes in path portion
    if (/%2f/i.test(layer)) {
      return true;
    }

    // Disallow control characters and null bytes (literal or encoded)
    if (
      /[\u0000-\u001F\u007F]/.test(layer) ||
      /%(?:0[0-9a-fA-F]|1[0-9a-fA-F]|7[fF])/i.test(layer)
    ) {
      return true;
    }

    // Disallow protocol-relative prefixes, backslash beginnings, or double slashes
    if (
      layer.startsWith('//') ||
      layer.startsWith('/\\') ||
      layer.startsWith('\\') ||
      layer.includes('//')
    ) {
      return true;
    }

    // Disallow absolute schemes at start
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(layer.slice(1))) {
      return true;
    }

    // Disallow dot-segment directory traversals
    if (
      /(?:^|\/)\.\.(?:\/|$)/.test(layer) ||
      /(?:^|\/)\.(?:\/|$)/.test(layer) ||
      /(?:^|\/)(?:\.|\%2e){1,2}(?:\/|$)/i.test(layer) ||
      /%2e/i.test(layer)
    ) {
      return true;
    }

    // Check individual path segments for dot or traversal
    const segments = layer.split('/');
    for (const seg of segments) {
      if (seg === '.' || seg === '..') {
        return true;
      }
    }

    // Disallow auth-loop routes revealed at any decoding layer
    for (const pattern of AUTH_LOOP_ROUTE_PATTERNS) {
      if (pattern.test(layer)) {
        return true;
      }
    }
  }

  // Disallow raw path starting with scheme or containing literal/encoded backslashes/controls anywhere
  if (
    path.includes('\\') ||
    /%5c/i.test(path) ||
    /[\u0000-\u001F\u007F]/.test(path) ||
    /%(?:0[0-9a-fA-F]|1[0-9a-fA-F]|7[fF])/i.test(path) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path.slice(1))
  ) {
    return true;
  }

  return false;
}

/**
 * Determines whether a given value is a safe, allowable relative returnTo destination.
 */
export function isValidReturnTo(
  rawReturnTo: unknown,
  expectedLocale?: SupportedLocale
): rawReturnTo is string {
  if (typeof rawReturnTo !== 'string') {
    return false;
  }

  // Reject surrounding whitespace directly; returnTo input must already be a canonical safe relative path.
  if (rawReturnTo !== rawReturnTo.trim()) {
    return false;
  }

  if (rawReturnTo.length === 0 || rawReturnTo.length > 2048) {
    return false;
  }

  if (hasMaliciousPatterns(rawReturnTo)) {
    return false;
  }

  // Validate URL structure using standard WHATWG URL with dummy origin
  let parsed: URL;
  try {
    const dummyOrigin = 'https://arabiyatmart.internal';
    parsed = new URL(rawReturnTo, dummyOrigin);
    if (
      parsed.origin !== dummyOrigin ||
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'arabiyatmart.internal'
    ) {
      return false;
    }
  } catch {
    return false;
  }

  // Check auth-loop prevention on parsed pathname
  for (const pattern of AUTH_LOOP_ROUTE_PATTERNS) {
    if (pattern.test(parsed.pathname)) {
      return false;
    }
  }

  // Check locale prefix from pathname segments
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const localeSegment = pathSegments[0] as SupportedLocale | undefined;
  if (!localeSegment || !SUPPORTED_LOCALES.includes(localeSegment)) {
    return false;
  }

  // If a specific locale is expected, verify it matches
  if (expectedLocale && localeSegment !== expectedLocale) {
    return false;
  }

  // Check allowlisted route patterns against parsed pathname
  const matchesAllowedRoute = ALLOWED_APPLICATION_PATH_PATTERNS.some((pattern) =>
    pattern.test(parsed.pathname)
  );

  return matchesAllowedRoute;
}

/**
 * Sanitizes an untrusted returnTo value, returning a safe relative path or the localized fallback.
 */
export function sanitizeReturnTo(
  rawReturnTo: unknown,
  expectedLocale: SupportedLocale = DEFAULT_LOCALE,
  fallback?: string
): string {
  const safeFallback =
    fallback && isValidReturnTo(fallback, expectedLocale)
      ? fallback
      : `/${expectedLocale}`;

  if (!isValidReturnTo(rawReturnTo, expectedLocale)) {
    return safeFallback;
  }

  return rawReturnTo;
}

/**
 * Extracts and sanitizes the 'returnTo' parameter from query params.
 */
export function extractReturnTo(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | string
    | URL
    | null
    | undefined,
  expectedLocale: SupportedLocale = DEFAULT_LOCALE,
  fallback?: string
): string {
  if (!searchParams) {
    return sanitizeReturnTo(undefined, expectedLocale, fallback);
  }

  let rawValue: unknown;

  if (searchParams instanceof URLSearchParams) {
    rawValue = searchParams.get('returnTo') ?? searchParams.get('return_to');
  } else if (searchParams instanceof URL) {
    rawValue = searchParams.searchParams.get('returnTo') ?? searchParams.searchParams.get('return_to');
  } else if (typeof searchParams === 'string') {
    let queryString = searchParams;
    const qIdx = queryString.indexOf('?');
    if (qIdx !== -1) {
      queryString = queryString.slice(qIdx + 1);
    }
    const hIdx = queryString.indexOf('#');
    if (hIdx !== -1) {
      queryString = queryString.slice(0, hIdx);
    }
    const params = new URLSearchParams(queryString);
    rawValue = params.get('returnTo') ?? params.get('return_to');
  } else if (
    typeof searchParams === 'object' &&
    searchParams !== null &&
    'searchParams' in searchParams &&
    (searchParams as Record<string, unknown>)['searchParams'] instanceof URLSearchParams
  ) {
    const sp = (searchParams as Record<string, unknown>)['searchParams'] as URLSearchParams;
    rawValue = sp.get('returnTo') ?? sp.get('return_to');
  } else {
    const record = searchParams as Record<string, string | string[] | undefined>;
    const val = record['returnTo'] ?? record['return_to'];
    rawValue = Array.isArray(val) ? val[0] : val;
  }

  return sanitizeReturnTo(rawValue, expectedLocale, fallback);
}
