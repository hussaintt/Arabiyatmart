import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { getCairoOgFonts } from '@/lib/og/fonts';
import { DefaultOgCard } from '@/components/og/default-og-card';
import { isAppLocale, type AppLocale } from '@/i18n/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawLocale = searchParams.get('locale');
  const validLocale: AppLocale = isAppLocale(rawLocale) ? rawLocale : 'ar';
  const isArabic = validLocale === 'ar';

  const title = searchParams.get('title') || undefined;
  const description = searchParams.get('description') || undefined;

  const fonts = await getCairoOgFonts();

  return new ImageResponse(
    (
      <DefaultOgCard
        isArabic={isArabic}
        title={title}
        description={description}
      />
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  );
}
