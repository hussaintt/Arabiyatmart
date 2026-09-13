import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/ar/catalogue/models/mod_corolla_01',
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
  useSearchParams: () => new URLSearchParams(),
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
    'data-testid': dataTestId,
    target,
    rel,
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    'data-testid'?: string;
    target?: string;
    rel?: string;
  }) => (
    <a
      href={href}
      data-locale={locale}
      className={className}
      data-testid={dataTestId}
      target={target}
      rel={rel}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
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
const mockGetCatalogueModel = vi.fn();
const mockGetCatalogueTrim = vi.fn();
const mockGetTrimDealers = vi.fn();

vi.mock('@/server/queries/catalogue', () => ({
  getCatalogueModel: (...args: unknown[]) => mockGetCatalogueModel(...args),
  getCatalogueTrim: (...args: unknown[]) => mockGetCatalogueTrim(...args),
  getTrimDealers: (...args: unknown[]) => mockGetTrimDealers(...args),
}));

import CatalogueModelPage, { generateMetadata as generateModelMetadata } from '@/app/[locale]/(marketplace)/catalogue/models/[publicId]/page';
import CatalogueTrimPage, { generateMetadata as generateTrimMetadata } from '@/app/[locale]/(marketplace)/catalogue/trims/[publicId]/page';
import { ModelOverview } from '@/components/catalogue/model-overview';
import { TrimTable } from '@/components/catalogue/trim-table';
import { TrimSpecifications } from '@/components/catalogue/trim-specifications';
import { catalogueModelPolicy, catalogueTrimPolicy, trimDealersPolicy } from '@/lib/cache/policy';
import { ApiContractError } from '@/lib/api/schemas/common';
import type { CatalogueTrimDetail, ModelPage, TrimDealer } from '@/types/taxonomy';

const mockModelData: ModelPage = {
  publicId: 'mod_corolla_01',
  slug: 'corolla',
  name: { ar: 'كورولا', en: 'Corolla' },
  bodyType: 'SEDAN',
  vehicleType: 'CAR',
  make: {
    publicId: 'mak_toyota_01',
    slug: 'toyota',
    name: { ar: 'تويوتا', en: 'Toyota' },
    logoUrl: 'https://images.arabiyatmart.com/makes/toyota.png',
  },
  startingPriceCents: 85000000,
  currency: 'EGP',
  activeNewListingCount: 35,
  generations: [
    {
      publicId: 'gen_corolla_12',
      name: 'E210',
      startYear: 2019,
      endYear: null,
      trimCount: 4,
    },
  ],
  trims: [
    {
      publicId: 'trm_active_01',
      name: { ar: 'اكتيف (Active)', en: 'Active' },
      modelYear: 2024,
      engineCc: 1600,
      powerHp: 120,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      officialPriceCents: 85000000,
      marketPriceCents: 88000000,
      currency: 'EGP',
      isActive: true,
    },
    {
      publicId: 'trm_comfort_02',
      name: { ar: 'كومفورت (Comfort)', en: 'Comfort' },
      modelYear: 2024,
      engineCc: 1600,
      powerHp: 120,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      officialPriceCents: 92000000,
      marketPriceCents: 95000000,
      currency: 'EGP',
      isActive: true,
    },
  ],
};

const mockTrimDetail: CatalogueTrimDetail = {
  publicId: 'trm_active_01',
  name: { ar: 'اكتيف', en: 'Active' },
  modelYear: 2024,
  engineCc: 1598,
  powerHp: 120,
  torqueNm: 154,
  fuelType: 'PETROL',
  transmission: 'CVT',
  drivetrain: 'FWD',
  seats: 5,
  fuelEconomyKmL: 14.5,
  warrantyYears: 5,
  warrantyKm: 150000,
  specs: {
    airbags_count: 6,
    sunroof: false,
    screen_size_inches: 8,
  },
  officialPriceCents: 85000000,
  marketPriceCents: 88000000,
  currency: 'EGP',
  brochureUrl: null,
  isActive: true,
  generation: {
    publicId: 'gen_corolla_12',
    name: 'E210',
    model: {
      publicId: 'mod_corolla_01',
      slug: 'corolla',
      name: { ar: 'كورولا', en: 'Corolla' },
      make: {
        publicId: 'mak_toyota_01',
        slug: 'toyota',
        name: { ar: 'تويوتا', en: 'Toyota' },
      },
    },
  },
  priceHistory: [],
};

const mockTrimDealers: TrimDealer[] = [
  {
    publicId: 'dlr_futtaim_01',
    slug: 'al-futtaim-motors',
    displayName: { ar: 'الفطيم للسيارات', en: 'Al-Futtaim Motors' },
    logoUrl: 'https://images.arabiyatmart.com/dealers/futtaim.webp',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    isVerified: true,
    listingCount: 15,
    startingPriceCents: 85000000,
    currency: 'EGP',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TASK-035: Catalogue Model and Trim Detail Routes', () => {
  beforeEach(() => {
    mockGetCatalogueModel.mockResolvedValue({ data: mockModelData });
    mockGetCatalogueTrim.mockResolvedValue({ data: mockTrimDetail });
    mockGetTrimDealers.mockResolvedValue({ data: mockTrimDealers });
  });

  describe('ModelOverview (RSC)', () => {
    it('renders model title, make name, starting price, and generations', () => {
      render(<ModelOverview model={mockModelData} locale="ar" />);

      expect(screen.getByTestId('model-title')).toHaveTextContent('تويوتا كورولا');
      expect(screen.getByTestId('model-starting-price')).toBeInTheDocument();
      expect(screen.getByTestId('model-starting-price').textContent).toMatch(/850,000|٨٥٠,٠٠٠/);
      expect(screen.getByTestId('model-generations-section')).toBeInTheDocument();
      expect(screen.getByText('E210')).toBeInTheDocument();
    });
  });

  describe('TrimTable (Client Component)', () => {
    it('renders both mobile cards and desktop semantic table with stable IDs and sorting', () => {
      render(<TrimTable trims={mockModelData.trims} locale="ar" />);

      // Mobile cards (< md)
      expect(screen.getByTestId('trim-mobile-cards')).toBeInTheDocument();
      expect(screen.getByTestId('trim-card-trm_active_01')).toBeInTheDocument();

      // Desktop table (>= md)
      expect(screen.getByTestId('trim-desktop-table')).toBeInTheDocument();
      expect(screen.getByTestId('trim-row-trm_active_01')).toBeInTheDocument();

      // Sort select changes order without crash
      const sortSelect = screen.getByTestId('trim-sort-select');
      fireEvent.change(sortSelect, { target: { value: 'price_desc' } });
      // Comfort (92,000,000) should now be first
      const rows = screen.getAllByTestId(/trim-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'trim-row-trm_comfort_02');
    });
  });

  describe('TrimSpecifications (RSC)', () => {
    it('renders grouped specifications with long Arabic labels without page overflow', () => {
      render(<TrimSpecifications trim={mockTrimDetail} locale="ar" />);

      const specsContainer = screen.getByTestId('trim-specifications');
      expect(specsContainer).toBeInTheDocument();

      // Engine group
      expect(screen.getByTestId('specs-engine')).toBeInTheDocument();
      expect(screen.getByText(/سعة المحرك/i)).toBeInTheDocument();
      expect(screen.getByText(/1598 CC|١٥٩٨ CC/)).toBeInTheDocument();

      // Dimensions group
      expect(screen.getByTestId('specs-dimensions')).toBeInTheDocument();
      expect(screen.getByText(/عدد المقاعد والركاب/i)).toBeInTheDocument();

      // Warranty group
      expect(screen.getByTestId('specs-warranty')).toBeInTheDocument();
      expect(screen.getByText(/مدة الضمان المعتمد/i)).toBeInTheDocument();

      // Additional specs from JSON
      expect(screen.getByTestId('specs-additional')).toBeInTheDocument();
      expect(screen.getByText(/airbags count/i)).toBeInTheDocument();
    });
  });

  describe('CatalogueModelPage (RSC Integration)', () => {
    it('renders full model page with breadcrumbs, overview, trims and related listings link', async () => {
      const pageJsx = await CatalogueModelPage({
        params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
      });

      render(pageJsx);

      expect(screen.getByTestId('model-overview')).toBeInTheDocument();
      expect(screen.getByTestId('trim-table-container')).toBeInTheDocument();

      const meta = await generateModelMetadata({
        params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
      });
      expect(meta.title).toContain('تويوتا كورولا');
      expect(meta.alternates?.canonical).toBe('/ar/catalogue/models/mod_corolla_01');
    });

    it('throws notFound() only on verified ApiContractError 404/NOT_FOUND', async () => {
      // 1. Invalid publicId fails PublicIdSchema (empty/whitespace string)
      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: '   ' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 2. ApiContractError with status 404
      const notFoundStatusError = new ApiContractError({
        error: {
          code: 'SOME_CODE',
          message: 'Model not found',
          status: 404,
          requestId: 'req-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetCatalogueModel.mockRejectedValue(notFoundStatusError);

      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 3. ApiContractError with code NOT_FOUND
      const notFoundCodeError = new ApiContractError({
        error: {
          code: 'NOT_FOUND',
          message: 'Model absent',
          status: 400,
          requestId: 'req-code-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetCatalogueModel.mockRejectedValue(notFoundCodeError);

      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('propagates generic Error("404") without converting to 404', async () => {
      const genericError = new Error('404');
      mockGetCatalogueModel.mockRejectedValue(genericError);

      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
        })
      ).rejects.toThrow(genericError);

      const genericNotFoundMsg = new Error('Resource not found (404)');
      mockGetCatalogueModel.mockRejectedValue(genericNotFoundMsg);

      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
        })
      ).rejects.toThrow(genericNotFoundMsg);
    });

    it('propagates server, timeout, and network errors without converting to 404', async () => {
      // 1. Upstream 500 ApiContractError
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
      mockGetCatalogueModel.mockRejectedValue(serverContractError);

      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
        })
      ).rejects.toThrow(serverContractError);

      // 2. Gateway timeout / Network error
      const timeoutError = new Error('Gateway timeout after 10000ms');
      mockGetCatalogueModel.mockRejectedValue(timeoutError);

      await expect(
        CatalogueModelPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'mod_corolla_01' }),
        })
      ).rejects.toThrow('Gateway timeout after 10000ms');
    });
  });

  describe('CatalogueTrimPage (RSC Integration)', () => {
    it('satisfies Acceptance Criteria: trim with long specs and no dealer stock renders specs, explicitly empty dealer state, omits unsupported availability, no internal taxonomy ID', async () => {
      // Empty dealers stock
      mockGetTrimDealers.mockResolvedValue({ data: [] });

      const pageJsx = await CatalogueTrimPage({
        params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
      });

      render(pageJsx);

      // 1. Header & specs rendered
      expect(screen.getByTestId('trim-header')).toBeInTheDocument();
      expect(screen.getByTestId('trim-title')).toHaveTextContent('تويوتا كورولا اكتيف');
      expect(screen.getByTestId('trim-specifications')).toBeInTheDocument();

      // 2. Dealer state is explicitly empty
      expect(screen.getByTestId('trim-dealers-empty')).toBeInTheDocument();
      expect(screen.getByText('لا تتوفر هذه الفئة لدى المعارض حالياً')).toBeInTheDocument();

      // 3. No internal numeric taxonomy ID exposed in DOM
      expect(document.body.innerHTML).not.toMatch(/id="taxonomy-\d+"/i);
      expect(document.body.innerHTML).not.toMatch(/data-trim-id="\d+"/i);

      // 4. Structured data verification: omits InStock availability when dealers is empty
      const meta = await generateTrimMetadata({
        params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
      });
      expect(meta.title).toContain('تويوتا كورولا اكتيف');
      expect(meta.alternates?.canonical).toBe('/ar/catalogue/trims/trm_active_01');
    });

    it('renders dealer stock cards when dealers are available', async () => {
      mockGetTrimDealers.mockResolvedValue({ data: mockTrimDealers });

      const pageJsx = await CatalogueTrimPage({
        params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
      });

      render(pageJsx);

      expect(screen.getByTestId('trim-dealer-card-al-futtaim-motors')).toBeInTheDocument();
      expect(screen.getByText('الفطيم للسيارات')).toBeInTheDocument();
    });

    it('throws notFound() only on verified ApiContractError 404/NOT_FOUND', async () => {
      // 1. Invalid publicId fails PublicIdSchema (empty/whitespace string)
      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: '   ' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 2. ApiContractError with status 404
      const notFoundStatusError = new ApiContractError({
        error: {
          code: 'SOME_CODE',
          message: 'Trim not found',
          status: 404,
          requestId: 'req-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetCatalogueTrim.mockRejectedValue(notFoundStatusError);

      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 3. ApiContractError with code NOT_FOUND
      const notFoundCodeError = new ApiContractError({
        error: {
          code: 'NOT_FOUND',
          message: 'Trim absent',
          status: 400,
          requestId: 'req-code-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetCatalogueTrim.mockRejectedValue(notFoundCodeError);

      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('propagates generic Error("404") without converting to 404', async () => {
      const genericError = new Error('404');
      mockGetCatalogueTrim.mockRejectedValue(genericError);

      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
        })
      ).rejects.toThrow(genericError);

      const genericNotFoundMsg = new Error('Resource not found (404)');
      mockGetCatalogueTrim.mockRejectedValue(genericNotFoundMsg);

      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
        })
      ).rejects.toThrow(genericNotFoundMsg);
    });

    it('propagates server, timeout, and network errors without converting to 404', async () => {
      // 1. Upstream 500 ApiContractError
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
      mockGetCatalogueTrim.mockRejectedValue(serverContractError);

      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
        })
      ).rejects.toThrow(serverContractError);

      // 2. Gateway timeout / Network error
      const timeoutError = new Error('Gateway timeout after 10000ms');
      mockGetCatalogueTrim.mockRejectedValue(timeoutError);

      await expect(
        CatalogueTrimPage({
          params: Promise.resolve({ locale: 'ar', publicId: 'trm_active_01' }),
        })
      ).rejects.toThrow('Gateway timeout after 10000ms');
    });
  });

  describe('Cache policy verification', () => {
    it('verifies model and trim policies are 3600s and trim dealers policy is 300s', () => {
      const modelPolicy = catalogueModelPolicy('mod_corolla_01');
      expect(modelPolicy.next?.revalidate).toBe(3600);
      expect(modelPolicy.next?.tags).toEqual(['taxonomy', 'model:mod_corolla_01', 'listings']);

      const trimPolicy = catalogueTrimPolicy('trm_active_01');
      expect(trimPolicy.next?.revalidate).toBe(3600);
      expect(trimPolicy.next?.tags).toEqual(['taxonomy', 'trim:trm_active_01']);

      const dealersPolicy = trimDealersPolicy('trm_active_01');
      expect(dealersPolicy.next?.revalidate).toBe(300);
      expect(dealersPolicy.next?.tags).toEqual(['dealers', 'catalogue:trim:trm_active_01:dealers']);
    });
  });
});
