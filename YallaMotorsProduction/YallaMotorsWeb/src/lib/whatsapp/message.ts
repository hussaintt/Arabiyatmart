export interface WhatsAppMessageOptions {
  title: string;
  year?: number | null | undefined;
  refCode?: string | null | undefined;
  slug?: string | null | undefined;
  publicId: string;
  locale?: string | undefined;
  siteOrigin?: string | undefined;
}

/**
 * Builds localized WhatsApp message text containing listing details, reference code, and canonical deep link.
 */
export function formatLocalizedWhatsAppMessage(options: WhatsAppMessageOptions): string {
  const { title, year, refCode, slug, publicId, locale = 'ar', siteOrigin } = options;
  const isArabic = locale === 'ar';
  const yearStr = year ? ` (${year})` : '';
  const code = refCode?.trim() || publicId;

  const origin =
    siteOrigin?.trim().replace(/\/+$/, '') ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://arabiyatmart.com');

  const langPrefix = isArabic ? 'ar' : 'en';
  const path = slug ? `/${langPrefix}/cars/${slug}` : `/${langPrefix}/listings/${publicId}`;
  const canonicalUrl = `${origin}${path}`;

  if (isArabic) {
    return `مرحباً، أنا مهتم بسيارتك المعروضة على عربيات مارت: ${title}${yearStr} - كود الإعلان: ${code} - الرابط: ${canonicalUrl}`;
  }

  return `Hello, I am interested in your car listed on Arabiyatmart: ${title}${yearStr} - Listing ref: ${code} - Link: ${canonicalUrl}`;
}

/**
 * Validates and formats a WhatsApp URL with optional localized pre-filled message text.
 * Strictly generates https://wa.me/<digits>?text=... with safe encoding.
 */
export function formatWhatsAppUrl(
  phone: string | null | undefined,
  options?: WhatsAppMessageOptions,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (options) {
    const message = formatLocalizedWhatsAppMessage(options);
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  return `https://wa.me/${digits}`;
}
