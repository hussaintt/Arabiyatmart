import { describe, it, expect } from 'vitest';
import {
  parseAcceptLanguage,
  resolveNegotiatedLocale,
} from '@/lib/auth/locale-negotiation';
import { signLocalePreference } from '@/lib/auth/locale-cookie';

const TEST_SECRET = 'test-locale-secret-must-be-32-chars-long';

describe('TASK 2.2: Locale Negotiation & Cache-Safe Selection', () => {
  describe('parseAcceptLanguage', () => {
    it('returns null for empty, null, or wildcard-only headers', () => {
      expect(parseAcceptLanguage(null)).toBeNull();
      expect(parseAcceptLanguage('')).toBeNull();
      expect(parseAcceptLanguage('   ')).toBeNull();
      expect(parseAcceptLanguage('*')).toBeNull();
      expect(parseAcceptLanguage('*;q=0.8')).toBeNull();
    });

    it('matches exact language tags', () => {
      expect(parseAcceptLanguage('ar')).toBe('ar');
      expect(parseAcceptLanguage('en')).toBe('en');
    });

    it('matches regional variants to supported base locales', () => {
      expect(parseAcceptLanguage('ar-EG')).toBe('ar');
      expect(parseAcceptLanguage('ar-SA')).toBe('ar');
      expect(parseAcceptLanguage('en-US')).toBe('en');
      expect(parseAcceptLanguage('en-GB')).toBe('en');
    });

    it('respects quality factor (q) weighting', () => {
      // English has higher q than Arabic
      expect(parseAcceptLanguage('ar;q=0.5, en;q=0.9')).toBe('en');
      // Arabic has higher q than English
      expect(parseAcceptLanguage('en;q=0.6, ar;q=0.8')).toBe('ar');
      // Regional tag with higher q
      expect(parseAcceptLanguage('fr-FR;q=0.9, en-US;q=0.8, ar;q=0.7')).toBe('en');
    });

    it('ignores languages with q=0', () => {
      expect(parseAcceptLanguage('ar;q=0, en;q=0.5')).toBe('en');
      expect(parseAcceptLanguage('ar;q=0')).toBeNull();
    });

    it('returns null when no supported language is present', () => {
      expect(parseAcceptLanguage('fr-FR, fr;q=0.9, de;q=0.8, es;q=0.7')).toBeNull();
      expect(parseAcceptLanguage('zh-CN, ru-RU')).toBeNull();
    });

    it('preserves declaration order when q values are equal', () => {
      expect(parseAcceptLanguage('en;q=0.8, ar;q=0.8')).toBe('en');
      expect(parseAcceptLanguage('ar;q=0.8, en;q=0.8')).toBe('ar');
    });
  });

  describe('resolveNegotiatedLocale', () => {
    it('defaults to Arabic when neither cookie nor header is provided', async () => {
      const locale = await resolveNegotiatedLocale();
      expect(locale).toBe('ar');
    });

    it('negotiates from Accept-Language when no cookie exists', async () => {
      const localeEn = await resolveNegotiatedLocale({
        acceptLanguage: 'en-US,en;q=0.9,ar;q=0.8',
      });
      expect(localeEn).toBe('en');

      const localeAr = await resolveNegotiatedLocale({
        acceptLanguage: 'ar-EG,ar;q=0.9',
      });
      expect(localeAr).toBe('ar');
    });

    it('falls back to Arabic if Accept-Language contains only unsupported languages', async () => {
      const locale = await resolveNegotiatedLocale({
        acceptLanguage: 'fr-FR,fr;q=0.9,de;q=0.8',
      });
      expect(locale).toBe('ar');
    });

    it('gives verified signed cookie precedence over Accept-Language header', async () => {
      const signedEn = await signLocalePreference('en', TEST_SECRET);
      // Header prefers Arabic, but cookie is signed English
      const locale = await resolveNegotiatedLocale({
        cookie: signedEn,
        acceptLanguage: 'ar-EG,ar;q=0.9',
        secret: TEST_SECRET,
      });
      expect(locale).toBe('en');
    });

    it('gives verified signed cookie precedence when cookie is Arabic', async () => {
      const signedAr = await signLocalePreference('ar', TEST_SECRET);
      // Header prefers English, but cookie is signed Arabic
      const locale = await resolveNegotiatedLocale({
        cookie: signedAr,
        acceptLanguage: 'en-US,en;q=0.9',
        secret: TEST_SECRET,
      });
      expect(locale).toBe('ar');
    });

    it('ignores tampered or invalid cookie and falls back to Accept-Language', async () => {
      const signedEn = await signLocalePreference('en', TEST_SECRET);
      const tamperedCookie = signedEn.replace('.en.', '.ar.'); // invalid HMAC signature

      const locale = await resolveNegotiatedLocale({
        cookie: tamperedCookie,
        acceptLanguage: 'en-US,en;q=0.9',
        secret: TEST_SECRET,
      });
      expect(locale).toBe('en');
    });

    it('ignores unsigned/unsupported cookie and falls back to Arabic default if no header', async () => {
      const locale = await resolveNegotiatedLocale({
        cookie: 'fr',
        secret: TEST_SECRET,
      });
      expect(locale).toBe('ar');
    });
  });
});
