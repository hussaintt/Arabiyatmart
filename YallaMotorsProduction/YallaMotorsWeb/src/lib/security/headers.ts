/**
 * Security headers and Content Security Policy (CSP) configuration.
 *
 * Implements strict security headers, clickjacking frame protection,
 * XSS mitigations, production HSTS, and explicit remote image/origin allowlists.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface SecurityHeaderOptions {
  isProduction?: boolean | undefined;
  siteOrigin?: string | undefined;
  backendOrigin?: string | undefined;
  mediaCdnOrigin?: string | undefined;
  reportOnly?: boolean | undefined;
}

export interface CspOptions {
  isProduction?: boolean | undefined;
  siteOrigin?: string | undefined;
  backendOrigin?: string | undefined;
  mediaCdnOrigin?: string | undefined;
}

export interface ImageHostOptions {
  isProduction?: boolean | undefined;
  backendOrigin?: string | undefined;
  mediaCdnOrigin?: string | undefined;
}

export interface RemotePattern {
  protocol?: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname?: string;
  search?: string;
}

const DEFAULT_IMAGE_HOSTS: readonly string[] = [
  'images.unsplash.com',
  'lh3.googleusercontent.com',
  'appleid.cdn-apple.com',
  'api.arabiyatmart.com',
];

/**
 * Builds Content Security Policy (CSP) directives string.
 *
 * Directives enforce:
 * - default-src: 'self'
 * - script-src: 'self', 'unsafe-inline' (hydration/Next.js runtime), explicit Google/Apple/Firebase origins.
 *   Strictly forbids wildcard origins ('*') and forbids 'unsafe-eval' in production.
 * - style-src: 'self', 'unsafe-inline' (Tailwind/CSS-in-JS), Google Fonts stylesheet origin.
 * - img-src: 'self', data:, blob:, explicit trusted origins (no wildcard '*').
 * - font-src: 'self', data:, Google Fonts static asset origin.
 * - connect-src: 'self', explicit API, Google, Apple, and Firebase endpoints.
 * - media-src: 'self', blob:, explicit media origin (no wildcard '*').
 * - frame-src: 'self', explicit Google, Apple, and Firebase auth/reCAPTCHA frames.
 * - frame-ancestors: 'none' (anti-clickjacking).
 * - object-src: 'none'.
 * - base-uri: 'self'.
 * - form-action: 'self', Google accounts, Apple ID.
 * - upgrade-insecure-requests in production.
 */
export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://accounts.google.com',
    'https://apis.google.com',
    'https://appleid.cdn-apple.com',
    'https://www.gstatic.com',
  ];

  if (!isProduction) {
    // Only allow eval in local development for Next.js Fast Refresh
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = [
    "'self'",
    'https://accounts.google.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://appleid.apple.com',
    'https://*.firebaseio.com',
    'https://*.googleapis.com',
    'https://fcmregistrations.googleapis.com',
  ];

  if (options.backendOrigin) {
    try {
      const parsed = new URL(options.backendOrigin);
      const proto = parsed.protocol.replace(':', '').toLowerCase();
      if ((proto === 'https' || (!isProduction && proto === 'http')) && parsed.origin !== 'null') {
        connectSrc.push(parsed.origin);
      }
    } catch {
      // Invalid URL handled by env validation
    }
  }

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    ...DEFAULT_IMAGE_HOSTS.map((h) => `https://${h}`),
  ];

  const imageOrigins = [options.mediaCdnOrigin, options.backendOrigin].filter(Boolean) as string[];
  for (const origin of imageOrigins) {
    try {
      const parsed = new URL(origin);
      const proto = parsed.protocol.replace(':', '').toLowerCase();
      if ((proto === 'https' || (!isProduction && proto === 'http')) && parsed.origin !== 'null') {
        if (!imgSrc.includes(parsed.origin)) {
          imgSrc.push(parsed.origin);
        }
      }
    } catch {
      // Ignored if invalid
    }
  }

  const mediaSrc = [
    "'self'",
    'blob:',
    'https://api.arabiyatmart.com',
  ];

  if (options.mediaCdnOrigin) {
    try {
      const parsed = new URL(options.mediaCdnOrigin);
      const proto = parsed.protocol.replace(':', '').toLowerCase();
      if ((proto === 'https' || (!isProduction && proto === 'http')) && parsed.origin !== 'null') {
        mediaSrc.push(parsed.origin);
      }
    } catch {
      // Ignored if invalid
    }
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': imgSrc,
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': connectSrc,
    'media-src': mediaSrc,
    'frame-src': [
      "'self'",
      'https://accounts.google.com',
      'https://appleid.apple.com',
      'https://*.firebaseapp.com',
      'https://www.google.com/recaptcha/',
      'https://recaptcha.google.com/',
    ],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", 'https://accounts.google.com', 'https://appleid.apple.com'],
  };

  if (isProduction) {
    directives['upgrade-insecure-requests'] = [];
  }

  return Object.entries(directives)
    .map(([key, values]) => (values.length > 0 ? `${key} ${values.join(' ')}` : key))
    .join('; ');
}

