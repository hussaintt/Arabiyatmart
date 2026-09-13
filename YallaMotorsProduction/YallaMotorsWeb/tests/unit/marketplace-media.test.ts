import { describe, expect, it } from 'vitest';
import { resolveMarketplaceMedia } from '@/lib/api/marketplace-media';

const origin = 'https://media.example.test';

describe('Listing media integration', () => {
  it('resolves upload paths for cards and detail media without changing the input', () => {
    const input = { data: [{ coverImageUrl: '/uploads/listing_image/car.webp', images: [{ url: '/uploads/listing_image/detail.webp', isCover: false }], vendor: { logoUrl: '/uploads/vendor/logo.png' }, isFavorited: false }], meta: { total: 1 } };
    expect(resolveMarketplaceMedia(input, origin)).toEqual({ data: [{ coverImageUrl: `${origin}/uploads/listing_image/car.webp`, images: [{ url: `${origin}/uploads/listing_image/detail.webp`, isCover: false }], vendor: { logoUrl: `${origin}/uploads/vendor/logo.png` }, isFavorited: false }], meta: { total: 1 } });
    expect(input.data[0]?.coverImageUrl).toBe('/uploads/listing_image/car.webp');
    expect(resolveMarketplaceMedia({ data: input.data[0] }, origin)).toHaveProperty('data.coverImageUrl', `${origin}/uploads/listing_image/car.webp`);
  });

  it('resolves catalogue logos before their strict adapter validates the response', () => {
    expect(resolveMarketplaceMedia({ data: [{ makeLogoUrl: '/uploads/makes/kia.png' }] }, origin)).toEqual({ data: [{ makeLogoUrl: `${origin}/uploads/makes/kia.png` }] });
    expect(resolveMarketplaceMedia([{ logoUrl: '/uploads/makes/kia.png' }], origin)).toEqual([{ logoUrl: `${origin}/uploads/makes/kia.png` }]);
  });

  it.each([null, 'https://cdn.example.test/car.webp', '//evil.test/car.webp', '/uploads/../secret', '/uploads/%2e%2e/secret', '/uploads/\\evil.test/car.webp', 'javascript:alert(1)', '/api/private'])('leaves %s unchanged for normal schema validation', value => {
    expect(resolveMarketplaceMedia({ data: [{ coverImageUrl: value }] }, origin)).toEqual({ data: [{ coverImageUrl: value }] });
  });
});
