"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UPSTREAM_ENDPOINTS } from "@/lib/api/endpoints";
import { ApiContractError, createOperationError } from "@/lib/api/error";
import { serverApiRequest } from "@/lib/api/server";
import { adapt204Acknowledgement } from "@/lib/api/adapters";
import { MutationAckResponseSchema } from "@/lib/api/schemas/common";
import { FilePublicIdParamsSchema } from "@/lib/api/schemas/upload";
import { createCookieCredentialResolver } from "@/lib/auth/session";
import { validateOrigin, validateSecFetchSite } from "@/lib/auth/csrf";
import { executeInvalidationPlan, invalidationPlans } from "@/lib/cache/invalidation";
import type { CookieStoreLike } from "@/lib/auth/cookies";
import { z } from "zod";
import type { ActionResult, MutationAckResponse } from "@/types/common";

async function requireActionCsrf(): Promise<void> {
  const requestHeaders = await headers();
  const origin = validateOrigin(requestHeaders);
  const site = validateSecFetchSite(requestHeaders);
  if (!origin.valid || !site.valid) {
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
          message: "Invalid file request",
          fieldErrors: error.issues.map((issue) => ({
            field: issue.path.join(".") || "publicId",
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

function normalizeInput(input: unknown): unknown {
  if (input instanceof FormData) {
    return Object.fromEntries(input.entries());
  }
  return input;
}

export async function deleteFile(
  input: { publicId: string } | unknown,
): Promise<ActionResult<MutationAckResponse>> {
  try {
    await requireActionCsrf();
    const params = FilePublicIdParamsSchema.parse(normalizeInput(input));
    const store = await cookies();
    const response = await serverApiRequest({
      operation: "deleteFile",
      method: "DELETE",
      endpoint: () => UPSTREAM_ENDPOINTS.deleteFile(params.publicId),
      outputSchema: MutationAckResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: createCookieCredentialResolver(
        store as unknown as CookieStoreLike,
      ),
      idempotencyKey: crypto.randomUUID(),
      adapter: adapt204Acknowledgement,
    });

    await executeInvalidationPlan(
      invalidationPlans.deleteFile(params.publicId),
      {
        revalidatePath: (path) => revalidatePath(path),
      },
    );

    return { ok: true, data: response };
  } catch (error) {
    return failure(error, "File could not be deleted");
  }
}
