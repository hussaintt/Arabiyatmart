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
});
