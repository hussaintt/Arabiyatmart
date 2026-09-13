// @vitest-environment jsdom

/**
 * Unit Test Suite for Canonical Search URL State and Filter Options (TASK-029).
 *
 * Verifies:
 * 1. Exact parameter parsing, unknown key stripping, malformed encoding resilience.
 * 2. Conflicting pagination, lower/upper bounds, duplicate arrays, and repeated scalar collapse.
 * 3. Arabic / Unicode search text handling.
 * 4. Deterministic canonical serialization and history round-trip equivalence.
 * 5. Backend API parameter projection (searchParamsToApiInput).
 * 6. Dynamic filter change updates with automatic pagination/cursor resets and descendant clearing.
 * 7. Dependent option loaders (make→model→generation→trim, country→city→area) with canonical query keys and AbortSignal.
 * 8. useDebouncedValue client hook with stable initial value, timer cleanup, and composition-event safety.
 * 9. Acceptance Criteria (Strict BDD): Stable canonical query string and byte-identical round-trip.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  parseSearchParams,
  canonicalizeSearchParams,
  serializeSearchParams,
  searchParamsToApiInput,
  applyFilterChange,
  buildSearchUrl,
} from '@/lib/search/params';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  DEFAULT_SORT,
} from '@/lib/search/defaults';
import {
  fetchMakes,
  fetchModels,
  fetchGenerations,
  fetchTrims,
  fetchCountries,
  fetchCities,
  fetchAreas,
  optionQueryKeys,
  clearVehicleDescendants,
  clearLocationDescendants,
  isModelValidForMake,
  isAreaValidForCity,
  pruneInvalidDescendants,
} from '@/lib/search/options';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { VehicleModel, Area } from '@/types/taxonomy';

describe('TASK-029: Canonical Search URL State (params.ts)', () => {
  describe('parseSearchParams', () => {
    it('parses valid search parameters across string, URLSearchParams, and object representations', () => {
      const queryStr =
        'makeSlug=toyota&modelSlug=camry&condition=NEW&yearMin=2020&yearMax=2024&priceMin=5000000&priceMax=12000000&mileageMax=50000&cityId=1&areaId=5&fuelType=HYBRID&transmission=AUTOMATIC&bodyType=SEDAN&sellerType=DEALER&vehicleType=CAR&hasWarranty=true&isNegotiable=false&installmentAvailable=true&exchangeAccepted=false&isVerified=true&sort=price_asc&page=2&limit=24&panel=filters&filter=price';

      const parsedFromString = parseSearchParams(queryStr);
      expect(parsedFromString.makeSlug).toBe('toyota');
      expect(parsedFromString.modelSlug).toBe('camry');
      expect(parsedFromString.condition).toBe('NEW');
      expect(parsedFromString.yearMin).toBe(2020);
      expect(parsedFromString.yearMax).toBe(2024);
      expect(parsedFromString.priceMin).toBe(5000000);
      expect(parsedFromString.priceMax).toBe(12000000);
      expect(parsedFromString.mileageMax).toBe(50000);
      expect(parsedFromString.cityId).toBe(1);
      expect(parsedFromString.areaId).toBe(5);
      expect(parsedFromString.fuelType).toBe('HYBRID');
      expect(parsedFromString.transmission).toBe('AUTOMATIC');
      expect(parsedFromString.bodyType).toBe('SEDAN');
      expect(parsedFromString.sellerType).toBe('DEALER');
      expect(parsedFromString.vehicleType).toBe('CAR');
      expect(parsedFromString.hasWarranty).toBe(true);
      expect(parsedFromString.isNegotiable).toBe(false);
      expect(parsedFromString.installmentAvailable).toBe(true);
      expect(parsedFromString.exchangeAccepted).toBe(false);
      expect(parsedFromString.isVerified).toBe(true);
      expect(parsedFromString.sort).toBe('price_asc');
      expect(parsedFromString.page).toBe(2);
      expect(parsedFromString.limit).toBe(24);
      expect(parsedFromString.panel).toBe('filters');
      expect(parsedFromString.filter).toBe('price');

      // URLSearchParams input
      const urlSearchParams = new URLSearchParams(queryStr);
      const parsedFromUSP = parseSearchParams(urlSearchParams);
      expect(parsedFromUSP).toEqual(parsedFromString);

      // Record input
      const recordInput = {
        makeSlug: 'toyota',
        modelSlug: 'camry',
        yearMin: 2020,
        page: 2,
      };
      const parsedFromRecord = parseSearchParams(recordInput);
      expect(parsedFromRecord.makeSlug).toBe('toyota');
      expect(parsedFromRecord.modelSlug).toBe('camry');
      expect(parsedFromRecord.yearMin).toBe(2020);
      expect(parsedFromRecord.page).toBe(2);
    });

    it('removes unknown and unauthorized parameters according to Phase 1 Section 2.6', () => {
      const maliciousUrl =
        'makeSlug=bmw&token=secret-token&hacker=true&returnTo=/admin/dashboard&cursor=should-not-be-in-search&foo=bar';
      const parsed = parseSearchParams(maliciousUrl);

      expect(parsed.makeSlug).toBe('bmw');
      expect((parsed as Record<string, unknown>)['token']).toBeUndefined();
      expect((parsed as Record<string, unknown>)['hacker']).toBeUndefined();
      expect((parsed as Record<string, unknown>)['returnTo']).toBeUndefined();
      expect((parsed as Record<string, unknown>)['foo']).toBeUndefined();
    });

    it('safely handles malformed percent-encoded sequences without throwing', () => {
      // Malformed encoding such as invalid UTF-8 sequences or truncated %
      const malformed = 'q=%E0%A4%A&makeSlug=toyota&yearMin=2021&broken=%80%99%ZZ';
      expect(() => parseSearchParams(malformed)).not.toThrow();

      const parsed = parseSearchParams(malformed);
      expect(parsed.makeSlug).toBe('toyota');
      expect(parsed.yearMin).toBe(2021);
    });

    it('collapses repeated scalar parameters and deduplicates sets', () => {
      const repeatedUrl =
        'makeSlug=toyota&makeSlug=bmw&condition=NEW&condition=USED&page=2&page=3';
      const parsed = parseSearchParams(repeatedUrl);

      // Collapses to first primary value
      expect(parsed.makeSlug).toBe('toyota');
      expect(parsed.condition).toBe('NEW');
      expect(parsed.page).toBe(2);

      // Duplicate array in object representation
      const duplicateArray = {
        makeSlug: ['toyota', 'toyota'],
        sort: ['price_asc', 'price_asc'],
      };
      const parsedArray = parseSearchParams(duplicateArray);
      expect(parsedArray.makeSlug).toBe('toyota');
      expect(parsedArray.sort).toBe('price_asc');
    });

    it('enforces lower and upper bound consistency (drops invalid upper bound)', () => {
      // yearMin > yearMax: drops invalid yearMax
      const invalidYears = 'yearMin=2024&yearMax=2020';
      const parsedYears = parseSearchParams(invalidYears);
      expect(parsedYears.yearMin).toBe(2024);
      expect(parsedYears.yearMax).toBeUndefined();

      // priceMin > priceMax: drops invalid priceMax
      const invalidPrices = 'priceMin=15000000&priceMax=10000000';
      const parsedPrices = parseSearchParams(invalidPrices);
      expect(parsedPrices.priceMin).toBe(15000000);
      expect(parsedPrices.priceMax).toBeUndefined();

      // Out of year range bounds 1900..2100
      const outOfBoundsYears = 'yearMin=1850&yearMax=2250';
      const parsedOOB = parseSearchParams(outOfBoundsYears);
      expect(parsedOOB.yearMin).toBeUndefined();
      expect(parsedOOB.yearMax).toBeUndefined();
    });

    it('resolves conflicting pagination (invalid page or non-allowlisted limit)', () => {
      // Negative page, zero, float, or NaN omitted (defaults to page 1)
      expect(parseSearchParams('page=-5').page).toBeUndefined();
      expect(parseSearchParams('page=0').page).toBeUndefined();
      expect(parseSearchParams('page=1.5').page).toBeUndefined();
      expect(parseSearchParams('page=abc').page).toBeUndefined();

      // Page exceeding 10000
      expect(parseSearchParams('page=10001').page).toBeUndefined();

      // Limit must be 12 | 20 | 24 | 40; arbitrary limits omitted (defaults to 20)
      expect(parseSearchParams('limit=999').limit).toBeUndefined();
      expect(parseSearchParams('limit=15').limit).toBeUndefined();
      expect(parseSearchParams('limit=0').limit).toBeUndefined();
      expect(parseSearchParams('limit=24').limit).toBe(24);
      expect(parseSearchParams('limit=40').limit).toBe(40);
    });

    it('enforces dependent hierarchy constraints (modelSlug requires makeSlug, areaId requires cityId)', () => {
      // modelSlug without makeSlug is omitted
      const modelWithoutMake = parseSearchParams('modelSlug=camry');
      expect(modelWithoutMake.modelSlug).toBeUndefined();

      // areaId without cityId is omitted
      const areaWithoutCity = parseSearchParams('areaId=12');
      expect(areaWithoutCity.areaId).toBeUndefined();

      // With parent, both are retained
      const withParents = parseSearchParams('makeSlug=toyota&modelSlug=camry&cityId=1&areaId=12');
      expect(withParents.makeSlug).toBe('toyota');
      expect(withParents.modelSlug).toBe('camry');
      expect(withParents.cityId).toBe(1);
      expect(withParents.areaId).toBe(12);
    });

    it('parses Arabic free-text search queries and enforces length bounds (2..120 chars)', () => {
      // 1 char query: omitted
      expect(parseSearchParams('q=a').q).toBeUndefined();
      expect(parseSearchParams('q= ').q).toBeUndefined();

      // Over 120 chars: omitted
      expect(parseSearchParams(`q=${'a'.repeat(121)}`).q).toBeUndefined();

      // Arabic query: properly decoded and retained
      const arabicQuery = 'مرسيدس بنز الفئة سي';
      const parsed = parseSearchParams(`q=${encodeURIComponent(arabicQuery)}`);
      expect(parsed.q).toBe(arabicQuery);
    });

    it('validates UI panel and filter states', () => {
      // Valid panel and filter
      const validPanel = parseSearchParams('panel=filters&filter=condition');
      expect(validPanel.panel).toBe('filters');
      expect(validPanel.filter).toBe('condition');

      // filter without panel=filters is omitted
      const filterWithoutPanel = parseSearchParams('panel=sort&filter=condition');
      expect(filterWithoutPanel.panel).toBe('sort');
      expect(filterWithoutPanel.filter).toBeUndefined();

      // Unknown panel is omitted
      const unknownPanel = parseSearchParams('panel=nonexistent_panel');
      expect(unknownPanel.panel).toBeUndefined();
    });
  });

  describe('canonicalizeSearchParams', () => {
    it('omits defaults: page 1, limit 20, sort newest', () => {
      const withDefaults = {
        makeSlug: 'toyota',
        page: 1,
        limit: 20 as const,
        sort: 'newest' as const,
      };

      const canonical = canonicalizeSearchParams(withDefaults);
      expect(canonical.makeSlug).toBe('toyota');
      expect(canonical.page).toBeUndefined();
      expect(canonical.limit).toBeUndefined();
      expect(canonical.sort).toBeUndefined();
    });

    it('retains non-default pagination and sorting values', () => {
      const nonDefaults = {
        makeSlug: 'toyota',
        page: 3,
        limit: 40 as const,
        sort: 'price_desc' as const,
      };

      const canonical = canonicalizeSearchParams(nonDefaults);
      expect(canonical.page).toBe(3);
      expect(canonical.limit).toBe(40);
      expect(canonical.sort).toBe('price_desc');
    });

    it('strips cursor from search URL state', () => {
      const withCursor = {
        makeSlug: 'toyota',
        cursor: 'opaque_cursor_token_123',
      };
      const canonical = canonicalizeSearchParams(withCursor);
      expect(canonical.cursor).toBeUndefined();
      expect(canonical.makeSlug).toBe('toyota');
    });
  });

  describe('serializeSearchParams', () => {
    it('deterministically sorts parameter keys alphabetically', () => {
      const unordered = {
        yearMin: 2020,
        cityId: 1,
        condition: 'USED' as const,
        makeSlug: 'toyota',
      };

      const serialized = serializeSearchParams(unordered);
      // Expected alphabetical order: cityId, condition, makeSlug, yearMin
      expect(serialized).toBe('cityId=1&condition=USED&makeSlug=toyota&yearMin=2020');
    });

    it('returns empty string when all parameters are default or empty', () => {
      expect(serializeSearchParams({})).toBe('');
      expect(serializeSearchParams('page=1&limit=20&sort=newest')).toBe('');
      expect(serializeSearchParams({ page: 1, limit: 20, sort: 'newest' })).toBe('');
    });

    it('correctly encodes Arabic search terms in query string', () => {
      const arabic = {
        q: 'كامري 2023',
        makeSlug: 'toyota',
      };
      const serialized = serializeSearchParams(arabic);
      expect(serialized).toContain('makeSlug=toyota');
      expect(serialized).toContain(`q=${encodeURIComponent('كامري 2023')}`);
    });
  });

  describe('searchParamsToApiInput', () => {
    it('projects canonical parameters to backend ListingSearchParams with default values', () => {
      const minimal = { makeSlug: 'toyota' };
      const apiInput = searchParamsToApiInput(minimal);

      expect(apiInput.makeSlug).toBe('toyota');
      // Server normalizations applied
      expect(apiInput.sort).toBe(DEFAULT_SORT);
      expect(apiInput.page).toBe(DEFAULT_PAGE);
      expect(apiInput.limit).toBe(DEFAULT_LIMIT);
    });

    it('strips UI overlay states (panel, filter) from API projection', () => {
      const withUI = {
        makeSlug: 'toyota',
        panel: 'filters' as const,
        filter: 'price',
      };
      const apiInput = searchParamsToApiInput(withUI);
      expect(apiInput.makeSlug).toBe('toyota');
      expect((apiInput as Record<string, unknown>)['panel']).toBeUndefined();
      expect((apiInput as Record<string, unknown>)['filter']).toBeUndefined();
    });
  });

  describe('applyFilterChange', () => {
    it('resets page and clears cursor when any filter, search query, or sort changes', () => {
      const current = {
        makeSlug: 'toyota',
        page: 4,
        cursor: 'cur_abc_123',
      };

      // Change make
      const updatedMake = applyFilterChange(current, { makeSlug: 'nissan' });
      expect(updatedMake.makeSlug).toBe('nissan');
      expect(updatedMake.page).toBeUndefined(); // reset to 1 (omitted in canonical)
      expect(updatedMake.cursor).toBeUndefined(); // cursor cleared

      // Change sort
      const updatedSort = applyFilterChange(current, { sort: 'price_asc' });
      expect(updatedSort.sort).toBe('price_asc');
      expect(updatedSort.page).toBeUndefined();
      expect(updatedSort.cursor).toBeUndefined();
    });

    it('clears dependent model when make changes', () => {
      const current = {
        makeSlug: 'toyota',
        modelSlug: 'corolla',
        page: 3,
      };

      const updated = applyFilterChange(current, { makeSlug: 'honda' });
      expect(updated.makeSlug).toBe('honda');
      expect(updated.modelSlug).toBeUndefined();
      expect(updated.page).toBeUndefined();
    });

    it('clears dependent area when city changes', () => {
      const current = {
        cityId: 1,
        areaId: 10,
        page: 2,
      };

      const updated = applyFilterChange(current, { cityId: 2 });
      expect(updated.cityId).toBe(2);
      expect(updated.areaId).toBeUndefined();
      expect(updated.page).toBeUndefined();
    });

    it('preserves existing filters when updating only page', () => {
      const current = {
        makeSlug: 'toyota',
        yearMin: 2021,
        page: 1,
      };

      const updated = applyFilterChange(current, { page: 3 });
      expect(updated.makeSlug).toBe('toyota');
      expect(updated.yearMin).toBe(2021);
      expect(updated.page).toBe(3);
    });

    it('builds full URL pathname and query string via buildSearchUrl', () => {
      expect(buildSearchUrl('/ar/search', { makeSlug: 'toyota' })).toBe(
        '/ar/search?makeSlug=toyota'
      );
      expect(buildSearchUrl('/en/search', { page: 1, limit: 20 })).toBe('/en/search');
    });
  });
});

describe('TASK-029: Dependent Option Loaders & Hierarchy (options.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides canonical TanStack query keys for all hierarchy levels', () => {
    expect(optionQueryKeys.makes()).toEqual(['taxonomy', 'makes']);
    expect(optionQueryKeys.models('toyota')).toEqual([
      'taxonomy',
      'make',
      'toyota',
      'models',
    ]);
    expect(optionQueryKeys.generations('mod_01h7x9k3p0000000000000001')).toEqual([
      'taxonomy',
      'model',
      'mod_01h7x9k3p0000000000000001',
      'generations',
    ]);
    expect(optionQueryKeys.trims('gen_01h7x9k3p0000000000000001')).toEqual([
      'taxonomy',
      'generation',
      'gen_01h7x9k3p0000000000000001',
      'trims',
    ]);
    expect(optionQueryKeys.countries()).toEqual(['locations', 'countries']);
    expect(optionQueryKeys.cities('AE')).toEqual(['locations', 'country', 'ae', 'cities']);
    expect(optionQueryKeys.areas(101)).toEqual(['locations', 'city', 101, 'areas']);
  });

  it('loads options and validates responses using fetchOptionEndpoint and AbortSignal', async () => {
    const mockMakes = [
      {
        publicId: 'mak_01h7x9k3p0000000000000001',
        slug: 'toyota',
        name: { ar: 'تويوتا', en: 'Toyota' },
        logoUrl: 'https://images.unsplash.com/logo-toyota.png',
        countryOfOrigin: 'JP',
        isActive: true,
        sortOrder: 1,
        activeListingCount: 150,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockMakes }),
    } as unknown as Response);

    const controller = new AbortController();
    const makes = await fetchMakes({ signal: controller.signal });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/bff/taxonomy/makes',
      expect.objectContaining({
        method: 'GET',
        signal: controller.signal,
      })
    );
    expect(makes).toEqual(mockMakes);
  });

  it('fetches models, generations, trims, countries, cities, and areas with typed paths', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Models
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            publicId: 'mod_01h7x9k3p0000000000000001',
            slug: 'camry',
            name: { ar: 'كامري', en: 'Camry' },
            bodyType: 'SEDAN',
            vehicleType: 'CAR',
            isActive: true,
            sortOrder: 1,
            activeListingCount: 45,
          },
        ],
      }),
    } as unknown as Response);

    const models = await fetchModels('toyota');
    expect(models).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/bff/taxonomy/makes/toyota/models',
      expect.any(Object)
    );

    // Generations
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            publicId: 'gen_01h7x9k3p0000000000000001',
            name: 'XV70',
            startYear: 2017,
            endYear: 2024,
          },
        ],
      }),
    } as unknown as Response);

    const generations = await fetchGenerations('mod_01h7x9k3p0000000000000001');
    expect(generations).toHaveLength(1);

    // Trims
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            publicId: 'trm_01h7x9k3p0000000000000001',
            name: { ar: 'جي ال اي', en: 'GLE' },
            modelYear: 2023,
            engineCc: 2500,
            powerHp: 204,
            torqueNm: 243,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            drivetrain: 'FWD',
            seats: 5,
            fuelEconomyKmL: 14.5,
            warrantyYears: 3,
            warrantyKm: 100000,
            specs: null,
            officialPriceCents: 11000000,
            marketPriceCents: 10500000,
            currency: 'AED',
            brochureUrl: null,
            isActive: true,
          },
        ],
      }),
    } as unknown as Response);

    const trims = await fetchTrims('gen_01h7x9k3p0000000000000001');
    expect(trims).toHaveLength(1);

    // Countries
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            code: 'AE',
            name: { ar: 'الإمارات', en: 'UAE' },
            phoneCode: '+971',
            currency: 'AED',
            configJson: null,
            isActive: true,
          },
        ],
      }),
    } as unknown as Response);

    const countries = await fetchCountries();
    expect(countries).toHaveLength(1);

    // Cities
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            countryId: 1,
            name: { ar: 'دبي', en: 'Dubai' },
            isActive: true,
          },
        ],
      }),
    } as unknown as Response);

    const cities = await fetchCities('AE');
    expect(cities).toHaveLength(1);

    // Areas
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 101,
            cityId: 1,
            name: { ar: 'البرشاء', en: 'Al Barsha' },
            postalCode: null,
            isActive: true,
          },
        ],
      }),
    } as unknown as Response);

    const areas = await fetchAreas(1);
    expect(areas).toHaveLength(1);
  });

  it('throws descriptive error on HTTP failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    await expect(fetchMakes()).rejects.toThrow(/HTTP 404/);
  });

  it('clears vehicle and location descendants on level changes', () => {
    const vehicleParams = {
      makeSlug: 'toyota',
      modelSlug: 'camry',
      generationPublicId: 'gen_01',
      trimPublicId: 'trm_01',
    };

    const makeCleared = clearVehicleDescendants(vehicleParams, 'make');
    expect(makeCleared.modelSlug).toBeUndefined();
    expect(makeCleared.generationPublicId).toBeUndefined();
    expect(makeCleared.trimPublicId).toBeUndefined();

    const modelCleared = clearVehicleDescendants(vehicleParams, 'model');
    expect(modelCleared.generationPublicId).toBeUndefined();
    expect(modelCleared.trimPublicId).toBeUndefined();
    expect(modelCleared.modelSlug).toBe('camry');

    const locationParams = {
      countryCode: 'AE',
      cityId: 1,
      areaId: 101,
    };

    const countryCleared = clearLocationDescendants(locationParams, 'country');
    expect(countryCleared.cityId).toBeUndefined();
    expect(countryCleared.areaId).toBeUndefined();

    const cityCleared = clearLocationDescendants(locationParams, 'city');
    expect(cityCleared.areaId).toBeUndefined();
    expect(cityCleared.cityId).toBe(1);
  });

  it('validates and prunes invalid descendants against loaded option lists', () => {
    const models: VehicleModel[] = [
      {
        publicId: 'mod_01',
        slug: 'camry',
        name: { ar: 'كامري', en: 'Camry' },
        bodyType: 'SEDAN',
        vehicleType: 'CAR',
        isActive: true,
        sortOrder: 1,
        activeListingCount: 10,
      },
      {
        publicId: 'mod_02',
        slug: 'corolla',
        name: { ar: 'كورولا', en: 'Corolla' },
        bodyType: 'SEDAN',
        vehicleType: 'CAR',
        isActive: false, // inactive!
        sortOrder: 2,
        activeListingCount: 0,
      },
    ];

    expect(isModelValidForMake('camry', models)).toBe(true);
    expect(isModelValidForMake('corolla', models)).toBe(false); // inactive
    expect(isModelValidForMake('land-cruiser', models)).toBe(false); // not in list

    const areas: Area[] = [
      { id: 101, cityId: 1, name: { ar: 'البرشاء', en: 'Al Barsha' }, postalCode: null, isActive: true },
      { id: 102, cityId: 1, name: { ar: 'السطوة', en: 'Al Satwa' }, postalCode: null, isActive: false },
    ];

    expect(isAreaValidForCity(101, areas)).toBe(true);
    expect(isAreaValidForCity(102, areas)).toBe(false); // inactive
    expect(isAreaValidForCity(999, areas)).toBe(false);

    // Prunes invalid descendants
    const pruned = pruneInvalidDescendants(
      { makeSlug: 'toyota', modelSlug: 'land-cruiser', cityId: 1, areaId: 999 },
      { models, areas }
    );
    expect(pruned.modelSlug).toBeUndefined();
    expect(pruned.areaId).toBeUndefined();
    expect(pruned.makeSlug).toBe('toyota');
    expect(pruned.cityId).toBe(1);
  });
});

describe('TASK-029: useDebouncedValue Hook (use-debounced-value.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides a stable initial value on initial render with zero clock divergence', () => {
    const { result } = renderHook(() => useDebouncedValue('تويوتا كامري', 300));
    expect(result.current).toBe('تويوتا كامري');
  });

  it('debounces rapid value changes until delayMs has elapsed', () => {
    const { result, rerender } = renderHook(
      ({ val, delay }) => useDebouncedValue(val, delay),
      { initialProps: { val: 'كامري', delay: 300 } }
    );

    expect(result.current).toBe('كامري');

    // Rapid change 1
    rerender({ val: 'كامري 20', delay: 300 });
    expect(result.current).toBe('كامري'); // Still old value

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('كامري'); // 150ms elapsed, still old value

    // Rapid change 2 before delay expires
    rerender({ val: 'كامري 2024', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('كامري'); // 200ms elapsed since change 2, still old value

    // Complete delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('كامري 2024'); // Now updated
  });

  it('cleans up pending timer on unmount', () => {
    const { unmount } = renderHook(() => useDebouncedValue('مرسيدس', 300));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('provides composition safety: pauses debounced commit during IME composition', () => {
    const { result, rerender } = renderHook(
      ({ val, isComposing }) => useDebouncedValue(val, 300, { isComposing }),
      { initialProps: { val: 'م', isComposing: true } }
    );

    expect(result.current).toBe('م');

    // User continues typing in composition mode
    rerender({ val: 'مر', isComposing: true });
    rerender({ val: 'مرس', isComposing: true });

    // Advance timers well beyond 300ms
    act(() => {
      vi.advanceTimersByTime(600);
    });
    // Must NOT commit while isComposing is true!
    expect(result.current).toBe('م');

    // User finishes composition (e.g. onCompositionEnd)
    rerender({ val: 'مرسيدس', isComposing: false });
    expect(result.current).toBe('م');

    // Once composition ends, timer runs and commits the final composed value
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('مرسيدس');
  });
});

describe('TASK-029: Strict BDD Acceptance Gate', () => {
  /**
   * Acceptance Criteria:
   * GIVEN: A URL containing defaults, duplicate filters, invalid page, and unordered sets
   * WHEN: It is parsed then serialized
   * THEN: Output is a single stable canonical query string, invalid data uses documented defaults/errors,
   *       and a second round-trip is byte-identical
   */
  it('converts non-canonical inputs into stable canonical query string with byte-identical second round-trip', () => {
    // Input containing defaults (limit=20, sort=newest, page=1), duplicate filters (makeSlug=toyota),
    // invalid page (-5), out of order params, unknown params (evil=true), and unordered bounds (yearMin > yearMax)
    const messyUrl =
      'limit=20&page=1&sort=newest&makeSlug=toyota&makeSlug=toyota&page=-5&cityId=10&yearMin=2024&yearMax=2020&evil=true&condition=USED';

    // WHEN: Parsed then serialized
    const firstPassSerialized = serializeSearchParams(messyUrl);

    // THEN:
    // 1. Defaults limit=20, page=1, sort=newest are omitted.
    // 2. Duplicate makeSlug collapsed to 'toyota'.
    // 3. Invalid page -5 dropped.
    // 4. Unknown param 'evil' removed.
    // 5. Invalid upper bound yearMax (2020 < 2024) dropped, yearMin (2024) retained.
    // 6. Keys sorted deterministically: cityId, condition, makeSlug, yearMin.
    const expectedCanonical = 'cityId=10&condition=USED&makeSlug=toyota&yearMin=2024';
    expect(firstPassSerialized).toBe(expectedCanonical);

    // AND: Second round-trip is byte-identical
    const secondPassParsed = parseSearchParams(firstPassSerialized);
    const secondPassSerialized = serializeSearchParams(secondPassParsed);

    expect(secondPassSerialized).toBe(firstPassSerialized);
    expect(secondPassSerialized).toBe(expectedCanonical);
  });
});
