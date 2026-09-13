import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PromotionPurchase } from '@/components/promotions/promotion-purchase';
import type { ListingPromotion, PromotionPackage } from '@/types/lead';

const mockPurchasePromotion = vi.fn();
const mockRefresh = vi.fn();

vi.mock('@/server/actions/promotions', () => ({
  purchasePromotion: (...args: unknown[]) => mockPurchasePromotion(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: () => mockRefresh(),
  }),
  usePathname: () => '/ar/best-offer/test-car-slug',
}));

describe('TASK-049: Promotion Packages and Best-Offer Purchase Route', () => {
  const samplePackages: PromotionPackage[] = [
    {
      tier: 'PREMIUM',
      durationDays: 7,
      priceCents: 15000, // 150 EGP
      currency: 'EGP',
      highlightedCard: true,
      homepageSlot: false,
      performanceStats: true,
      autoRenewEveryDays: null,
      placements: ['أعلى نتائج البحث'],
    },
    {
      tier: 'EXTRA_PREMIUM',
      durationDays: 14,
      priceCents: 35000, // 350 EGP
      currency: 'EGP',
      highlightedCard: true,
      homepageSlot: true,
      performanceStats: true,
      autoRenewEveryDays: null,
      placements: ['صدارة البحث المطلقة', 'بانر الصفحة الرئيسية'],
    },
  ];

  const sampleListing = {
    publicId: 'list_xyz_123',
    slug: 'toyota-camry-2024-test',
    title: 'تويوتا كامري 2024 هايبرد',
    priceCents: 95000000,
    currency: 'EGP',
    coverImageUrl: 'https://cdn.example.com/camry.jpg',
  };

  beforeEach(() => {
    mockPurchasePromotion.mockReset();
    mockRefresh.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders package cards with benefits, duration, and integer cents price formatting', () => {
    render(
      <PromotionPurchase
        packages={samplePackages}
        listing={sampleListing}
        existingPromotions={[]}
        locale="ar"
      />
    );

    // Verify package cards render
    expect(screen.getByTestId('package-card-PREMIUM')).toBeInTheDocument();
    expect(screen.getByTestId('package-card-EXTRA_PREMIUM')).toBeInTheDocument();

    // Verify integer cents formatting (150 EGP and 350 EGP, in Arabic format)
    expect(screen.getByTestId('package-price-PREMIUM')).toHaveTextContent(/150|١٥٠/);
    expect(screen.getByTestId('package-price-EXTRA_PREMIUM')).toHaveTextContent(/350|٣٥٠/);

    // Verify benefits checklist
    expect(screen.getAllByText('تمييز بصري للبطاقة بألوان ملفتة')).toHaveLength(2);
    expect(screen.getByText('ظهور حصري في سلايدر الصفحة الرئيسية')).toBeInTheDocument();
    expect(screen.getAllByText('لوحة إحصائيات متقدمة لعدد المشاهدات والطلبات')).toHaveLength(2);
  });

  it('renders empty state when no packages are available', () => {
    render(
      <PromotionPurchase
        packages={[]}
        listing={sampleListing}
        existingPromotions={[]}
        locale="ar"
      />
    );

    expect(screen.getByTestId('empty-packages-state')).toBeInTheDocument();
    expect(screen.getByText('لا تتوفر باقات ترويجية حالياً')).toBeInTheDocument();
  });

  it('displays active promotion alert if listing is currently promoted', () => {
    const activePromo: ListingPromotion = {
      publicId: 'promo_active_1',
      tier: 'EXTRA_PREMIUM',
      type: 'EXTRA_PREMIUM',
      status: 'ACTIVE',
      durationDays: 14,
      priceCents: 35000,
      currency: 'EGP',
      startsAt: '2026-09-01T10:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      lastBumpedAt: null,
      createdAt: '2026-09-01T10:00:00Z',
      perks: null,
      listing: {
        publicId: sampleListing.publicId,
        slug: sampleListing.slug,
        year: 2024,
      },
    };

    render(
      <PromotionPurchase
        packages={samplePackages}
        listing={sampleListing}
        existingPromotions={[activePromo]}
        locale="ar"
      />
    );

    expect(screen.getByTestId('active-promotion-alert')).toBeInTheDocument();
    expect(screen.getByText('هذا الإعلان مميز حالياً')).toBeInTheDocument();
  });

  it('updates selected package and order summary when a package is clicked', () => {
    render(
      <PromotionPurchase
        packages={samplePackages}
        listing={sampleListing}
        existingPromotions={[]}
        locale="ar"
      />
    );

    // Click on PREMIUM package select button
    fireEvent.click(screen.getByTestId('select-tier-button-PREMIUM'));

    // Check summary updates
    expect(screen.getByTestId('summary-selected-tier')).toHaveTextContent('PREMIUM');
    expect(screen.getByTestId('summary-total-price')).toHaveTextContent(/150|١٥٠/);

    // Switch to EXTRA_PREMIUM
    fireEvent.click(screen.getByTestId('select-tier-button-EXTRA_PREMIUM'));
    expect(screen.getByTestId('summary-selected-tier')).toHaveTextContent('EXTRA_PREMIUM');
    expect(screen.getByTestId('summary-total-price')).toHaveTextContent(/350|٣٥٠/);
  });

  it('submits purchase with correct params and idempotency key, preventing double-click', async () => {
    mockPurchasePromotion.mockResolvedValueOnce({
      ok: true,
      data: {
        publicId: 'promo_created_99',
        tier: 'EXTRA_PREMIUM',
        type: 'EXTRA_PREMIUM',
        status: 'ACTIVE',
        durationDays: 14,
        priceCents: 35000,
        currency: 'EGP',
        startsAt: '2026-09-09T00:00:00Z',
        endsAt: '2026-09-23T00:00:00Z',
        lastBumpedAt: null,
        createdAt: '2026-09-09T00:00:00Z',
        perks: null,
        listing: {
          publicId: sampleListing.publicId,
          slug: sampleListing.slug,
          year: 2024,
        },
      },
    });

    render(
      <PromotionPurchase
        packages={samplePackages}
        listing={sampleListing}
        existingPromotions={[]}
        locale="ar"
      />
    );

    const submitBtn = screen.getByTestId('confirm-purchase-button');
    expect(submitBtn).toBeEnabled();

    // Rapid double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // purchasePromotion must be called only once
    expect(mockPurchasePromotion).toHaveBeenCalledTimes(1);
    expect(mockPurchasePromotion).toHaveBeenCalledWith(
      {
        listingPublicId: 'list_xyz_123',
        tier: 'EXTRA_PREMIUM',
      },
      expect.any(String), // idempotency key
      'toyota-camry-2024-test'
    );

    await waitFor(() => {
      expect(screen.getByTestId('purchase-success-card')).toBeInTheDocument();
    });

    expect(screen.getByText('تم تأكيد ترقية الإعلان بنجاح!')).toBeInTheDocument();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('displays 409, 422, and 429 error messages distinctly', async () => {
    // Test 409 Conflict
    mockPurchasePromotion.mockResolvedValueOnce({
      ok: false,
      error: {
        status: 409,
        code: 'PROMOTION_CONFLICT',
        message: 'Conflict',
      },
    });

    render(
      <PromotionPurchase
        packages={samplePackages}
        listing={sampleListing}
        existingPromotions={[]}
        locale="ar"
      />
    );

    fireEvent.click(screen.getByTestId('confirm-purchase-button'));

    await waitFor(() => {
      expect(screen.getByTestId('purchase-error-alert')).toHaveTextContent(
        'هذا الإعلان لديه ترقية نشطة بالفعل أو يوجد تعارض في العملية'
      );
    });

    // Test 422 Unprocessable
    mockPurchasePromotion.mockResolvedValueOnce({
      ok: false,
      error: {
        status: 422,
        code: 'INELIGIBLE_LISTING',
        message: 'Ineligible',
      },
    });

    fireEvent.click(screen.getByTestId('confirm-purchase-button'));

    await waitFor(() => {
      expect(screen.getByTestId('purchase-error-alert')).toHaveTextContent(
        'طلب غير صالح أو الإعلان غير مؤهل للترقية'
      );
    });

    // Test 429 Rate Limit
    mockPurchasePromotion.mockResolvedValueOnce({
      ok: false,
      error: {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      },
    });

    fireEvent.click(screen.getByTestId('confirm-purchase-button'));

    await waitFor(() => {
      expect(screen.getByTestId('purchase-error-alert')).toHaveTextContent(
        'تم إرسال طلبات كثيرة، يرجى الانتظار قليلاً والمحاولة لاحقاً'
      );
    });
  });
});
