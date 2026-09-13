import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/msw-server";
import { SellWorkflow } from "@/components/sell/sell-workflow";
import type { ListingOwnershipScope } from "@/types/sell";
import {
  createEmptySellDraft,
  createInitialSellWizardState,
  getSellDraftStorageKey,
  hashSellDraftUserPublicId,
  SELL_DRAFT_VERSION,
} from "@/stores/sell-store";

describe("TASK 2.3: Explicit Listing Ownership Scopes & Quotas", () => {
  beforeEach(() => {
    server.use(
      http.get("*/api/bff/taxonomy/makes", () => HttpResponse.json({ data: [] })),
    );
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const mockScopes: ListingOwnershipScope[] = [
    {
      id: "personal",
      type: "personal",
      displayName: "حساب شخصي (أفراد)",
      role: "INDIVIDUAL",
      isVerified: true,
      phoneVerified: true,
      quota: { currentCount: 1, maxLimit: 5, availableSlots: 4 },
    },
    {
      id: "vnd_autotraders_eg",
      type: "dealership",
      displayName: "معرض أوتوتريدرز مصر",
      role: "OWNER",
      vendorPublicId: "vnd_autotraders_eg",
      isVerified: true,
      phoneVerified: true,
      quota: { currentCount: 12, maxLimit: 50, availableSlots: 38 },
    },
    {
      id: "vnd_cairo_motors",
      type: "dealership",
      displayName: "كايرو موتورز",
      role: "STAFF",
      vendorPublicId: "vnd_cairo_motors",
      isVerified: true,
      phoneVerified: true,
      quota: { currentCount: 5, maxLimit: 50, availableSlots: 45 },
    },
  ];

  it("presents eligible personal and dealership scopes with roles and quotas", () => {
    render(
      <SellWorkflow
        userPublicId="usr_multiscope"
        locale="ar"
        eligibleScopes={mockScopes}
      />
    );

    // Scope selector is visible
    expect(screen.getByTestId("listing-scope-selector")).toBeInTheDocument();

    // All 3 scopes are rendered
    expect(screen.getByTestId("scope-card-personal")).toBeInTheDocument();
    expect(screen.getByTestId("scope-card-vnd_autotraders_eg")).toBeInTheDocument();
    expect(screen.getByTestId("scope-card-vnd_cairo_motors")).toBeInTheDocument();

    // Roles are displayed
    expect(screen.getByText("بائع شخصي (أفراد)")).toBeInTheDocument();
    expect(screen.getByText("مالك المعرض")).toBeInTheDocument();
    expect(screen.getByText("موظف المعرض")).toBeInTheDocument();

    // Quotas and prerequisites are displayed
    expect(screen.getByText("سعة الحساب: حتى 5 إعلانات نشطة")).toBeInTheDocument();
    expect(screen.getAllByText("سعة الحساب: حتى 50 إعلانات نشطة")).toHaveLength(2);
    expect(screen.getAllByText("الهاتف موثق وجاهز للنشر")).toHaveLength(3);
  });

  it("requires explicit selection when multiple scopes exist before enabling the workflow", () => {
    render(
      <SellWorkflow
        userPublicId="usr_multiscope_gated"
        locale="en"
        eligibleScopes={mockScopes}
      />
    );

    // Prompt indicating selection is required
    expect(screen.getByTestId("scope-selection-prompt")).toBeInTheDocument();
    expect(
      screen.getByText("Please select an ownership scope (personal or dealership) above to begin.")
    ).toBeInTheDocument();

    // Step heading/form is hidden while no scope is selected
    expect(screen.queryByTestId("sell-condition-step")).not.toBeInTheDocument();

    // Selecting a scope activates the workflow
    fireEvent.click(screen.getByTestId("scope-card-vnd_autotraders_eg"));

    // Workflow is now active
    expect(screen.queryByTestId("scope-selection-prompt")).not.toBeInTheDocument();
    expect(screen.getByTestId("sell-condition-step")).toBeInTheDocument();
  });

  it("automatically selects the personal scope when only one scope is eligible", () => {
    const singleScope: ListingOwnershipScope[] = [mockScopes[0]!];
    render(
      <SellWorkflow
        userPublicId="usr_single_scope"
        locale="ar"
        eligibleScopes={singleScope}
      />
    );

    // No selection required prompt
    expect(screen.queryByTestId("scope-selection-prompt")).not.toBeInTheDocument();
    // Directly on condition step
    expect(screen.getByTestId("sell-step-condition")).toBeInTheDocument();
    // Scope card is pressed/active
    expect(screen.getByTestId("scope-card-personal")).toHaveAttribute("aria-pressed", "true");
  });

  it("isolates saved drafts across scopes so personal drafts do not appear in dealership workflows", async () => {
    const userId = "usr_draft_isolation";
    const userHash = hashSellDraftUserPublicId(userId);

    // Seed personal draft in localStorage
    localStorage.setItem(
      getSellDraftStorageKey(userId, "personal"),
      JSON.stringify({
        version: SELL_DRAFT_VERSION,
        userHash,
        draft: { ...createEmptySellDraft(), condition: "USED" },
      })
    );

    // Seed dealer draft in localStorage
    localStorage.setItem(
      getSellDraftStorageKey(userId, "vnd_autotraders_eg"),
      JSON.stringify({
        version: SELL_DRAFT_VERSION,
        userHash,
        draft: { ...createEmptySellDraft(), condition: "NEW" },
      })
    );

    render(
      <SellWorkflow
        userPublicId={userId}
        locale="en"
        eligibleScopes={mockScopes}
      />
    );

    // 1. Select personal scope -> should load personal draft (condition: USED)
    fireEvent.click(screen.getByTestId("scope-card-personal"));
    expect(screen.getByTestId("sell-condition-step")).toBeInTheDocument();
    expect(screen.getByTestId("condition-option-used")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("condition-option-new")).toHaveAttribute("aria-checked", "false");

    // 2. Select dealer scope -> should load dealer draft (condition: NEW)
    fireEvent.click(screen.getByTestId("scope-card-vnd_autotraders_eg"));
    expect(screen.getByTestId("condition-option-new")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("condition-option-used")).toHaveAttribute("aria-checked", "false");

    // 3. Switch back to personal scope -> should return to personal draft (condition: USED)
    fireEvent.click(screen.getByTestId("scope-card-personal"));
    expect(screen.getByTestId("condition-option-used")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("condition-option-new")).toHaveAttribute("aria-checked", "false");
  });

  it("displays the chosen ownership scope, role, and active quota in ReviewStep", () => {
    const state = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "Toyota",
      modelPublicId: "Corolla",
      year: 2022,
      mileageKm: 25000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 80000000,
      cityId: 1,
    });
    state.currentStep = "review";

    // Dealership scope
    const dealerScope = mockScopes[1]!;

    render(
      <SellWorkflow
        userPublicId="usr_review_scope"
        locale="ar"
        eligibleScopes={[dealerScope]}
        initialState={state}
      />
    );

    // Review step displays ownership scope section
    const scopeSection = screen.getByTestId("review-section-scope");
    expect(scopeSection).toBeInTheDocument();
    expect(within(scopeSection).getByText("معرض أوتوتريدرز مصر")).toBeInTheDocument();
    expect(within(scopeSection).getByText("مالك المعرض")).toBeInTheDocument();
    expect(within(scopeSection).getByText("حتى 50 إعلانات نشطة")).toBeInTheDocument();
  });
});
