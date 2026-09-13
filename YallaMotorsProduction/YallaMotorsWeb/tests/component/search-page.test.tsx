import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/ar/search',
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    locale,
    children,
    onClick,
    className,
    prefetch: _prefetch,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    prefetch?: boolean;
    [key: string]: unknown;
  }) => {
    void _prefetch;
    return (
      <a
        href={href}
        data-locale={locale}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
}));

// Mock next/navigation
const mockRedirect = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    fill: _unusedFill,
    priority: _unusedPriority,
    sizes: _unusedSizes,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    className?: string;
    [key: string]: unknown;
  }) => {
    void _unusedFill;
    void _unusedPriority;
    void _unusedSizes;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} {...props} />;
  },
}));

// Mock searchListings, listMakes, listCities
const mockSearchListings = vi.fn();
vi.mock('@/server/queries/listings', () => ({
  searchListings: (...args: unknown[]) => mockSearchListings(...args),
}));

const mockListMakes = vi.fn();
vi.mock('@/server/queries/taxonomy', () => ({
  listMakes: (...args: unknown[]) => mockListMakes(...args),
}));

const mockListCities = vi.fn();
vi.mock('@/server/queries/locations', () => ({
  listCities: (...args: unknown[]) => mockListCities(...args),
}));

// Mock option loaders
const mockFetchModels = vi.fn();
const mockFetchAreas = vi.fn();
vi.mock('@/lib/search/options', () => ({
  fetchModels: (...args: unknown[]) => mockFetchModels(...args),
  fetchAreas: (...args: unknown[]) => mockFetchAreas(...args),
}));

import SearchPage, { generateMetadata } from '@/app/[locale]/(marketplace)/search/page';
import SearchLoading from '@/app/[locale]/(marketplace)/search/loading';
import { SearchShell } from '@/components/search/search-shell';
import { MobileFilterDrawer } from '@/components/search/mobile-filter-drawer';
import { ActiveFilters } from '@/components/search/active-filters';
import { SortControl } from '@/components/search/sort-control';
import { SearchResults } from '@/components/search/search-results';
import { AppProviders } from '@/providers/app-providers';
import { createListingCard } from '../fixtures/factories';
import type { ListingCard } from '@/types/listing';
import type { Make, VehicleModel, City } from '@/types/taxonomy';

const sampleMake: Make = {
  publicId: 'make_toyota_1',
  slug: 'toyota',
  name: { ar: 'تويوتا', en: 'Toyota' },
  logoUrl: 'https://images.arabiyatmart.com/toyota.png',
  countryOfOrigin: 'Japan',
  isActive: true,
  sortOrder: 1,
  activeListingCount: 15,
};

const sampleModelCorolla: VehicleModel = {
  publicId: 'mod_corolla_1',
  slug: 'corolla',
  name: { ar: 'كورولا', en: 'Corolla' },
  bodyType: 'SEDAN',
  vehicleType: 'CAR',
  isActive: true,
  sortOrder: 1,
  activeListingCount: 10,
};

const sampleModelCamry: VehicleModel = {
  publicId: 'mod_camry_2',
  slug: 'camry',
  name: { ar: 'كامري', en: 'Camry' },
  bodyType: 'SEDAN',
  vehicleType: 'CAR',
  isActive: true,
  sortOrder: 2,
  activeListingCount: 5,
};

const sampleCity: City = {
  id: 1,
  name: { ar: 'القاهرة', en: 'Cairo' },
  countryId: 1,
  isActive: true,
};