/**
 * Builds all security headers as a key-value record.
 */
export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');
  const cspHeader = options.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  const headers: Record<string, string> = {
    [cspHeader]: buildContentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(self), microphone=(), geolocation=(), browsing-topics=(), payment=()',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'on',
  };

  if (isProduction) {
    // 2 years HSTS with subdomains and preload inclusion
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

/**
 * Returns security headers in the NextConfig headers array format.
 */
export function getSecurityHeaders(options: SecurityHeaderOptions = {}): SecurityHeader[] {
  const record = buildSecurityHeaders(options);
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function parseAllowedRemotePattern(
  originStr: string,
  isProduction: boolean
): RemotePattern | null {
  try {
    const parsed = new URL(originStr);
    const protocol = parsed.protocol.replace(':', '').toLowerCase();

    // Reject unsupported schemes (e.g. ftp, javascript, data, file)
    if (protocol !== 'http' && protocol !== 'https') {
      return null;
    }

    // In production, remote origins MUST use HTTPS
    if (isProduction && protocol !== 'https') {
      return null;
    }

    // Hostname must be valid and must never contain wildcards
    if (!parsed.hostname || parsed.hostname.includes('*')) {
      return null;
    }

    const pattern: RemotePattern = {
      protocol: protocol as 'http' | 'https',
      hostname: parsed.hostname,
    };
    if (parsed.port) {
      pattern.port = parsed.port;
    }
    return pattern;
  } catch {
    return null;
  }
}

/**
 * Returns allowed remote patterns for Next.js image optimization.
 * Forbids wildcard '*' hostnames and allows only explicit hosts and protocols.
 * Drops unsupported schemes (e.g. ftp, javascript) and requires HTTPS in production.
 */
export function getAllowedImageRemotePatterns(options: ImageHostOptions = {}): RemotePattern[] {
  const isProduction =
    options.isProduction ??
    (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production');

  const patterns: RemotePattern[] = DEFAULT_IMAGE_HOSTS.map((hostname) => ({
    protocol: 'https',
    hostname,
  }));

  if (options.backendOrigin) {
    const pattern = parseAllowedRemotePattern(options.backendOrigin, isProduction);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  if (options.mediaCdnOrigin) {
    const pattern = parseAllowedRemotePattern(options.mediaCdnOrigin, isProduction);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  // In local development, permit loopback images if testing local uploads
  if (!isProduction) {
    patterns.push({
      protocol: 'http',
      hostname: 'localhost',
    });
    patterns.push({
      protocol: 'http',
      hostname: '127.0.0.1',
    });
  }

  return patterns;
}

/**
 * Validates that a redirect destination is safe.
 * Rejects:
 * - protocol-relative URLs (e.g. //evil.com)
 * - javascript:, data:, or other scheme injections
 * - external origins not explicitly matching allowedOrigins
 *
 * Allows:
 * - relative paths starting with / (e.g. /ar/me, /en/dealers)
 * - absolute URLs matching an explicitly allowed origin
 */
export function validateRedirectHost(url: string, allowedOrigins: string[] = []): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();

  // Reject backslashes anywhere: browsers normalize /\ or \ to network paths
  if (trimmed.includes('\\')) {
    return false;
  }

  // Reject whitespace or control characters
  if (/[\s\r\n\t]/.test(trimmed)) {
    return false;
  }

  // Reject protocol-relative URLs
  if (trimmed.startsWith('//')) {
    return false;
  }

  // Reject dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }

  // Relative paths: verify they strictly stay relative when resolved
  if (trimmed.startsWith('/')) {
    try {
      const dummyBase = 'https://internal.canonical.local';
      const resolved = new URL(trimmed, dummyBase);
      return resolved.origin === dummyBase && resolved.pathname.startsWith('/');
    } catch {
      return false;
    }
  }

  // Validate absolute URLs
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    return allowedOrigins.some((allowed) => {
      try {
        const allowedParsed = new URL(allowed);
        return parsed.origin === allowedParsed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
