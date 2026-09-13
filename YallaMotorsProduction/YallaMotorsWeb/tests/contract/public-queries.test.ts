import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api/server')>()), serverApiRequest: mocks.apiRequest }));

import * as catalogue from '@/server/queries/catalogue';
import * as dealers from '@/server/queries/dealers';
import * as home from '@/server/queries/home';
import * as listings from '@/server/queries/listings';
import * as locations from '@/server/queries/locations';
import * as promotions from '@/server/queries/promotions';
import * as taxonomy from '@/server/queries/taxonomy';
import { createListingCard } from '../fixtures/factories';

const emptyPage = { data: [], meta: { total: 0, page: 1, limit: 12, hasMore: false } };

describe('public RSC query modules', () => {
  beforeEach(() => mocks.apiRequest.mockReset());

  it('exports every Phase 2 public operation', () => {
    const operations = {
      ...home, ...listings, ...dealers, ...taxonomy, ...catalogue, ...locations, ...promotions,
    } as Record<string, unknown>;
    for (const name of [
      'getHomePageData', 'listBanners', 'getPublicSettings', 'getSpotlight', 'searchListings',
      'getListing', 'getSimilarListings', 'listDealers', 'getDealer', 'getDealerListings',
      'listMakes', 'listModels', 'listGenerations', 'listTrims', 'getTrim', 'getListingBatch',
      'getTrimBatch', 'getModelsWithPrices', 'getCatalogueModel', 'getCatalogueTrim',
      'getTrimDealers', 'getMakeDealers', 'listCountries', 'getCountryConfig', 'listCities',
      'listAreas', 'listPromotionPackages',
    ]) expect(operations[name], name).toBeTypeOf('function');
  });

  it('validates search params and applies locale plus public cache tags', async () => {
    mocks.apiRequest.mockResolvedValue(emptyPage);
    await listings.searchListings({ makeSlug: 'bmw', page: 1, limit: 12 }, 'en');
    const options = mocks.apiRequest.mock.calls[0]![0];
    expect(options).toMatchObject({
      operation: 'searchListings',
      locale: 'en',
      query: { makeSlug: 'bmw', page: 1, limit: 12 },
      cachePolicy: { cache: 'force-cache', isPrivate: false },
    });
    expect(options.cachePolicy.next.tags).toContain('listings');
  });

  it.each([
    () => taxonomy.listModels({ makeSlug: '../admin' }, 'ar'),
    () => listings.getListing({ slug: '%2e%2e' }, 'en'),
    () => locations.getCountryConfig({ code: 'EGYPT' }, 'ar'),
    () => catalogue.getCatalogueModel({ publicId: '../private' }, 'en'),
  ])('rejects invalid path input before upstream I/O', (operation) => {
    expect(operation).toThrow();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('uses exact registry endpoints and query placement for representative domains', async () => {
    mocks.apiRequest.mockResolvedValue({ data: [] });
    await taxonomy.listModels({ makeSlug: 'bmw' }, 'en');
    let options = mocks.apiRequest.mock.calls.at(-1)![0];
    expect(options.endpoint()).toBe('/v1/taxonomy/makes/bmw/models');
    expect(options.query).toBeUndefined();

    await catalogue.getModelsWithPrices({ makeSlug: 'bmw', condition: 'NEW' }, 'ar');
    options = mocks.apiRequest.mock.calls.at(-1)![0];
    expect(options.endpoint()).toBe('/v1/catalogue/makes/bmw/models-with-prices');
    expect(options.query).toEqual({ condition: 'NEW' });

    await locations.listCities({ code: 'eg' }, 'en');
    options = mocks.apiRequest.mock.calls.at(-1)![0];
    expect(options.endpoint()).toBe('/v1/locations/countries/EG/cities');
  });

  it('caps compare batches, requests unique slugs, and restores the requested order', async () => {
    const first = createListingCard({ publicId: 'lst_first', slug: 'car-one', isFavorited: true });
    const second = createListingCard({ publicId: 'lst_second', slug: 'car-two', isFavorited: true });
    mocks.apiRequest.mockResolvedValue({ data: [second, first] });
    const result = await listings.getListingBatch({ slugs: ['car-one', 'car-two'] }, 'ar');
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ query: { slugs: 'car-one,car-two' } }));
    expect(result.data.map((item) => item.slug)).toEqual(['car-one', 'car-two']);
    await expect(listings.getListingBatch({ slugs: ['one', 'two', 'three', 'four', 'five'] }, 'ar')).rejects.toThrow();
    await expect(listings.getListingBatch({ slugs: ['car-one', 'car-one'] }, 'ar')).rejects.toThrow();
  });

  it('caps trim batches, requests unique public IDs, and restores the requested order', async () => {
    const makeTrim = (publicId: string) => ({
      publicId,
      name: { ar: `فئة ${publicId}`, en: `Trim ${publicId}` },
      modelYear: 2026,
      engineCc: null,
      powerHp: null,
      torqueNm: null,
      fuelType: null,
      transmission: null,
      drivetrain: null,
      seats: null,
      fuelEconomyKmL: null,
      warrantyYears: null,
      warrantyKm: null,
      specs: null,
      officialPriceCents: null,
      marketPriceCents: null,
      currency: 'EGP',
      brochureUrl: null,
      isActive: true,
    });
    mocks.apiRequest.mockResolvedValue({ data: [makeTrim('trim-two'), makeTrim('trim-one')] });
    const result = await taxonomy.getTrimBatch({ publicIds: ['trim-one', 'trim-two'] }, 'en');
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ query: { publicIds: 'trim-one,trim-two' } }));
    expect(result.data.map((item) => item.publicId)).toEqual(['trim-one', 'trim-two']);
    await expect(taxonomy.getTrimBatch({ publicIds: ['one', 'two', 'three', 'four', 'five'] }, 'en')).rejects.toThrow();
    await expect(taxonomy.getTrimBatch({ publicIds: ['trim-one', 'trim-one'] }, 'en')).rejects.toThrow();
  });

  it('forces personalized favorite state out through the public adapter', async () => {
    mocks.apiRequest.mockResolvedValue(emptyPage);
    await listings.searchListings({ limit: 12 }, 'ar');
    const adapter = mocks.apiRequest.mock.calls[0]![0].adapter as (raw: unknown) => unknown;
    const personalized = createListingCard({ isFavorited: true });
    expect(adapter({ data: [personalized], meta: emptyPage.meta })).toMatchObject({ data: [{ isFavorited: false }] });
  });

  it('degrades optional home sections independently while preserving successful listing sections', async () => {
    mocks.apiRequest.mockImplementation(async (options: { operation: string }) => {
      if (['listBanners', 'getSpotlight', 'listDealers', 'getPublicSettings'].includes(options.operation)) throw new Error('optional outage');
      if (options.operation === 'searchListings') return emptyPage;
      throw new Error(`Unexpected operation ${options.operation}`);
    });
    await expect(home.getHomePageData('ar')).resolves.toMatchObject({
      banners: [], spotlight: [], featuredListings: [], latestListings: [], featuredDealers: [],
    });
  });

  it('propagates critical listing failure to the route boundary', async () => {
    mocks.apiRequest.mockImplementation(async (options: { operation: string }) => {
      if (options.operation === 'searchListings') throw new Error('listing outage');
      throw new Error('optional outage');
    });
    await expect(home.getHomePageData('en')).rejects.toThrow('listing outage');
  });
});
