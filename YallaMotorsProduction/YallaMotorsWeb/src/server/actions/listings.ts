'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { PublicIdSchema } from '@/lib/api/schemas/common';
import { ListingCardResponseSchema } from '@/lib/api/schemas/listing';
import {
  CreateListingInputSchema,
  TransitionListingInputSchema,
  UpdateListingInputSchema,
  UpdatePriceInputSchema,
} from '@/lib/api/schemas/sell';
import { getCredentialsFromCookies, type CookieStoreLike } from '@/lib/auth/cookies';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';
import { z } from 'zod';
import type { ActionResult } from '@/types/common';
import type { ListingCard } from '@/types/listing';
import type {
  CreateListingInput,
  TransitionListingInput,
  UpdateListingInput,
  UpdatePriceInput,
} from '@/types/sell';

function errorResult<T>(
  error: unknown,
  defaultMessage = 'Listing operation could not be completed'
): ActionResult<T> {
  if (error instanceof ApiContractError) {
    return { ok: false, error: error.body.error };
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const candidate = (error as { error: unknown }).error;
    if (candidate && typeof candidate === 'object' && 'status' in candidate && 'code' in candidate) {
      return { ok: false, error: candidate as ActionResult<T> extends { ok: false; error: infer E } ? E : never };
    }
  }
  return {
    ok: false,
    error: createOperationError({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : defaultMessage,
    }).error,
  };
}

function normalizeInput(input: unknown): unknown {
  if (input instanceof FormData) {
    return Object.fromEntries(input.entries());
  }
  return input;
}

const UpdateListingParamsSchema = z.object({
  publicId: PublicIdSchema,
  input: UpdateListingInputSchema,
});

const UpdatePriceParamsSchema = z.object({
  publicId: PublicIdSchema,
  input: UpdatePriceInputSchema,
});

const TransitionListingParamsSchema = z.object({
  publicId: PublicIdSchema,
  input: TransitionListingInputSchema,
});

export async function createListing(
  input: CreateListingInput | unknown,
  idempotencyKey?: string,
  vendorPublicId?: string
): Promise<ActionResult<ListingCard>> {
  const parsed = CreateListingInputSchema.safeParse(normalizeInput(input));
  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid listing submission data',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'root',
          code: issue.code,
          message: issue.message,
        })),
      })
    );
  }

  const store = await cookies();
  const { accessToken } = getCredentialsFromCookies(store as unknown as CookieStoreLike);
  if (!accessToken) {
    return errorResult(
      createOperationError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to create a listing',
      })
    );
  }

  const effectiveIdempotencyKey = idempotencyKey?.trim() || crypto.randomUUID();
  const targetVendor = vendorPublicId?.trim();
  const isVendorScope = Boolean(targetVendor && targetVendor !== 'personal');

  try {
    const result = await serverApiRequest({
      operation: isVendorScope ? 'createVendorListing' : 'createListing',
      method: 'POST',
      endpoint: () =>
        isVendorScope
          ? UPSTREAM_ENDPOINTS.createVendorListing(targetVendor!)
          : UPSTREAM_ENDPOINTS.createListing(),
      inputSchema: CreateListingInputSchema,
      outputSchema: ListingCardResponseSchema,
      input: parsed.data,
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: effectiveIdempotencyKey,
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });

    try {
      await executeInvalidationPlan(invalidationPlans.createListing(), {
        revalidateTag,
        revalidatePath,
      });
    } catch {
      // Invalidation failures after upstream creation should not fail the 201 response
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to create listing');
  }
}

