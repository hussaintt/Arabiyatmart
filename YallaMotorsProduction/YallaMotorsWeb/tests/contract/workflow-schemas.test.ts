import { describe, expect, it } from "vitest";
import {
  OfferStatusSchema,
  SellerScopeSchema,
  OfferSchema,
  OfferResponseSchema,
  OfferListResponseSchema,
  CreateOfferInputSchema,
  RespondOfferInputSchema,
  adaptRawOffer,
  adaptRawOfferList,
  stripOfferNullsForUpstream,
} from "@/lib/api/schemas/offer";
import {
  LeadChannelSchema,
  LeadStatusSchema,
  ReportCategorySchema,
  CreateLeadInputSchema,
  UpdateLeadStatusInputSchema,
  CreateReportInputSchema,
  PurchasePromotionInputSchema,
  adaptRawLead,
  adaptRawLeadDetail,
  adaptRawLeadList,
  adaptRawListingReport,
  adaptRawListingPromotion,
  adaptRawPromotionList,
  adaptRawPromotionPackageList,
} from "@/lib/api/schemas/lead";
import {
  NotificationItemSchema,
  RegisterDeviceInputSchema,
  WebPushSubscriptionInputSchema,
  adaptRawNotification,
  adaptRawNotificationList,
  adaptRawDeviceRegistration,
} from "@/lib/api/schemas/notification";
import {
  SavedSearchQuerySchema,
  UpdateSavedSearchInputSchema,
  VehicleSearchSuggestionSchema,
  VehicleSearchSuggestionResponseSchema,
  adaptRawSavedSearch,
  adaptRawVehicleSearchSuggestionList,
} from "@/lib/api/schemas/saved-search";
import {
  UploadPurposeSchema,
  UPLOAD_PURPOSE_CONFIG,
  validateUploadFileMeta,
  adaptRawUploadedFile,
  adaptRawUploadedFileList,
  adaptRawFileStatus,
} from "@/lib/api/schemas/upload";
import {
  DashboardRangeSchema,
  dashboardRangeToDays,
  DashboardSummarySchema,
  adaptRawDashboardOverview,
} from "@/lib/api/schemas/dashboard";
import {
  CreateListingInputSchema,
  UpdateListingInputSchema,
  TransitionListingInputSchema,
  UpdatePriceInputSchema,
  SellListingDraftSchema,
  SellWizardStateSchema,
  projectDraftToCreateInput,
} from "@/lib/api/schemas/sell";

