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
import { CentsInput } from "@/components/sell/cents-input";
import {
  createEmptySellDraft,
  createInitialSellWizardState,
} from "@/stores/sell-store";
import type { Area, City } from "@/types/taxonomy";

const mockCities: City[] = [
  {
    id: 1,
    countryId: 1,
    name: { ar: "القاهرة", en: "Cairo" },
    isActive: true,
  },
  {
    id: 2,
    countryId: 1,
    name: { ar: "الجيزة", en: "Giza" },
    isActive: true,
  },
];

const mockAreas: Area[] = [
  {
    id: 101,
    cityId: 1,
    name: { ar: "مدينة نصر", en: "Nasr City" },
    postalCode: "11765",
    isActive: true,
  },
  {
    id: 102,
    cityId: 1,
    name: { ar: "المعادي", en: "Maadi" },
    postalCode: "11728",
    isActive: true,
  },
];

describe("TASK-045: Details, Pricing, and Contact/Location steps", () => {
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
      http.get("*/api/bff/taxonomy/makes", () => HttpResponse.json({ data: [] })),
      http.get("*/api/bff/locations/countries/EG/cities", () => {
        return HttpResponse.json({ data: mockCities });
      }),
      http.get("*/api/bff/locations/cities/:cityId/areas", ({ params }) => {
        if (params.cityId === "1") {
          return HttpResponse.json({ data: mockAreas });
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

  describe("CentsInput", () => {
    it("handles standard input and formats on blur using integer cents", () => {
      const handleChange = vi.fn();
      render(
        <CentsInput
          id="test-price"
          value={null}
          onChange={handleChange}
          currency="EGP"
          locale="en"
        />,
      );

      const input = screen.getByTestId("cents-input-test-price");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "350000" } });

      expect(handleChange).toHaveBeenCalledWith(35000000); // 350,000.00 EGP in cents

      fireEvent.blur(input);
      expect(input).toHaveValue("350,000");
    });

    it("parses Arabic-Indic numerals correctly into integer cents", () => {
      const handleChange = vi.fn();
      render(
        <CentsInput
          id="arabic-price"
          value={null}
          onChange={handleChange}
          currency="EGP"
          locale="ar"
        />,
      );

      const input = screen.getByTestId("cents-input-arabic-price");
      fireEvent.focus(input);
      // Eastern Arabic digits for 125000
      fireEvent.change(input, { target: { value: "١٢٥٠٠٠" } });

      expect(handleChange).toHaveBeenCalledWith(12500000);
    });

    it("displays error for invalid formatted price", () => {
      const handleChange = vi.fn();
      render(
        <CentsInput
          id="invalid-price"
          value={null}
          onChange={handleChange}
          currency="EGP"
          locale="ar"
        />,
      );

      const input = screen.getByTestId("cents-input-invalid-price");
      fireEvent.change(input, { target: { value: "abc" } });
      expect(screen.getByTestId("cents-input-error")).toBeInTheDocument();
    });
  });

  describe("DetailsStep", () => {
    it("validates required details (mileage, fuel, transmission, body) and enables Next", async () => {
      const initialState = createInitialSellWizardState({
        ...createEmptySellDraft(),
        condition: "USED",
        makePublicId: "make_1",
        modelPublicId: "model_1",
        year: 2022,
      });
      initialState.currentStep = "details";

      render(
        <SellWorkflow
          userPublicId="usr_details_test"
          locale="ar"
          initialState={initialState}
        />,
      );

      expect(screen.getByTestId("sell-step-details")).toBeInTheDocument();
      const nextButton = screen.getByTestId("sell-next");
      expect(nextButton).toBeDisabled();

      // Enter mileage
      const mileageInput = screen.getByTestId("input-mileage");
      fireEvent.change(mileageInput, { target: { value: "65000" } });

      // Select Fuel Type
      const fuelTrigger = screen.getByTestId("select-fuel-trigger");
      fireEvent.click(fuelTrigger);
      const petrolOption = await screen.findByTestId("fuel-option-petrol");
      fireEvent.click(petrolOption);

      // Select Transmission
      const txTrigger = screen.getByTestId("select-transmission-trigger");
      fireEvent.click(txTrigger);
      const autoOption = await screen.findByTestId("tx-option-automatic");
      fireEvent.click(autoOption);

      // Select Body Type
      const bodyTrigger = screen.getByTestId("select-body-type-trigger");
      fireEvent.click(bodyTrigger);
      const sedanOption = await screen.findByTestId("body-option-sedan");
      fireEvent.click(sedanOption);

      // All 4 required details filled -> next enabled
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  describe("PricingStep", () => {
    it("accepts asking price, toggles terms, and enables Next", async () => {
      const initialState = createInitialSellWizardState({
        ...createEmptySellDraft(),
        condition: "USED",
        makePublicId: "make_1",
        modelPublicId: "model_1",
        year: 2022,
        mileageKm: 50000,
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        bodyType: "SEDAN",
      });
      initialState.currentStep = "pricing";

      render(
        <SellWorkflow
          userPublicId="usr_pricing_test"
          locale="ar"
          initialState={initialState}
        />,
      );

      expect(screen.getByTestId("sell-step-pricing")).toBeInTheDocument();
      const nextButton = screen.getByTestId("sell-next");
      expect(nextButton).toBeDisabled();

      // Enter asking price
      const priceInput = screen.getByTestId("cents-input-pricing-amount");
      fireEvent.focus(priceInput);
      fireEvent.change(priceInput, { target: { value: "480000" } });
      fireEvent.blur(priceInput);

      // Toggle negotiable and installment
      fireEvent.click(screen.getByTestId("checkbox-negotiable"));
      fireEvent.click(screen.getByTestId("checkbox-installment"));

      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  describe("ContactLocationStep", () => {
    it("loads cities, allows city and area selection, verifies contact info, and enables Next", async () => {
      const initialState = createInitialSellWizardState({
        ...createEmptySellDraft(),
        condition: "USED",
        makePublicId: "make_1",
        modelPublicId: "model_1",
        year: 2022,
        mileageKm: 50000,
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        bodyType: "SEDAN",
        priceCents: 50000000,
        allowChat: false, // Turn off chat to test explicit phone requirement
      });
      initialState.currentStep = "location";

      render(
        <SellWorkflow
          userPublicId="usr_location_test"
          locale="ar"
          initialState={initialState}
        />,
      );

      expect(screen.getByTestId("sell-step-location")).toBeInTheDocument();
      const nextButton = screen.getByTestId("sell-next");
      expect(nextButton).toBeDisabled();

      // 1. Select City (Cairo = 1)
      const cityTrigger = screen.getByTestId("select-city-trigger");
      await waitFor(() => expect(cityTrigger).not.toBeDisabled());
      fireEvent.click(cityTrigger);
      const cairoOption = await screen.findByTestId("city-option-1");
      fireEvent.click(cairoOption);

      // 2. Select Area (Nasr City = 101)
      const areaTrigger = screen.getByTestId("select-area-trigger");
      await waitFor(() => expect(areaTrigger).not.toBeDisabled());
      fireEvent.click(areaTrigger);
      const nasrCityOption = await screen.findByTestId("area-option-101");
      fireEvent.click(nasrCityOption);

      // Still disabled because allowChat is false and no phone is entered
      expect(nextButton).toBeDisabled();

      // 3. Enter Phone
      const phoneInput = screen.getByTestId("input-contact-phone");
      fireEvent.change(phoneInput, { target: { value: "+201012345678" } });

      // With City and Phone provided, location step is complete
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });
  });
});
