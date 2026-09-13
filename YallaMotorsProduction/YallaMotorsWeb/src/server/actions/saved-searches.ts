"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UPSTREAM_ENDPOINTS } from "@/lib/api/endpoints";
import { ApiContractError, createOperationError } from "@/lib/api/error";
import { serverApiRequest } from "@/lib/api/server";
import { MutationAckResponseSchema } from "@/lib/api/schemas/common";
import {
  CreateSavedSearchInputSchema,
  SavedSearchPublicIdParamsSchema,
  SavedSearchQuerySchema,
  SavedSearchResponseSchema,
  UpdateSavedSearchInputSchema,
  adaptRawSavedSearch,
} from "@/lib/api/schemas/saved-search";
import { adapt204Acknowledgement } from "@/lib/api/adapters";
import { validateOrigin, validateSecFetchSite } from "@/lib/auth/csrf";
import { createCookieCredentialResolver } from "@/lib/auth/session";
import {
  executeInvalidationPlan,
  invalidationPlans,
} from "@/lib/cache/invalidation";
import { canonicalizeSearchParams } from "@/lib/search/params";
import type { CookieStoreLike } from "@/lib/auth/cookies";
import type { ActionResult, MutationAckResponse } from "@/types/common";
import type {
  CreateSavedSearchInput,
  SavedSearch,
  SavedSearchQuery,
  UpdateSavedSearchInput,
} from "@/types/saved-search";

const CreateSavedSearchCandidateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).nullable(),
    query: z.unknown(),
    notifyPush: z.boolean(),
    notifyEmail: z.boolean(),
  })
  .strict();

function normalizeFormInput(input: unknown): unknown {
  return input instanceof FormData
    ? Object.fromEntries(input.entries())
    : input;
}

function normalizeSavedSearchQuery(input: unknown): SavedSearchQuery {
  const canonical = canonicalizeSearchParams(input);
  const query: SavedSearchQuery = {};
  const keys = [
    "makeSlug",
    "modelSlug",
    "yearMin",
    "yearMax",
    "priceMin",
    "priceMax",
    "mileageMax",
    "cityId",
    "areaId",
    "condition",
    "fuelType",
    "transmission",
    "bodyType",
    "sellerType",
    "hasWarranty",
    "isNegotiable",
    "installmentAvailable",
    "exchangeAccepted",
  ] as const satisfies readonly (keyof SavedSearchQuery)[];

  for (const key of keys) {
    const value = canonical[key];
    if (value !== undefined) {
      (query as Record<string, unknown>)[key] = value;
    }
  }

  return SavedSearchQuerySchema.parse(query);
}

async function requireActionCsrf(): Promise<void> {
  const requestHeaders = await headers();
  if (
    !validateOrigin(requestHeaders).valid ||
    !validateSecFetchSite(requestHeaders).valid
  ) {
    throw new ApiContractError(
      createOperationError({
        status: 403,
        code: "FORBIDDEN",
        message: "Invalid request origin",
      }),
    );
  }
}

function failure<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof ApiContractError) {
    return { ok: false, error: error.body.error };
  }

  const body =
    error instanceof z.ZodError
      ? createOperationError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Invalid saved search request",
          fieldErrors: error.issues.map((issue) => ({
            field: issue.path.join(".") || "input",
            code: issue.code,
            message: issue.message,
          })),
        })
      : createOperationError({
          status: 500,
          code: "INTERNAL_SERVER_ERROR",
          message: fallback,
        });

  return { ok: false, error: body.error };
}

async function invalidateSavedSearches(): Promise<void> {
  const result = await executeInvalidationPlan(
    invalidationPlans.savedSearchMutation(),
    {
      revalidatePath: (path) => revalidatePath(path),
    },
  );
  if (!result.success) {
    throw new ApiContractError(
      createOperationError({
        status: 500,
        code: "RECONCILIATION_REQUIRED",
        message: "Saved search changed, but the view must be refreshed",
      }),
    );
  }
}

export async function createSavedSearch(
  input: CreateSavedSearchInput | unknown,
): Promise<ActionResult<SavedSearch>> {
  try {
    await requireActionCsrf();
    const candidate = CreateSavedSearchCandidateSchema.parse(
      normalizeFormInput(input),
    );
    const parsed = CreateSavedSearchInputSchema.parse({
      ...candidate,
      query: normalizeSavedSearchQuery(candidate.query),
    });
    const store = await cookies();
    const response = await serverApiRequest({
      operation: "createSavedSearch",
      method: "POST",
      endpoint: UPSTREAM_ENDPOINTS.savedSearches,
      input: parsed,
      outputSchema: SavedSearchResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: createCookieCredentialResolver(
        store as unknown as CookieStoreLike,
      ),
      idempotencyKey: crypto.randomUUID(),
      adapter: adaptRawSavedSearch,
    });
    await invalidateSavedSearches();
    return { ok: true, data: response.data };
  } catch (error) {
    return failure(error, "Saved search could not be created");
  }
}

export async function updateSavedSearch(
  publicId: string,
  input: UpdateSavedSearchInput | unknown,
): Promise<ActionResult<SavedSearch>> {
  try {
    await requireActionCsrf();
    const params = SavedSearchPublicIdParamsSchema.parse({ publicId });
    const parsed = UpdateSavedSearchInputSchema.parse(
      normalizeFormInput(input),
    );
    const store = await cookies();
    const response = await serverApiRequest({
      operation: "updateSavedSearch",
      method: "PATCH",
      endpoint: () => UPSTREAM_ENDPOINTS.savedSearch(params.publicId),
      input: parsed,
      outputSchema: SavedSearchResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: createCookieCredentialResolver(
        store as unknown as CookieStoreLike,
      ),
      idempotencyKey: crypto.randomUUID(),
      adapter: adaptRawSavedSearch,
    });
    await invalidateSavedSearches();
    return { ok: true, data: response.data };
  } catch (error) {
    return failure(error, "Saved search could not be updated");
  }
}

export async function deleteSavedSearch(
  input: { publicId: string } | unknown,
): Promise<ActionResult<MutationAckResponse>> {
  try {
    await requireActionCsrf();
    const params = SavedSearchPublicIdParamsSchema.parse(
      normalizeFormInput(input),
    );
    const store = await cookies();
    const response = await serverApiRequest({
      operation: "deleteSavedSearch",
      method: "DELETE",
      endpoint: () => UPSTREAM_ENDPOINTS.savedSearch(params.publicId),
      outputSchema: MutationAckResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: createCookieCredentialResolver(
        store as unknown as CookieStoreLike,
      ),
      idempotencyKey: crypto.randomUUID(),
      adapter: adapt204Acknowledgement,
    });
    await invalidateSavedSearches();
    return { ok: true, data: response };
  } catch (error) {
    return failure(error, "Saved search could not be deleted");
  }
}
