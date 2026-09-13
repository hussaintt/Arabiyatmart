"use client";

import * as React from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { AlertCircle, Check, CheckCheck, Loader2, WifiOff } from "lucide-react";
import { browserApiRequest } from "@/lib/api/browser";
import { BFF_ENDPOINTS } from "@/lib/api/endpoints";
import { normalizeCursorMeta } from "@/lib/api/pagination";
import { generateRequestId } from "@/lib/api/request-id";
import { CountResponseSchema } from "@/lib/api/schemas/common";
import {
  NotificationListResponseSchema,
  NotificationResponseSchema,
} from "@/lib/api/schemas/notification";
import { queryKeys } from "@/lib/query/keys";
import { buildSearchUrl, canonicalizeSearchParams } from "@/lib/search/params";
import { markAllNotificationsRead } from "@/server/actions/notifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";
import type {
  CountResponse,
  JsonValue,
  PartialLocalizedText,
} from "@/types/common";
import type {
  NotificationItem,
  NotificationListResponse,
} from "@/types/notification";

function localizedText(
  value: PartialLocalizedText | null,
  locale: AppLocale,
): string | null {
  if (!value) return null;
  return value[locale] ?? value[locale === "ar" ? "en" : "ar"] ?? null;
}

function routeCandidate(data: JsonValue | null): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  for (const key of ["path", "target", "route", "url"] as const) {
    if (typeof data[key] === "string") return data[key];
  }
  return null;
}

export function resolveNotificationTarget(
  locale: AppLocale,
  data: JsonValue | null,
): string | null {
  const candidate = routeCandidate(data);
  if (
    !candidate ||
    candidate !== candidate.trim() ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("://") ||
    candidate.includes("\\") ||
    candidate.includes("#") ||
    /[\u0000-\u001f]/.test(candidate)
  ) {
    return null;
  }

  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  if (
    decoded.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  const queryIndex = candidate.indexOf("?");
  let pathname = queryIndex >= 0 ? candidate.slice(0, queryIndex) : candidate;
  const rawQuery = queryIndex >= 0 ? candidate.slice(queryIndex + 1) : "";
  pathname = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, "") || "/";

  if (pathname === "/search") {
    return buildSearchUrl(
      `/${locale}/search`,
      canonicalizeSearchParams(rawQuery),
    );
  }

  const exactRoutes = new Set([
    "/favorites",
    "/notifications",
    "/profile",
    "/saved-searches",
    "/me/listings",
    "/me/leads",
  ]);
  const isExact = exactRoutes.has(pathname);
  const isDetail =
    /^\/listing\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname) ||
    /^\/me\/leads\/[A-Za-z0-9_-]{2,160}$/.test(pathname);
  if ((!isExact && !isDetail) || rawQuery) return null;
  return `/${locale}${pathname}`;
}

function replaceNotification(
  current: InfiniteData<NotificationListResponse, string | null> | undefined,
  publicId: string,
  replacement: NotificationItem,
) {
  if (!current) return current;
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((item) =>
        item.publicId === publicId ? replacement : item,
      ),
    })),
  };
}

interface NotificationListProps {
  initialPage: NotificationListResponse;
  initialUnreadCount: CountResponse;
  locale: AppLocale;
  limit?: 20 | 40 | 80 | undefined;
}

