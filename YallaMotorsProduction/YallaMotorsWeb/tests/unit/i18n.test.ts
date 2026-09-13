import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl/navigation", () => ({
  createNavigation: vi.fn(() => ({
    Link: vi.fn(),
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
    permanentRedirect: vi.fn(),
  })),
}));

import {
  locales,
  defaultLocale,
  isAppLocale,
  getLocaleDirection,
  LOCALE_COOKIE_NAME,
  getLocaleConfig,
} from "@/i18n/config";

import {
  formatMoney,
  formatMoneyFromCents,
  parseCentsToParts,
  validateMoneyCents,
  getCurrencyLabel,
  getCurrencyDecimalPlaces,
  toArabicDigits,
  toWesternDigits,
  formatDigits,
  formatNumber,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
} from "@/i18n/format";
import {
  routing,
  Link,
  redirect,
  useRouter,
  usePathname,
  ALLOWED_QUERY_PARAMS,
  LISTING_SEARCH_QUERY_PARAMS,
  isAllowedQueryParam,
  filterAllowedQueryParams,
  filterRouteQueryParams,
  filterListingSearchQueryParams,
  filterDealerInventoryQueryParams,
  resolveRouteKey,
  isSafeReturnTo,
  sanitizeReturnTo,
  parseAndValidateSafeMoneyCents,
  filterNotificationsLimit,
  VALID_LEAD_STATUSES,
} from "@/i18n/routing";
import arMessages from "../../messages/ar.json";
import enMessages from "../../messages/en.json";

describe("i18n configuration", () => {
  it("defines supported locales as ['ar', 'en'] with Arabic as default", () => {
    expect(locales).toEqual(["ar", "en"]);
    expect(defaultLocale).toBe("ar");
  });

  it("validates app locales correctly without inferring from client storage", () => {
    expect(isAppLocale("ar")).toBe(true);
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
    expect(isAppLocale("")).toBe(false);
    expect(isAppLocale(undefined)).toBe(false);
    expect(isAppLocale(null)).toBe(false);
    expect(isAppLocale(123)).toBe(false);
  });

  it("returns correct text direction for each locale", () => {
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("en")).toBe("ltr");
  });

  it("defines standard cookie name for locale presentation preference", () => {
    expect(LOCALE_COOKIE_NAME).toBe("am_locale");
  });

  it("provides comprehensive locale metadata", () => {
    const arConfig = getLocaleConfig("ar");
    expect(arConfig.dir).toBe("rtl");
    expect(arConfig.lang).toBe("ar");
    expect(arConfig.timeZone).toBe("Africa/Cairo");
    expect(arConfig.defaultCurrency).toBe("EGP");

    const enConfig = getLocaleConfig("en");
    expect(enConfig.dir).toBe("ltr");
    expect(enConfig.lang).toBe("en");
    expect(enConfig.timeZone).toBe("Africa/Cairo");
  });
});