describe('TASK-030: Search Results Route & Components Suite', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockListMakes.mockResolvedValue({ data: [sampleMake] });
    mockListCities.mockResolvedValue({ data: [sampleCity] });
    mockFetchModels.mockResolvedValue([sampleModelCorolla, sampleModelCamry]);
    mockFetchAreas.mockResolvedValue([]);
    routingState.pathname = '/ar/search';
    routingState.replace.mockClear();
    routingState.push.mockClear();
    mockRedirect.mockClear();
  });

  describe('1. SearchPage Server Component & Canonical Redirects', () => {
    it('redirects non-canonical URLs (e.g. page=1 default) to canonical clean URL', async () => {
      const params = Promise.resolve({ locale: 'ar' });
      const searchParams = Promise.resolve({ page: '1' });

      await expect(
        SearchPage({ params, searchParams })
      ).rejects.toThrow('REDIRECT:/ar/search');

      expect(mockRedirect).toHaveBeenCalledWith('/ar/search');
    });

    it('redirects non-canonical default sort (sort=newest) to clean URL', async () => {
      const params = Promise.resolve({ locale: 'ar' });
      const searchParams = Promise.resolve({ sort: 'newest', makeSlug: 'toyota' });

      await expect(
        SearchPage({ params, searchParams })
      ).rejects.toThrow('REDIRECT:/ar/search?makeSlug=toyota');

      expect(mockRedirect).toHaveBeenCalledWith('/ar/search?makeSlug=toyota');
    });

    it('renders server-side results and Schema.org ItemList JSON-LD for canonical URL', async () => {
      const fakeCard = createListingCard({
        slug: 'toyota-corolla-2022-clean',
        title: 'Toyota Corolla 2022 Clean',
      });
      mockSearchListings.mockResolvedValue({
        data: [fakeCard],
        meta: { total: 1, page: 1, limit: 20, hasMore: false },
      });

      const params = Promise.resolve({ locale: 'ar' });
      const searchParams = Promise.resolve({ makeSlug: 'toyota' });

      const jsx = await SearchPage({ params, searchParams });
      render(<AppProviders initialSession={null}>{jsx}</AppProviders>);

      expect(screen.getByTestId('search-shell')).toBeInTheDocument();
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
      expect(screen.getByText('Toyota Corolla 2022 Clean')).toBeInTheDocument();

      // Verify Schema.org ItemList script
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const found = Array.from(scripts).some((s) =>
        s.textContent?.includes('"@type":"ItemList"')
      );
      expect(found).toBe(true);
    });

    it('escapes JSON-LD payload to prevent </script> tag injection', async () => {
      const xssCard = createListingCard({
        slug: 'injected-title',
        title: 'Corolla </script><script>alert("xss")</script>',
      });
      mockSearchListings.mockResolvedValue({
        data: [xssCard],
        meta: { total: 1, page: 1, limit: 20, hasMore: false },
      });

      const params = Promise.resolve({ locale: 'ar' });
      const searchParams = Promise.resolve({});

      const jsx = await SearchPage({ params, searchParams });
      const { container } = render(<AppProviders initialSession={null}>{jsx}</AppProviders>);

      const scriptTag = container.querySelector('script[type="application/ld+json"]');
      expect(scriptTag).toBeInTheDocument();
      const rawHtml = scriptTag?.innerHTML ?? '';
      expect(rawHtml).not.toContain('</script>');
      expect(rawHtml).not.toContain('<script>');
      expect(rawHtml).toContain('\\u003c/script\\u003e');
      expect(rawHtml).toContain('\\u003cscript\\u003e');
    });
  });

  describe('2. SearchPage generateMetadata', () => {
    it('emits meaningful localized title and noindex on filtered pages', async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({
          makeSlug: 'toyota',
          modelSlug: 'corolla',
          condition: 'NEW',
        }),
      });

      expect(meta.title).toContain('تويوتا');
      expect(meta.title).toContain('جديدة');
      expect(meta.robots).toEqual({ index: false, follow: true });
      expect(meta.alternates?.canonical).toBe(
        '/ar/search?condition=NEW&makeSlug=toyota&modelSlug=corolla'
      );
    });

    it('emits indexable metadata for completely unfiltered search', async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({}),
      });

      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.alternates?.canonical).toBe('/ar/search');
    });
  });

  describe('3. ActiveFilters & Filter Chips', () => {
    it('renders chips for active filters and handles remove & clear all', () => {
      const onRemoveFilter = vi.fn();
      const onClearAll = vi.fn();

      render(
        <ActiveFilters
          params={{
            condition: 'NEW',
            makeSlug: 'toyota',
            priceMin: 20000000, // 200,000 EGP in cents
          }}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearAll}
          makes={[sampleMake]}
          locale="ar"
        />
      );

      expect(screen.getByText('الماركة: تويوتا')).toBeInTheDocument();
      expect(screen.getByText('جديد (زيرو)')).toBeInTheDocument();
      expect(screen.getByText(/من (200,000|٢٠٠[٬,]٠٠٠)/)).toBeInTheDocument();

      // Click remove on make filter
      const removeButtons = screen.getAllByRole('button', { name: /إزالة الفلتر/ });
      expect(removeButtons.length).toBe(3);
      fireEvent.click(removeButtons[0]!);
      expect(onRemoveFilter).toHaveBeenCalled();

      // Click clear all
      const clearAllBtn = screen.getByRole('button', { name: 'مسح الكل' });
      fireEvent.click(clearAllBtn);
      expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    it('returns null if there are no active filters', () => {
      const { container } = render(
        <ActiveFilters
          params={{}}
          onRemoveFilter={vi.fn()}
          onClearAll={vi.fn()}
          locale="ar"
        />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('4. MobileFilterDrawer Apply & Cancel Semantics', () => {
    it('applies draft filters only on explicit Apply, discards on Cancel', async () => {
      const onApply = vi.fn();

      render(
        <MobileFilterDrawer
          currentParams={{ condition: 'USED' }}
          onApply={onApply}
          makes={[sampleMake]}
          locale="ar"
        />
      );

      // Trigger button shows active count 1
      const trigger = screen.getByTestId('mobile-filter-trigger');
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      // Open drawer
      fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('mobile-filter-drawer')).toBeInTheDocument();
      });

      // Click Cancel button
      const cancelBtn = screen.getByTestId('mobile-filter-cancel');
      fireEvent.click(cancelBtn);

      expect(onApply).not.toHaveBeenCalled();

      // Re-open and click Apply
      fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('mobile-filter-drawer')).toBeInTheDocument();
      });

      const applyBtn = screen.getByTestId('mobile-filter-apply');
      fireEvent.click(applyBtn);

      expect(onApply).toHaveBeenCalledWith({ condition: 'USED' });
    });
  });

  describe('5. Acceptance Criteria: Make change and rapid Model changes race safety', async () => {
    it('GIVEN desktop user changes make then rapidly changes model twice, THEN canonical URL reflects final selection and resets page', async () => {
      render(
        <SearchShell
          initialParams={{ page: 3, makeSlug: 'toyota' }}
          totalResults={5}
          makes={[sampleMake]}
          models={[sampleModelCorolla, sampleModelCamry]}
          locale="ar"
        >
          <div>Results Content</div>
        </SearchShell>
      );

      // Change model to corolla then camry rapidly
      const modelSelect = screen.getByLabelText('الموديل');
      expect(modelSelect).toBeInTheDocument();

      fireEvent.change(modelSelect, { target: { value: 'corolla' } });
      fireEvent.change(modelSelect, { target: { value: 'camry' } });

      await waitFor(() => {
        expect(routingState.replace).toHaveBeenCalled();
      });

      // The final call should have camry, make toyota, and page reset (omitted page=1)
      const lastCall = routingState.replace.mock.calls[routingState.replace.mock.calls.length - 1];
      expect(lastCall?.[0]).toContain('makeSlug=toyota');
      expect(lastCall?.[0]).toContain('modelSlug=camry');
      expect(lastCall?.[0]).not.toContain('page=');
    });
  });

  describe('6. SearchResults & Pagination Component', () => {
    it('renders empty listings state when data is empty', () => {
      render(
        <SearchResults
          results={{
            data: [],
            meta: { total: 0, page: 1, limit: 20, hasMore: false },
          }}
          currentParams={{}}
          locale="ar"
        />
      );

      expect(screen.getByTestId('empty-listings')).toBeInTheDocument();
      expect(screen.getByText('لم نجد سيارات تطابق بحثك')).toBeInTheDocument();
    });

    it('renders pagination links when totalPages > 1', () => {
      const fakeCards: ListingCard[] = [
        createListingCard({ publicId: 'lst_1', slug: 'car-1', title: 'Car 1' }),
      ];

      render(
        <AppProviders initialSession={null}>
          <SearchResults
            results={{
              data: fakeCards,
              meta: { total: 50, page: 2, limit: 20, hasMore: true },
            }}
            currentParams={{ makeSlug: 'toyota' }}
            locale="ar"
            pathname="/ar/search"
          />
        </AppProviders>
      );

      // Expect pagination links to preserve filters
      const page1Link = screen.getByRole('link', { name: '1' });
      expect(page1Link.getAttribute('href')).toContain('/ar/search');
      expect(page1Link.getAttribute('href')).toContain('makeSlug=toyota');

      const nextLink = screen.getByLabelText('Go to next page');
      expect(nextLink.getAttribute('href')).toContain('page=3');
    });
  });

  describe('7. SortControl Component', () => {
    it('renders sort options and triggers onSortChange', () => {
      const onSortChange = vi.fn();
      render(
        <SortControl
          value="newest"
          onSortChange={onSortChange}
          locale="ar"
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      fireEvent.change(select, { target: { value: 'price_asc' } });
      expect(onSortChange).toHaveBeenCalledWith('price_asc');
    });
  });

  describe('8. SearchLoading Skeleton', () => {
    it('renders skeleton matching layout without throwing', () => {
      const { container } = render(<SearchLoading />);
      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5);
    });
  });
});
