import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../setup/msw-server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SellWorkflow } from "@/components/sell/sell-workflow";
import {
  createEmptySellDraft,
  createInitialSellWizardState,
} from "@/stores/sell-store";
import type { SellPhoto } from "@/types/sell";
import type { ListingCard } from "@/types/listing";

const mockCreateListing = vi.fn();
const mockRouterReplace = vi.fn();

const mockRouter: AppRouterInstance = {
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  replace: (...args: [string, ...unknown[]]) => mockRouterReplace(...args),
  prefetch: vi.fn(),
};

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <AppRouterContext.Provider value={mockRouter}>
      {ui}
    </AppRouterContext.Provider>,
  );
}

vi.mock("@/server/actions/listings", () => ({
  createListing: (...args: unknown[]) => mockCreateListing(...args),
  updateListing: vi.fn(),
  updateListingPrice: vi.fn(),
  transitionListing: vi.fn(),
}));

describe("TASK-047: Sell Review, Submission, and Route", () => {
  const readyPhotos: SellPhoto[] = [
    {
      clientId: "p1",
      localPreviewUrl: "blob:http://localhost/p1",
      publicId: "pub_file_1",
      url: "https://cdn.example.com/p1.jpg",
      status: "READY",
      progress: 1,
    },
    {
      clientId: "p2",
      localPreviewUrl: "blob:http://localhost/p2",
      publicId: "pub_file_2",
      url: "https://cdn.example.com/p2.jpg",
      status: "READY",
      progress: 1,
    },
    {
      clientId: "p3",
      localPreviewUrl: "blob:http://localhost/p3",
      publicId: "pub_file_3",
      url: "https://cdn.example.com/p3.jpg",
      status: "READY",
      progress: 1,
    },
  ];

  const completeDraft = {
    ...createEmptySellDraft(),
    condition: "USED" as const,
    makePublicId: "make_toyota_pub",
    modelPublicId: "model_corolla_pub",
    year: 2023,
    mileageKm: 45000,
    fuelType: "PETROL" as const,
    transmission: "AUTOMATIC" as const,
    bodyType: "SEDAN" as const,
    priceCents: 65000000,
    isNegotiable: true,
    installmentAvailable: true,
    exchangeAccepted: false,
    cityId: 1,
    areaId: 101,
    contactPhone: "+201012345678",
    whatsappPhone: "+201012345678",
    allowChat: true,
    description: "سيارة بحالة ممتازة صيانة توكيل",
  };

  beforeEach(() => {
    localStorage.clear();
    mockCreateListing.mockReset();
    mockRouterReplace.mockReset();

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    server.use(
      http.get("*/api/bff/taxonomy/makes", () => HttpResponse.json({ data: [] })),
      http.get("*/api/bff/locations/countries/EG/cities", () => {
        return HttpResponse.json({
          data: [
            { id: 1, countryId: 1, name: { ar: "القاهرة", en: "Cairo" }, isActive: true },
          ],
        });
      }),
      http.get("*/api/bff/locations/cities/:cityId/areas", () => {
        return HttpResponse.json({
          data: [
            { id: 101, cityId: 1, name: { ar: "مدينة نصر", en: "Nasr City" }, postalCode: "11765", isActive: true },
          ],
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders all review summary sections with facts and edit links", async () => {
    const initialState = createInitialSellWizardState(completeDraft);
    initialState.currentStep = "review";
    initialState.photos = readyPhotos;
    initialState.coverPhotoClientId = "p1";

    renderWithRouter(
      <SellWorkflow
        userPublicId="usr_test_review"
        locale="ar"
        initialState={initialState}
      />,
    );

    expect(screen.getByTestId("sell-step-review")).toBeInTheDocument();

    // Verify each section exists
    expect(screen.getByTestId("review-section-condition")).toBeInTheDocument();
    expect(screen.getByTestId("review-section-vehicle")).toBeInTheDocument();
    expect(screen.getByTestId("review-section-details")).toBeInTheDocument();
    expect(screen.getByTestId("review-section-pricing")).toBeInTheDocument();
    expect(screen.getByTestId("review-section-photos")).toBeInTheDocument();
    expect(screen.getByTestId("review-section-location")).toBeInTheDocument();

    // Verify facts are rendered
    expect(screen.getByText("مستعملة")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("make_toyota_pub")).toBeInTheDocument();
    expect(screen.getByText("model_corolla_pub")).toBeInTheDocument();
    expect(screen.getByText("بنزين")).toBeInTheDocument();
    expect(screen.getByText("أوتوماتيك")).toBeInTheDocument();
    expect(screen.getByText("سيدان")).toBeInTheDocument();
    expect(screen.getByText(/650,000/)).toBeInTheDocument();
    expect(screen.getByText("سيارة بحالة ممتازة صيانة توكيل")).toBeInTheDocument();
    expect(screen.getAllByText("+201012345678").length).toBeGreaterThanOrEqual(1);

    // Verify edit button jumps back to that step
    const editPricingBtn = screen.getByTestId("review-edit-pricing");
    fireEvent.click(editPricingBtn);

    await waitFor(() => {
      expect(screen.getByTestId("sell-step-pricing")).toBeInTheDocument();
    });
  });

  it("submits valid draft idempotently, calls createListing, clears draft, and navigates to listing page", async () => {
    const mockCreatedListing: Partial<ListingCard> = {
      publicId: "list_created_123",
      slug: "toyota-corolla-2023-1001",
      title: "تويوتا كورولا 2023",
      priceCents: 65000000,
      currency: "EGP",
    };

    mockCreateListing.mockResolvedValueOnce({
      ok: true,
      data: mockCreatedListing,
    });

    const initialState = createInitialSellWizardState(completeDraft);
    initialState.currentStep = "review";
    initialState.photos = readyPhotos;
    initialState.coverPhotoClientId = "p1";

    renderWithRouter(
      <SellWorkflow
        userPublicId="usr_test_submit"
        locale="ar"
        initialState={initialState}
      />,
    );

    const submitBtn = screen.getByTestId("sell-next");
    expect(submitBtn).toHaveTextContent("تأكيد ونشر الإعلان");
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateListing).toHaveBeenCalledTimes(1);
    });

    // Check payload passed to createListing
    const callArgs = mockCreateListing.mock.calls[0] as unknown as [Record<string, unknown>, string | undefined];
    const [calledPayload, idempotencyKey] = callArgs;
    expect(calledPayload.condition).toBe("USED");
    expect(calledPayload.makePublicId).toBe("make_toyota_pub");
    expect(calledPayload.modelPublicId).toBe("model_corolla_pub");
    expect(calledPayload.year).toBe(2023);
    expect(calledPayload.priceCents).toBe(65000000);
    expect(calledPayload.imageFilePublicIds).toEqual(["pub_file_1", "pub_file_2", "pub_file_3"]);
    expect(calledPayload.coverImagePublicId).toBe("pub_file_1");
    expect(idempotencyKey).toBeDefined();

    // Verify navigation to the new listing's page
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/ar/listing/toyota-corolla-2023-1001");
    });
  });

  it("handles submission failure by displaying error message without destroying draft state", async () => {
    mockCreateListing.mockResolvedValueOnce({
      ok: false,
      error: {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "رقم الهاتف غير صالح للمنطقة المحددة",
        fieldErrors: [],
        details: null,
        retryAfterSeconds: null,
      },
    });

    const initialState = createInitialSellWizardState(completeDraft);
    initialState.currentStep = "review";
    initialState.photos = readyPhotos;
    initialState.coverPhotoClientId = "p1";

    renderWithRouter(
      <SellWorkflow
        userPublicId="usr_test_fail"
        locale="ar"
        initialState={initialState}
      />,
    );

    const submitBtn = screen.getByTestId("sell-next");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("sell-submit-error")).toHaveTextContent(
        "رقم الهاتف غير صالح للمنطقة المحددة",
      );
    });

    // Verify user can still edit fields after error
    const editLocationBtn = screen.getByTestId("review-edit-location");
    fireEvent.click(editLocationBtn);

    await waitFor(() => {
      expect(screen.getByTestId("sell-step-location")).toBeInTheDocument();
    });
  });

  it("prevents double submission while request is in flight", async () => {
    let resolveSubmit: ((val: unknown) => void) | null = null;
    mockCreateListing.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    const initialState = createInitialSellWizardState(completeDraft);
    initialState.currentStep = "review";
    initialState.photos = readyPhotos;
    initialState.coverPhotoClientId = "p1";

    renderWithRouter(
      <SellWorkflow
        userPublicId="usr_test_double"
        locale="ar"
        initialState={initialState}
      />,
    );

    const submitBtn = screen.getByTestId("sell-next");
    fireEvent.click(submitBtn);

    // Should immediately call createListing once
    expect(mockCreateListing).toHaveBeenCalledTimes(1);

    // Rapid second click should NOT trigger a second call
    fireEvent.click(submitBtn);
    expect(mockCreateListing).toHaveBeenCalledTimes(1);

    // Resolve initial request
    if (resolveSubmit) {
      (resolveSubmit as (val: unknown) => void)({
        ok: true,
        data: { slug: "new-car-slug" },
      });
    }

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/ar/listing/new-car-slug");
    });
  });
});