describe("Workflow & Dashboard Schemas Contract", () => {
  // ── 1. Offers ─────────────────────────────────────────────────────────────
  describe("Offers Domain", () => {
    it("validates all OfferStatus branches", () => {
      const statuses = [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "COUNTERED",
        "EXPIRED",
        "WITHDRAWN",
      ] as const;
      statuses.forEach((status) => {
        expect(OfferStatusSchema.parse(status)).toBe(status);
      });
      expect(() => OfferStatusSchema.parse("INVALID")).toThrow();
    });

    it("validates SellerScope discriminated union", () => {
      expect(SellerScopeSchema.parse({ kind: "PRIVATE" })).toEqual({
        kind: "PRIVATE",
      });
      expect(
        SellerScopeSchema.parse({ kind: "VENDOR", vendorPublicId: "vnd_123" }),
      ).toEqual({
        kind: "VENDOR",
        vendorPublicId: "vnd_123",
      });
      expect(() => SellerScopeSchema.parse({ kind: "VENDOR" })).toThrow();
      expect(() => SellerScopeSchema.parse({ kind: "UNKNOWN" })).toThrow();
    });

    it("validates complete Offer entity", () => {
      const validOffer = {
        publicId: "ofr_01",
        offerCents: 50000000,
        counterCents: null,
        currency: "EGP",
        status: "PENDING",
        message: "عرض خاص لسيارة تويوتا بحالة ممتازة",
        sellerNote: null,
        expiresAt: "2026-09-14T12:00:00.000Z",
        respondedAt: null,
        createdAt: "2026-09-07T12:00:00.000Z",
        listing: {
          publicId: "lst_123",
          slug: "toyota-corolla-2023",
          title: "تويوتا كورولا 2023",
          coverImageUrl: "https://cdn.example.com/cars/corolla.jpg",
          priceCents: 55000000,
        },
        buyer: {
          publicId: "usr_buyer_1",
          firstName: "أحمد",
          lastName: "محمود",
        },
      };

      const parsed = OfferSchema.parse(validOffer);
      expect(parsed.publicId).toBe("ofr_01");
      expect(parsed.offerCents).toBe(50000000);
      expect(parsed.listing.title).toBe("تويوتا كورولا 2023");
      expect(OfferResponseSchema.parse({ data: parsed }).data.publicId).toBe(
        "ofr_01",
      );
      expect(
        OfferListResponseSchema.parse({
          data: [parsed],
          total: 1,
          page: 1,
          limit: 20,
        }).total,
      ).toBe(1);
    });

    it("validates CreateOfferInput constraints", () => {
      expect(
        CreateOfferInputSchema.parse({ offerCents: 1000, message: "معقول؟" }),
      ).toEqual({
        offerCents: 1000,
        message: "معقول؟",
      });
      expect(
        CreateOfferInputSchema.parse({ offerCents: 1000, message: null }),
      ).toEqual({
        offerCents: 1000,
        message: null,
      });
      // Zero cents rejected
      expect(() =>
        CreateOfferInputSchema.parse({ offerCents: 0, message: null }),
      ).toThrow();
      // Negative cents rejected
      expect(() =>
        CreateOfferInputSchema.parse({ offerCents: -50, message: null }),
      ).toThrow();
    });

    it("enforces cross-field rules on RespondOfferInputSchema", () => {
      // Accept with no counter
      expect(
        RespondOfferInputSchema.parse({
          action: "accept",
          sellerNote: "تمت الموافقة",
        }),
      ).toBeDefined();

      // Reject with no counter
      expect(
        RespondOfferInputSchema.parse({
          action: "reject",
          sellerNote: "السعر منخفض جدا",
        }),
      ).toBeDefined();

      // Counter WITH counterCents
      expect(
        RespondOfferInputSchema.parse({
          action: "counter",
          counterCents: 52000000,
          sellerNote: "أقل سعر ممكن 520,000",
        }),
      ).toBeDefined();

      // Counter WITHOUT counterCents must fail
      expect(() =>
        RespondOfferInputSchema.parse({
          action: "counter",
          sellerNote: "عرض مضاد",
        }),
      ).toThrow(/counter amount is required/i);

      // Accept WITH counterCents must fail
      expect(() =>
        RespondOfferInputSchema.parse({
          action: "accept",
          counterCents: 500000,
          sellerNote: null,
        }),
      ).toThrow(/allowed only for counter/i);
    });

    it("adapts raw offer and strips internal DB IDs", () => {
      const rawUpstream = {
        id: 9999,
        userId: 8888,
        listingId: 7777,
        publicId: "ofr_raw_1",
        offerCents: 45000000,
        currency: "EGP",
        status: "PENDING",
        expiresAt: "2026-09-14T12:00:00.000Z",
        createdAt: "2026-09-07T12:00:00.000Z",
        listing: {
          id: 7777,
          publicId: "lst_raw_1",
          slug: "bmw-320i-2022",
          title: "BMW 320i",
          priceCents: 50000000,
        },
        buyer: {
          id: 8888,
          publicId: "usr_raw_buyer",
        },
      };

      const adapted = adaptRawOffer(rawUpstream);
      expect(adapted.data.publicId).toBe("ofr_raw_1");
      expect(adapted.data.counterCents).toBeNull();
      expect(adapted.data.message).toBeNull();
      expect(adapted.data.sellerNote).toBeNull();
      expect(adapted.data.respondedAt).toBeNull();
      expect(adapted.data.listing.coverImageUrl).toBeNull();
      expect(adapted.data.buyer.firstName).toBeNull();
      // Internal IDs must not be present in output
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.id).toBeUndefined();
      expect(rawAdapted.userId).toBeUndefined();
    });

    it("adapts raw offer list and normalizes missing total to null", () => {
      const rawList = {
        data: [
          {
            publicId: "ofr_item_1",
            offerCents: 30000000,
            currency: "EGP",
            status: "ACCEPTED",
            expiresAt: "2026-09-14T12:00:00.000Z",
            createdAt: "2026-09-07T12:00:00.000Z",
            listing: {
              publicId: "lst_1",
              slug: "kia-sportage",
              title: "كيا سبورتاج",
              priceCents: 32000000,
            },
            buyer: { publicId: "usr_b1" },
          },
        ],
        // missing total
        page: 1,
        limit: 20,
      };

      const adapted = adaptRawOfferList(rawList);
      expect(adapted.data).toHaveLength(1);
      expect(adapted.total).toBeNull();
      expect(adapted.page).toBe(1);
      expect(adapted.limit).toBe(20);
    });

    it("strips null values for upstream body", () => {
      const input = { offerCents: 5000, message: null, custom: undefined };
      const stripped = stripOfferNullsForUpstream(input);
      expect(stripped).toEqual({ offerCents: 5000 });
    });
  });

  // ── 2. Leads, Reports & Promotions ────────────────────────────────────────
  describe("Leads Domain", () => {
    it("validates all 8 LeadChannel enum values", () => {
      const channels = [
        "CALL_REVEAL",
        "WHATSAPP",
        "CHAT",
        "CALLBACK_FORM",
        "FINANCE_REQUEST",
        "INSURANCE_REQUEST",
        "TEST_DRIVE",
        "INSPECTION",
      ] as const;
      channels.forEach((channel) => {
        expect(LeadChannelSchema.parse(channel)).toBe(channel);
      });
      expect(() => LeadChannelSchema.parse("INVALID_CHANNEL")).toThrow();
    });

    it("validates all 6 LeadStatus enum values", () => {
      const statuses = [
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "WON",
        "LOST",
        "SPAM",
      ] as const;
      statuses.forEach((status) => {
        expect(LeadStatusSchema.parse(status)).toBe(status);
      });
      expect(() => LeadStatusSchema.parse("INVALID_STATUS")).toThrow();
    });

    it("enforces buyerPhone on CreateLeadInputSchema for callback and request channels", () => {
      // Valid call reveal without buyer phone
      expect(
        CreateLeadInputSchema.parse({
          listingPublicId: "lst_1",
          channel: "CALL_REVEAL",
          buyerPhone: null,
          buyerName: null,
          note: null,
          meta: null,
        }),
      ).toBeDefined();

      // Callback form WITH phone
      expect(
        CreateLeadInputSchema.parse({
          listingPublicId: "lst_1",
          channel: "CALLBACK_FORM",
          buyerPhone: "+201012345678",
          buyerName: "طارق",
          note: "يرجى الاتصال مساءً",
          meta: null,
        }),
      ).toBeDefined();

      // Callback form WITHOUT phone must fail
      expect(() =>
        CreateLeadInputSchema.parse({
          listingPublicId: "lst_1",
          channel: "CALLBACK_FORM",
          buyerPhone: null,
          buyerName: "طارق",
          note: null,
          meta: null,
        }),
      ).toThrow(/buyer phone is required/i);
    });

    it("validates UpdateLeadStatusInputSchema (excludes NEW)", () => {
      expect(
        UpdateLeadStatusInputSchema.parse({
          status: "QUALIFIED",
          note: "تم التواصل والتأكيد",
        }),
      ).toBeDefined();

      expect(() =>
        UpdateLeadStatusInputSchema.parse({
          status: "NEW" as unknown as "QUALIFIED",
          note: null,
        }),
      ).toThrow();
    });

    it("adapts raw lead detail and strips internal IDs", () => {
      const rawLead = {
        id: 111,
        listingId: 222,
        publicId: "lead_01",
        channel: "WHATSAPP",
        status: "NEW",
        eventsCount: 1,
        listing: {
          id: 222,
          publicId: "lst_1",
          slug: "hyundai-tucson-2023",
          title: "هيونداي توسان",
        },
        events: [
          {
            type: "CREATED",
            meta: { source: "web" },
            createdAt: "2026-09-07T12:00:00.000Z",
          },
        ],
      };

      const adapted = adaptRawLeadDetail(rawLead);
      expect(adapted.data.publicId).toBe("lead_01");
      expect(adapted.data.events).toHaveLength(1);
      expect(adapted.data.events[0]?.type).toBe("CREATED");
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.id).toBeUndefined();
    });

    it("adapts raw lead list with cursor metadata", () => {
      const rawList = {
        data: [
          {
            publicId: "lead_02",
            channel: "CHAT",
            status: "CONTACTED",
            eventsCount: 2,
            listing: {
              publicId: "lst_2",
              slug: "mercedes-c200",
              title: "مرسيدس C200",
            },
          },
        ],
        meta: {
          hasMore: true,
          nextCursor: "cursor_abc_123",
        },
      };

      const adapted = adaptRawLeadList(rawList);
      expect(adapted.data).toHaveLength(1);
      expect(adapted.meta.hasMore).toBe(true);
      expect(adapted.meta.nextCursor).toBe("cursor_abc_123");
    });
  });

  describe("Reports Domain", () => {
    it("validates all 6 ReportCategory values", () => {
      const categories = [
        "FRAUD",
        "WRONG_INFO",
        "SOLD_ALREADY",
        "DUPLICATE",
        "OFFENSIVE",
        "OTHER",
      ] as const;
      categories.forEach((cat) => {
        expect(ReportCategorySchema.parse(cat)).toBe(cat);
      });
      expect(() => ReportCategorySchema.parse("INVALID_CAT")).toThrow();
    });

    it("enforces details required when category is OTHER", () => {
      // Category FRAUD with null details is allowed
      expect(
        CreateReportInputSchema.parse({
          listingPublicId: "lst_1",
          category: "FRAUD",
          details: null,
        }),
      ).toBeDefined();

      // Category OTHER with details is allowed
      expect(
        CreateReportInputSchema.parse({
          listingPublicId: "lst_1",
          category: "OTHER",
          details: "إعلان غير واضح المواصفات",
        }),
      ).toBeDefined();

      // Category OTHER without details must fail
      expect(() =>
        CreateReportInputSchema.parse({
          listingPublicId: "lst_1",
          category: "OTHER",
          details: null,
        }),
      ).toThrow(/details are required when category is other/i);
    });

    it("adapts raw listing report", () => {
      const raw = {
        id: 55,
        publicId: "rep_01",
        category: "SOLD_ALREADY",
        details: "السيارة بيعت من يومين",
        status: "OPEN",
        createdAt: "2026-09-07T12:00:00.000Z",
        listing: {
          id: 12,
          publicId: "lst_1",
          slug: "bmw-x5",
          title: "BMW X5",
        },
      };

      const adapted = adaptRawListingReport(raw);
      expect(adapted.data.publicId).toBe("rep_01");
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.id).toBeUndefined();
    });
  });

  describe("Promotions Domain", () => {
    it("validates PurchasePromotionInputSchema", () => {
      expect(
        PurchasePromotionInputSchema.parse({
          listingPublicId: "lst_1",
          tier: "PREMIUM",
        }),
      ).toBeDefined();

      expect(
        PurchasePromotionInputSchema.parse({
          listingPublicId: "lst_1",
          tier: "EXTRA_PREMIUM",
        }),
      ).toBeDefined();

      expect(() =>
        PurchasePromotionInputSchema.parse({
          listingPublicId: "lst_1",
          tier: "GOLD" as unknown as "PREMIUM",
        }),
      ).toThrow();
    });

    it("adapts raw promotion item and list", () => {
      const rawPromo = {
        id: 1,
        publicId: "pro_01",
        tier: "PREMIUM",
        type: "FEATURED",
        status: "ACTIVE",
        durationDays: 7,
        priceCents: 150000,
        currency: "EGP",
        createdAt: "2026-09-07T12:00:00.000Z",
        perks: {
          highlightedCard: true,
          homepageSlot: true,
          performanceStats: true,
          autoRenewEveryDays: null,
        },
      };

      const adapted = adaptRawListingPromotion(rawPromo);
      expect(adapted.data.publicId).toBe("pro_01");
      expect(adapted.data.perks?.highlightedCard).toBe(true);
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.id).toBeUndefined();

      const adaptedList = adaptRawPromotionList([rawPromo]);
      expect(adaptedList.data).toHaveLength(1);
    });

    it("adapts raw promotion package list", () => {
      const rawPackages = [
        {
          tier: "EXTRA_PREMIUM",
          durationDays: 14,
          priceCents: 300000,
          currency: "EGP",
          highlightedCard: true,
          homepageSlot: true,
          performanceStats: true,
          autoRenewEveryDays: 14,
          placements: ["HOMEPAGE", "SEARCH_TOP", "CATEGORY_HIGHLIGHT"],
        },
      ];

      const adapted = adaptRawPromotionPackageList(rawPackages);
      expect(adapted.data).toHaveLength(1);
      expect(adapted.data[0]?.tier).toBe("EXTRA_PREMIUM");
      expect(adapted.data[0]?.placements).toContain("SEARCH_TOP");
    });
  });

  // ── 3. Notifications & Web Push ───────────────────────────────────────────
  describe("Notifications & Web Push Domain", () => {
    it("validates NotificationItem with partial localized text and unicode", () => {
      const item = {
        publicId: "notif_01",
        type: "LEAD_RECEIVED",
        title: { ar: "تم استلام طلب تواصل", en: "New buyer inquiry" },
        body: { ar: "يرغب مشترٍ في التواصل بشأن السيارة" },
        data: { path: "/me/leads/lead_01", slug: "toyota-corolla" },
        readAt: null,
        createdAt: "2026-09-07T12:00:00.000Z",
      };

      const parsed = NotificationItemSchema.parse(item);
      expect(parsed.publicId).toBe("notif_01");
      expect(parsed.title.ar).toBe("تم استلام طلب تواصل");
      expect(parsed.body?.en).toBeUndefined();
    });

    it("adapts raw notification and strips internal IDs", () => {
      const raw = {
        id: 777,
        userId: 444,
        publicId: "notif_raw",
        type: "PRICE_DROP",
        title: { ar: "انخفاض في السعر" },
        body: null,
        data: { path: "/listing/toyota-corolla" },
        createdAt: "2026-09-07T12:00:00.000Z",
      };

      const adapted = adaptRawNotification(raw);
      expect(adapted.data.publicId).toBe("notif_raw");
      expect(adapted.data.data).toEqual({ path: "/listing/toyota-corolla" });
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.id).toBeUndefined();
      expect(rawAdapted.userId).toBeUndefined();
    });

    it("adapts raw notification list with wrapped cursor meta", () => {
      const raw = {
        data: [
          {
            id: 1,
            publicId: "notif_1",
            type: "INFO",
            title: "مرحباً بك",
            createdAt: "2026-09-07T12:00:00.000Z",
          },
        ],
        hasMore: false,
        nextCursor: null,
      };

      const adapted = adaptRawNotificationList(raw);
      expect(adapted.data).toHaveLength(1);
      expect(adapted.meta.hasMore).toBe(false);
      expect(adapted.meta.nextCursor).toBeNull();
    });

    it("validates device registration and strips token in output", () => {
      const regInput = {
        token: "fcm_token_very_long_valid_string_12345",
        platform: "WEB" as const,
        appVersion: "1.0.0",
        locale: "ar" as const,
      };
      expect(RegisterDeviceInputSchema.parse(regInput)).toBeDefined();

      const rawDevice = {
        id: 12,
        userId: 34,
        token: "fcm_token_private",
        publicId: "dev_01",
        platform: "WEB",
        appVersion: "1.0.0",
        locale: "ar",
        lastSeenAt: "2026-09-07T12:00:00.000Z",
        createdAt: "2026-09-07T12:00:00.000Z",
      };

      const adapted = adaptRawDeviceRegistration(rawDevice);
      expect(adapted.data.publicId).toBe("dev_01");
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.token).toBeUndefined();
      expect(rawAdapted.id).toBeUndefined();
    });

    it("enforces cross-field rules on WebPushSubscriptionInputSchema", () => {
      // Valid push subscription
      const validSub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/sub_id_123",
        keys: {
          p256dh: "BNcRdreALRF8M+NC000...",
          auth: "tBHItDaA...",
        },
      };
      expect(WebPushSubscriptionInputSchema.parse(validSub)).toBeDefined();

      // Insecure HTTP endpoint must fail
      expect(() =>
        WebPushSubscriptionInputSchema.parse({
          ...validSub,
          endpoint: "http://insecure.example.com/endpoint",
        }),
      ).toThrow(/HTTPS/i);

      // Missing p256dh key must fail
      expect(() =>
        WebPushSubscriptionInputSchema.parse({
          endpoint: "https://fcm.googleapis.com/endpoint",
          keys: {
            p256dh: "",
            auth: "valid_auth",
          },
        }),
      ).toThrow(/p256dh key is required/i);

      // Missing auth key must fail
      expect(() =>
        WebPushSubscriptionInputSchema.parse({
          endpoint: "https://fcm.googleapis.com/endpoint",
          keys: {
            p256dh: "valid_p256dh",
            auth: "",
          },
        }),
      ).toThrow(/auth key is required/i);
    });
  });

  // ── 4. Saved Searches & Suggestions ───────────────────────────────────────
  describe("Saved Searches & Suggestions Domain", () => {
    it("enforces cross-field rules on SavedSearchQuerySchema", () => {
      // Valid query
      expect(
        SavedSearchQuerySchema.parse({
          makeSlug: "toyota",
          modelSlug: "corolla",
          yearMin: 2020,
          yearMax: 2023,
          priceMin: 40000000,
          priceMax: 60000000,
          condition: "USED",
        }),
      ).toBeDefined();

      // modelSlug WITHOUT makeSlug must fail
      expect(() =>
        SavedSearchQuerySchema.parse({
          modelSlug: "corolla",
        }),
      ).toThrow(/modelSlug requires makeSlug/i);

      // yearMin > yearMax must fail
      expect(() =>
        SavedSearchQuerySchema.parse({
          yearMin: 2024,
          yearMax: 2020,
        }),
      ).toThrow(/invalid year range/i);

      // priceMin > priceMax must fail
      expect(() =>
        SavedSearchQuerySchema.parse({
          priceMin: 80000000,
          priceMax: 50000000,
        }),
      ).toThrow(/invalid price range/i);

      // Unknown keys rejected due to strict()
      expect(() =>
        SavedSearchQuerySchema.parse({
          makeSlug: "toyota",
          unknownField: true,
        }),
      ).toThrow();
    });

    it("enforces UpdateSavedSearchInputSchema requires at least one field", () => {
      expect(
        UpdateSavedSearchInputSchema.parse({ isActive: false }),
      ).toBeDefined();
      expect(
        UpdateSavedSearchInputSchema.parse({ name: "بحث جديد" }),
      ).toBeDefined();
      expect(() => UpdateSavedSearchInputSchema.parse({})).toThrow(
        /at least one update field/i,
      );
    });

    it("adapts raw saved search and handles stringified query", () => {
      const raw = {
        id: 99,
        userId: 88,
        publicId: "ss_01",
        name: "بحث سيارات كورولا",
        query: JSON.stringify({ makeSlug: "toyota", modelSlug: "corolla" }),
        isActive: true,
        notifyPush: true,
        notifyEmail: false,
        lastMatchedAt: null,
        createdAt: "2026-09-07T12:00:00.000Z",
      };

      const adapted = adaptRawSavedSearch(raw);
      expect(adapted.data.publicId).toBe("ss_01");
      expect(adapted.data.query.makeSlug).toBe("toyota");
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.id).toBeUndefined();
    });

    it("enforces VehicleSearchSuggestion cross-field rules", () => {
      // Valid MAKE without modelSlug
      expect(
        VehicleSearchSuggestionSchema.parse({
          type: "MAKE",
          label: "تويوتا",
          makeSlug: "toyota",
          modelSlug: null,
          comparisonRef: null,
        }),
      ).toBeDefined();

      // Valid MODEL with modelSlug
      expect(
        VehicleSearchSuggestionSchema.parse({
          type: "MODEL",
          label: "تويوتا كورولا",
          makeSlug: "toyota",
          modelSlug: "corolla",
          comparisonRef: null,
        }),
      ).toBeDefined();

      // MAKE with modelSlug must fail
      expect(() =>
        VehicleSearchSuggestionSchema.parse({
          type: "MAKE",
          label: "تويوتا",
          makeSlug: "toyota",
          modelSlug: "corolla",
          comparisonRef: null,
        }),
      ).toThrow(/MAKE must not carry modelSlug/i);

      // MODEL with null modelSlug must fail
      expect(() =>
        VehicleSearchSuggestionSchema.parse({
          type: "MODEL",
          label: "تويوتا كورولا",
          makeSlug: "toyota",
          modelSlug: null,
          comparisonRef: null,
        }),
      ).toThrow(/MODEL requires modelSlug/i);
    });

    it("adapts raw vehicle suggestions array", () => {
      const raw = [
        { type: "MAKE", label: "كيا", makeSlug: "kia", modelSlug: null },
        {
          type: "MODEL",
          label: "كيا سيراتو",
          makeSlug: "kia",
          modelSlug: "cerato",
        },
      ];
      const adapted = adaptRawVehicleSearchSuggestionList(raw);
      expect(adapted.data).toHaveLength(2);
      expect(adapted.data[1]?.modelSlug).toBe("cerato");
      expect(adapted.data[0]?.comparisonRef).toBeNull();
    });

    it("preserves and validates approved vehicle comparison references through the response contract", () => {
      const listingResponse = VehicleSearchSuggestionResponseSchema.parse({
        data: [
          {
            type: "MODEL",
            label: "Hyundai Elantra 2023 Smart",
            makeSlug: "hyundai",
            modelSlug: "elantra",
            comparisonRef: {
              kind: "listing",
              id: "hyundai-elantra-2023",
            },
          },
        ],
      });
      expect(listingResponse.data[0]?.comparisonRef).toEqual({
        kind: "listing",
        id: "hyundai-elantra-2023",
      });

      const trimSuggestion = adaptRawVehicleSearchSuggestionList([
        {
          type: "MODEL",
          label: "Toyota Corolla Prestige",
          makeSlug: "toyota",
          modelSlug: "corolla",
          trimPublicId: "trm_prestige_02",
        },
      ]);
      expect(trimSuggestion.data[0]?.comparisonRef).toEqual({
        kind: "trim",
        id: "trm_prestige_02",
      });
    });

    it("rejects malformed or ambiguous suggestion comparison references", () => {
      expect(() =>
        adaptRawVehicleSearchSuggestionList([
          {
            type: "MODEL",
            label: "Invalid listing",
            makeSlug: "toyota",
            modelSlug: "corolla",
            listingSlug: "INVALID LISTING SLUG",
          },
        ]),
      ).toThrow();

      expect(() =>
        adaptRawVehicleSearchSuggestionList([
          {
            type: "MODEL",
            label: "Ambiguous result",
            makeSlug: "toyota",
            modelSlug: "corolla",
            listingSlug: "toyota-corolla-2023",
            trimPublicId: "trm_prestige_02",
          },
        ]),
      ).toThrow(/at most one comparison reference/i);
    });
  });

  // ── 5. Uploads ────────────────────────────────────────────────────────────
  describe("Uploads Domain", () => {
    it("validates all 13 UploadPurpose enum values", () => {
      const purposes = [
        "USER_AVATAR",
        "LISTING_IMAGE",
        "LISTING_VIDEO",
        "VEHICLE_MAKE_LOGO",
        "TRIM_BROCHURE",
        "VENDOR_LOGO",
        "VENDOR_BANNER",
        "VENDOR_KYC",
        "VENDOR_BILLING_PROOF",
        "BANNER_IMAGE",
        "CHAT_ATTACHMENT",
        "EXPORT",
        "AI_STUDIO_SOURCE",
      ] as const;
      purposes.forEach((purpose) => {
        expect(UploadPurposeSchema.parse(purpose)).toBe(purpose);
        expect(UPLOAD_PURPOSE_CONFIG[purpose].maxSizeBytes).toBeGreaterThan(0);
      });
      expect(() => UploadPurposeSchema.parse("INVALID_PURPOSE")).toThrow();
    });

    it("validates file upload meta limits and mime allowlist", () => {
      // Valid avatar
      expect(
        validateUploadFileMeta("USER_AVATAR", "image/jpeg", 1024 * 1024).valid,
      ).toBe(true);
      // Avatar too large (>2MB)
      expect(
        validateUploadFileMeta("USER_AVATAR", "image/jpeg", 3 * 1024 * 1024)
          .valid,
      ).toBe(false);
      // Avatar disallowed mime (pdf)
      expect(
        validateUploadFileMeta("USER_AVATAR", "application/pdf", 1024).valid,
      ).toBe(false);

      // Valid listing video
      expect(
        validateUploadFileMeta("LISTING_VIDEO", "video/mp4", 50 * 1024 * 1024)
          .valid,
      ).toBe(true);
      // Video too large (>100MB)
      expect(
        validateUploadFileMeta("LISTING_VIDEO", "video/mp4", 101 * 1024 * 1024)
          .valid,
      ).toBe(false);
    });

    it("adapts raw uploaded file and rejects storage keys and internal IDs", () => {
      const raw = {
        id: 100,
        userId: 200,
        storageKey: "s3://private-bucket/uploads/file.jpg",
        s3Key: "uploads/file.jpg",
        bucket: "private-bucket",
        diskPath: "/var/uploads/file.jpg",
        path: "/uploads/file.jpg",
        publicId: "fil_01",
        url: "https://cdn.example.com/uploads/fil_01.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 543210,
        width: 1920,
        height: 1080,
        variants: { thumbnail: "https://cdn.example.com/uploads/thumb.jpg" },
        thumbnailUrl: "https://cdn.example.com/uploads/thumb.jpg",
        status: "READY",
      };

      const adapted = adaptRawUploadedFile(raw);
      expect(adapted.data.publicId).toBe("fil_01");
      expect(adapted.data.status).toBe("READY");
      // Storage keys and internal IDs must be stripped!
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.storageKey).toBeUndefined();
      expect(rawAdapted.s3Key).toBeUndefined();
      expect(rawAdapted.bucket).toBeUndefined();
      expect(rawAdapted.diskPath).toBeUndefined();
      expect(rawAdapted.id).toBeUndefined();
    });

    it("adapts file status response and rejects storage keys", () => {
      const raw = {
        id: 101,
        storageKey: "internal_key",
        publicId: "fil_status_1",
        status: "PROCESSING",
        mimeType: "video/mp4",
        width: null,
        height: null,
        url: null,
        thumbnailUrl: null,
      };

      const adapted = adaptRawFileStatus(raw);
      expect(adapted.publicId).toBe("fil_status_1");
      expect(adapted.status).toBe("PROCESSING");
      const rawAdapted = adapted as unknown as Record<string, unknown>;
      expect(rawAdapted.storageKey).toBeUndefined();
      expect(rawAdapted.id).toBeUndefined();
    });
  });

  // ── 6. Dashboard ──────────────────────────────────────────────────────────
  describe("Dashboard Domain", () => {
    it("validates DashboardRange enum and helper", () => {
      expect(DashboardRangeSchema.parse("7d")).toBe("7d");
      expect(DashboardRangeSchema.parse("30d")).toBe("30d");
      expect(DashboardRangeSchema.parse("90d")).toBe("90d");
      expect(() => DashboardRangeSchema.parse("14d")).toThrow();

      expect(dashboardRangeToDays("7d")).toBe(7);
      expect(dashboardRangeToDays("30d")).toBe(30);
      expect(dashboardRangeToDays("90d")).toBe(90);
    });

    it("enforces totalLeads >= sum(leadsByChannel) on DashboardSummary", () => {
      // Valid summary
      expect(
        DashboardSummarySchema.parse({
          activeListingsCount: 15,
          totalViews: 12000,
          totalLeads: 50,
          leadsByChannel: {
            CALL_REVEAL: 30,
            WHATSAPP: 20,
          },
          totalFavorites: 45,
          responseRatePercentage: 92,
        }),
      ).toBeDefined();

      // Total leads less than channel sum must fail
      expect(() =>
        DashboardSummarySchema.parse({
          activeListingsCount: 15,
          totalViews: 12000,
          totalLeads: 25, // Less than 30 + 20 = 50
          leadsByChannel: {
            CALL_REVEAL: 30,
            WHATSAPP: 20,
          },
          totalFavorites: 45,
          responseRatePercentage: 92,
        }),
      ).toThrow(/totalLeads cannot be less than the sum of leads by channel/i);
    });

    it("validates responseRatePercentage supports decimals (0..100) and rejects invalid bounds", () => {
      const baseSummary = {
        activeListingsCount: 10,
        totalViews: 1000,
        totalLeads: 10,
        leadsByChannel: { CALL_REVEAL: 5, WHATSAPP: 5 },
        totalFavorites: 8,
      };

      // Exact decimal preservation
      expect(
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: 88.5,
        }).responseRatePercentage,
      ).toBe(88.5);

      expect(
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: 0.25,
        }).responseRatePercentage,
      ).toBe(0.25);

      expect(
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: 99.99,
        }).responseRatePercentage,
      ).toBe(99.99);

      // Boundaries 0 and 100
      expect(
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: 0,
        }).responseRatePercentage,
      ).toBe(0);

      expect(
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: 100,
        }).responseRatePercentage,
      ).toBe(100);

      // Negative value rejected
      expect(() =>
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: -0.1,
        }),
      ).toThrow();

      // Value exceeding 100 rejected
      expect(() =>
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: 100.01,
        }),
      ).toThrow();

      // Non-number rejected
      expect(() =>
        DashboardSummarySchema.parse({
          ...baseSummary,
          responseRatePercentage: "88.5" as unknown as number,
        }),
      ).toThrow();
    });

    it("adapts raw dashboard overview response and strips vendor numeric ID", () => {
      const raw = {
        id: 12,
        vendorId: 345,
        window: {
          days: 30,
          startAt: "2026-08-08T00:00:00.000Z",
        },
        summary: {
          activeListingsCount: 10,
          totalViews: 5000,
          totalLeads: 20,
          leadsByChannel: { CALL_REVEAL: 15, WHATSAPP: 5 },
          totalFavorites: 30,
          responseRatePercentage: 88.5,
        },
      };

      const adapted = adaptRawDashboardOverview(raw);
      expect(adapted.data.window.days).toBe(30);
      expect(adapted.data.summary.responseRatePercentage).toBe(88.5);
      const rawAdapted = adapted.data as unknown as Record<string, unknown>;
      expect(rawAdapted.vendorId).toBeUndefined();
      expect(rawAdapted.id).toBeUndefined();
    });
  });

  // ── 7. Sell & Listing Mutations ───────────────────────────────────────────
  describe("Sell & Listing Mutations Domain", () => {
    const validListingInput = {
      makePublicId: "mak_toyota",
      modelPublicId: "mod_camry",
      year: 2023,
      mileageKm: 25000,
      condition: "USED" as const,
      conditionGrade: "EXCELLENT" as const,
      priceCents: 75000000,
      fuelType: "PETROL" as const,
      transmission: "AUTOMATIC" as const,
      bodyType: "SEDAN" as const,
      cityId: 1,
      contactPhone: "+201012345678",
      imageFilePublicIds: ["fil_img_1", "fil_img_2"],
      coverImagePublicId: "fil_img_1",
    };

    it("validates CreateListingInput with cross-field rules", () => {
      expect(CreateListingInputSchema.parse(validListingInput)).toBeDefined();

      // Condition NEW cannot have conditionGrade
      expect(() =>
        CreateListingInputSchema.parse({
          ...validListingInput,
          condition: "NEW",
          conditionGrade: "EXCELLENT",
        }),
      ).toThrow(/New cars cannot have a used-condition grade/i);

      // Cover image must be in imageFilePublicIds
      expect(() =>
        CreateListingInputSchema.parse({
          ...validListingInput,
          coverImagePublicId: "fil_not_in_list",
        }),
      ).toThrow(/Cover image must be in imageFilePublicIds/i);

      // Duplicate images rejected
      expect(() =>
        CreateListingInputSchema.parse({
          ...validListingInput,
          imageFilePublicIds: ["fil_img_1", "fil_img_1"],
        }),
      ).toThrow(/Image IDs must be unique/i);

      // Contact requirement: no phone, no whatsapp, no chat
      expect(() =>
        CreateListingInputSchema.parse({
          ...validListingInput,
          contactPhone: null,
          whatsappPhone: null,
          allowChat: false,
        }),
      ).toThrow(/At least one contact method must be provided/i);
    });

    it("validates UpdateListingInputSchema is partial and non-empty", () => {
      expect(
        UpdateListingInputSchema.parse({
          priceCents: 70000000,
          isNegotiable: true,
        }),
      ).toBeDefined();

      expect(() => UpdateListingInputSchema.parse({})).toThrow(
        /At least one listing field is required/i,
      );
    });

    it("enforces TransitionListingInputSchema rejectionReason rules", () => {
      // Reject requires rejectionReason
      expect(
        TransitionListingInputSchema.parse({
          action: "reject",
          rejectionReason: "صور السيارة غير واضحة",
        }),
      ).toBeDefined();

      expect(() =>
        TransitionListingInputSchema.parse({
          action: "reject",
        }),
      ).toThrow(/Rejection reason is required/i);

      // Other actions must NOT carry rejectionReason
      expect(() =>
        TransitionListingInputSchema.parse({
          action: "approve",
          rejectionReason: "سبب غير مبرر",
        }),
      ).toThrow(/only valid for reject/i);
    });

    it("validates UpdatePriceInputSchema enforces positive money cents", () => {
      expect(UpdatePriceInputSchema.parse({ priceCents: 50000 })).toBeDefined();
      expect(() => UpdatePriceInputSchema.parse({ priceCents: 0 })).toThrow();
      expect(() =>
        UpdatePriceInputSchema.parse({ priceCents: -100 }),
      ).toThrow();
    });

    it("validates SellListingDraftSchema and SellWizardStateSchema", () => {
      const draft = {
        condition: "USED" as const,
        makePublicId: "mak_honda",
        modelPublicId: "mod_civic",
        generationPublicId: null,
        trimPublicId: null,
        year: 2022,
        mileageKm: 30000,
        fuelType: "PETROL" as const,
        transmission: "CVT" as const,
        bodyType: "SEDAN" as const,
        engineCc: 1600,
        colorExterior: "Silver",
        colorInterior: "Black",
        features: ["Sunroof", "Leather Seats"],
        description: "هوندا سيفيك بحالة الوكالة",
        priceCents: 65000000,
        isNegotiable: true,
        installmentAvailable: false,
        exchangeAccepted: false,
        hasWarranty: true,
        hasServiceHistory: true,
        cityId: 1,
        areaId: 2,
        contactPhone: "+201098765432",
        whatsappPhone: "+201098765432",
        allowChat: true,
      };

      expect(SellListingDraftSchema.parse(draft)).toBeDefined();

      const wizardState = {
        currentStep: "photos" as const,
        draft,
        photos: [
          {
            clientId: "client_p1",
            localPreviewUrl: "blob:http://localhost/uuid-1",
            publicId: "fil_p1",
            url: "https://cdn.example.com/p1.jpg",
            status: "READY" as const,
            progress: 1,
          },
        ],
        coverPhotoClientId: "client_p1",
        isSubmitting: false,
        errorCode: null,
        errorMessage: null,
        createdListing: null,
        isSuccess: false,
      };

      expect(SellWizardStateSchema.parse(wizardState)).toBeDefined();

      // coverPhotoClientId not matching photos must fail
      expect(() =>
        SellWizardStateSchema.parse({
          ...wizardState,
          coverPhotoClientId: "non_existent_client_id",
        }),
      ).toThrow(/coverPhotoClientId must match an existing photo clientId/i);
    });

    it("projects SellListingDraft and photos to CreateListingInput, stripping clientIds and localPreviewUrls", () => {
      const draft = {
        condition: "USED" as const,
        makePublicId: "mak_honda",
        modelPublicId: "mod_civic",
        generationPublicId: "gen_10",
        trimPublicId: null,
        year: 2022,
        mileageKm: 30000,
        fuelType: "PETROL" as const,
        transmission: "CVT" as const,
        bodyType: "SEDAN" as const,
        engineCc: 1600,
        colorExterior: "Silver",
        colorInterior: "Black",
        features: ["Sunroof"],
        description: "هوندا سيفيك",
        priceCents: 65000000,
        isNegotiable: true,
        installmentAvailable: false,
        exchangeAccepted: false,
        hasWarranty: true,
        hasServiceHistory: true,
        cityId: 1,
        areaId: 2,
        contactPhone: "+201098765432",
        whatsappPhone: null,
        allowChat: true,
      };

      const photos = [
        {
          clientId: "photo_client_1",
          localPreviewUrl: "blob:http://localhost/uuid-blob-1",
          publicId: "fil_ready_1",
          url: "https://cdn.example.com/ready1.jpg",
          status: "READY" as const,
          progress: 1,
        },
        {
          clientId: "photo_client_2",
          localPreviewUrl: "blob:http://localhost/uuid-blob-2",
          publicId: "fil_ready_2",
          url: "https://cdn.example.com/ready2.jpg",
          status: "READY" as const,
          progress: 1,
        },
        {
          clientId: "photo_client_3",
          localPreviewUrl: "blob:http://localhost/uuid-blob-3",
          publicId: null,
          url: null,
          status: "UPLOADING" as const,
          progress: 0.5,
        },
      ];

      const projected = projectDraftToCreateInput(
        draft,
        photos,
        "photo_client_2",
      );
      expect(projected.makePublicId).toBe("mak_honda");
      expect(projected.coverImagePublicId).toBe("fil_ready_2");
      expect(projected.imageFilePublicIds).toEqual([
        "fil_ready_1",
        "fil_ready_2",
      ]);
      // Verify no client-only fields leaked
      const rawProjected = projected as unknown as Record<string, unknown>;
      expect(rawProjected.clientId).toBeUndefined();
      expect(rawProjected.localPreviewUrl).toBeUndefined();
    });
  });

  // ── 8. Strict Typed-Mismatch Regressions (No Silent Defaulting or Coercion) ──
  describe("Strict Typed-Mismatch Regressions (No Silent Defaulting or Coercion)", () => {
    describe("Offer Adapter Family", () => {
      it("adaptRawOfferList throws on missing page or limit instead of fabricating defaults", () => {
        const validItem = {
          publicId: "ofr_1",
          offerCents: 100000,
          currency: "EGP",
          status: "PENDING",
          expiresAt: "2026-09-14T12:00:00.000Z",
          createdAt: "2026-09-07T12:00:00.000Z",
          listing: {
            publicId: "lst_1",
            slug: "car",
            title: "Car",
            priceCents: 120000,
          },
          buyer: { publicId: "usr_1" },
        };

        // Missing page
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
            limit: 20,
          }),
        ).toThrow();

        // Missing limit
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
            page: 1,
          }),
        ).toThrow();

        // Missing both
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
          }),
        ).toThrow();
      });

      it("adaptRawOfferList rejects wrong primitive types and out-of-range bounds for page and limit", () => {
        const validItem = {
          publicId: "ofr_1",
          offerCents: 100000,
          currency: "EGP",
          status: "PENDING",
          expiresAt: "2026-09-14T12:00:00.000Z",
          createdAt: "2026-09-07T12:00:00.000Z",
          listing: {
            publicId: "lst_1",
            slug: "car",
            title: "Car",
            priceCents: 120000,
          },
          buyer: { publicId: "usr_1" },
        };

        // String page instead of number
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
            page: "1",
            limit: 20,
          }),
        ).toThrow();

        // String limit instead of number
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
            page: 1,
            limit: "20",
          }),
        ).toThrow();

        // Non-positive page (0)
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
            page: 0,
            limit: 20,
          }),
        ).toThrow();

        // Limit exceeding maximum allowed (50)
        expect(() =>
          adaptRawOfferList({
            data: [validItem],
            page: 1,
            limit: 51,
          }),
        ).toThrow();
      });

      it("adaptRawOffer throws when listing, buyer, or offerCents have wrong primitive types", () => {
        const validOffer = {
          publicId: "ofr_1",
          offerCents: 100000,
          currency: "EGP",
          status: "PENDING",
          expiresAt: "2026-09-14T12:00:00.000Z",
          createdAt: "2026-09-07T12:00:00.000Z",
          listing: {
            publicId: "lst_1",
            slug: "car",
            title: "Car",
            priceCents: 120000,
          },
          buyer: { publicId: "usr_1" },
        };

        // listing is a string instead of object
        expect(() =>
          adaptRawOffer({ ...validOffer, listing: "invalid_string" }),
        ).toThrow();
        // buyer is a number instead of object
        expect(() => adaptRawOffer({ ...validOffer, buyer: 12345 })).toThrow();
        // offerCents is a string instead of positive integer
        expect(() =>
          adaptRawOffer({ ...validOffer, offerCents: "100000" }),
        ).toThrow();
      });
    });

    describe("Lead & Promotion Adapter Family", () => {
      const validLead = {
        publicId: "led_1",
        channel: "WHATSAPP",
        status: "NEW",
        buyerName: "Buyer",
        buyerPhone: "+201012345678",
        note: null,
        eventsCount: 3,
        lastActivityAt: "2026-09-07T12:00:00.000Z",
        createdAt: "2026-09-07T12:00:00.000Z",
        listing: { publicId: "lst_1", slug: "car", title: "Car" },
        buyer: { publicId: "usr_b1" },
        seller: { publicId: "usr_s1" },
      };

      it("adaptRawLead throws when eventsCount is missing, non-integer, or negative instead of defaulting to 0", () => {
        // Missing eventsCount
        const missingEventsCount = { ...validLead };
        delete (missingEventsCount as Record<string, unknown>).eventsCount;
        expect(() => adaptRawLead(missingEventsCount)).toThrow();

        // String eventsCount
        expect(() =>
          adaptRawLead({ ...validLead, eventsCount: "3" }),
        ).toThrow();

        // Negative eventsCount
        expect(() => adaptRawLead({ ...validLead, eventsCount: -1 })).toThrow();

        // Float eventsCount
        expect(() =>
          adaptRawLead({ ...validLead, eventsCount: 3.5 }),
        ).toThrow();
      });

      it("adaptRawLead throws when listing or buyer is a wrong primitive type", () => {
        // listing is a number
        expect(() => adaptRawLead({ ...validLead, listing: 999 })).toThrow();
        // buyer is a string
        expect(() =>
          adaptRawLead({ ...validLead, buyer: "not_an_object" }),
        ).toThrow();
      });

      it("adaptRawLeadList throws when meta hasMore is missing, string, or non-boolean instead of Boolean-coercing", () => {
        // Missing hasMore in meta object
        expect(() =>
          adaptRawLeadList({
            data: [validLead],
            meta: { nextCursor: null },
          }),
        ).toThrow();

        // String hasMore in meta object
        expect(() =>
          adaptRawLeadList({
            data: [validLead],
            meta: { hasMore: "true", nextCursor: null },
          }),
        ).toThrow();

        // Number hasMore in meta object
        expect(() =>
          adaptRawLeadList({
            data: [validLead],
            meta: { hasMore: 1, nextCursor: null },
          }),
        ).toThrow();

        // Missing hasMore in flat format
        expect(() =>
          adaptRawLeadList({
            data: [validLead],
            nextCursor: null,
          }),
        ).toThrow();

        // String hasMore in flat format
        expect(() =>
          adaptRawLeadList({
            data: [validLead],
            hasMore: "false",
          }),
        ).toThrow();
      });

      it("adaptRawListingPromotion throws when perks boolean flags are missing or non-boolean instead of Boolean-coercing", () => {
        const validPromotion = {
          publicId: "prm_1",
          tier: "FEATURED",
          type: "HOMEPAGE_FEATURED",
          status: "ACTIVE",
          durationDays: 7,
          priceCents: 50000,
          currency: "EGP",
          createdAt: "2026-09-07T12:00:00.000Z",
          perks: {
            highlightedCard: true,
            homepageSlot: true,
            performanceStats: true,
            autoRenewEveryDays: null,
          },
        };

        // String boolean for highlightedCard
        expect(() =>
          adaptRawListingPromotion({
            ...validPromotion,
            perks: {
              ...validPromotion.perks,
              highlightedCard: "true",
            },
          }),
        ).toThrow();

        // Number for homepageSlot
        expect(() =>
          adaptRawListingPromotion({
            ...validPromotion,
            perks: {
              ...validPromotion.perks,
              homepageSlot: 0,
            },
          }),
        ).toThrow();

        // Missing performanceStats flag
        expect(() =>
          adaptRawListingPromotion({
            ...validPromotion,
            perks: {
              highlightedCard: true,
              homepageSlot: true,
              autoRenewEveryDays: null,
            },
          }),
        ).toThrow();
      });
    });

    describe("Saved Searches Adapter Family", () => {
      const validSavedSearch = {
        publicId: "ss_1",
        name: "My Search",
        query: { makeSlug: "toyota" },
        isActive: true,
        notifyPush: true,
        notifyEmail: false,
        lastMatchedAt: null,
        createdAt: "2026-09-07T12:00:00.000Z",
      };

      it("adaptRawSavedSearch throws on malformed stringified query JSON instead of swallowing as {}", () => {
        expect(() =>
          adaptRawSavedSearch({
            ...validSavedSearch,
            query: "{not-valid-json",
          }),
        ).toThrow();

        expect(() =>
          adaptRawSavedSearch({
            ...validSavedSearch,
            query: '{"makeSlug": }',
          }),
        ).toThrow();
      });

      it("adaptRawSavedSearch throws on missing or non-boolean isActive/notify flags instead of defaulting", () => {
        // Missing isActive
        const missingIsActive = { ...validSavedSearch };
        delete (missingIsActive as Record<string, unknown>).isActive;
        expect(() => adaptRawSavedSearch(missingIsActive)).toThrow();

        // String isActive
        expect(() =>
          adaptRawSavedSearch({
            ...validSavedSearch,
            isActive: "true",
          }),
        ).toThrow();

        // Missing notifyPush
        const missingNotifyPush = { ...validSavedSearch };
        delete (missingNotifyPush as Record<string, unknown>).notifyPush;
        expect(() => adaptRawSavedSearch(missingNotifyPush)).toThrow();

        // Number notifyPush
        expect(() =>
          adaptRawSavedSearch({
            ...validSavedSearch,
            notifyPush: 1,
          }),
        ).toThrow();

        // Missing notifyEmail
        const missingNotifyEmail = { ...validSavedSearch };
        delete (missingNotifyEmail as Record<string, unknown>).notifyEmail;
        expect(() => adaptRawSavedSearch(missingNotifyEmail)).toThrow();

        // String notifyEmail
        expect(() =>
          adaptRawSavedSearch({
            ...validSavedSearch,
            notifyEmail: "false",
          }),
        ).toThrow();
      });
    });

    describe("Notification Adapter Family", () => {
      const validNotification = {
        publicId: "notif_1",
        type: "OFFER_RECEIVED",
        title: { ar: "عنوان", en: "Title" },
        body: null,
        data: null,
        readAt: null,
        createdAt: "2026-09-07T12:00:00.000Z",
      };

      it("adaptRawNotificationList throws when meta hasMore is missing or non-boolean instead of Boolean-coercing", () => {
        // Missing hasMore in meta object
        expect(() =>
          adaptRawNotificationList({
            data: [validNotification],
            meta: { nextCursor: null },
          }),
        ).toThrow();

        // String hasMore in meta object
        expect(() =>
          adaptRawNotificationList({
            data: [validNotification],
            meta: { hasMore: "true", nextCursor: null },
          }),
        ).toThrow();

        // Number hasMore in flat format
        expect(() =>
          adaptRawNotificationList({
            data: [validNotification],
            hasMore: 1,
          }),
        ).toThrow();

        // Missing hasMore entirely
        expect(() =>
          adaptRawNotificationList({
            data: [validNotification],
          }),
        ).toThrow();
      });

      it("adaptRawNotification throws on missing or invalid primitive title instead of silent fallback", () => {
        // Missing title
        const missingTitle = { ...validNotification };
        delete (missingTitle as Record<string, unknown>).title;
        expect(() => adaptRawNotification(missingTitle)).toThrow();

        // Number title
        expect(() =>
          adaptRawNotification({
            ...validNotification,
            title: 12345,
          }),
        ).toThrow();

        // Boolean title
        expect(() =>
          adaptRawNotification({
            ...validNotification,
            title: false,
          }),
        ).toThrow();
      });
    });

    describe("Dashboard Adapter Family", () => {
      const validOverview = {
        window: {
          days: 30,
          startAt: "2026-08-08T00:00:00.000Z",
        },
        summary: {
          activeListingsCount: 5,
          totalViews: 1000,
          totalLeads: 10,
          leadsByChannel: { CALL_REVEAL: 6, WHATSAPP: 4 },
          totalFavorites: 8,
          responseRatePercentage: 90,
        },
      };

      it("adaptRawDashboardOverview throws when window.days is missing, string, or out-of-range instead of defaulting to 30", () => {
        // Missing days
        expect(() =>
          adaptRawDashboardOverview({
            window: { startAt: "2026-08-08T00:00:00.000Z" },
            summary: validOverview.summary,
          }),
        ).toThrow();

        // String days
        expect(() =>
          adaptRawDashboardOverview({
            window: { days: "30", startAt: "2026-08-08T00:00:00.000Z" },
            summary: validOverview.summary,
          }),
        ).toThrow();

        // Zero days
        expect(() =>
          adaptRawDashboardOverview({
            window: { days: 0, startAt: "2026-08-08T00:00:00.000Z" },
            summary: validOverview.summary,
          }),
        ).toThrow();

        // Negative days
        expect(() =>
          adaptRawDashboardOverview({
            window: { days: -5, startAt: "2026-08-08T00:00:00.000Z" },
            summary: validOverview.summary,
          }),
        ).toThrow();
      });

      it("adaptRawDashboardOverview throws when required summary metrics are missing or wrong types instead of defaulting to 0", () => {
        // Missing totalViews
        const missingViews = { ...validOverview.summary };
        delete (missingViews as Record<string, unknown>).totalViews;
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: missingViews,
          }),
        ).toThrow();

        // Missing totalLeads
        const missingLeads = { ...validOverview.summary };
        delete (missingLeads as Record<string, unknown>).totalLeads;
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: missingLeads,
          }),
        ).toThrow();

        // Missing activeListingsCount
        const missingListings = { ...validOverview.summary };
        delete (missingListings as Record<string, unknown>).activeListingsCount;
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: missingListings,
          }),
        ).toThrow();

        // Missing leadsByChannel
        const missingChannels = { ...validOverview.summary };
        delete (missingChannels as Record<string, unknown>).leadsByChannel;
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: missingChannels,
          }),
        ).toThrow();

        // String metric instead of number
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: {
              ...validOverview.summary,
              totalViews: "1000",
            },
          }),
        ).toThrow();

        // Negative metric count
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: {
              ...validOverview.summary,
              totalViews: -1,
            },
          }),
        ).toThrow();
      });

      it("adaptRawDashboardOverview preserves exact decimal responseRatePercentage without rounding and rejects invalid bounds", () => {
        // Decimal value preservation without rounding
        const adaptedDecimal = adaptRawDashboardOverview({
          window: validOverview.window,
          summary: {
            ...validOverview.summary,
            responseRatePercentage: 88.5,
          },
        });
        expect(adaptedDecimal.data.summary.responseRatePercentage).toBe(88.5);

        const adaptedFineGrain = adaptRawDashboardOverview({
          window: validOverview.window,
          summary: {
            ...validOverview.summary,
            responseRatePercentage: 73.25,
          },
        });
        expect(adaptedFineGrain.data.summary.responseRatePercentage).toBe(
          73.25,
        );

        // Invalid lower bound (< 0)
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: {
              ...validOverview.summary,
              responseRatePercentage: -0.01,
            },
          }),
        ).toThrow();

        // Invalid upper bound (> 100)
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: {
              ...validOverview.summary,
              responseRatePercentage: 100.1,
            },
          }),
        ).toThrow();

        // String type rejected
        expect(() =>
          adaptRawDashboardOverview({
            window: validOverview.window,
            summary: {
              ...validOverview.summary,
              responseRatePercentage: "88.5",
            },
          }),
        ).toThrow();
      });
    });

    describe("Upload Adapter Family", () => {
      const validFile = {
        publicId: "fil_1",
        url: "https://cdn.example.com/fil_1.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 102400,
        width: 1920,
        height: 1080,
        variants: null,
        thumbnailUrl: null,
        status: "READY",
      };

      it("adaptRawUploadedFile throws when width or height is a string or negative number instead of coercing to null", () => {
        // String width
        expect(() =>
          adaptRawUploadedFile({ ...validFile, width: "1920" }),
        ).toThrow();

        // Negative width
        expect(() =>
          adaptRawUploadedFile({ ...validFile, width: -10 }),
        ).toThrow();

        // String height
        expect(() =>
          adaptRawUploadedFile({ ...validFile, height: "1080" }),
        ).toThrow();

        // Zero height
        expect(() =>
          adaptRawUploadedFile({ ...validFile, height: 0 }),
        ).toThrow();
      });

      it("adaptRawUploadedFileList validates array of files and rejects invalid entries", () => {
        const result = adaptRawUploadedFileList([validFile]);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.publicId).toBe("fil_1");
        expect(() =>
          adaptRawUploadedFileList([{ ...validFile, width: "invalid" }]),
        ).toThrow();
      });

      it("adaptRawFileStatus throws when width or height is a string instead of coercing to null", () => {
        const validStatus = {
          publicId: "fil_status_1",
          status: "READY",
          mimeType: "image/jpeg",
          width: 800,
          height: 600,
          url: "https://cdn.example.com/status.jpg",
          thumbnailUrl: null,
        };

        // String width
        expect(() =>
          adaptRawFileStatus({ ...validStatus, width: "800" }),
        ).toThrow();

        // String height
        expect(() =>
          adaptRawFileStatus({ ...validStatus, height: "600" }),
        ).toThrow();
      });
    });
  });
});
