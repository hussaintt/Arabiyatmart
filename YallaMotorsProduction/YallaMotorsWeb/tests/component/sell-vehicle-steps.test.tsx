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
import { SellWorkflow } from "@/components/sell/sell-workflow";
import {
  createEmptySellDraft,
  createInitialSellWizardState,
} from "@/stores/sell-store";
import type { Generation, Make, Trim, VehicleModel } from "@/types/taxonomy";

const mockMakes: Make[] = [
  {
    publicId: "make_toyota_pub",
    slug: "toyota",
    name: { ar: "تويوتا", en: "Toyota" },
    logoUrl: null,
    countryOfOrigin: "Japan",
    isActive: true,
    sortOrder: 1,
    activeListingCount: 150,
  },
  {
    publicId: "make_bmw_pub",
    slug: "bmw",
    name: { ar: "بي إم دبليو", en: "BMW" },
    logoUrl: null,
    countryOfOrigin: "Germany",
    isActive: true,
    sortOrder: 2,
    activeListingCount: 80,
  },
];

const mockToyotaModels: VehicleModel[] = [
  {
    publicId: "model_corolla_pub",
    slug: "corolla",
    name: { ar: "كورولا", en: "Corolla" },
    bodyType: "SEDAN",
    vehicleType: "CAR",
    isActive: true,
    sortOrder: 1,
    activeListingCount: 60,
  },
  {
    publicId: "model_camry_pub",
    slug: "camry",
    name: { ar: "كامري", en: "Camry" },
    bodyType: "SEDAN",
    vehicleType: "CAR",
    isActive: true,
    sortOrder: 2,
    activeListingCount: 30,
  },
];

const mockBmwModels: VehicleModel[] = [
  {
    publicId: "model_3series_pub",
    slug: "3-series",
    name: { ar: "الفئة الثالثة", en: "3 Series" },
    bodyType: "SEDAN",
    vehicleType: "CAR",
    isActive: true,
    sortOrder: 1,
    activeListingCount: 20,
  },
];

const mockGenerations: Generation[] = [
  {
    publicId: "gen_e210_pub",
    name: "E210 (الجيل الثاني عشر)",
    startYear: 2018,
    endYear: null,
  },
];

const mockTrims: Trim[] = [
  {
    publicId: "trim_active_pub",
    name: { ar: "أكتيف", en: "Active" },
    modelYear: 2024,
    engineCc: 1600,
    powerHp: 120,
    torqueNm: 154,
    fuelType: "PETROL",
    transmission: "CVT",
    drivetrain: "FWD",
    seats: 5,
    fuelEconomyKmL: 18.2,
    warrantyYears: 3,
    warrantyKm: 100000,
    specs: null,
    officialPriceCents: 150000000,
    marketPriceCents: 155000000,
    currency: "EGP",
    brochureUrl: null,
    isActive: true,
  },
];

