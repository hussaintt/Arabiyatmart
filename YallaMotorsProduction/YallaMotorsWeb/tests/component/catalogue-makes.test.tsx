import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/ar/catalogue/makes/toyota',
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
    role,
    'aria-selected': ariaSelected,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    role?: string;
    'aria-selected'?: boolean;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      data-locale={locale}
      className={className}
      role={role}
      aria-selected={ariaSelected}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

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
const mockListMakes = vi.fn();
const mockGetModelsWithPrices = vi.fn();
const mockGetMakeDealers = vi.fn();

vi.mock('@/server/queries/taxonomy', () => ({
  listMakes: (...args: unknown[]) => mockListMakes(...args),
}));

vi.mock('@/server/queries/catalogue', () => ({
  getModelsWithPrices: (...args: unknown[]) => mockGetModelsWithPrices(...args),
  getMakeDealers: (...args: unknown[]) => mockGetMakeDealers(...args),
}));

import MakesPage, { generateMetadata as generateMakesMetadata } from '@/app/[locale]/(marketplace)/catalogue/makes/page';
import MakeCataloguePage, { generateMetadata as generateMakeDetailMetadata } from '@/app/[locale]/(marketplace)/catalogue/makes/[makeSlug]/page';
import { MakeGrid } from '@/components/catalogue/make-grid';
import { ModelPriceCard } from '@/components/catalogue/model-price-card';
import { ConditionTabs } from '@/components/catalogue/condition-tabs';
import { ApiContractError } from '@/lib/api/schemas/common';
import type { Make, ModelWithPrice, TrimDealer } from '@/types/taxonomy';

const mockMakes: Make[] = [
  {
    publicId: 'mak_toyota_01',
    slug: 'toyota',
    name: { ar: 'تويوتا', en: 'Toyota' },
    logoUrl: 'https://images.arabiyatmart.com/makes/toyota.png',
    countryOfOrigin: 'اليابان',
    isActive: true,
    sortOrder: 1,
    activeListingCount: 154,
  },
  {
    publicId: 'mak_hyundai_02',
    slug: 'hyundai',
    name: { ar: 'هيونداي', en: 'Hyundai' },
    logoUrl: null, // Test logo fallback
    countryOfOrigin: 'كوريا الجنوبية',
    isActive: true,
    sortOrder: 2,
    activeListingCount: 98,
  },
];

const mockModels: ModelWithPrice[] = [
  {
    publicId: 'mod_corolla_01',
    slug: 'corolla',
    name: { ar: 'كورولا', en: 'Corolla' },
    bodyType: 'SEDAN',
    vehicleType: 'CAR',
    startingPriceCents: 85000000,
    currency: 'EGP',
    activeListingCount: 45,
  },
  {
    publicId: 'mod_yaris_02',
    slug: 'yaris',
    name: { ar: 'ياريس', en: 'Yaris' },
    bodyType: 'HATCHBACK',
    vehicleType: 'CAR',
    startingPriceCents: null, // Test price unavailable
    currency: 'EGP',
    activeListingCount: 12,
  },
];

const mockDealers: TrimDealer[] = [
  {
    publicId: 'dlr_futtaim_01',
    slug: 'al-futtaim-motors',
    displayName: { ar: 'الفطيم للسيارات', en: 'Al-Futtaim Motors' },
    logoUrl: 'https://images.arabiyatmart.com/dealers/futtaim.webp',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    isVerified: true,
    listingCount: 30,
    startingPriceCents: 85000000,
    currency: 'EGP',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  routingState.searchParams = new URLSearchParams();
});

