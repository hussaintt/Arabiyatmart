import { z } from 'zod';
import type {
  DeviceRegistration,
  DeviceRegistrationListResponse,
  DeviceRegistrationResponse,
  NotificationItem,
  NotificationListParams,
  NotificationListResponse,
  NotificationPublicIdParams,
  NotificationResponse,
  NotificationViewState,
  RegisterDeviceInput,
  UnregisterDeviceInput,
  WebPushSubscriptionInput,
  WebPushSubscriptionKeys,
} from '@/types/notification';
import {
  CursorMetaSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  LocaleSchema,
  PartialLocalizedTextSchema,
  PublicIdSchema,
} from './common';
import { unwrapDataArray, unwrapDataObject } from './taxonomy';

// ── Notification Schemas ────────────────────────────────────────────────────

export const NotificationItemSchema: z.ZodType<NotificationItem> = z.object({
  publicId: PublicIdSchema,
  type: z.string().min(1),
  title: PartialLocalizedTextSchema,
  body: PartialLocalizedTextSchema.nullable(),
  data: JsonValueSchema.nullable(),
  readAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});

export const NotificationListResponseSchema: z.ZodType<NotificationListResponse> = z.object({
  data: z.array(NotificationItemSchema),
  meta: CursorMetaSchema,
});

export const NotificationListParamsSchema: z.ZodType<NotificationListParams> = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.union([z.literal(20), z.literal(40), z.literal(80)]).optional(),
  unreadOnly: z.boolean().optional(),
});

export const NotificationPublicIdParamsSchema: z.ZodType<NotificationPublicIdParams> = z.object({
  publicId: PublicIdSchema,
});

export const NotificationResponseSchema: z.ZodType<NotificationResponse> = z.object({
  data: NotificationItemSchema,
});

export const NotificationViewStateSchema: z.ZodType<NotificationViewState> = z.object({
  notifications: z.array(NotificationItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  isLoadingMore: z.boolean(),
  isMarkingAllRead: z.boolean(),
});

// ── Device Registration Schemas ─────────────────────────────────────────────

export const RegisterDeviceInputSchema: z.ZodType<RegisterDeviceInput> = z.object({
  token: z.string().min(8).max(4096),
  platform: z.literal('WEB'),
  appVersion: z.string().max(32).nullable(),
  locale: LocaleSchema,
});

export const UnregisterDeviceInputSchema: z.ZodType<UnregisterDeviceInput> = z.object({
  token: z.string().min(8).max(4096),
});

export const DeviceRegistrationSchema: z.ZodType<DeviceRegistration> = z.object({
  publicId: PublicIdSchema,
  platform: z.literal('WEB'),
  appVersion: z.string().max(32).nullable(),
  locale: LocaleSchema.nullable(),
  lastSeenAt: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
});

export const DeviceRegistrationResponseSchema: z.ZodType<DeviceRegistrationResponse> = z.object({
  data: DeviceRegistrationSchema,
});

export const DeviceRegistrationListResponseSchema: z.ZodType<DeviceRegistrationListResponse> = z.object({
  data: z.array(DeviceRegistrationSchema),
});

// ── Web Push Subscription (Serializable Contract) ───────────────────────────

export const WebPushSubscriptionKeysSchema: z.ZodType<WebPushSubscriptionKeys> = z.object({
  p256dh: z.string().trim().min(1, 'p256dh key is required'),
  auth: z.string().trim().min(1, 'auth key is required'),
});

export const WebPushSubscriptionInputSchema: z.ZodType<WebPushSubscriptionInput> = z
  .object({
    endpoint: z
      .string()
      .url()
      .refine((url) => url.startsWith('https://'), 'Push endpoint must use HTTPS'),
    keys: WebPushSubscriptionKeysSchema,
    expirationTime: z.number().int().positive().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.endpoint || val.endpoint.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['endpoint'],
        message: 'Push endpoint is required',
      });
    }
    if (!val.keys?.p256dh || val.keys.p256dh.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['keys', 'p256dh'],
        message: 'p256dh key is required',
      });
    }
    if (!val.keys?.auth || val.keys.auth.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['keys', 'auth'],
        message: 'auth key is required',
      });
    }
  });

