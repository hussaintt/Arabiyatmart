import { describe, it, expect } from 'vitest';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  getSecurityHeaders,
  getAllowedImageRemotePatterns,
  validateRedirectHost,
} from '@/lib/security/headers';

describe('Security Headers Suite', () => {
  describe('Content Security Policy (CSP)', () => {
    it('generates compliant CSP for development', () => {
      const csp = buildContentSecurityPolicy({ isProduction: false });

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain('https://accounts.google.com');
      expect(csp).toContain('https://appleid.cdn-apple.com');
      expect(csp).toContain('https://www.gstatic.com');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).not.toContain('upgrade-insecure-requests');
    });

    it('forbids unsafe-eval and wildcard script origins in production', () => {
      const csp = buildContentSecurityPolicy({ isProduction: true });

      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toMatch(/script-src[^;]*\*/);
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    it('allows explicit authentication and cloud provider origins', () => {
      const csp = buildContentSecurityPolicy({
        isProduction: true,
        backendOrigin: 'https://api.arabiyatmart.com',
        mediaCdnOrigin: 'https://cdn.arabiyatmart.com',
      });

      // Google Identity & Firebase
      expect(csp).toContain('https://accounts.google.com');
      expect(csp).toContain('https://identitytoolkit.googleapis.com');
      expect(csp).toContain('https://securetoken.googleapis.com');
      expect(csp).toContain('https://*.firebaseio.com');
      expect(csp).toContain('https://fcmregistrations.googleapis.com');

      // Apple
      expect(csp).toContain('https://appleid.cdn-apple.com');
      expect(csp).toContain('https://appleid.apple.com');

      // Backend API & Media CDN
      expect(csp).toContain('https://api.arabiyatmart.com');
      expect(csp).toContain('https://cdn.arabiyatmart.com');
    });

    it('forbids wildcard media and image URLs in CSP without any asterisks', () => {
      const csp = buildContentSecurityPolicy({ isProduction: true });

      const imgDirective = csp
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('img-src'));
      expect(imgDirective).toBeDefined();
      expect(imgDirective).not.toContain('*');
      expect(imgDirective).toContain('https://images.unsplash.com');
      expect(imgDirective).toContain('https://lh3.googleusercontent.com');

      const mediaDirective = csp
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('media-src'));
      expect(mediaDirective).toBeDefined();
      expect(mediaDirective).not.toContain('*');
    });
  });

  describe('Security Headers', () => {
    it('sets strict transport security (HSTS) in production', () => {
      const prodHeaders = buildSecurityHeaders({ isProduction: true });
      expect(prodHeaders['Strict-Transport-Security']).toBe(
        'max-age=63072000; includeSubDomains; preload'
      );
    });

    it('omits HSTS in development to avoid local HTTP caching issues', () => {
      const devHeaders = buildSecurityHeaders({ isProduction: false });
      expect(devHeaders['Strict-Transport-Security']).toBeUndefined();
    });

    it('enforces MIME sniffing protection, Referrer-Policy, and Permissions-Policy', () => {
      const headers = buildSecurityHeaders({ isProduction: true });

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Permissions-Policy']).toContain('microphone=()');
      expect(headers['Permissions-Policy']).toContain('geolocation=()');
      expect(headers['Permissions-Policy']).toContain('browsing-topics=()');
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
      expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
      expect(headers['X-DNS-Prefetch-Control']).toBe('on');
    });

    it('returns formatted headers matching Next.js configuration requirements', () => {
      const list = getSecurityHeaders({ isProduction: true });
      expect(Array.isArray(list)).toBe(true);

      const keys = list.map((h) => h.key);
      expect(keys).toContain('Content-Security-Policy');
      expect(keys).toContain('X-Content-Type-Options');
      expect(keys).toContain('X-Frame-Options');
      expect(keys).toContain('Strict-Transport-Security');
    });

    it('supports Content-Security-Policy-Report-Only when requested', () => {
      const headers = buildSecurityHeaders({ reportOnly: true });
      expect(headers['Content-Security-Policy-Report-Only']).toBeDefined();
      expect(headers['Content-Security-Policy']).toBeUndefined();
    });
  });

  describe('Remote Image Patterns', () => {
    it('allows explicit remote image domains without wildcard hosts or asterisks', () => {
      const patterns = getAllowedImageRemotePatterns({
        isProduction: true,
        mediaCdnOrigin: 'https://media.arabiyatmart.com',
      });

      const hostnames = patterns.map((p) => p.hostname);
      expect(hostnames).toContain('images.unsplash.com');
      expect(hostnames).toContain('lh3.googleusercontent.com');
      expect(hostnames).toContain('appleid.cdn-apple.com');
      expect(hostnames).toContain('api.arabiyatmart.com');
      expect(hostnames).toContain('media.arabiyatmart.com');

      // Strict check: No pattern contains wildcard asterisk in hostname
      for (const pattern of patterns) {
        expect(pattern.hostname).not.toContain('*');
      }
    });

    it('requires explicit protocols on all remote image patterns', () => {
      const patterns = getAllowedImageRemotePatterns({ isProduction: true });
      for (const pattern of patterns) {
        expect(['http', 'https']).toContain(pattern.protocol);
        expect(pattern.hostname.length).toBeGreaterThan(0);
        expect(pattern.hostname).not.toContain('*');
      }
    });

    it('rejects unsupported schemes (ftp, javascript, data) and does not include them', () => {
      // Negative tests for unsupported schemes
      const patterns = getAllowedImageRemotePatterns({
        isProduction: false,
        backendOrigin: 'ftp://evil.example',
        mediaCdnOrigin: 'javascript://evil.example',
      });

      const protocols = patterns.map((p) => p.protocol);
      const hostnames = patterns.map((p) => p.hostname);

      expect(protocols).not.toContain('ftp');
      expect(protocols).not.toContain('javascript');
      expect(hostnames).not.toContain('evil.example');

      for (const pattern of patterns) {
        expect(['http', 'https']).toContain(pattern.protocol);
        expect(pattern.protocol).not.toBe('ftp');
        expect(pattern.protocol).not.toBe('javascript');
      }
    });

    it('requires HTTPS for remote origins in production and rejects non-HTTPS origins', () => {
      // In production, remote origins must use HTTPS
      const prodPatterns = getAllowedImageRemotePatterns({
        isProduction: true,
        backendOrigin: 'http://insecure-backend.arabiyatmart.com',
        mediaCdnOrigin: 'https://cdn.arabiyatmart.com',
      });

      const hostnames = prodPatterns.map((p) => p.hostname);
      // Insecure HTTP origin must be dropped in production
      expect(hostnames).not.toContain('insecure-backend.arabiyatmart.com');
      // Secure HTTPS origin must be accepted
      expect(hostnames).toContain('cdn.arabiyatmart.com');

      for (const p of prodPatterns) {
        expect(p.protocol).toBe('https');
      }
    });

    it('rejects wildcard hostnames in remote origins', () => {
      const patterns = getAllowedImageRemotePatterns({
        isProduction: true,
        mediaCdnOrigin: 'https://*.wildcard-cdn.com',
      });

      const hostnames = patterns.map((p) => p.hostname);
      expect(hostnames).not.toContain('*.wildcard-cdn.com');
      for (const p of patterns) {
        expect(p.hostname).not.toContain('*');
      }
    });
  });

  describe('Redirect Host Validation', () => {
    const allowed = ['https://arabiyatmart.com', 'https://api.arabiyatmart.com'];

    it('accepts safe relative path redirects', () => {
      expect(validateRedirectHost('/ar/login', allowed)).toBe(true);
      expect(validateRedirectHost('/en/dealers/toyota', allowed)).toBe(true);
      expect(validateRedirectHost('/search?make=toyota', allowed)).toBe(true);
    });

    it('accepts exact allowed site origins', () => {
      expect(validateRedirectHost('https://arabiyatmart.com/ar/profile', allowed)).toBe(true);
    });

    it('rejects protocol-relative URLs', () => {
      expect(validateRedirectHost('//evil.com/phish', allowed)).toBe(false);
      expect(validateRedirectHost('\\\\evil.com/phish', allowed)).toBe(false);
    });

    it('rejects browser-normalized backslash and network-path redirects', () => {
      // Browser normalization: /\\evil.com or /\\/evil.com resolves to https://evil.com/
      expect(validateRedirectHost('/\\evil.com', allowed)).toBe(false);
      expect(validateRedirectHost('/\\/evil.com', allowed)).toBe(false);
      expect(validateRedirectHost('\\evil.com', allowed)).toBe(false);
      expect(validateRedirectHost('/evil.com\\@good.com', allowed)).toBe(false);
      expect(validateRedirectHost('/foo\\bar', allowed)).toBe(false);
    });

    it('rejects unapproved external hosts', () => {
      expect(validateRedirectHost('https://evil.com/login', allowed)).toBe(false);
      expect(validateRedirectHost('https://attacker.arabiyatmart.com.evil.com', allowed)).toBe(false);
    });

    it('rejects javascript, data, and dangerous schemes', () => {
      expect(validateRedirectHost('javascript:alert(1)', allowed)).toBe(false);
      expect(validateRedirectHost('data:text/html,<script>alert(1)</script>', allowed)).toBe(false);
      expect(validateRedirectHost('vbscript:msgbox(1)', allowed)).toBe(false);
    });
  });
});