describe('TASK-034: Makes Index and Make Catalogue Routes', () => {
  beforeEach(() => {
    mockListMakes.mockResolvedValue({ data: mockMakes });
    mockGetModelsWithPrices.mockResolvedValue({ data: mockModels });
    mockGetMakeDealers.mockResolvedValue({ data: mockDealers });
  });

  describe('MakeGrid (RSC)', () => {
    it('renders make tiles with logo and fallback initials when logoUrl is null', () => {
      render(<MakeGrid makes={mockMakes} locale="ar" />);

      // Make grid present
      const grid = screen.getByTestId('make-grid');
      expect(grid).toBeInTheDocument();
      // Responsive classes: 2 cols mobile, 3-4 tablet, 5-6 desktop
      expect(grid.className).toContain('grid-cols-2');
      expect(grid.className).toContain('sm:grid-cols-3');
      expect(grid.className).toContain('lg:grid-cols-5');

      // Card 1: Toyota with logo
      expect(screen.getByTestId('make-card-toyota')).toBeInTheDocument();
      expect(screen.getByText('تويوتا')).toBeInTheDocument();
      expect(screen.getByAltText('تويوتا')).toBeInTheDocument();

      // Card 2: Hyundai with initials fallback
      expect(screen.getByTestId('make-card-hyundai')).toBeInTheDocument();
      expect(screen.getByText('هيونداي')).toBeInTheDocument();
      expect(screen.getByText('هي')).toBeInTheDocument(); // First 2 characters of 'هيونداي'
    });
  });

  describe('ModelPriceCard (RSC)', () => {
    it('renders model card with formatted starting price from integer cents', () => {
      render(<ModelPriceCard model={mockModels[0]!} makeSlug="toyota" locale="ar" />);

      expect(screen.getByTestId('model-card-corolla')).toBeInTheDocument();
      expect(screen.getByText('كورولا')).toBeInTheDocument();
      expect(screen.getByTestId('model-starting-price')).toBeInTheDocument();
      // 85,000,000 cents -> 850,000 EGP
      expect(screen.getByTestId('model-starting-price').textContent).toMatch(/850,000|٨٥٠,٠٠٠/);
    });

    it('gracefully handles models with unavailable starting price', () => {
      render(<ModelPriceCard model={mockModels[1]!} makeSlug="toyota" locale="ar" />);

      expect(screen.getByTestId('model-card-yaris')).toBeInTheDocument();
      expect(screen.getByTestId('model-price-unavailable')).toBeInTheDocument();
      expect(screen.getByText(/السعر يحدد حسب الفئة والمواصفات|Price depends on trim/i)).toBeInTheDocument();
    });
  });

  describe('ConditionTabs (Client Component with Link Fallback)', () => {
    it('provides semantic links for all, new, and used tabs allowing navigation without JS', () => {
      render(<ConditionTabs makeSlug="toyota" currentCondition="USED" locale="ar" />);

      const tabs = screen.getByTestId('condition-tabs');
      expect(tabs).toBeInTheDocument();

      const allTab = screen.getByTestId('condition-tab-all');
      expect(allTab).toHaveAttribute('href', '/catalogue/makes/toyota');
      expect(allTab).toHaveAttribute('aria-selected', 'false');

      const newTab = screen.getByTestId('condition-tab-new');
      expect(newTab).toHaveAttribute('href', '/catalogue/makes/toyota?condition=NEW');
      expect(newTab).toHaveAttribute('aria-selected', 'false');

      const usedTab = screen.getByTestId('condition-tab-used');
      expect(usedTab).toHaveAttribute('href', '/catalogue/makes/toyota?condition=USED');
      expect(usedTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('MakesPage (RSC Index)', () => {
    it('renders all makes and generates canonical metadata', async () => {
      const pageJsx = await MakesPage({
        params: Promise.resolve({ locale: 'ar' }),
      });

      render(pageJsx);

      expect(screen.getByRole('heading', { level: 1, name: /دليل ماركات وتوكيلات السيارات/i })).toBeInTheDocument();
      expect(screen.getByTestId('make-card-toyota')).toBeInTheDocument();
      expect(screen.getByTestId('make-card-hyundai')).toBeInTheDocument();

      const meta = await generateMakesMetadata({
        params: Promise.resolve({ locale: 'ar' }),
      });
      expect(meta.alternates?.canonical).toBe('/ar/catalogue/makes');
    });
  });

  describe('MakeCataloguePage (RSC Detail)', () => {
    it('satisfies Acceptance Criteria: switches condition to used, formats price from cents, degrades gracefully when dealers absent', async () => {
      // Simulate dealer absence for used cars
      mockGetMakeDealers.mockResolvedValue({ data: [] });
      mockGetModelsWithPrices.mockResolvedValue({
        data: [
          {
            publicId: 'mod_corolla_used',
            slug: 'corolla',
            name: { ar: 'كورولا', en: 'Corolla' },
            bodyType: 'SEDAN',
            vehicleType: 'CAR',
            startingPriceCents: 65000000,
            currency: 'EGP',
            activeListingCount: 22,
          },
        ],
      });

      const pageJsx = await MakeCataloguePage({
        params: Promise.resolve({ locale: 'ar', makeSlug: 'toyota' }),
        searchParams: Promise.resolve({ condition: 'USED' }),
      });

      render(pageJsx);

      // 1. Header rendered with make name
      expect(screen.getByTestId('make-title')).toHaveTextContent('تويوتا');

      // 2. Condition tabs rendered and used tab is selected
      const usedTab = screen.getByTestId('condition-tab-used');
      expect(usedTab).toHaveAttribute('aria-selected', 'true');

      // 3. Models rendered with integer cents formatting (65,000,000 cents -> 650,000 EGP)
      expect(screen.getByTestId('model-card-corolla')).toBeInTheDocument();
      expect(screen.getByTestId('model-starting-price').textContent).toMatch(/650,000|٦٥٠,٠٠٠/);

      // 4. Dealer absence degrades without error (dealer section not displayed, page does not 404)
      expect(screen.queryByTestId('make-dealers-section')).toBeNull();

      // 5. Metadata canonical contains condition
      const meta = await generateMakeDetailMetadata({
        params: Promise.resolve({ locale: 'ar', makeSlug: 'toyota' }),
        searchParams: Promise.resolve({ condition: 'USED' }),
      });
      expect(meta.alternates?.canonical).toBe('/ar/catalogue/makes/toyota?condition=USED');
    });

    it('throws notFound() when makeSlug is unknown', async () => {
      await expect(
        MakeCataloguePage({
          params: Promise.resolve({ locale: 'ar', makeSlug: 'unknown-brand-xyz' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('propagates generic Error("404") without converting to 404', async () => {
      const genericError = new Error('404');
      mockListMakes.mockRejectedValue(genericError);

      await expect(
        MakeCataloguePage({
          params: Promise.resolve({ locale: 'ar', makeSlug: 'toyota' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(genericError);

      const genericNotFoundMsg = new Error('Resource not found (404)');
      mockListMakes.mockRejectedValue(genericNotFoundMsg);

      await expect(
        MakeCataloguePage({
          params: Promise.resolve({ locale: 'ar', makeSlug: 'toyota' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(genericNotFoundMsg);
    });

    it('propagates server, timeout, and network errors without converting to 404', async () => {
      const serverContractError = new ApiContractError({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          status: 500,
          requestId: 'req-500',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockListMakes.mockRejectedValue(serverContractError);

      await expect(
        MakeCataloguePage({
          params: Promise.resolve({ locale: 'ar', makeSlug: 'toyota' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(serverContractError);
    });

    it('renders empty models state gracefully without crashing', async () => {
      mockGetModelsWithPrices.mockResolvedValue({ data: [] });

      const pageJsx = await MakeCataloguePage({
        params: Promise.resolve({ locale: 'ar', makeSlug: 'toyota' }),
        searchParams: Promise.resolve({ condition: 'NEW' }),
      });

      render(pageJsx);

      expect(screen.getByTestId('models-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/لا توجد موديلات متاحة حالياً لسيارات تويوتا/i)).toBeInTheDocument();
    });
  });
});
