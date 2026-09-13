"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { UPSTREAM_ENDPOINTS } from "@/lib/api/endpoints";
import { ApiContractError, createOperationError } from "@/lib/api/error";
import { serverApiRequest } from "@/lib/api/server";
import {
  CountResponseSchema,
  MutationAckResponseSchema,
} from "@/lib/api/schemas/common";
import {
  DeviceRegistrationResponseSchema,
  NotificationPublicIdParamsSchema,
  NotificationResponseSchema,
  RegisterDeviceInputSchema,
  UnregisterDeviceInputSchema,
  adaptRawDeviceRegistration,
  adaptRawNotification,
} from "@/lib/api/schemas/notification";
import { adapt204Acknowledgement } from "@/lib/api/adapters";
import { validateOrigin, validateSecFetchSite } from "@/lib/auth/csrf";
import { createCookieCredentialResolver } from "@/lib/auth/session";
import {
  executeInvalidationPlan,
  invalidationPlans,
} from "@/lib/cache/invalidation";
import type { CookieStoreLike } from "@/lib/auth/cookies";
import type {
  ActionResult,
  CountResponse,
  MutationAckResponse,
} from "@/types/common";
import type {
  DeviceRegistration,
  NotificationItem,
  NotificationPublicIdParams,
  RegisterDeviceInput,
  UnregisterDeviceInput,
} from "@/types/notification";

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
          message: "Invalid notification request",
          fieldErrors: error.issues.map((issue) => ({
            field: issue.path[0] === "token" ? "device" : issue.path.join("."),
            code: issue.code,
            message:
              issue.path[0] === "token"
                ? "Invalid device registration"
                : issue.message,
          })),
        })
      : createOperationError({
          status: 500,
          code: "INTERNAL_SERVER_ERROR",
          message: fallback,
        });
  return { ok: false, error: body.error };
}

async function credentialResolver() {
  const store = await cookies();
  return createCookieCredentialResolver(store as unknown as CookieStoreLike);
}

async function invalidateNotifications(kind: "read" | "device") {
  const plan =
    kind === "read"
      ? invalidationPlans.notificationRead()
      : invalidationPlans.notificationDevice();
  await executeInvalidationPlan(plan, {});
}

export async function markNotificationRead(
  params: NotificationPublicIdParams | unknown,
): Promise<ActionResult<NotificationItem>> {
  try {
    await requireActionCsrf();
    const parsed = NotificationPublicIdParamsSchema.parse(params);
    const response = await serverApiRequest({
      operation: "markNotificationRead",
      method: "PATCH",
      endpoint: () => UPSTREAM_ENDPOINTS.markNotificationRead(parsed.publicId),
      outputSchema: NotificationResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: await credentialResolver(),
      idempotencyKey: crypto.randomUUID(),
      adapter: adaptRawNotification,
    });
    await invalidateNotifications("read");
    return { ok: true, data: response.data };
  } catch (error) {
    return failure(error, "Notification could not be marked as read");
  }
}

export async function markAllNotificationsRead(): Promise<
  ActionResult<CountResponse>
> {
  try {
    await requireActionCsrf();
    const response = await serverApiRequest({
      operation: "markAllNotificationsRead",
      method: "POST",
      endpoint: UPSTREAM_ENDPOINTS.markAllNotificationsRead,
      outputSchema: CountResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: await credentialResolver(),
      idempotencyKey: crypto.randomUUID(),
    });
    await invalidateNotifications("read");
    return { ok: true, data: response };
  } catch (error) {
    return failure(error, "Notifications could not be marked as read");
  }
}

export async function registerNotificationDevice(
  input: RegisterDeviceInput | unknown,
): Promise<ActionResult<DeviceRegistration>> {
  try {
    await requireActionCsrf();
    const parsed = RegisterDeviceInputSchema.parse(input);
    const response = await serverApiRequest({
      operation: "registerNotificationDevice",
      method: "POST",
      endpoint: UPSTREAM_ENDPOINTS.notificationDevices,
      input: parsed,
      outputSchema: DeviceRegistrationResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: await credentialResolver(),
      idempotencyKey: crypto.randomUUID(),
      adapter: adaptRawDeviceRegistration,
    });
    await invalidateNotifications("device");
    return { ok: true, data: response.data };
  } catch (error) {
    return failure(error, "Device could not be registered");
  }
}

export async function unregisterNotificationDevice(
  input: UnregisterDeviceInput | unknown,
): Promise<ActionResult<MutationAckResponse>> {
  try {
    await requireActionCsrf();
    const parsed = UnregisterDeviceInputSchema.parse(input);
    const response = await serverApiRequest({
      operation: "unregisterNotificationDevice",
      method: "DELETE",
      endpoint: () =>
        UPSTREAM_ENDPOINTS.unregisterNotificationDevice(parsed.token),
      outputSchema: MutationAckResponseSchema,
      authMode: "M",
      cachePolicy: { cache: "no-store", isPrivate: true },
      credentialResolver: await credentialResolver(),
      idempotencyKey: crypto.randomUUID(),
      adapter: adapt204Acknowledgement,
    });
    await invalidateNotifications("device");
    return { ok: true, data: response };
  } catch (error) {
    return failure(error, "Device could not be unregistered");
  }
}
