import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAppLocale, type AppLocale } from '@/i18n/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cachedImages: Partial<Record<AppLocale, Buffer>> = {};

async function getHomeOgBuffer(locale: AppLocale): Promise<Buffer> {
  if (cachedImages[locale]) {
    return cachedImages[locale]!;
  }
  const filename = locale === 'en' ? 'og-home-en.jpg' : 'og-home-ar.jpg';
  const filePath = path.join(process.cwd(), 'public/images', filename);
  const buffer = await fs.readFile(filePath);
  cachedImages[locale] = buffer;
  return buffer;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawLocale = searchParams.get('locale');
  const locale: AppLocale = isAppLocale(rawLocale) ? rawLocale : 'ar';

  try {
    const buffer = await getHomeOgBuffer(locale);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch {
    const fallbackPath = path.join(process.cwd(), 'public/images/og-default.jpg');
    const fallbackBuffer = await fs.readFile(fallbackPath);
    return new NextResponse(fallbackBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  }
}
