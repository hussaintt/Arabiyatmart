import "server-only";

import { cookies } from "next/headers";
import { UPSTREAM_ENDPOINTS } from "@/lib/api/endpoints";
import { normalizeCursorMeta } from "@/lib/api/pagination";
import { serverApiRequest } from "@/lib/api/server";
import { CountResponseSchema } from "@/lib/api/schemas/common";
import {
  DeviceRegistrationListResponseSchema,
  NotificationListParamsSchema,
  NotificationListResponseSchema,
  adaptRawDeviceRegistrationList,
  adaptRawNotificationList,
} from "@/lib/api/schemas/notification";
import { createCookieCredentialResolver } from "@/lib/auth/session";
import type { CookieStoreLike } from "@/lib/auth/cookies";
import type { CountResponse } from "@/types/common";
import type {
  DeviceRegistrationListResponse,
  NotificationListParams,
  NotificationListResponse,
} from "@/types/notification";

export function enforceNotificationCursorContract(
  raw: unknown,
): NotificationListResponse {
  const response = adaptRawNotificationList(raw);
  return { ...response, meta: normalizeCursorMeta(response.meta) };
}

export async function listNotifications(
  params: NotificationListParams = {},
): Promise<NotificationListResponse> {
  const input = NotificationListParamsSchema.parse(params);
  const store = await cookies();
  return serverApiRequest({
    operation: "listNotifications",
    method: "GET",
    endpoint: UPSTREAM_ENDPOINTS.notifications,
    query: {
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
      ...(input.unreadOnly !== undefined
        ? { unreadOnly: input.unreadOnly }
        : {}),
    },
    outputSchema: NotificationListResponseSchema,
    authMode: "S",
    cachePolicy: { cache: "no-store", isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike,
    ),
    adapter: enforceNotificationCursorContract,
  });
}

export async function getUnreadNotificationCount(): Promise<CountResponse> {
  const store = await cookies();
  return serverApiRequest({
    operation: "getUnreadNotificationCount",
    method: "GET",
    endpoint: UPSTREAM_ENDPOINTS.unreadNotificationCount,
    outputSchema: CountResponseSchema,
    authMode: "S",
    cachePolicy: { cache: "no-store", isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike,
    ),
  });
}

export async function listNotificationDevices(): Promise<DeviceRegistrationListResponse> {
  const store = await cookies();
  return serverApiRequest({
    operation: "listNotificationDevices",
    method: "GET",
    endpoint: UPSTREAM_ENDPOINTS.notificationDevices,
    outputSchema: DeviceRegistrationListResponseSchema,
    authMode: "S",
    cachePolicy: { cache: "no-store", isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike,
    ),
    adapter: adaptRawDeviceRegistrationList,
  });
}
