import * as React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CountResponse } from "@/types/common";
import type {
  DeviceRegistration,
  NotificationItem,
  NotificationListResponse,
} from "@/types/notification";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  browserRequest: vi.fn(),
  markAll: vi.fn(),
  requireSession: vi.fn(),
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  listDevices: vi.fn(),
  permissionState: "default" as
    "checking" | "unsupported" | NotificationPermission,
  requestPermission: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  registerWorker: vi.fn(),
  getRegistration: vi.fn(),
  unregisterWorker: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/lib/api/browser", () => ({
  browserApiRequest: (...args: unknown[]) => state.browserRequest(...args),
}));
vi.mock("@/server/actions/notifications", () => ({
  markAllNotificationsRead: (...args: unknown[]) => state.markAll(...args),
}));
vi.mock("@/lib/auth/guards", () => ({
  requireSession: (...args: unknown[]) => state.requireSession(...args),
}));
vi.mock("@/server/queries/notifications", () => ({
  listNotifications: (...args: unknown[]) => state.listNotifications(...args),
  getUnreadNotificationCount: (...args: unknown[]) =>
    state.getUnreadCount(...args),
  listNotificationDevices: (...args: unknown[]) => state.listDevices(...args),
}));
vi.mock("@/hooks/use-notification-permission", () => ({
  useNotificationPermission: () => ({
    state: state.permissionState,
    requestPermission: (...args: unknown[]) => state.requestPermission(...args),
  }),
}));
vi.mock("@/lib/firebase/client", () => ({
  getWebPushToken: (...args: unknown[]) => state.getToken(...args),
  deleteWebPushToken: (...args: unknown[]) => state.deleteToken(...args),
}));

import NotificationsPage, {
  generateMetadata,
} from "@/app/[locale]/(account)/notifications/page";
import {
  NotificationList,
  resolveNotificationTarget,
} from "@/components/notifications/notification-list";
import { PushOptIn } from "@/components/notifications/push-opt-in";

const unread: NotificationItem = {
  publicId: "ntf_01",
  type: "SAVED_SEARCH_MATCH",
  title: { ar: "نتيجة جديدة", en: "A new match" },
  body: { ar: "وجدنا سيارة", en: "We found a vehicle" },
  data: { path: "/listing/toyota-corolla-2024" },
  readAt: null,
  createdAt: "2026-09-08T10:00:00.000Z",
};

const read: NotificationItem = {
  ...unread,
  publicId: "ntf_02",
  title: { ar: "تم التحديث", en: "Updated" },
  data: { path: "/saved-searches" },
  readAt: "2026-09-08T11:00:00.000Z",
};

const third: NotificationItem = {
  ...read,
  publicId: "ntf_03",
  title: { ar: "طلب تواصل", en: "Buyer inquiry" },
};

