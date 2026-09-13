import { z } from "zod";
import type {
  CreateSavedSearchInput,
  SavedSearch,
  SavedSearchListResponse,
  SavedSearchPublicIdParams,
  SavedSearchQuery,
  SavedSearchResponse,
  UpdateSavedSearchInput,
  VehicleSearchSuggestion,
  VehicleSearchSuggestionParams,
  VehicleSearchSuggestionResponse,
} from "@/types/saved-search";
import {
  IsoDateTimeSchema,
  LocaleSchema,
  MoneyCentsSchema,
  PublicIdSchema,
  SlugSchema,
} from "./common";
import {
  BodyTypeSchema,
  CarConditionSchema,
  FuelTypeSchema,
  SellerTypeSchema,
  TransmissionSchema,
} from "./listing";
import { CompareItemRefSchema } from "./compare";
import { unwrapDataArray, unwrapDataObject } from "./taxonomy";

// ── Query & Entity Schemas ──────────────────────────────────────────────────

export const SavedSearchQuerySchema: z.ZodType<SavedSearchQuery> = z
  .object({
    makeSlug: SlugSchema.optional(),
    modelSlug: SlugSchema.optional(),
    yearMin: z.number().int().min(1900).max(2100).optional(),
    yearMax: z.number().int().min(1900).max(2100).optional(),
    priceMin: MoneyCentsSchema.optional(),
    priceMax: MoneyCentsSchema.optional(),
    mileageMax: z.number().int().nonnegative().optional(),
    cityId: z.number().int().positive().optional(),
    areaId: z.number().int().positive().optional(),
    condition: CarConditionSchema.optional(),
    fuelType: FuelTypeSchema.optional(),
    transmission: TransmissionSchema.optional(),
    bodyType: BodyTypeSchema.optional(),
    sellerType: SellerTypeSchema.optional(),
    hasWarranty: z.boolean().optional(),
    isNegotiable: z.boolean().optional(),
    installmentAvailable: z.boolean().optional(),
    exchangeAccepted: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.modelSlug && !value.makeSlug) {
      context.addIssue({
        code: "custom",
        path: ["modelSlug"],
        message: "modelSlug requires makeSlug",
      });
    }
    if (
      value.yearMin !== undefined &&
      value.yearMax !== undefined &&
      value.yearMin > value.yearMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["yearMax"],
        message: "Invalid year range",
      });
    }
    if (
      value.priceMin !== undefined &&
      value.priceMax !== undefined &&
      value.priceMin > value.priceMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["priceMax"],
        message: "Invalid price range",
      });
    }
  });

export const SavedSearchSchema: z.ZodType<SavedSearch> = z.object({
  publicId: PublicIdSchema,
  name: z.string().max(100).nullable(),
  query: SavedSearchQuerySchema,
  isActive: z.boolean(),
  notifyPush: z.boolean(),
  notifyEmail: z.boolean(),
  lastMatchedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});

export const SavedSearchListResponseSchema: z.ZodType<SavedSearchListResponse> =
  z.object({
    data: z.array(SavedSearchSchema),
  });

export const SavedSearchResponseSchema: z.ZodType<SavedSearchResponse> =
  z.object({
    data: SavedSearchSchema,
  });

// ── Inputs & Params ─────────────────────────────────────────────────────────

export const CreateSavedSearchInputSchema: z.ZodType<CreateSavedSearchInput> =
  z.object({
    name: z.string().trim().min(1).max(100).nullable(),
    query: SavedSearchQuerySchema,
    notifyPush: z.boolean(),
    notifyEmail: z.boolean(),
  });

