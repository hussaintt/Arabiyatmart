/**
 * External URL parsing, validation, and approved-origin sanitization.
 *
 * Implements Phase 1 Section 3.1 and Phase 2 Section 3.1:
 * - Approved-origin parsing for image, contact, and backend URLs.
 * - Rejects credentials/userinfo in URLs (e.g., https://user:pass@host).
 * - Rejects non-HTTP protocols (e.g., javascript:, data:, file:, ftp:).
 * - Rejects protocol-relative URLs (e.g., //attacker.com).
 * - Rejects localhost and loopback interfaces in production.
 * - Rejects open redirects and backslash scheme-smuggling attacks.
 */

export const DEFAULT_IMAGE_HOSTS: readonly string[] = [
  'images.unsplash.com',
  'lh3.googleusercontent.com',
  'appleid.cdn-apple.com',
  'api.arabiyatmart.com',
];

export interface ExternalUrlOptions {
  isProduction?: boolean | undefined;
  allowedOrigins?: string[] | undefined;
  backendOrigin?: string | undefined;
  mediaCdnOrigin?: string | undefined;
}

/**
 * Checks whether a hostname belongs to a local or loopback interface.
 */
function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.localhost') ||
    /^127(?:\.\d+){3}$/.test(lower)
  );
}

/**
 * Parses and validates an external URL against strict security invariants:
 * - No userinfo / credentials
 * - No protocol-relative URLs or backslashes
 * - HTTP/HTTPS only; HTTPS required in production
 * - No localhost in production
 * - Origin must match allowedOrigins if specified
 */
export function parseApprovedUrl(
  url: string,
  options: ExternalUrlOptions = {}
): URL | null {
  if (!url || typeof url !== 'string') return null;

  // Strictly reject leading or trailing whitespace
  if (/^\s|\s$/.test(url)) {
    return null;
  }

  // Reject control characters or embedded whitespace
  if (/[\x00-\x20\x7F]/.test(url)) {
    return null;
  }

  // Reject protocol-relative URLs, backslashes, or encoded separators/traversal
  if (
    url.startsWith('//') ||
    url.startsWith('/\\') ||
    url.includes('\\') ||
    /%(?:2f|5c|2e|00)/i.test(url)
  ) {
    return null;
  }

  // Iterative decode check for double/nested encoding
  let current = url;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      if (
        next.includes('\\') ||
        next.includes('\0') ||
        next.includes('/../') ||
        next.endsWith('/..') ||
        next === '/..' ||
        next.startsWith('//') ||
        next.startsWith('/\\') ||
        /%(?:2f|5c|2e|00)/i.test(next)
      ) {
        return null;
      }
      current = next;
    } catch {
      return null;
    }
  }

  const isProduction =
    options.isProduction ??
    (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production');

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Reject credentials in URLs
  if (parsed.username || parsed.password) {
    return null;
  }

  // Protocol validation: must be http or https
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return null;
  }

  // In production, remote URLs MUST use HTTPS
  if (isProduction && protocol !== 'https:') {
    return null;
  }

  // Localhost / loopback check in production
  if (isProduction && isLoopbackHost(parsed.hostname)) {
    return null;
  }

  // Origin check if allowedOrigins is provided
  if (options.allowedOrigins && options.allowedOrigins.length > 0) {
    const originMatched = options.allowedOrigins.some((allowed) => {
      try {
        const allowedOrigin = new URL(allowed).origin.toLowerCase();
        return parsed.origin.toLowerCase() === allowedOrigin;
      } catch {
        return false;
      }
    });
    if (!originMatched) {
      return null;
    }
  }

  return parsed;
}

/**
 * Validates whether an image URL originates from an approved image host or CDN.
 */