const firstPage: NotificationListResponse = {
  data: [unread, read],
  meta: { hasMore: true, nextCursor: "opaque-notification-cursor" },
};
const finalPage: NotificationListResponse = {
  data: [read, third],
  meta: { hasMore: false, nextCursor: null },
};
const initialCount: CountResponse = { count: 1 };
const device: DeviceRegistration = {
  publicId: "dev_01",
  platform: "WEB",
  appVersion: null,
  locale: "en",
  lastSeenAt: "2026-09-08T11:00:00.000Z",
  createdAt: "2026-09-08T10:00:00.000Z",
};

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderList(
  page: NotificationListResponse = firstPage,
  count: CountResponse = initialCount,
  locale: "ar" | "en" = "en",
) {
  const client = queryClient();
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <NotificationList
          initialPage={page}
          initialUnreadCount={count}
          locale={locale}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("TASK-042: notifications and web push", () => {
  beforeEach(() => {
    state.permissionState = "default";
    state.requestPermission.mockResolvedValue("granted");
    state.getToken.mockResolvedValue("secret-device-token-12345");
    state.deleteToken.mockResolvedValue(true);
    state.unregisterWorker.mockResolvedValue(true);
    const registration = { unregister: state.unregisterWorker };
    state.registerWorker.mockResolvedValue(registration);
    state.getRegistration.mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: state.registerWorker,
        getRegistration: state.getRegistration,
      },
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    state.browserRequest.mockImplementation(
      async ({ path, method }: { path: string; method?: string }) => {
        if (path.includes("cursor=")) return finalPage;
        if (path.endsWith("/read") && method === "PATCH") {
          return {
            data: { ...unread, readAt: "2026-09-08T12:00:00.000Z" },
          };
        }
        if (path.endsWith("/devices") && method === "POST") {
          return { data: device };
        }
        if (path.endsWith("/devices") && method === "DELETE") {
          return { ok: true };
        }
        return initialCount;
      },
    );
    state.markAll.mockResolvedValue({ ok: true, data: { count: 0 } });
    state.requireSession.mockResolvedValue({ user: { publicId: "usr_1" } });
    state.listNotifications.mockResolvedValue(firstPage);
    state.getUnreadCount.mockResolvedValue(initialCount);
    state.listDevices.mockResolvedValue({ data: [device] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the exact opaque cursor, removes overlap, and reaches a real end state", async () => {
    renderList();
    fireEvent.click(screen.getByTestId("notifications-load-more"));
    await waitFor(() => expect(state.browserRequest).toHaveBeenCalledTimes(1));
    expect(state.browserRequest.mock.calls[0]?.[0].path).toBe(
      "/api/bff/notifications?limit=20&unreadOnly=false&cursor=opaque-notification-cursor",
    );
    expect(await screen.findByText("Buyer inquiry")).toBeInTheDocument();
    expect(screen.getAllByText("Updated")).toHaveLength(1);
    expect(screen.getByTestId("notifications-end")).toBeInTheDocument();
  });

  it("rolls back both the row and unread count when mark-one fails", async () => {
    let rejectRead!: (reason: unknown) => void;
    state.browserRequest.mockImplementationOnce(
      () => new Promise((_resolve, reject) => (rejectRead = reject)),
    );
    renderList({ data: [unread], meta: { hasMore: false, nextCursor: null } });

    fireEvent.click(screen.getByTestId("mark-notification-read-ntf_01"));
    await waitFor(() =>
      expect(screen.getByText("0 unread")).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("mark-notification-read-ntf_01"),
    ).not.toBeInTheDocument();
    rejectRead(new Error("network"));

    expect(await screen.findByText("1 unread")).toBeInTheDocument();
    expect(
      screen.getByTestId("mark-notification-read-ntf_01"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "previous state was restored",
    );
  });

  it("reconciles mark-all from the returned authoritative count", async () => {
    renderList({ data: [unread], meta: { hasMore: false, nextCursor: null } });
    fireEvent.click(screen.getByTestId("mark-all-notifications-read"));

    await waitFor(() => expect(state.markAll).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("0 unread")).toBeInTheDocument();
    expect(screen.getByTestId("mark-all-notifications-read")).toBeDisabled();
    expect(
      screen.queryByTestId("mark-notification-read-ntf_01"),
    ).not.toBeInTheDocument();
  });

  it("never prompts or registers before an explicit default-state gesture", async () => {
    render(<PushOptIn locale="en" initiallyRegistered={false} />);
    expect(state.requestPermission).not.toHaveBeenCalled();
    expect(state.registerWorker).not.toHaveBeenCalled();
    expect(state.browserRequest).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Enable notifications" }),
    );
    await waitFor(() =>
      expect(state.requestPermission).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(state.browserRequest).toHaveBeenCalledTimes(1));
    expect(state.registerWorker).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(document.body.textContent).not.toContain(
      "secret-device-token-12345",
    );
    expect(
      screen.getByRole("button", { name: "Disable notifications" }),
    ).toBeInTheDocument();
  });

  it("locks duplicate opt-in and returns only a token-free device record", async () => {
    let resolveToken!: (token: string) => void;
    state.permissionState = "granted";
    state.getToken.mockImplementationOnce(
      () => new Promise((resolve) => (resolveToken = resolve)),
    );
    render(<PushOptIn locale="en" initiallyRegistered={false} />);
    const button = screen.getByRole("button", { name: "Enable notifications" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(state.registerWorker).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(state.getToken).toHaveBeenCalledTimes(1));
    resolveToken("secret-device-token-12345");
    await waitFor(() => expect(state.browserRequest).toHaveBeenCalledTimes(1));
    const request = state.browserRequest.mock.calls[0]?.[0];
    expect(request.path).toBe("/api/bff/notifications/devices");
    expect(request.idempotencyKey).toEqual(expect.any(String));
    expect(JSON.stringify({ data: device })).not.toContain(
      "secret-device-token",
    );
    expect(document.body.textContent).not.toContain("secret-device-token");
  });

  it("handles unsupported and denied permission without a device request", async () => {
    state.permissionState = "unsupported";
    const unsupported = render(
      <PushOptIn locale="en" initiallyRegistered={false} />,
    );
    expect(screen.getByTestId("push-unsupported")).toBeInTheDocument();
    unsupported.unmount();

    state.permissionState = "denied";
    render(<PushOptIn locale="en" initiallyRegistered={false} />);
    expect(screen.getByText(/Permission is blocked/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enable notifications" }),
    ).toBeDisabled();
    expect(state.requestPermission).not.toHaveBeenCalled();
    expect(state.browserRequest).not.toHaveBeenCalled();
  });

  it("unregisters the backend device, Firebase token, and same-origin worker on opt-out", async () => {
    state.permissionState = "granted";
    render(<PushOptIn locale="en" initiallyRegistered />);
    fireEvent.click(
      screen.getByRole("button", { name: "Disable notifications" }),
    );
    await waitFor(() => expect(state.browserRequest).toHaveBeenCalledTimes(1));
    expect(state.browserRequest.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        path: "/api/bff/notifications/devices",
        method: "DELETE",
      }),
    );
    expect(state.deleteToken).toHaveBeenCalledTimes(1);
    expect(state.unregisterWorker).toHaveBeenCalledTimes(1);
  });

  it("rejects malicious targets and canonicalizes allowlisted internal search targets", () => {
    expect(
      resolveNotificationTarget("en", { target: "https://evil.example/steal" }),
    ).toBeNull();
    expect(
      resolveNotificationTarget("en", { path: "//evil.example" }),
    ).toBeNull();
    expect(
      resolveNotificationTarget("en", { path: "/listing/../admin" }),
    ).toBeNull();
    expect(
      resolveNotificationTarget("ar", {
        path: "/en/search?makeSlug=toyota&page=9&unknown=bad",
      }),
    ).toBe("/ar/search?makeSlug=toyota&page=9");
  });

  it("shows the offline hint after mount and preserves responsive/RTL content", async () => {
    renderList(firstPage, initialCount, "ar");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fireEvent(window, new Event("offline"));
    expect(
      await screen.findByTestId("notifications-offline"),
    ).toBeInTheDocument();
    expect(screen.getByText("نتيجة جديدة")).toBeInTheDocument();
    expect(screen.getByTestId("notification-cards")).toHaveClass("space-y-3");
    expect(screen.getByTestId("notifications-load-more")).toBeDisabled();
  });

  it("server-renders the private first page and emits canonical noindex metadata", async () => {
    const page = await NotificationsPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(
      <QueryClientProvider client={queryClient()}>{page}</QueryClientProvider>,
    );
    expect(state.requireSession).toHaveBeenCalledWith(
      "/en/notifications",
      "en",
    );
    expect(state.listNotifications).toHaveBeenCalledWith({
      limit: 20,
      unreadOnly: false,
    });
    expect(state.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(state.listDevices).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("notifications-page")).toBeInTheDocument();
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toMatch(/\/en\/notifications$/);
  });

  it("does not read notifications when the session guard rejects", async () => {
    state.requireSession.mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/en/login"),
    );
    await expect(
      NotificationsPage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(state.listNotifications).not.toHaveBeenCalled();
    expect(state.getUnreadCount).not.toHaveBeenCalled();
    expect(state.listDevices).not.toHaveBeenCalled();
  });

  it("ships a service worker with no authenticated fetch cache and no token logging", () => {
    const worker = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).not.toMatch(/addEventListener\(["']fetch/);
    expect(worker).not.toMatch(/caches\./);
    expect(worker).not.toMatch(/console\./);
    expect(worker).not.toContain("token");
  });
});