// ── Adapters ─────────────────────────────────────────────────────────────────

function cleanRawNotification(raw: Record<string, unknown>): Record<string, unknown> {
  let title: unknown = raw.title;
  if (typeof raw.title === 'string') {
    title = { ar: raw.title, en: raw.title };
  }

  let body: unknown = null;
  if (raw.body !== undefined && raw.body !== null) {
    if (typeof raw.body === 'string') {
      body = { ar: raw.body, en: raw.body };
    } else {
      body = raw.body;
    }
  }

  return {
    publicId: raw.publicId,
    type: raw.type,
    title,
    body,
    data: raw.data === undefined ? null : raw.data,
    readAt: raw.readAt === undefined ? null : raw.readAt,
    createdAt: raw.createdAt,
  };
}

export function adaptRawNotification(input: unknown): NotificationResponse {
  // `NotificationItem` itself has a `data` field containing navigation metadata.
  // Unwrap the response envelope exactly once so that domain metadata is never
  // mistaken for a second transport envelope.
  const direct = typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : null;
  const target = direct && typeof direct.publicId === 'string'
    ? direct
    : unwrapDataObject(input);
  const cleaned = cleanRawNotification(target);
  const data = NotificationItemSchema.parse(cleaned);
  return { data };
}

export function adaptRawNotificationList(input: unknown): NotificationListResponse {
  if (typeof input !== 'object' || input === null) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected notification list object input',
      },
    ]);
  }

  const rawObj = input as Record<string, unknown>;
  const list = unwrapDataArray(rawObj);

  const data = list.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index],
          message: 'Expected notification item to be an object',
        },
      ]);
    }
    const cleaned = cleanRawNotification(item as Record<string, unknown>);
    return NotificationItemSchema.parse(cleaned);
  });

  let meta: unknown;
  if (typeof rawObj.meta === 'object' && rawObj.meta !== null && !Array.isArray(rawObj.meta)) {
    const m = rawObj.meta as Record<string, unknown>;
    meta = {
      hasMore: m.hasMore,
      nextCursor: m.nextCursor === undefined ? null : m.nextCursor,
    };
  } else if ('hasMore' in rawObj || 'nextCursor' in rawObj) {
    meta = {
      hasMore: rawObj.hasMore,
      nextCursor: rawObj.nextCursor === undefined ? null : rawObj.nextCursor,
    };
  } else {
    meta = rawObj.meta;
  }

  const validatedMeta = CursorMetaSchema.parse(meta);

  return {
    data,
    meta: validatedMeta,
  };
}

function cleanRawDeviceRegistration(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    publicId: raw.publicId,
    platform: 'WEB',
    appVersion: raw.appVersion === undefined ? null : raw.appVersion,
    locale: raw.locale === undefined ? null : raw.locale,
    lastSeenAt: raw.lastSeenAt,
    createdAt: raw.createdAt,
  };
}

export function adaptRawDeviceRegistration(input: unknown): DeviceRegistrationResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  const cleaned = cleanRawDeviceRegistration(target);
  const data = DeviceRegistrationSchema.parse(cleaned);
  return { data };
}

export function adaptRawDeviceRegistrationList(input: unknown): DeviceRegistrationListResponse {
  const list = unwrapDataArray(input);
  const data = list.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index],
          message: 'Expected device registration item to be an object',
        },
      ]);
    }
    const cleaned = cleanRawDeviceRegistration(item as Record<string, unknown>);
    return DeviceRegistrationSchema.parse(cleaned);
  });
  return DeviceRegistrationListResponseSchema.parse({ data });
}
