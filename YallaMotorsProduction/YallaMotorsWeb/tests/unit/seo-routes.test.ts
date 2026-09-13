import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  listMakes: vi.fn(),
  listModels: vi.fn(),
  listGenerations: vi.fn(),
  listTrims: vi.fn(),
  listDealers: vi.fn(),
  searchListings: vi.fn(),
}));

vi.mock('@/server/queries/taxonomy', () => ({ listMakes: mocks.listMakes, listModels: mocks.listModels, listGenerations: mocks.listGenerations, listTrims: mocks.listTrims }));
vi.mock('@/server/queries/dealers', () => ({ listDealers: mocks.listDealers }));
vi.mock('@/server/queries/listings', () => ({ searchListings: mocks.searchListings }));

import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { isAllowedBffPath } from '@/lib/api/endpoints';

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const publicPageFiles = [
  '(marketplace)/page.tsx',
  '(marketplace)/search/page.tsx',
  '(marketplace)/dealers/page.tsx',
  '(marketplace)/dealers/[slug]/page.tsx',
  '(marketplace)/listing/[slug]/page.tsx',
  '(marketplace)/catalogue/makes/page.tsx',
  '(marketplace)/catalogue/makes/[makeSlug]/page.tsx',
  '(marketplace)/catalogue/models/[publicId]/page.tsx',
  '(marketplace)/catalogue/trims/[publicId]/page.tsx',
  '(marketplace)/news/page.tsx',
  '(marketplace)/privacy/page.tsx',
  '(marketplace)/terms/page.tsx',
] as const;

const privatePageFiles = [
  '(account)/best-offer/page.tsx',
  '(marketplace)/compare/page.tsx',
  '(account)/best-offer/[slug]/page.tsx',
  '(account)/favorites/page.tsx',
  '(account)/me/dashboard/page.tsx',
  '(account)/me/leads/page.tsx',
  '(account)/me/leads/[publicId]/page.tsx',
  '(account)/me/listings/page.tsx',
  '(account)/notifications/page.tsx',
  '(account)/profile/page.tsx',
  '(account)/profile/edit/page.tsx',
  '(account)/saved-searches/page.tsx',
  '(account)/sell/page.tsx',
  '(auth)/forgot-password/page.tsx',
  '(auth)/login/page.tsx',
  '(auth)/register/page.tsx',
  '(auth)/register-success/page.tsx',
  '(auth)/reset-password/page.tsx',
  '(auth)/verify-email/page.tsx',
  'forbidden/page.tsx',
] as const;

function pageFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return pageFiles(resolve(dir, entry.name), relative);
    return entry.name === 'page.tsx' ? [relative] : [];
  });
}

describe('SEO, manifest, and route inventory', () => {
  beforeEach(() => {
    mocks.listMakes.mockResolvedValue({
      data: [
        { publicId: 'mk_01', slug: 'toyota', isActive: true },
        { publicId: 'mk_02', slug: 'hidden', isActive: false },
      ],
    });
    mocks.listModels.mockResolvedValue({ data: [{ publicId: 'mdl_01', isActive: true }] });
    mocks.listGenerations.mockResolvedValue({ data: [{ publicId: 'gen_01' }] });
    mocks.listTrims.mockResolvedValue({ data: [{ publicId: 'trim_01', isActive: true }] });
    mocks.listDealers.mockResolvedValue({ data: [{ slug: 'trusted-cars' }], meta: { hasMore: false, nextCursor: null } });
    mocks.searchListings.mockResolvedValue({ data: [{ slug: 'toyota-corolla-2025' }], meta: { total: 1, page: 1, limit: 40, hasMore: false } });
  });

  it('publishes a localized install manifest with verified local icon dimensions', () => {
    const value = manifest();
    expect(value.start_url).toBe('/ar');
    expect(value.scope).toBe('/');
    expect(value.lang).toBe('ar');
    expect(value.dir).toBe('rtl');
    expect(value.icons).toEqual([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }),
    ]);
    expect(pngDimensions(resolve('public/icons/icon-192.png'))).toEqual({ width: 192, height: 192 });
    expect(pngDimensions(resolve('public/icons/icon-512.png'))).toEqual({ width: 512, height: 512 });
    const og = readFileSync(resolve('public/images/og-default.jpg'));
    expect([...og.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it('keeps private, auth, filtered, comparison, and API routes out of crawling', () => {
    const value = robots();
    expect(value.sitemap).toBe('http://localhost:3000/sitemap.xml');
    const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
    const disallowed = rules.flatMap((rule) => rule.disallow ?? []);
    expect(disallowed).toEqual(expect.arrayContaining(['/api/', '/*/profile', '/*/me/', '/*/compare', '/*?*cursor=']));
  });

  it('audits every localized page exactly once for public or noindex metadata', () => {
    const actual = pageFiles(resolve('src/app/[locale]')).sort();
    const inventory = [...publicPageFiles, ...privatePageFiles].sort();
    expect(actual).toEqual(inventory);
    for (const file of publicPageFiles) {
      const source = readFileSync(resolve('src/app/[locale]', file), 'utf8');
      expect(source, `${file} must publish OpenGraph metadata`).toContain('openGraph');
    }
    for (const file of privatePageFiles) {
      const source = readFileSync(resolve('src/app/[locale]', file), 'utf8');
      expect(source, `${file} must be noindex`).toMatch(/index:\s*false/);
    }
  });

  it('lists canonical localized public routes with language alternates and no private URLs', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toEqual(expect.arrayContaining([
      'http://localhost:3000/ar',
      'http://localhost:3000/en/search',
      'http://localhost:3000/ar/catalogue/makes/toyota',
      'http://localhost:3000/en/catalogue/models/mdl_01',
      'http://localhost:3000/ar/catalogue/trims/trim_01',
      'http://localhost:3000/ar/dealers/trusted-cars',
      'http://localhost:3000/en/listing/toyota-corolla-2025',
    ]));
    expect(urls.some((url) => /\/(?:profile|favorites|notifications|sell|me|api|compare)(?:\/|$)/.test(url))).toBe(false);
    expect(entries.every((entry) => entry.alternates?.languages?.ar && entry.alternates.languages.en && entry.alternates.languages['x-default'])).toBe(true);
  });

  it('fails closed for removed price-offer BFF paths while retaining lead contact routes', () => {
    expect(isAllowedBffPath('/api/bff/me/offers')).toBe(false);
    expect(isAllowedBffPath('/api/bff/me/received-offers')).toBe(false);
    expect(isAllowedBffPath('/api/bff/leads')).toBe(true);
    expect(isAllowedBffPath('/api/bff/me/leads')).toBe(true);
  });
});
