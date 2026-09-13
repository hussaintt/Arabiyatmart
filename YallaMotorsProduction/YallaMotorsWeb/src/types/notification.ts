import type {
  CursorMeta,
  JsonValue,
  Locale,
  PartialLocalizedText,
} from './common';

export interface NotificationItem {
  publicId: string;
  type: string;
  title: PartialLocalizedText;
  body: PartialLocalizedText | null;
  data: JsonValue | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  meta: CursorMeta;
}

export interface NotificationListParams {
  cursor?: string | undefined;
  limit?: (20 | 40 | 80) | undefined;
  unreadOnly?: boolean | undefined;
}

export interface NotificationPublicIdParams {
  publicId: string;
}

export interface NotificationResponse {
  data: NotificationItem;
}

export interface RegisterDeviceInput {
  token: string;
  platform: 'WEB';
  appVersion: string | null;
  locale: Locale;
}

export interface UnregisterDeviceInput {
  token: string;
}

export interface DeviceRegistration {
  publicId: string;
  platform: 'WEB';
  appVersion: string | null;
  locale: Locale | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface DeviceRegistrationResponse {
  data: DeviceRegistration;
}

export interface DeviceRegistrationListResponse {
  data: DeviceRegistration[];
}

export interface NotificationViewState {
  notifications: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  isMarkingAllRead: boolean;
}

export interface WebPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: WebPushSubscriptionKeys;
  expirationTime?: number | null | undefined;
}