describe("i18n routing, navigation, and target-route-aware query parameter preservation", () => {
  it("configures next-intl routing with prefix=always and defaultLocale=ar", () => {
    expect(routing.locales).toEqual(["ar", "en"]);
    expect(routing.defaultLocale).toBe("ar");
    expect(routing.localePrefix).toBe("always");
  });

  it("exports navigation helpers", () => {
    expect(Link).toBeDefined();
    expect(redirect).toBeDefined();
    expect(useRouter).toBeDefined();
    expect(usePathname).toBeDefined();
  });

  it("identifies documented allowed query parameters according to Phase 1 Section 2.6", () => {
    expect(ALLOWED_QUERY_PARAMS).toContain("condition");
    expect(ALLOWED_QUERY_PARAMS).toContain("q");
    expect(ALLOWED_QUERY_PARAMS).toContain("item");
    expect(ALLOWED_QUERY_PARAMS).toContain("unreadOnly");
    expect(ALLOWED_QUERY_PARAMS).toContain("vendor");
    expect(LISTING_SEARCH_QUERY_PARAMS).toContain("makeSlug");
    expect(LISTING_SEARCH_QUERY_PARAMS).toContain("condition");
    expect(isAllowedQueryParam("condition")).toBe(true);
    expect(isAllowedQueryParam("q")).toBe(true);
    expect(isAllowedQueryParam("sort")).toBe(true);
    expect(isAllowedQueryParam("priceMin")).toBe(true);
    expect(isAllowedQueryParam("makeSlug")).toBe(true);
    expect(isAllowedQueryParam("unknownParam")).toBe(false);
    expect(isAllowedQueryParam("tracking_id")).toBe(false);
  });

  it("resolves route keys accurately from pathnames", () => {
    expect(resolveRouteKey("/")).toBe("home");
    expect(resolveRouteKey("/ar")).toBe("home");
    expect(resolveRouteKey("/en")).toBe("home");
    expect(resolveRouteKey("/ar/search")).toBe("search");
    expect(resolveRouteKey("/en/compare")).toBe("compare");
    expect(resolveRouteKey("/ar/notifications")).toBe("notifications");
    expect(resolveRouteKey("/en/me/dashboard")).toBe("me_dashboard");
    expect(resolveRouteKey("/ar/sell")).toBe("sell");
    expect(resolveRouteKey("/en/dealers")).toBe("dealers");
    expect(resolveRouteKey("/ar/dealers/cairo-motors")).toBe("dealer_detail");
    expect(resolveRouteKey("/en/login")).toBe("auth");
  });

  describe("/search listing search query contract & negative filtering", () => {
    it("preserves valid listing search parameters while stripping unknown keys", () => {
      const searchParams = {
        makeSlug: "toyota",
        modelSlug: "corolla",
        condition: "USED",
        yearMin: "2018",
        yearMax: "2023",
        priceMin: "10000000",
        priceMax: "30000000",
        mileageMax: "150000",
        cityId: "1",
        areaId: "5",
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        bodyType: "SEDAN",
        vehicleType: "CAR",
        sellerType: "DEALER",
        sort: "price_asc",
        page: "2",
        limit: "24", // non-default valid limit
        q: "clean condition",
        hasWarranty: "true",
        unknown_tracking: "analytics_payload",
      };

      const filtered = filterListingSearchQueryParams(searchParams);
      expect(filtered).toEqual({
        makeSlug: "toyota",
        modelSlug: "corolla",
        condition: "USED",
        yearMin: "2018",
        yearMax: "2023",
        priceMin: "10000000",
        priceMax: "30000000",
        mileageMax: "150000",
        cityId: "1",
        areaId: "5",
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        bodyType: "SEDAN",
        vehicleType: "CAR",
        sellerType: "DEALER",
        sort: "price_asc",
        page: "2",
        limit: "24",
        q: "clean condition",
        hasWarranty: "true",
      });
      expect(filtered).not.toHaveProperty("unknown_tracking");
    });

    it("rejects modelSlug unless a valid makeSlug is also retained", () => {
      // modelSlug alone without makeSlug -> rejected
      const orphanModel = { modelSlug: "corolla" };
      expect(filterListingSearchQueryParams(orphanModel)).toEqual({});

      // invalid makeSlug with modelSlug -> both rejected
      const invalidMakeWithModel = { makeSlug: "TOYOTA!_INVALID", modelSlug: "corolla" };
      expect(filterListingSearchQueryParams(invalidMakeWithModel)).toEqual({});

      // valid makeSlug with valid modelSlug -> both retained
      const validBoth = { makeSlug: "toyota", modelSlug: "corolla" };
      expect(filterListingSearchQueryParams(validBoth)).toEqual({
        makeSlug: "toyota",
        modelSlug: "corolla",
      });

      // valid makeSlug with invalid modelSlug -> makeSlug retained, modelSlug rejected
      const validMakeInvalidModel = { makeSlug: "toyota", modelSlug: "COROLLA!@" };
      expect(filterListingSearchQueryParams(validMakeInvalidModel)).toEqual({
        makeSlug: "toyota",
      });
    });

    it("enforces yearMin/yearMax integer bounds 1900..2100 and removes invalid dependent upper bounds", () => {
      // Out of bounds: < 1900 or > 2100 stripped
      const outOfBounds = { yearMin: "1899", yearMax: "2101" };
      expect(filterListingSearchQueryParams(outOfBounds)).toEqual({});

      // yearMin > yearMax: invalid upper bound is removed, yearMin is retained
      const invalidRange = { yearMin: "2025", yearMax: "2020" };
      const filtered = filterListingSearchQueryParams(invalidRange);
      expect(filtered.yearMin).toBe("2025");
      expect(filtered).not.toHaveProperty("yearMax");

      // Valid range within 1900..2100: both retained
      const validRange = { yearMin: "2015", yearMax: "2022" };
      expect(filterListingSearchQueryParams(validRange)).toEqual({
        yearMin: "2015",
        yearMax: "2022",
      });
    });

    it("enforces priceMin <= priceMax and removes invalid upper bounds", () => {
      const invalidPrice = { priceMin: "50000000", priceMax: "10000000" };
      const filtered = filterListingSearchQueryParams(invalidPrice);
      expect(filtered.priceMin).toBe("50000000");
      expect(filtered).not.toHaveProperty("priceMax");

      const validPrice = { priceMin: "10000000", priceMax: "50000000" };
      expect(filterListingSearchQueryParams(validPrice)).toEqual({
        priceMin: "10000000",
        priceMax: "50000000",
      });
    });

    it("enforces safe non-negative integer cents for priceMin and priceMax, rejecting unsafe amounts (e.g. 9007199254740992)", () => {
      // Direct helper verification
      expect(parseAndValidateSafeMoneyCents("9007199254740992")).toBeUndefined(); // > MAX_SAFE_INTEGER
      expect(parseAndValidateSafeMoneyCents("9007199254740991")).toBe(9007199254740991); // MAX_SAFE_INTEGER
      expect(parseAndValidateSafeMoneyCents("0")).toBe(0);
      expect(parseAndValidateSafeMoneyCents("15000000")).toBe(15000000);
      expect(parseAndValidateSafeMoneyCents("-100")).toBeUndefined();
      expect(parseAndValidateSafeMoneyCents("99999999999999999999999999999")).toBeUndefined();

      // Filter integration: unsafe amounts > Number.MAX_SAFE_INTEGER are stripped
      const unsafePrices = {
        priceMin: "9007199254740992",
        priceMax: "99999999999999999999",
      };
      const filteredUnsafe = filterListingSearchQueryParams(unsafePrices);
      expect(filteredUnsafe).not.toHaveProperty("priceMin");
      expect(filteredUnsafe).not.toHaveProperty("priceMax");

      // Valid safe integer boundary retained
      const maxSafePrices = {
        priceMin: "0",
        priceMax: "9007199254740991",
      };
      expect(filterListingSearchQueryParams(maxSafePrices)).toEqual({
        priceMin: "0",
        priceMax: "9007199254740991",
      });

      // Dealer inventory also rejects unsafe amounts
      expect(filterDealerInventoryQueryParams({ priceMin: "9007199254740992" })).toEqual({});
      expect(filterDealerInventoryQueryParams({ priceMax: "9007199254740992" })).toEqual({});
    });

    it("strictly accepts exact backend enums only and rejects arbitrary strings / regex matches", () => {
      // Valid enums
      const validEnums = {
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        bodyType: "SUV",
        vehicleType: "CAR",
        sellerType: "DEALER",
        condition: "NEW",
      };
      expect(filterListingSearchQueryParams(validEnums)).toEqual(validEnums);

      // Invalid enums (lowercase, regex matches, non-contract values)
      const invalidEnums = {
        fuelType: "BIO_DIESEL",
        transmission: "AUTO_6SPEED",
        bodyType: "SPORTS_CAR",
        vehicleType: "AIRPLANE",
        sellerType: "BROKER",
        condition: "LIKE_NEW",
      };
      expect(filterListingSearchQueryParams(invalidEnums)).toEqual({});
    });

    it("enforces exact marketplace limit allowlist (12|20|24|40) and omits default 20", () => {
      // Default 20 is omitted from canonical URLs
      expect(filterListingSearchQueryParams({ limit: "20" })).toEqual({});

      // 12, 24, 40 are retained
      expect(filterListingSearchQueryParams({ limit: "12" })).toEqual({ limit: "12" });
      expect(filterListingSearchQueryParams({ limit: "24" })).toEqual({ limit: "24" });
      expect(filterListingSearchQueryParams({ limit: "40" })).toEqual({ limit: "40" });

      // Arbitrary positive limits are rejected
      expect(filterListingSearchQueryParams({ limit: "15" })).toEqual({});
      expect(filterListingSearchQueryParams({ limit: "50" })).toEqual({});
      expect(filterListingSearchQueryParams({ limit: "100" })).toEqual({});
      expect(filterListingSearchQueryParams({ limit: "999" })).toEqual({});
    });

    it("NEGATIVE TEST: strictly strips returnTo, cursor, status, range, step, unreadOnly, vendor, item from /search", () => {
      const mixedParams = {
        condition: "USED",
        q: "toyota",
        returnTo: "https://evil.com",
        cursor: "opaque_checkpoint_123",
        status: "ACTIVE",
        range: "30d",
        step: "pricing",
        unreadOnly: "true",
        vendor: "dealer_auto",
        item: "listing:toyota-corolla",
        malicious_code: "1' OR '1'='1",
      };

      const filtered = filterListingSearchQueryParams(mixedParams);
      expect(filtered).toEqual({
        condition: "USED",
        q: "toyota",
      });

      // Strict negative assertions
      expect(filtered).not.toHaveProperty("returnTo");
      expect(filtered).not.toHaveProperty("cursor");
      expect(filtered).not.toHaveProperty("status");
      expect(filtered).not.toHaveProperty("range");
      expect(filtered).not.toHaveProperty("step");
      expect(filtered).not.toHaveProperty("unreadOnly");
      expect(filtered).not.toHaveProperty("vendor");
      expect(filtered).not.toHaveProperty("item");
      expect(filtered).not.toHaveProperty("malicious_code");
    });

    it("validates listing search values (rejects short q, canonical page 1, canonical newest sort)", () => {
      const invalidValues = {
        q: "a",       // shorter than 2 chars
        page: "1",    // page 1 must be omitted from canonical URLs
        sort: "newest", // newest is canonical default, omitted
      };

      const filtered = filterListingSearchQueryParams(invalidValues);
      expect(filtered).not.toHaveProperty("q");
      expect(filtered).not.toHaveProperty("page");
      expect(filtered).not.toHaveProperty("sort");
    });
  });

  describe("dealer-detail route & DealerInventoryParamsSchema exact contract", () => {
    it("preserves valid dealer inventory parameters matching DealerInventoryParamsSchema exactly", () => {
      const inventoryParams = {
        cursor: "checkpoint_dealer_inv_1",
        limit: "40",
        makeSlug: "toyota",
        modelSlug: "corolla",
        yearMin: "2019",
        yearMax: "2023",
        priceMin: "10000000",
        priceMax: "25000000",
        mileageMax: "80000",
        cityId: "1",
        condition: "USED",
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        bodyType: "SEDAN",
        vehicleType: "CAR",
        hasWarranty: "true",
        installmentAvailable: "false",
        sort: "price_asc",
      };

      const filtered = filterDealerInventoryQueryParams(inventoryParams);
      expect(filtered).toEqual(inventoryParams);

      const routeFiltered = filterRouteQueryParams("/ar/dealers/cairo-cars", inventoryParams);
      expect(routeFiltered).toEqual(inventoryParams);
    });

    it("omits default sort=newest and default limit=20 on dealer inventory", () => {
      const defaults = {
        sort: "newest",
        limit: "20",
        makeSlug: "honda",
      };

      const filtered = filterDealerInventoryQueryParams(defaults);
      expect(filtered).toEqual({ makeSlug: "honda" });
      expect(filtered).not.toHaveProperty("sort");
      expect(filtered).not.toHaveProperty("limit");
    });

    it("NEGATIVE TEST: dealer-detail strictly strips q, areaId, sellerType, isVerified, isNegotiable, exchangeAccepted, page, panel, filter, and unsupported sorts", () => {
      const excludedParams = {
        makeSlug: "toyota",
        q: "search text should be stripped",
        areaId: "3",
        sellerType: "DEALER",
        isVerified: "true",
        isNegotiable: "true",
        exchangeAccepted: "false",
        page: "2",
        panel: "filters",
        filter: "specs",
        sort: "mileage_asc", // unsupported in dealer inventory (only newest, price_asc, price_desc)
        unknown_key: "drop_me",
      };

      const filtered = filterDealerInventoryQueryParams(excludedParams);
      expect(filtered).toEqual({ makeSlug: "toyota" });

      expect(filtered).not.toHaveProperty("q");
      expect(filtered).not.toHaveProperty("areaId");
      expect(filtered).not.toHaveProperty("sellerType");
      expect(filtered).not.toHaveProperty("isVerified");
      expect(filtered).not.toHaveProperty("isNegotiable");
      expect(filtered).not.toHaveProperty("exchangeAccepted");
      expect(filtered).not.toHaveProperty("page");
      expect(filtered).not.toHaveProperty("panel");
      expect(filtered).not.toHaveProperty("filter");
      expect(filtered).not.toHaveProperty("sort");
      expect(filtered).not.toHaveProperty("unknown_key");
    });

    it("strips modelSlug on dealer inventory if makeSlug is missing or invalid", () => {
      expect(filterDealerInventoryQueryParams({ modelSlug: "corolla" })).toEqual({});
      expect(
        filterDealerInventoryQueryParams({ makeSlug: "TOYOTA!@", modelSlug: "corolla" })
      ).toEqual({});
    });
  });

  describe("route-specific limits & canonical default omission", () => {
    it("enforces 12|20|24|40 (omit 20) for dealers", () => {
      // Dealers
      expect(filterRouteQueryParams("/ar/dealers", { limit: "20" })).toEqual({});
      expect(filterRouteQueryParams("/ar/dealers", { limit: "12" })).toEqual({ limit: "12" });
      expect(filterRouteQueryParams("/ar/dealers", { limit: "24" })).toEqual({ limit: "24" });
      expect(filterRouteQueryParams("/ar/dealers", { limit: "40" })).toEqual({ limit: "40" });
      expect(filterRouteQueryParams("/ar/dealers", { limit: "50" })).toEqual({});
    });

    it("enforces dedicated 20|40|80 (omit 20) for notifications matching NotificationListParamsSchema", () => {
      // Direct helper verification
      expect(filterNotificationsLimit("20")).toBeUndefined(); // omit canonical default
      expect(filterNotificationsLimit("40")).toBe("40");
      expect(filterNotificationsLimit("80")).toBe("80");
      expect(filterNotificationsLimit("12")).toBeUndefined(); // rejected
      expect(filterNotificationsLimit("24")).toBeUndefined(); // rejected
      expect(filterNotificationsLimit("15")).toBeUndefined(); // rejected
      expect(filterNotificationsLimit("50")).toBeUndefined(); // rejected

      // Notifications route query param verification
      expect(filterRouteQueryParams("/ar/notifications", { limit: "20" })).toEqual({});
      expect(filterRouteQueryParams("/ar/notifications", { limit: "40" })).toEqual({ limit: "40" });
      expect(filterRouteQueryParams("/ar/notifications", { limit: "80" })).toEqual({ limit: "80" });
      expect(filterRouteQueryParams("/ar/notifications", { limit: "12" })).toEqual({});
      expect(filterRouteQueryParams("/ar/notifications", { limit: "24" })).toEqual({});
      expect(filterRouteQueryParams("/ar/notifications", { limit: "15" })).toEqual({});
      expect(filterRouteQueryParams("/ar/notifications", { limit: "50" })).toEqual({});
      expect(filterRouteQueryParams("/ar/notifications", { limit: "100" })).toEqual({});
    });

    it("enforces 20|50|100 (omit 20) for favorites and me_listings", () => {
      // Favorites
      expect(filterRouteQueryParams("/en/favorites", { limit: "20" })).toEqual({});
      expect(filterRouteQueryParams("/en/favorites", { limit: "50" })).toEqual({ limit: "50" });
      expect(filterRouteQueryParams("/en/favorites", { limit: "100" })).toEqual({ limit: "100" });
      expect(filterRouteQueryParams("/en/favorites", { limit: "12" })).toEqual({});
      expect(filterRouteQueryParams("/en/favorites", { limit: "24" })).toEqual({});
      expect(filterRouteQueryParams("/en/favorites", { limit: "40" })).toEqual({});

      // Me listings
      expect(filterRouteQueryParams("/ar/me/listings", { limit: "20" })).toEqual({});
      expect(filterRouteQueryParams("/ar/me/listings", { limit: "50" })).toEqual({ limit: "50" });
      expect(filterRouteQueryParams("/ar/me/listings", { limit: "100" })).toEqual({ limit: "100" });
      expect(filterRouteQueryParams("/ar/me/listings", { limit: "15" })).toEqual({});
    });
  });

  describe("auth returnTo safety and open-redirect prevention", () => {
    it("rejects absolute external URLs and URI schemes", () => {
      expect(isSafeReturnTo("https://evil.com")).toBe(false);
      expect(isSafeReturnTo("http://attacker.org/ar/search")).toBe(false);
      expect(isSafeReturnTo("javascript:alert(document.cookie)")).toBe(false);
      expect(isSafeReturnTo("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
      expect(sanitizeReturnTo("https://evil.com")).toBeUndefined();
    });

    it("rejects protocol-relative and backslash bypass attempts", () => {
      expect(isSafeReturnTo("//evil.com")).toBe(false);
      expect(isSafeReturnTo("/\\evil.com")).toBe(false);
      expect(isSafeReturnTo("\\evil.com")).toBe(false);
      expect(isSafeReturnTo("/ar\\evil.com")).toBe(false);
      expect(isSafeReturnTo("/%5Cevil.com")).toBe(false);
    });

    it("rejects control characters and CRLF injection", () => {
      expect(isSafeReturnTo("/ar/search\r\nSet-Cookie:admin=1")).toBe(false);
      expect(isSafeReturnTo("/ar/dealers\0")).toBe(false);
    });

    it("rejects unlocalized paths and auth endpoint redirect loops", () => {
      expect(isSafeReturnTo("/search?condition=USED")).toBe(false); // missing /ar or /en prefix
      expect(isSafeReturnTo("/ar/login")).toBe(false);
      expect(isSafeReturnTo("/en/register")).toBe(false);
      expect(isSafeReturnTo("/ar/forgot-password")).toBe(false);
      expect(isSafeReturnTo("/en/auth/callback")).toBe(false);
    });

    it("accepts safe same-origin relative localized application paths", () => {
      expect(isSafeReturnTo("/ar")).toBe(true);
      expect(isSafeReturnTo("/en/search?condition=USED&q=toyota")).toBe(true);
      expect(isSafeReturnTo("/ar/dealers/cairo-motors")).toBe(true);
      expect(isSafeReturnTo("/en/me/listings")).toBe(true);
      expect(isSafeReturnTo("/ar/compare?item=listing:corolla")).toBe(true);

      expect(sanitizeReturnTo("/ar/search?condition=USED")).toBe("/ar/search?condition=USED");
    });
  });

  describe("documented route-specific preservation & repeated values", () => {
    it("preserves repeated query values for compare route (up to 4, deduplicated)", () => {
      const searchParams = new URLSearchParams();
      searchParams.append("item", "listing:toyota-corolla-2022");
      searchParams.append("item", "listing:honda-civic-2023");
      searchParams.append("item", "listing:toyota-corolla-2022"); // duplicate
      searchParams.append("item", "trim:kia-sportage-topline");
      searchParams.append("unrelated", "test");

      const preserved = filterRouteQueryParams("compare", searchParams);
      expect(preserved).toEqual({
        item: [
          "listing:toyota-corolla-2022",
          "listing:honda-civic-2023",
          "trim:kia-sportage-topline",
        ],
      });
      expect(preserved).not.toHaveProperty("unrelated");
    });

    it("preserves notifications route parameters (cursor, limit, unreadOnly)", () => {
      const params = {
        cursor: "checkpoint_notif_99",
        limit: "40",
        unreadOnly: "true",
        condition: "USED",
        q: "spam",
      };

      const preserved = filterRouteQueryParams("/ar/notifications", params);
      expect(preserved).toEqual({
        cursor: "checkpoint_notif_99",
        limit: "40",
        unreadOnly: "true",
      });
      expect(preserved).not.toHaveProperty("condition");
      expect(preserved).not.toHaveProperty("q");
    });

    it("preserves dashboard route parameters (range, vendor) and rejects unrelated keys", () => {
      const params = {
        range: "30d",
        vendor: "cairo_motors",
        step: "review",
        cursor: "ignored_cursor",
      };

      const preserved = filterRouteQueryParams("/en/me/dashboard", params);
      expect(preserved).toEqual({
        range: "30d",
        vendor: "cairo_motors",
      });
      expect(preserved).not.toHaveProperty("step");
      expect(preserved).not.toHaveProperty("cursor");
    });

    it("preserves sell route parameter (step) within allowed wizard steps", () => {
      const validSellParams = { step: "pricing", tracking: "123" };
      expect(filterRouteQueryParams("/ar/sell", validSellParams)).toEqual({ step: "pricing" });

      const invalidSellParams = { step: "unauthorized_step" };
      expect(filterRouteQueryParams("/ar/sell", invalidSellParams)).toEqual({});
    });

    it("preserves me_listings route parameters (status, cursor, limit) and omits ALL", () => {
      const activeListings = { status: "ACTIVE", cursor: "curs_1", limit: "50" };
      expect(filterRouteQueryParams("/ar/me/listings", activeListings)).toEqual({
        status: "ACTIVE",
        cursor: "curs_1",
        limit: "50",
      });

      const allListings = { status: "ALL", cursor: "curs_2" };
      expect(filterRouteQueryParams("/ar/me/listings", allListings)).toEqual({
        cursor: "curs_2",
      });
    });

    it("preserves me_leads route parameters (status, cursor) with strict LeadStatus validation", () => {
      // Valid LeadStatus values: NEW, CONTACTED, QUALIFIED, WON, LOST, SPAM
      expect(VALID_LEAD_STATUSES).toEqual(
        new Set(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"])
      );
      for (const status of VALID_LEAD_STATUSES) {
        expect(filterRouteQueryParams("/ar/me/leads", { status, cursor: "curs_lead_1" })).toEqual({
          status,
          cursor: "curs_lead_1",
        });
      }

      // Arbitrary or undocumented statuses are stripped
      expect(
        filterRouteQueryParams("/ar/me/leads", { status: "ACTIVE", cursor: "curs_lead_2" })
      ).toEqual({
        cursor: "curs_lead_2",
      });
      expect(
        filterRouteQueryParams("/ar/me/leads", { status: "RANDOM", cursor: "curs_lead_3" })
      ).toEqual({
        cursor: "curs_lead_3",
      });
      expect(filterRouteQueryParams("/ar/me/leads", { status: "pending" })).toEqual({});

      // Unapproved parameters such as channel, limit, q are strictly stripped
      expect(
        filterRouteQueryParams("/ar/me/leads", {
          status: "QUALIFIED",
          channel: "WHATSAPP",
          limit: "20",
          q: "test",
        })
      ).toEqual({
        status: "QUALIFIED",
      });
    });

    it("preserves dealers directory parameters (cityId, cursor, limit) while discarding q", () => {
      const dealerParams = {
        cityId: "2",
        cursor: "dealer_page_2",
        limit: "24",
        q: "search should be dropped per Section 2.6",
      };

      const preserved = filterRouteQueryParams("/ar/dealers", dealerParams);
      expect(preserved).toEqual({
        cityId: "2",
        cursor: "dealer_page_2",
        limit: "24",
      });
      expect(preserved).not.toHaveProperty("q");
    });

    it("preserves current home route filters while dropping route-specific keys for locale switcher", () => {
      const homeParams = {
        condition: "USED",
        q: "toyota",
        returnTo: "https://evil.com",
        cursor: "abc",
        step: "photos",
      };

      const preserved = filterRouteQueryParams("home", homeParams);
      expect(preserved).toEqual({
        condition: "USED",
        q: "toyota",
      });
      expect(preserved).not.toHaveProperty("returnTo");
      expect(preserved).not.toHaveProperty("cursor");
      expect(preserved).not.toHaveProperty("step");
    });
  });

  it("handles URLSearchParams and strips empty or whitespace parameters", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("condition", "NEW");
    searchParams.set("q", " ");
    searchParams.set("unauthorized", "test");

    const preserved = filterAllowedQueryParams(searchParams);
    expect(preserved).toEqual({ condition: "NEW" });
  });

  it("handles undefined or empty searchParams gracefully", () => {
    expect(filterAllowedQueryParams(undefined)).toEqual({});
    expect(filterAllowedQueryParams({})).toEqual({});
  });
});

describe("i18n formatters (integer minor units / money)", () => {
  it("formats integer cents to whole currency amounts without floating-point errors", () => {
    // 150,000 EGP = 15,000,000 cents
    const arFormatted = formatMoneyFromCents(15000000, "EGP", "ar");
    expect(arFormatted).toBe("150,000 ج.م");

    const enFormatted = formatMoneyFromCents(15000000, "EGP", "en");
    expect(enFormatted).toBe("150,000 EGP");
  });

  it("formats decimal cents accurately when requested or fractional", () => {
    // 12.50 EGP = 1250 cents
    const arWithDecimals = formatMoneyFromCents(1250, "EGP", "ar", true);
    expect(arWithDecimals).toBe("12.50 ج.م");

    const enWithDecimals = formatMoneyFromCents(1250, "EGP", "en", true);
    expect(enWithDecimals).toBe("12.50 EGP");
  });

  it("handles zero cents properly", () => {
    expect(formatMoney(0, { currency: "EGP", locale: "ar" })).toBe("0 ج.م");
    expect(formatMoney(0, { currency: "EGP", locale: "en" })).toBe("0 EGP");
  });

  it("handles negative amounts properly", () => {
    expect(formatMoney(-50000, { currency: "EGP", locale: "ar" })).toBe("-500 ج.م");
    expect(formatMoney(-50000, { currency: "EGP", locale: "en" })).toBe("-500 EGP");
  });

  it("handles multi-decimal currencies like KWD (3 decimals)", () => {
    expect(getCurrencyDecimalPlaces("KWD")).toBe(3);
    const kwdFormatted = formatMoney(1250, {
      currency: "KWD",
      locale: "ar",
      showDecimals: true,
    });
    expect(kwdFormatted).toBe("1.250 د.ك");
  });

  it("handles zero-decimal currencies like JPY", () => {
    expect(getCurrencyDecimalPlaces("JPY")).toBe(0);
    const jpyFormatted = formatMoney(500, { currency: "JPY", locale: "en" });
    expect(jpyFormatted).toBe("500 JPY");
  });

  it("supports Eastern Arabic numerals formatting when requested", () => {
    const arabicDigitsMoney = formatMoney(15000000, {
      currency: "EGP",
      locale: "ar",
      useArabicDigits: true,
    });
    expect(arabicDigitsMoney).toBe("١٥٠,٠٠٠ ج.م");
  });

  it("parses cents to exact BigInt parts", () => {
    const parts = parseCentsToParts(123456789, { currency: "EGP" });
    expect(parts.wholeUnits).toBe(1234567n);
    expect(parts.fractionUnits).toBe(89n);
    expect(parts.isNegative).toBe(false);
  });

  it("returns localized currency labels", () => {
    expect(getCurrencyLabel("EGP", "ar")).toBe("ج.م");
    expect(getCurrencyLabel("EGP", "en")).toBe("EGP");
    expect(getCurrencyLabel("USD", "ar")).toBe("دولار");
    expect(getCurrencyLabel("USD", "en")).toBe("USD");
    expect(getCurrencyLabel("SAR", "ar")).toBe("ر.س");
    expect(getCurrencyLabel("SAR", "en")).toBe("SAR");
    expect(getCurrencyLabel("AED", "ar")).toBe("د.إ");
    expect(getCurrencyLabel("AED", "en")).toBe("AED");
  });

  it("formats numbers with locale-aware number format", () => {
    expect(formatNumber(150000, "en")).toBe("150,000");
    const arNumber = formatNumber(150000, "ar");
    expect(arNumber).toBeTruthy();
  });
});

describe("integer-cents strict validation and negative tests", () => {
  it("rejects floating-point numbers field-specifically and never truncates floating money", () => {
    expect(() => validateMoneyCents(12.5, "priceCents")).toThrowError(
      /Invalid priceCents: floating-point monetary values are prohibited/
    );
    expect(() => formatMoney(150.99)).toThrowError(
      /Invalid priceCents: floating-point monetary values are prohibited/
    );
    expect(() => formatMoneyFromCents(0.5, "EGP", "ar", undefined, "offerCents")).toThrowError(
      /Invalid offerCents: floating-point monetary values are prohibited/
    );
  });

  it("rejects non-finite values (NaN, Infinity) and never converts them to zero", () => {
    expect(() => validateMoneyCents(NaN, "priceCents")).toThrowError(
      /Invalid priceCents: expected a finite numeric integer/
    );
    expect(() => formatMoney(Infinity)).toThrowError(
      /Invalid priceCents: expected a finite numeric integer/
    );
    expect(() => parseCentsToParts(-Infinity)).toThrowError(
      /Invalid priceCents: expected a finite numeric integer/
    );
  });

  it("rejects unsafe integer values beyond Number.MAX_SAFE_INTEGER", () => {
    const unsafeInt = Number.MAX_SAFE_INTEGER + 100;
    expect(() => validateMoneyCents(unsafeInt, "priceCents")).toThrowError(
      /Invalid priceCents: integer cents value exceeds safe integer bounds/
    );
  });

  it("rejects non-numeric types (null, undefined, string, object)", () => {
    expect(() => validateMoneyCents("15000000", "priceCents")).toThrowError(
      /Invalid priceCents: expected integer cents as number or bigint/
    );
    expect(() => validateMoneyCents(null, "priceCents")).toThrowError(
      /Invalid priceCents: expected integer cents as number or bigint/
    );
    expect(() => validateMoneyCents(undefined, "priceCents")).toThrowError(
      /Invalid priceCents: expected integer cents as number or bigint/
    );
    expect(() => validateMoneyCents({}, "priceCents")).toThrowError(
      /Invalid priceCents: expected integer cents as number or bigint/
    );
  });

  it("accepts valid BigInt values without error", () => {
    expect(validateMoneyCents(100n)).toBe(100n);
    expect(formatMoney(100000000000000n, { currency: "EGP", locale: "en" })).toBe(
      "1,000,000,000,000 EGP"
    );
  });
});

describe("i18n digit conversion", () => {
  it("converts Western digits to Arabic-Indic digits", () => {
    expect(toArabicDigits("1234567890")).toBe("١٢٣٤٥٦٧٨٩٠");
    expect(toArabicDigits(2026)).toBe("٢٠٢٦");
  });

  it("converts Arabic-Indic digits to Western digits", () => {
    expect(toWesternDigits("١٢٣٤٥٦٧٨٩٠")).toBe("1234567890");
    expect(toWesternDigits("موديل ٢٠٢٦")).toBe("موديل 2026");
  });

  it("formats digits according to locale", () => {
    expect(formatDigits("123", "ar")).toBe("١٢٣");
    expect(formatDigits("123", "en")).toBe("123");
  });
});

describe("i18n date, time, and deterministic relative time formatting", () => {
  const testIso = "2026-09-07T12:00:00Z";

  it("formats date deterministically using Africa/Cairo timezone", () => {
    const arDate = formatDate(testIso, "ar");
    const enDate = formatDate(testIso, "en");
    expect(arDate).toBeTruthy();
    expect(enDate).toBeTruthy();
    expect(enDate).toContain("2026");
  });

  it("formats time using Africa/Cairo timezone", () => {
    const arTime = formatTime(testIso, "ar");
    const enTime = formatTime(testIso, "en");
    expect(arTime).toBeTruthy();
    expect(enTime).toBeTruthy();
  });

  it("formats full date-time", () => {
    const arDateTime = formatDateTime(testIso, "ar");
    const enDateTime = formatDateTime(testIso, "en");
    expect(arDateTime).toBeTruthy();
    expect(enDateTime).toBeTruthy();
  });

  it("requires an explicit reference time (baseDate) for deterministic relative time", () => {
    const base = new Date("2026-09-07T12:00:00Z");
    const twoHoursAgo = new Date("2026-09-07T10:00:00Z");
    const tomorrow = new Date("2026-09-08T12:00:00Z");

    const enPast = formatRelativeTime(twoHoursAgo, base, "en");
    expect(enPast).toBe("2 hours ago");

    const arPast = formatRelativeTime(twoHoursAgo, base, "ar");
    expect(arPast).toContain("ساعت");

    const enFuture = formatRelativeTime(tomorrow, base, "en");
    expect(enFuture).toBe("tomorrow");
  });

  it("rejects invalid dates with a descriptive TypeError", () => {
    expect(() => formatDate("not-a-date")).toThrowError(/Invalid date/);
    expect(() => formatRelativeTime("invalid", "2026-09-07T12:00:00Z")).toThrowError(
      /Invalid date/
    );
    expect(() => formatRelativeTime("2026-09-07T12:00:00Z", "invalid")).toThrowError(
      /Invalid baseDate/
    );
  });
});

describe("i18n message trees and key parity", () => {
  const requiredNamespaces = [
    "navigation",
    "actions",
    "validation",
    "loading",
    "empty",
    "error",
    "auth",
    "marketplace",
    "account",
    "seller",
    "vendor",
  ] as const;

  it("contains all 11 mandatory vocabulary trees in Arabic", () => {
    for (const ns of requiredNamespaces) {
      expect(arMessages, `Missing namespace ${ns} in ar.json`).toHaveProperty(ns);
      expect(Object.keys((arMessages as Record<string, unknown>)[ns] ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("contains all 11 mandatory vocabulary trees in English", () => {
    for (const ns of requiredNamespaces) {
      expect(enMessages, `Missing namespace ${ns} in en.json`).toHaveProperty(ns);
      expect(Object.keys((enMessages as Record<string, unknown>)[ns] ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("enforces strict 1-to-1 key parity between ar.json and en.json", () => {
    function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      let keys: string[] = [];
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "object" && val !== null) {
          keys = keys.concat(getKeys(val as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys.sort();
    }

    const arKeys = getKeys(arMessages as Record<string, unknown>);
    const enKeys = getKeys(enMessages as Record<string, unknown>);

    const missingInEn = arKeys.filter((k) => !enKeys.includes(k));
    const missingInAr = enKeys.filter((k) => !arKeys.includes(k));

    expect(missingInEn, "Keys present in ar.json but missing in en.json").toEqual([]);
    expect(missingInAr, "Keys present in en.json but missing in ar.json").toEqual([]);
    expect(arKeys.length).toBe(enKeys.length);
  });
});

describe("TASK-005 Acceptance Criteria (Strict BDD)", () => {
  it("GIVEN identical fixed content at /ar and /en, WHEN both render on server, THEN Arabic is lang='ar' dir='rtl', English is lang='en' dir='ltr', no key is missing, and money derives from integer cents", () => {
    // 1. Language & Direction
    expect(getLocaleConfig("ar").lang).toBe("ar");
    expect(getLocaleConfig("ar").dir).toBe("rtl");
    expect(getLocaleDirection("ar")).toBe("rtl");

    expect(getLocaleConfig("en").lang).toBe("en");
    expect(getLocaleConfig("en").dir).toBe("ltr");
    expect(getLocaleDirection("en")).toBe("ltr");

    // 2. Key completeness and parity
    const arSections = Object.keys(arMessages).sort();
    const enSections = Object.keys(enMessages).sort();
    expect(arSections).toEqual(enSections);

    // 3. Money derives strictly from integer cents without floating point
    const cents = 15000000; // 150,000.00 EGP
    const arMoney = formatMoneyFromCents(cents, "EGP", "ar");
    const enMoney = formatMoneyFromCents(cents, "EGP", "en");

    expect(arMoney).toBe("150,000 ج.م");
    expect(enMoney).toBe("150,000 EGP");
  });
});