export const UpdateSavedSearchInputSchema: z.ZodType<UpdateSavedSearchInput> = z
  .object({
    name: z.string().trim().min(1).max(100).nullable().optional(),
    isActive: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one update field is required",
  );

export const SavedSearchPublicIdParamsSchema: z.ZodType<SavedSearchPublicIdParams> =
  z.object({
    publicId: PublicIdSchema,
  });

// ── Search Suggestions ──────────────────────────────────────────────────────

export const VehicleSearchSuggestionSchema: z.ZodType<VehicleSearchSuggestion> =
  z
    .object({
      type: z.enum(["MAKE", "MODEL"]),
      label: z.string().min(1),
      makeSlug: SlugSchema,
      modelSlug: SlugSchema.nullable(),
      comparisonRef: CompareItemRefSchema.nullable(),
    })
    .superRefine((value, context) => {
      if (value.type === "MODEL" && value.modelSlug === null) {
        context.addIssue({
          code: "custom",
          path: ["modelSlug"],
          message: "MODEL requires modelSlug",
        });
      }
      if (value.type === "MAKE" && value.modelSlug !== null) {
        context.addIssue({
          code: "custom",
          path: ["modelSlug"],
          message: "MAKE must not carry modelSlug",
        });
      }
    });

export const VehicleSearchSuggestionParamsSchema: z.ZodType<VehicleSearchSuggestionParams> =
  z.object({
    q: z.string().trim().min(2).max(80),
    locale: LocaleSchema,
    condition: CarConditionSchema.optional(),
    limit: z.union([z.literal(5), z.literal(8), z.literal(12)]).optional(),
  });

export const VehicleSearchSuggestionResponseSchema: z.ZodType<VehicleSearchSuggestionResponse> =
  z.object({
    data: z.array(VehicleSearchSuggestionSchema).max(12),
  });

// ── Adapters ─────────────────────────────────────────────────────────────────

function cleanRawSavedSearch(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  let query: unknown = raw.query;
  if (typeof query === "string") {
    try {
      query = JSON.parse(query);
    } catch {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["query"],
          message: "Invalid JSON in stringified query",
        },
      ]);
    }
  }

  return {
    publicId: raw.publicId,
    name: raw.name === undefined ? null : raw.name,
    query: query,
    isActive: raw.isActive,
    notifyPush: raw.notifyPush,
    notifyEmail: raw.notifyEmail,
    lastMatchedAt: raw.lastMatchedAt === undefined ? null : raw.lastMatchedAt,
    createdAt: raw.createdAt,
  };
}

export function adaptRawSavedSearch(input: unknown): SavedSearchResponse {
  const obj = unwrapDataObject(input);
  const target =
    "data" in obj &&
    typeof obj.data === "object" &&
    obj.data !== null &&
    !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : obj;
  const cleaned = cleanRawSavedSearch(target);
  const data = SavedSearchSchema.parse(cleaned);
  return { data };
}

export function adaptRawSavedSearchList(
  input: unknown,
): SavedSearchListResponse {
  const list = unwrapDataArray(input);
  const data = list.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["data", index],
          message: "Expected saved search item to be an object",
        },
      ]);
    }
    const cleaned = cleanRawSavedSearch(item as Record<string, unknown>);
    return SavedSearchSchema.parse(cleaned);
  });
  return SavedSearchListResponseSchema.parse({ data });
}

export function adaptRawVehicleSearchSuggestionList(
  input: unknown,
): VehicleSearchSuggestionResponse {
  const list = unwrapDataArray(input);
  const data = list.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["data", index],
          message: "Expected suggestion item to be an object",
        },
      ]);
    }
    const raw = item as Record<string, unknown>;
    const explicitComparisonRef = raw.comparisonRef;
    const hasExplicitComparisonRef =
      explicitComparisonRef !== undefined && explicitComparisonRef !== null;
    const hasListingSlug =
      raw.listingSlug !== undefined && raw.listingSlug !== null;
    const hasTrimPublicId =
      raw.trimPublicId !== undefined && raw.trimPublicId !== null;

    if (
      Number(hasExplicitComparisonRef) +
        Number(hasListingSlug) +
        Number(hasTrimPublicId) >
      1
    ) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["data", index, "comparisonRef"],
          message: "Suggestion must carry at most one comparison reference",
        },
      ]);
    }

    const comparisonRef = hasExplicitComparisonRef
      ? CompareItemRefSchema.parse(explicitComparisonRef)
      : hasListingSlug
        ? CompareItemRefSchema.parse({ kind: "listing", id: raw.listingSlug })
        : hasTrimPublicId
          ? CompareItemRefSchema.parse({ kind: "trim", id: raw.trimPublicId })
          : null;

    const cleaned = {
      type: raw.type,
      label: raw.label,
      makeSlug: raw.makeSlug,
      modelSlug: raw.modelSlug === undefined ? null : raw.modelSlug,
      comparisonRef,
    };
    return VehicleSearchSuggestionSchema.parse(cleaned);
  });
  return VehicleSearchSuggestionResponseSchema.parse({ data });
}