export function isApprovedImageUrl(
  url: string,
  options: ExternalUrlOptions = {}
): boolean {
  const allowedOrigins: string[] = [];

  // Default image hosts
  for (const host of DEFAULT_IMAGE_HOSTS) {
    allowedOrigins.push(`https://${host}`);
  }

  if (options.mediaCdnOrigin) {
    allowedOrigins.push(options.mediaCdnOrigin);
  }

  if (options.backendOrigin) {
    allowedOrigins.push(options.backendOrigin);
  }

  const isProduction =
    options.isProduction ??
    (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production');

  if (!isProduction) {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000', 'http://127.0.0.1:4000');
  }

  const parsed = parseApprovedUrl(url, { ...options, allowedOrigins });
  return parsed !== null;
}

/**
 * Validates whether a URL points to the approved Fastify backend API origin.
 */
export function isApprovedBackendUrl(
  url: string,
  options: ExternalUrlOptions = {}
): boolean {
  const backendOrigin = options.backendOrigin ?? process.env.BACKEND_API_ORIGIN;
  if (!backendOrigin) {
    return false;
  }

  const parsed = parseApprovedUrl(url, {
    ...options,
    allowedOrigins: [backendOrigin],
  });
  return parsed !== null;
}

/**
 * Validates whether a redirect target is safe against open redirect vulnerabilities.
 * Allows:
 * - Relative paths starting with a single '/' (not '//' or '/\')
 * - Absolute URLs pointing to an allowed origin
 *
 * Strictly rejects:
 * - Percent-encoded path separators (%2f, %5c), dot traversal (%2e), or null bytes (%00)
 * - Protocol-relative paths (// or /\)
 * - Raw backslashes (\)
 * - Control characters or whitespace
 * - Decoded traversal (/../)
 */
export function isSafeRedirectTarget(
  url: string,
  options: ExternalUrlOptions = {}
): boolean {
  if (!url || typeof url !== 'string') return false;

  // Strictly reject leading or trailing whitespace (never silently accepted or trimmed)
  if (/^\s|\s$/.test(url)) {
    return false;
  }

  // Reject control characters or internal whitespace
  if (/[\x00-\x20\x7F]/.test(url)) return false;

  // Reject backslashes anywhere
  if (url.includes('\\')) return false;

  // Reject protocol-relative URLs (raw // or /\)
  if (url.startsWith('//') || url.startsWith('/\\')) return false;

  // Strictly reject percent-encoded path separators (/ or \), dot traversal (.), or null bytes
  if (/%(?:2f|5c|2e|00)/i.test(url)) {
    return false;
  }

  // Perform bounded iterative decoding until stable to catch double/nested encoding
  let decoded: string = url;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      if (
        next.startsWith('//') ||
        next.startsWith('/\\') ||
        next.includes('\\') ||
        next.includes('\0') ||
        next.includes('/../') ||
        next.endsWith('/..') ||
        next === '/..' ||
        /%(?:2f|5c|2e|00)/i.test(next) ||
        /[\x00-\x1F\x7F]/.test(next)
      ) {
        return false;
      }
      decoded = next;
    } catch {
      return false;
    }
  }

  if (
    decoded.startsWith('//') ||
    decoded.startsWith('/\\') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    decoded.includes('/../') ||
    decoded.endsWith('/..') ||
    decoded === '/..' ||
    /%(?:2f|5c|2e|00)/i.test(decoded) ||
    /[\x00-\x1F\x7F]/.test(decoded)
  ) {
    return false;
  }

  // Relative path validation
  if (url.startsWith('/')) {
    // Second character must not be / or \
    if (url.length > 1 && (url[1] === '/' || url[1] === '\\')) {
      return false;
    }

    // Ensure path doesn't contain authority smuggling like /@evil.com in raw or decoded form
    const rawPathWithoutQuery = url.split(/[?#]/)[0] ?? '';
    if (rawPathWithoutQuery.includes('@')) {
      return false;
    }
    const decodedPathWithoutQuery = decoded.split(/[?#]/)[0] ?? '';
    if (decodedPathWithoutQuery.includes('@')) {
      return false;
    }

    try {
      const dummyOrigin = 'https://safe-internal.local';
      const resolved = new URL(url, dummyOrigin);
      return (
        resolved.origin === dummyOrigin &&
        resolved.pathname.startsWith('/') &&
        !resolved.pathname.startsWith('//')
      );
    } catch {
      return false;
    }
  }

  // Absolute URL validation
  if (options.allowedOrigins && options.allowedOrigins.length > 0) {
    const parsed = parseApprovedUrl(url, options);
    return parsed !== null;
  }

  return false;
}

/**
 * Validates and classifies contact URLs (tel, mailto, whatsapp).
 * Rejects javascript:, data:, or parameter injection.
 */
export function isSafeContactUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Disallow control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;

  // 1. Telephone links: tel:+1234567890
  if (trimmed.toLowerCase().startsWith('tel:')) {
    const numberPart = trimmed.slice(4).trim();
    // Allow standard international phone characters: digits, +, -, space, parentheses
    return /^\+?[\d\s().-]{5,30}$/.test(numberPart);
  }

  // 2. Email links: mailto:user@domain.com
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    const emailPart = trimmed.slice(7).trim();
    // Basic email format without CRLF or scheme injection
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailPart);
  }

  // 3. WhatsApp web links: https://wa.me/... or https://api.whatsapp.com/send...
  if (trimmed.toLowerCase().startsWith('https://wa.me/') || trimmed.toLowerCase().startsWith('https://api.whatsapp.com/send')) {
    try {
      const parsed = new URL(trimmed);
      return (
        parsed.protocol === 'https:' &&
        (parsed.hostname === 'wa.me' || parsed.hostname === 'api.whatsapp.com') &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Normalizes contact information into a safe URI link.
 */
export function sanitizeContactUrl(url: string): string | null {
  if (!isSafeContactUrl(url)) {
    return null;
  }
  return url.trim();
}
