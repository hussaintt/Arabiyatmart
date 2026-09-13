import { describe, expect, it } from 'vitest';
import {
  formatLocalizedWhatsAppMessage,
  formatWhatsAppUrl,
} from '@/lib/whatsapp/message';

describe('WhatsApp Deep-Link & Localized Message (Phase 3.3)', () => {
  it('formats localized Arabic WhatsApp message with listing details and canonical deep link', () => {
    const text = formatLocalizedWhatsAppMessage({
      title: 'كيا سبورتاج',
      year: 2023,
      publicId: 'lst_123',
      slug: 'kia-sportage-2023',
      locale: 'ar',
      siteOrigin: 'https://arabiyatmart.com',
    });

    expect(text).toContain('مرحباً، أنا مهتم بسيارتك المعروضة على عربيات مارت: كيا سبورتاج (2023)');
    expect(text).toContain('كود الإعلان: lst_123');
    expect(text).toContain('الرابط: https://arabiyatmart.com/ar/cars/kia-sportage-2023');
  });

  it('formats localized English WhatsApp message with listing details and canonical deep link', () => {
    const text = formatLocalizedWhatsAppMessage({
      title: 'BMW 320i',
      year: 2022,
      publicId: 'lst_456',
      slug: 'bmw-320i-2022',
      locale: 'en',
      siteOrigin: 'https://arabiyatmart.com',
    });

    expect(text).toContain('Hello, I am interested in your car listed on Arabiyatmart: BMW 320i (2022)');
    expect(text).toContain('Listing ref: lst_456');
    expect(text).toContain('Link: https://arabiyatmart.com/en/cars/bmw-320i-2022');
  });

  it('generates encoded https://wa.me/ URL with pre-filled message text', () => {
    const url = formatWhatsAppUrl('+20 100 123 4567', {
      title: 'Mercedes C180',
      year: 2021,
      publicId: 'lst_789',
      locale: 'ar',
      siteOrigin: 'https://arabiyatmart.com',
    });

    expect(url).not.toBeNull();
    expect(url).toContain('https://wa.me/201001234567?text=');
    expect(url).toContain(encodeURIComponent('Mercedes C180'));
  });

  it('returns null for invalid or missing phone numbers', () => {
    expect(formatWhatsAppUrl(null)).toBeNull();
    expect(formatWhatsAppUrl('')).toBeNull();
    expect(formatWhatsAppUrl('123')).toBeNull(); // Less than 7 digits
  });
});
