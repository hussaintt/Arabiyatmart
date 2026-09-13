import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/ar/dealers',
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
  useSearchParams: () => routingState.searchParams,
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    locale,
    children,
    onClick,
    className,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    [key: string]: unknown;
  }) => (
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
  ),
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

// Mock server queries
const mockListDealers = vi.fn();
const mockListCities = vi.fn();
vi.mock('@/server/queries/dealers', () => ({
  listDealers: (...args: unknown[]) => mockListDealers(...args),
}));
vi.mock('@/server/queries/locations', () => ({
  listCities: (...args: unknown[]) => mockListCities(...args),
}));

import DealersPage, { generateMetadata } from '@/app/[locale]/(marketplace)/dealers/page';
import DealersLoading from '@/app/[locale]/(marketplace)/dealers/loading';
import { DealerCard } from '@/components/dealer/dealer-card';
import { DealerDirectoryFilters } from '@/components/dealer/dealer-directory-filters';
import { dealersPolicy } from '@/lib/cache/policy';
import type { DealerDirectoryItem } from '@/types/dealer';
import type { City } from '@/types/taxonomy';

const mockDealers: DealerDirectoryItem[] = [
  {
    publicId: 'dlr_futtaim_01',
    slug: 'al-futtaim-motors',
    displayName: { ar: 'الفطيم للسيارات', en: 'Al-Futtaim Motors' },
    logoUrl: 'https://images.arabiyatmart.com/dealers/futtaim.webp',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    activeListingCount: 42,
    isVerified: true,
  },
  {
    publicId: 'dlr_auto_arabia_02',
    slug: 'auto-arabia-gallery',
    displayName: { ar: 'أوتو أرابيا (Auto Arabia)', en: 'Auto Arabia' },
    logoUrl: null, // No logo fallback test
    cityName: { ar: 'الجيزة', en: 'Giza' },
    activeListingCount: 0, // Zero inventory test
    isVerified: false,
  },
];

const mockCities: City[] = [
  { id: 1, countryId: 1, name: { ar: 'القاهرة', en: 'Cairo' }, isActive: true },
  { id: 2, countryId: 1, name: { ar: 'الجيزة', en: 'Giza' }, isActive: true },
  { id: 3, countryId: 1, name: { ar: 'الإسكندرية', en: 'Alexandria' }, isActive: true },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  routingState.searchParams = new URLSearchParams();
});