export async function updateListing(
  params: { publicId: string; input: UpdateListingInput } | unknown,
  idempotencyKey?: string
): Promise<ActionResult<ListingCard>> {
  const parsed = UpdateListingParamsSchema.safeParse(normalizeInput(params));
  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid listing update data',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'root',
          code: issue.code,
          message: issue.message,
        })),
      })
    );
  }

  const store = await cookies();
  const { accessToken } = getCredentialsFromCookies(store as unknown as CookieStoreLike);
  if (!accessToken) {
    return errorResult(
      createOperationError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to update listing',
      })
    );
  }

  const effectiveIdempotencyKey = idempotencyKey?.trim() || crypto.randomUUID();

  try {
    const result = await serverApiRequest({
      operation: 'updateListing',
      method: 'PATCH',
      endpoint: () => UPSTREAM_ENDPOINTS.updateListing(parsed.data.publicId),
      inputSchema: UpdateListingInputSchema,
      outputSchema: ListingCardResponseSchema,
      input: parsed.data.input,
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: effectiveIdempotencyKey,
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });

    try {
      await executeInvalidationPlan(
        invalidationPlans.updateListing({ slug: result.data.slug }),
        { revalidateTag, revalidatePath }
      );
    } catch {
      // Ignore invalidation errors if running outside server component context
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to update listing');
  }
}

export async function updateListingPrice(
  params: { publicId: string; input: UpdatePriceInput } | unknown,
  idempotencyKey?: string
): Promise<ActionResult<ListingCard>> {
  const parsed = UpdatePriceParamsSchema.safeParse(normalizeInput(params));
  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid price update data',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'root',
          code: issue.code,
          message: issue.message,
        })),
      })
    );
  }

  const store = await cookies();
  const { accessToken } = getCredentialsFromCookies(store as unknown as CookieStoreLike);
  if (!accessToken) {
    return errorResult(
      createOperationError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to update price',
      })
    );
  }

  const effectiveIdempotencyKey = idempotencyKey?.trim() || crypto.randomUUID();

  try {
    const result = await serverApiRequest({
      operation: 'updateListing',
      method: 'PATCH',
      endpoint: () => UPSTREAM_ENDPOINTS.updateListing(parsed.data.publicId),
      inputSchema: z.object({ priceCents: z.number().int().positive() }),
      outputSchema: ListingCardResponseSchema,
      input: { priceCents: parsed.data.input.priceCents },
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: effectiveIdempotencyKey,
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });

    try {
      await executeInvalidationPlan(
        invalidationPlans.updateListingPrice({ slug: result.data.slug }),
        { revalidateTag, revalidatePath }
      );
    } catch {
      // Invalidation errors
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to update price');
  }
}

export async function transitionListing(
  params: { publicId: string; input: TransitionListingInput } | unknown,
  idempotencyKey?: string
): Promise<ActionResult<ListingCard>> {
  const parsed = TransitionListingParamsSchema.safeParse(normalizeInput(params));
  if (!parsed.success) {
    return errorResult(
      createOperationError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid status transition data',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'root',
          code: issue.code,
          message: issue.message,
        })),
      })
    );
  }

  const store = await cookies();
  const { accessToken } = getCredentialsFromCookies(store as unknown as CookieStoreLike);
  if (!accessToken) {
    return errorResult(
      createOperationError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to transition listing',
      })
    );
  }

  const effectiveIdempotencyKey = idempotencyKey?.trim() || crypto.randomUUID();

  try {
    const result = await serverApiRequest({
      operation: 'transitionListing',
      method: 'POST',
      endpoint: () => UPSTREAM_ENDPOINTS.transitionListing(parsed.data.publicId),
      inputSchema: TransitionListingInputSchema,
      outputSchema: ListingCardResponseSchema,
      input: parsed.data.input,
      authMode: 'M',
      credentialResolver: async () => accessToken,
      idempotencyKey: effectiveIdempotencyKey,
      cachePolicy: { cache: 'no-store', isPrivate: true },
    });

    try {
      await executeInvalidationPlan(
        invalidationPlans.transitionListing({ slug: result.data.slug }),
        { revalidateTag, revalidatePath }
      );
    } catch {
      // Invalidation errors
    }

    return { ok: true, data: result.data };
  } catch (error) {
    return errorResult(error, 'Failed to transition listing status');
  }
}
