import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const mockGetListing = vi.fn();
vi.mock('@/server/queries/listings', () => ({
  getListing: (...args: unknown[]) => mockGetListing(...args),
}));

import { getCairoOgFonts } from '@/lib/og/fonts';
import { GET as getListingOg } from '@/app/api/og/listing/[slug]/route';
import { GET as getDefaultOg } from '@/app/api/og/default/route';
import { GET as getHomeOg } from '@/app/api/og/home/route';
import { createListingDetail } from '../fixtures/factories';

describe('Open Graph (OG) Image Generation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and memoizes static Cairo font configs for Satori', async () => {
    const fonts = await getCairoOgFonts();
    expect(fonts).toHaveLength(3);
    expect(fonts.map(f => f.weight).sort()).toEqual([400, 600, 700]);
    expect(fonts.every(f => f.name === 'Cairo')).toBe(true);
    expect(fonts.every(f => f.data.byteLength > 10000)).toBe(true);
  });

  it('generates dynamic listing OG image with 1200x630 dimensions and WhatsApp <300KB compliance', async () => {
    const sampleListing = createListingDetail({
      title: 'مرسيدس بنز C180 موديل 2023',
      priceCents: 85000000,
      currency: 'EGP',
      mileageKm: 45000,
      year: 2023,
    });
    mockGetListing.mockResolvedValue({ data: sampleListing });

    const request = new NextRequest('http://localhost:3000/api/og/listing/' + sampleListing.slug + '?locale=ar');
    const response = await getListingOg(request, {
      params: Promise.resolve({ slug: sampleListing.slug }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('cache-control')).toContain('public');
    expect(response.headers.get('cache-control')).toContain('s-maxage=604800');

    const buffer = Buffer.from(await response.arrayBuffer());

    // Validate PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');

    // Extract width and height from PNG IHDR chunk (bytes 16-24)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    expect(width).toBe(1200);
    expect(height).toBe(630);

    // Strict WhatsApp file size ceiling (< 300KB)
    expect(buffer.byteLength).toBeLessThan(300 * 1024);
  });

  it('gracefully handles missing listing by returning a branded fallback image without crashing', async () => {
    mockGetListing.mockRejectedValue(new Error('Listing not found'));

    const request = new NextRequest('http://localhost:3000/api/og/listing/non-existent-car?locale=ar');
    const response = await getListingOg(request, {
      params: Promise.resolve({ slug: 'non-existent-car' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
  });

  it('generates general default OG card with custom title and description', async () => {
    const request = new NextRequest('http://localhost:3000/api/og/default?locale=en&title=Arabiyatmart+Dealers&description=Find+top+car+dealers');
    const response = await getDefaultOg(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('cache-control')).toContain('public');

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
    expect(buffer.byteLength).toBeLessThan(300 * 1024);
  });

  it('serves professional localized home OG images (Arabic and English) with 1200x630 dimensions under 300KB', async () => {
    // 1. Arabic Home Banner
    const arRequest = new NextRequest('http://localhost:3000/api/og/home?locale=ar');
    const arResponse = await getHomeOg(arRequest);

    expect(arResponse.status).toBe(200);
    expect(arResponse.headers.get('content-type')).toBe('image/jpeg');
    expect(arResponse.headers.get('cache-control')).toContain('public');

    const arBuffer = Buffer.from(await arResponse.arrayBuffer());
    expect([...arBuffer.subarray(0, 2)]).toEqual([0xff, 0xd8]); // JPEG magic bytes
    expect(arBuffer.byteLength).toBeLessThan(300 * 1024); // WhatsApp budget

    // 2. English Home Banner
    const enRequest = new NextRequest('http://localhost:3000/api/og/home?locale=en');
    const enResponse = await getHomeOg(enRequest);

    expect(enResponse.status).toBe(200);
    expect(enResponse.headers.get('content-type')).toBe('image/jpeg');
    expect(enResponse.headers.get('cache-control')).toContain('public');

    const enBuffer = Buffer.from(await enResponse.arrayBuffer());
    expect([...enBuffer.subarray(0, 2)]).toEqual([0xff, 0xd8]); // JPEG magic bytes
    expect(enBuffer.byteLength).toBeLessThan(300 * 1024); // WhatsApp budget
  });

  it('successfully converts and renders listing with WebP photo without crashing Satori', async () => {
    // Valid 10x10 WebP image bytes generated via sharp
    const sampleWebpBase64 = 'UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoKAAoAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=';
    const sampleWebpBuffer = Buffer.from(sampleWebpBase64, 'base64');

    const sampleListing = createListingDetail({
      title: 'تويوتا كورولا 2024',
      images: [
        {
          id: 'img-1',
          url: 'https://example.com/car.webp',
          mediumUrl: 'https://example.com/car-medium.webp',
          thumbnailUrl: 'https://example.com/car-thumb.webp',
          sortOrder: 0,
        },
      ],
    });
    mockGetListing.mockResolvedValue({ data: sampleListing });

    // Mock fetch to return webp bytes
    const originalFetch = global.fetch;
    const webpArrayBuffer = sampleWebpBuffer.buffer.slice(
      sampleWebpBuffer.byteOffset,
      sampleWebpBuffer.byteOffset + sampleWebpBuffer.byteLength
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/webp' }),
      arrayBuffer: async () => webpArrayBuffer,
    }) as unknown as typeof fetch;

    try {
      const request = new NextRequest('http://localhost:3000/api/og/listing/' + sampleListing.slug + '?locale=ar');
      const response = await getListingOg(request, {
        params: Promise.resolve({ slug: sampleListing.slug }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/png');

      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(buffer.readUInt32BE(16)).toBe(1200);
      expect(buffer.readUInt32BE(20)).toBe(630);
      expect(buffer.byteLength).toBeLessThan(300 * 1024);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