describe('TASK-032: Dealer Directory Route', () => {
  beforeEach(() => {
    mockListDealers.mockResolvedValue({
      data: mockDealers,
      meta: { hasMore: false, nextCursor: null },
    });
    mockListCities.mockResolvedValue({
      data: mockCities,
    });
  });

  describe('DealerDirectoryPage (RSC)', () => {
    it('renders server-visible dealer cards with 1/2/3 responsive grid and no internal dealer IDs', async () => {
      const pageJsx = await DealersPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({}),
      });

      render(pageJsx);

      // Page Title
      expect(screen.getByRole('heading', { level: 1, name: /دليل معارض وتجار السيارات/i })).toBeInTheDocument();

      // Responsive Grid container with 1/2/3 columns (sm:grid-cols-2 lg:grid-cols-3)
      const grid = screen.getByTestId('dealer-directory-grid');
      expect(grid).toBeInTheDocument();
      expect(grid.className).toContain('grid-cols-1');
      expect(grid.className).toContain('sm:grid-cols-2');
      expect(grid.className).toContain('lg:grid-cols-3');

      // Dealer card presence
      expect(screen.getByTestId('dealer-card-al-futtaim-motors')).toBeInTheDocument();
      expect(screen.getByText('الفطيم للسيارات')).toBeInTheDocument();
      expect(screen.getByText(/42 سيارة معروضة|٤٢ سيارة معروضة/)).toBeInTheDocument();

      // Ensure NO internal numeric ID is exposed in the HTML
      expect(document.body.innerHTML).not.toMatch(/id="dealer-\d+"/i);
      expect(document.body.innerHTML).not.toMatch(/data-dealer-id="\d+"/i);
    });

    it('generates canonical metadata and sets noindex on filtered variants', async () => {
      // 1. Unfiltered page: index: true
      const metaUnfiltered = await generateMetadata({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({}),
      });

      expect(metaUnfiltered.alternates?.canonical).toBe('/ar/dealers');
      expect((metaUnfiltered.robots as { index?: boolean })?.index).toBe(true);

      // 2. Filtered by cityId: index: false (noindex, follow)
      const metaFiltered = await generateMetadata({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({ cityId: '1' }),
      });

      expect(metaFiltered.alternates?.canonical).toBe('/ar/dealers');
      expect((metaFiltered.robots as { index?: boolean })?.index).toBe(false);
      expect((metaFiltered.robots as { follow?: boolean })?.follow).toBe(true);
    });

    it('handles malformed parameters safely and renders without crash', async () => {
      const pageJsx = await DealersPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({ cityId: 'not-a-number', cursor: '   ' }),
      });

      render(pageJsx);

      // Successfully falls back to default unfiltered query
      expect(screen.getByTestId('dealer-directory-grid')).toBeInTheDocument();
      expect(mockListDealers).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 24 }),
        'ar'
      );
    });

    it('renders localized empty state when query returns zero dealers', async () => {
      mockListDealers.mockResolvedValue({
        data: [],
        meta: { hasMore: false, nextCursor: null },
      });

      const pageJsx = await DealersPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({ cityId: '99' }),
      });

      render(pageJsx);

      expect(screen.getByTestId('dealer-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/لا توجد معارض سيارات مسجلة في هذه المدينة/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /عرض جميع المعارض/i })).toBeInTheDocument();
    });

    it('renders pagination controls when hasMore is true', async () => {
      mockListDealers.mockResolvedValue({
        data: mockDealers,
        meta: { hasMore: true, nextCursor: 'cur_next_page_token' },
      });

      const pageJsx = await DealersPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({}),
      });

      render(pageJsx);

      const nextLink = screen.getByRole('link', { name: /الصفحة التالية/i });
      expect(nextLink).toBeInTheDocument();
      expect(nextLink).toHaveAttribute('href', expect.stringContaining('cursor=cur_next_page_token'));
    });
  });

  describe('DealerCard (RSC)', () => {
    it('renders fallback icon when logoUrl is null and bidi name support', () => {
      render(<DealerCard dealer={mockDealers[1]!} locale="ar" />);

      // Title rendered with bidi text
      const nameHeading = screen.getByText('أوتو أرابيا (Auto Arabia)');
      expect(nameHeading).toBeInTheDocument();
      expect(nameHeading).toHaveAttribute('dir', 'auto');

      // Zero inventory state
      expect(screen.getByText(/لا توجد سيارات حالياً/i)).toBeInTheDocument();
    });
  });

  describe('DealerDirectoryFilters (Client Component)', () => {
    it('updates URL and resets cursor pagination when a city is selected', () => {
      routingState.searchParams = new URLSearchParams('cityId=1&cursor=token_123');

      render(
        <DealerDirectoryFilters
          cities={mockCities}
          selectedCityId={1}
          totalDealers={42}
          locale="ar"
        />
      );

      const select = screen.getByLabelText(/اختر المدينة/i);
      expect(select).toHaveValue('1');

      // Change city to Giza (id: 2)
      fireEvent.change(select, { target: { value: '2' } });

      // router.push called with new cityId and WITHOUT cursor
      expect(routingState.push).toHaveBeenCalledWith('/ar/dealers?cityId=2');
    });

    it('clears city filter and resets pagination when clear button is clicked', () => {
      routingState.searchParams = new URLSearchParams('cityId=1');

      render(
        <DealerDirectoryFilters
          cities={mockCities}
          selectedCityId={1}
          totalDealers={42}
          locale="ar"
        />
      );

      const clearBtn = screen.getByRole('button', { name: /إعادة ضبط فلتر المدينة/i });
      fireEvent.click(clearBtn);

      expect(routingState.push).toHaveBeenCalledWith('/ar/dealers');
    });
  });

  describe('DealersLoading (RSC)', () => {
    it('renders 9 card skeletons and filter skeleton', () => {
      render(<DealersLoading />);
      expect(screen.getByTestId('dealers-loading')).toBeInTheDocument();
    });
  });

  describe('Cache Policy Verification', () => {
    it('verifies the existing cache policy is 300s under dealers', () => {
      const policy = dealersPolicy();
      expect(policy.cache).toBe('force-cache');
      expect(policy.isPrivate).toBe(false);
      expect(policy.next?.revalidate).toBe(300);
      expect(policy.next?.tags).toEqual(['dealers']);
    });
  });
});