describe("TASK-044: Condition and Vehicle selection steps", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    server.use(
      http.get("*/api/bff/taxonomy/makes", () => {
        return HttpResponse.json({ data: mockMakes });
      }),
      http.get("*/api/bff/taxonomy/makes/:makeSlug/models", ({ params }) => {
        const { makeSlug } = params;
        if (makeSlug === "toyota") {
          return HttpResponse.json({ data: mockToyotaModels });
        }
        if (makeSlug === "bmw") {
          return HttpResponse.json({ data: mockBmwModels });
        }
        return HttpResponse.json({ data: [] });
      }),
      http.get("*/api/bff/taxonomy/models/:modelPublicId/generations", ({ params }) => {
        if (params.modelPublicId === "model_corolla_pub") {
          return HttpResponse.json({ data: mockGenerations });
        }
        return HttpResponse.json({ data: [] });
      }),
      http.get("*/api/bff/taxonomy/generations/:generationPublicId/trims", ({ params }) => {
        if (params.generationPublicId === "gen_e210_pub") {
          return HttpResponse.json({ data: mockTrims });
        }
        return HttpResponse.json({ data: [] });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders condition step and commits selection to store, enabling Next", async () => {
    render(<SellWorkflow userPublicId="usr_test" locale="ar" />);

    expect(screen.getByTestId("sell-step-condition")).toBeInTheDocument();
    expect(screen.getByTestId("condition-option-new")).toBeInTheDocument();
    expect(screen.getByTestId("condition-option-used")).toBeInTheDocument();

    const nextButton = screen.getByTestId("sell-next");
    expect(nextButton).toBeDisabled();

    // Select USED
    fireEvent.click(screen.getByTestId("condition-option-used"));

    await waitFor(() => {
      expect(screen.getByTestId("condition-option-used")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(nextButton).not.toBeDisabled();
    });

    // Advance to Vehicle step
    fireEvent.click(nextButton);
    expect(await screen.findByTestId("sell-step-vehicle")).toBeInTheDocument();
  });

  it("cascades Make -> Model -> Generation -> Trim and enables Next when required fields are complete", async () => {
    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
    });
    initialState.currentStep = "vehicle";

    render(
      <SellWorkflow
        userPublicId="usr_test"
        locale="ar"
        initialState={initialState}
      />,
    );

    expect(screen.getByTestId("sell-step-vehicle")).toBeInTheDocument();
    const nextButton = screen.getByTestId("sell-next");
    expect(nextButton).toBeDisabled();

    // 1. Wait for Makes to load, then open Make Combobox
    const makeTrigger = screen.getByTestId("combobox-vehicle-make");
    await waitFor(() => expect(makeTrigger).not.toBeDisabled());
    fireEvent.click(makeTrigger);

    // Wait for dialog and select Toyota
    const toyotaItem = await screen.findByTestId("combobox-item-make_toyota_pub");
    expect(toyotaItem).toBeInTheDocument();
    fireEvent.click(toyotaItem);

    // Make trigger now shows Toyota
    await waitFor(() => {
      expect(makeTrigger).toHaveTextContent("تويوتا");
    });

    // 2. Wait for Models to load, then open Model Combobox
    const modelTrigger = screen.getByTestId("combobox-vehicle-model");
    await waitFor(() => expect(modelTrigger).not.toBeDisabled());
    fireEvent.click(modelTrigger);

    const corollaItem = await screen.findByTestId("combobox-item-model_corolla_pub");
    expect(corollaItem).toBeInTheDocument();
    fireEvent.click(corollaItem);

    await waitFor(() => {
      expect(modelTrigger).toHaveTextContent("كورولا");
    });

    // 3. Select Year
    const yearTrigger = screen.getByTestId("select-year-trigger");
    await waitFor(() => expect(yearTrigger).not.toBeDisabled());
    fireEvent.click(yearTrigger);

    const yearOption = await screen.findByTestId("year-option-2023");
    fireEvent.click(yearOption);

    // With Make, Model, and Year selected, vehicle step is complete!
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
      expect(screen.getByTestId("vehicle-selection-summary")).toHaveTextContent(
        "تويوتا - كورولا - 2023",
      );
    });
  });

  it("clears descendants when parent Make changes", async () => {
    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_toyota_pub",
      modelPublicId: "model_corolla_pub",
      generationPublicId: "gen_e210_pub",
      trimPublicId: "trim_active_pub",
      year: 2023,
    });
    initialState.currentStep = "vehicle";

    render(
      <SellWorkflow
        userPublicId="usr_test"
        locale="ar"
        initialState={initialState}
      />,
    );

    // Initially complete
    expect(screen.getByTestId("sell-next")).not.toBeDisabled();

    // Wait for makes and change to BMW
    const makeTrigger = screen.getByTestId("combobox-vehicle-make");
    await waitFor(() => expect(makeTrigger).not.toBeDisabled());
    fireEvent.click(makeTrigger);

    const bmwItem = await screen.findByTestId("combobox-item-make_bmw_pub");
    fireEvent.click(bmwItem);

    // After Make change, model and year should be reset, disabling Next
    await waitFor(() => {
      expect(screen.getByTestId("combobox-vehicle-model")).toHaveTextContent(
        "اختر الموديل...",
      );
      expect(screen.getByTestId("sell-next")).toBeDisabled();
    });
  });

  it("handles race condition: slow model response for previous make does not overwrite current make", async () => {
    let resolveToyota: ((value: unknown) => void) | null = null;
    server.use(
      http.get("*/api/bff/taxonomy/makes/:makeSlug/models", ({ params }) => {
        if (params.makeSlug === "toyota") {
          return new Promise((resolve) => {
            resolveToyota = () =>
              resolve(HttpResponse.json({ data: mockToyotaModels }));
          });
        }
        if (params.makeSlug === "bmw") {
          return HttpResponse.json({ data: mockBmwModels });
        }
        return HttpResponse.json({ data: [] });
      }),
    );

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
    });
    initialState.currentStep = "vehicle";

    render(
      <SellWorkflow
        userPublicId="usr_test"
        locale="en"
        initialState={initialState}
      />,
    );

    // Select Toyota (delayed response)
    const makeTrigger = screen.getByTestId("combobox-vehicle-make");
    await waitFor(() => expect(makeTrigger).not.toBeDisabled());
    fireEvent.click(makeTrigger);

    const toyota = await screen.findByTestId("combobox-item-make_toyota_pub");
    fireEvent.click(toyota);

    // Quickly switch to BMW
    await waitFor(() => expect(makeTrigger).not.toBeDisabled());
    fireEvent.click(makeTrigger);
    const bmw = await screen.findByTestId("combobox-item-make_bmw_pub");
    fireEvent.click(bmw);

    // Now resolve the old Toyota response
    if (resolveToyota) {
      (resolveToyota as (v: unknown) => void)(null);
    }

    // Open model combobox - should show BMW models only (3 Series), NOT Toyota Corolla
    const modelTrigger = screen.getByTestId("combobox-vehicle-model");
    await waitFor(() => expect(modelTrigger).not.toBeDisabled());
    fireEvent.click(modelTrigger);

    await waitFor(() => {
      expect(
        screen.getByTestId("combobox-item-model_3series_pub"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("combobox-item-model_corolla_pub"),
      ).not.toBeInTheDocument();
    });
  });
});