export function NotificationList({
  initialPage,
  initialUnreadCount,
  locale,
  limit = 20,
}: NotificationListProps) {
  const ar = locale === "ar";
  const queryClient = useQueryClient();
  const listKey = React.useMemo(
    () => queryKeys.notifications({ limit, unreadOnly: false }),
    [limit],
  );
  const countKey = queryKeys.notificationUnreadCount();
  const pendingIds = React.useRef(new Set<string>());
  const [markingAll, setMarkingAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const count = useQuery({
    queryKey: countKey,
    initialData: initialUnreadCount,
    staleTime: 30_000,
    queryFn: () =>
      browserApiRequest({
        path: BFF_ENDPOINTS.notificationUnreadCount(),
        outputSchema: CountResponseSchema,
      }),
  });

  const query = useInfiniteQuery({
    queryKey: listKey,
    initialPageParam: null as string | null,
    initialData: { pages: [initialPage], pageParams: [null] },
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(limit),
        unreadOnly: "false",
      });
      if (pageParam) params.set("cursor", pageParam);
      const response = await browserApiRequest({
        path: `${BFF_ENDPOINTS.notifications()}?${params.toString()}`,
        outputSchema: NotificationListResponseSchema,
      });
      return { ...response, meta: normalizeCursorMeta(response.meta) };
    },
    getNextPageParam: (page) =>
      page.meta.hasMore ? page.meta.nextCursor : undefined,
  });

  const data = query.data as InfiniteData<
    NotificationListResponse,
    string | null
  >;
  const notifications = React.useMemo(() => {
    const unique = new Map<string, NotificationItem>();
    for (const page of data.pages) {
      for (const item of page.data) {
        if (!unique.has(item.publicId)) unique.set(item.publicId, item);
      }
    }
    return Array.from(unique.values());
  }, [data.pages]);

  const markOne = async (item: NotificationItem) => {
    if (item.readAt || pendingIds.current.has(item.publicId)) return;
    pendingIds.current.add(item.publicId);
    setError(null);
    const listSnapshot =
      queryClient.getQueryData<
        InfiniteData<NotificationListResponse, string | null>
      >(listKey);
    const countSnapshot = queryClient.getQueryData<CountResponse>(countKey);
    const optimistic = { ...item, readAt: new Date().toISOString() };
    queryClient.setQueryData(listKey, (current) =>
      replaceNotification(
        current as InfiniteData<NotificationListResponse, string | null>,
        item.publicId,
        optimistic,
      ),
    );
    queryClient.setQueryData<CountResponse>(countKey, (current) => ({
      count: Math.max(0, (current?.count ?? 0) - 1),
    }));

    try {
      const response = await browserApiRequest({
        path: BFF_ENDPOINTS.notificationRead(item.publicId),
        method: "PATCH",
        outputSchema: NotificationResponseSchema,
        idempotencyKey: generateRequestId(),
      });
      queryClient.setQueryData(listKey, (current) =>
        replaceNotification(
          current as InfiniteData<NotificationListResponse, string | null>,
          item.publicId,
          response.data,
        ),
      );
    } catch {
      if (listSnapshot) queryClient.setQueryData(listKey, listSnapshot);
      if (countSnapshot) queryClient.setQueryData(countKey, countSnapshot);
      setError(
        ar
          ? "تعذّر تحديث الإشعار. أُعيدت الحالة السابقة."
          : "The notification could not be updated. Its previous state was restored.",
      );
    } finally {
      pendingIds.current.delete(item.publicId);
    }
  };

  const markAll = async () => {
    if (markingAll || count.data.count === 0) return;
    setMarkingAll(true);
    setError(null);
    const result = await markAllNotificationsRead();
    if (!result.ok) {
      setError(
        ar
          ? "تعذّر تعليم كل الإشعارات كمقروءة."
          : "Notifications could not all be marked as read.",
      );
      setMarkingAll(false);
      return;
    }
    queryClient.setQueryData(countKey, result.data);
    const markedAt = new Date().toISOString();
    queryClient.setQueryData<
      InfiniteData<NotificationListResponse, string | null>
    >(listKey, (current) =>
      current
        ? {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              data: page.data.map((item) => ({
                ...item,
                readAt: item.readAt ?? markedAt,
              })),
            })),
          }
        : current,
    );
    setMarkingAll(false);
  };

  return (
    <section className="min-w-0 space-y-4" data-testid="notification-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" aria-live="polite">
          {ar ? `${count.data.count} غير مقروءة` : `${count.data.count} unread`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void markAll()}
          disabled={markingAll || count.data.count === 0}
          data-testid="mark-all-notifications-read"
        >
          {markingAll ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="me-2 h-4 w-4" />
          )}
          {ar ? "تعليم الكل كمقروء" : "Mark all read"}
        </Button>
      </div>

      {offline ? (
        <Alert data-testid="notifications-offline">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            {ar
              ? "أنت غير متصل. ستظهر التحديثات بعد عودة الاتصال."
              : "You are offline. Updates will appear after reconnecting."}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notifications.length === 0 ? (
        <div
          className="rounded-xl border border-dashed bg-card px-6 py-14 text-center"
          data-testid="notifications-empty"
        >
          <CheckCheck
            className="mx-auto h-11 w-11 text-muted-foreground/50"
            aria-hidden
          />
          <h2 className="mt-4 text-lg font-bold">
            {ar ? "لا توجد إشعارات" : "No notifications yet"}
          </h2>
        </div>
      ) : (
        <div className="space-y-3" data-testid="notification-cards">
          {notifications.map((item) => {
            const title =
              localizedText(item.title, locale) ??
              (ar ? "إشعار" : "Notification");
            const body = localizedText(item.body, locale);
            const target = resolveNotificationTarget(locale, item.data);
            return (
              <article
                key={item.publicId}
                className={`relative min-w-0 rounded-xl border p-4 sm:p-5 ${item.readAt ? "bg-card" : "border-primary/30 bg-primary/5"}`}
                data-testid={`notification-${item.publicId}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-muted-foreground/30" : "bg-primary"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-bold">{title}</h2>
                    {body ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {body}
                      </p>
                    ) : null}
                    <time
                      className="mt-2 block text-xs text-muted-foreground"
                      dateTime={item.createdAt}
                    >
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                    </time>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {target ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={target}>{ar ? "فتح" : "Open"}</a>
                        </Button>
                      ) : null}
                      {!item.readAt ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void markOne(item)}
                          data-testid={`mark-notification-read-${item.publicId}`}
                        >
                          <Check className="me-2 h-4 w-4" />
                          {ar ? "تعليم كمقروء" : "Mark read"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div
        className="flex min-h-12 items-center justify-center"
        aria-live="polite"
      >
        {query.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage || offline}
            data-testid="notifications-load-more"
          >
            {query.isFetchingNextPage ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : null}
            {query.isFetchingNextPage
              ? ar
                ? "جارٍ التحميل..."
                : "Loading…"
              : ar
                ? "تحميل المزيد"
                : "Load more"}
          </Button>
        ) : (
          <p
            className="text-sm text-muted-foreground"
            data-testid="notifications-end"
          >
            {ar ? "وصلت إلى نهاية القائمة" : "You have reached the end"}
          </p>
        )}
      </div>
    </section>
  );
}
