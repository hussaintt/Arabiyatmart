import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { getCairoOgFonts } from '@/lib/og/fonts';
import { ListingOgCard } from '@/components/og/listing-og-card';
import { DefaultOgCard } from '@/components/og/default-og-card';
import { getListing } from '@/server/queries/listings';
import { ListingSlugParamsSchema } from '@/lib/api/schemas/listing';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { formatMoneyFromCents } from '@/i18n/format';
import { serverEnv } from '@/lib/env/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSMISSION_MAP: Record<string, { ar: string; en: string }> = {
  AUTOMATIC: { ar: 'أوتوماتيك', en: 'Automatic' },
  MANUAL: { ar: 'مانيوال', en: 'Manual' },
  CVT: { ar: 'CVT', en: 'CVT' },
  DCT: { ar: 'DCT', en: 'DCT' },
};

const FUEL_MAP: Record<string, { ar: string; en: string }> = {
  PETROL: { ar: 'بنزين', en: 'Petrol' },
  DIESEL: { ar: 'ديزل', en: 'Diesel' },
  HYBRID: { ar: 'هايبرد', en: 'Hybrid' },
  ELECTRIC: { ar: 'كهرباء', en: 'Electric' },
  GAS: { ar: 'غاز طبيعي', en: 'Natural Gas' },
};

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const fullUrl = imageUrl.startsWith('/') ? `${serverEnv.SITE_ORIGIN}${imageUrl}` : imageUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Arabiyatmart-OG-Generator/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const arrayBuf = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuf);

    // Satori only supports JPEG and PNG (it crashes with TypeError on WebP/AVIF).
    // Convert and compress all car photos to high-performance JPEG (800x520) via sharp:
    const jpegBuffer = await sharp(inputBuffer)
      .resize(800, 520, { fit: 'cover', withoutEnlargement: false })
      .jpeg({ quality: 80 })
      .toBuffer();

    return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
  } catch (err) {
    console.warn('[OG Generator] Image processing failed or timed out, using fallback silhouette:', err);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const rawLocale = searchParams.get('locale');
  const validLocale: AppLocale = isAppLocale(rawLocale) ? rawLocale : 'ar';
  const isArabic = validLocale === 'ar';

  const fonts = await getCairoOgFonts();

  const parsedSlug = ListingSlugParamsSchema.safeParse({ slug });
  if (!parsedSlug.success) {
    return new ImageResponse(
      (
        <DefaultOgCard
          isArabic={isArabic}
          title={isArabic ? 'الإعلان غير موجود' : 'Listing Not Found'}
          description={isArabic ? 'عذراً، لم يتم العثور على الإعلان المطلوب.' : 'Sorry, the requested vehicle listing could not be found.'}
        />
      ),
      {
        width: 1200,
        height: 630,
        fonts,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  }

  try {
    const res = await getListing({ slug: parsedSlug.data.slug }, validLocale);
    const listing = res.data;

    const rawCoverUrl = listing.images[0]?.mediumUrl || listing.images[0]?.url;
    const coverImageBase64 = rawCoverUrl ? await fetchImageAsBase64(rawCoverUrl) : null;

    const priceFormatted = formatMoneyFromCents(listing.priceCents, listing.currency, validLocale);
    const mileageFormatted = `${listing.mileageKm.toLocaleString(isArabic ? 'ar-EG' : 'en-US')} ${isArabic ? 'كم' : 'km'}`;

    const transConfig = TRANSMISSION_MAP[listing.transmission];
    const transmission = transConfig
      ? (isArabic ? transConfig.ar : transConfig.en)
      : listing.transmission;

    const fuelConfig = FUEL_MAP[listing.fuelType];
    const fuelType = fuelConfig
      ? (isArabic ? fuelConfig.ar : fuelConfig.en)
      : listing.fuelType;

    const cityName = isArabic ? listing.city.name.ar : listing.city.name.en;
    const condition = isArabic
      ? (listing.condition === 'NEW' ? 'جديدة' : 'مستعملة')
      : (listing.condition === 'NEW' ? 'New' : 'Used');

    const vendorName = listing.vendor
      ? (isArabic ? listing.vendor.displayName.ar : listing.vendor.displayName.en)
      : null;

    return new ImageResponse(
      (
        <ListingOgCard
          isArabic={isArabic}
          title={listing.title}
          priceFormatted={priceFormatted}
          year={listing.year}
          condition={condition}
          mileageFormatted={mileageFormatted}
          transmission={transmission}
          fuelType={fuelType}
          cityName={cityName}
          isVerified={listing.vendor?.isVerified ?? false}
          vendorName={vendorName}
          coverImageBase64={coverImageBase64}
        />
      ),
      {
        width: 1200,
        height: 630,
        fonts,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch {
    return new ImageResponse(
      (
        <DefaultOgCard
          isArabic={isArabic}
          title={isArabic ? 'عربيات مارت - سوق السيارات' : 'Arabiyatmart - Car Marketplace'}
          description={isArabic ? 'سوق بيع وشراء السيارات الأول في مصر' : 'The premier marketplace for buying and selling cars in Egypt'}
        />
      ),
      {
        width: 1200,
        height: 630,
        fonts,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
