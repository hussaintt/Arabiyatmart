import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { NotificationList } from "@/components/notifications/notification-list";
import { PushOptIn } from "@/components/notifications/push-opt-in";
import { requireSession } from "@/lib/auth/guards";
import { serverEnv } from "@/lib/env/server";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import { makeQueryClient } from "@/lib/query/client";
import { QueryHydrationBoundary } from "@/lib/query/hydration";
import { queryKeys } from "@/lib/query/keys";
import {
  getUnreadNotificationCount,
  listNotificationDevices,
  listNotifications,
} from "@/server/queries/notifications";

export const dynamic = "force-dynamic";

interface NotificationsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: NotificationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title:
      locale === "ar"
        ? "الإشعارات | عربيات مارت"
        : "Notifications | Arabiyat Mart",
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${serverEnv.SITE_ORIGIN}/${locale}/notifications`,
    },
  };
}

export default async function NotificationsPage({
  params,
}: NotificationsPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  await requireSession(`/${locale}/notifications`, locale);

  const [initialPage, initialUnreadCount, devices] = await Promise.all([
    listNotifications({ limit: 20, unreadOnly: false }),
    getUnreadNotificationCount(),
    listNotificationDevices(),
  ]);
  const queryClient = makeQueryClient();
  queryClient.setQueryData(
    queryKeys.notifications({ limit: 20, unreadOnly: false }),
    { pages: [initialPage], pageParams: [null] },
  );
  queryClient.setQueryData(
    queryKeys.notificationUnreadCount(),
    initialUnreadCount,
  );
  queryClient.setQueryData(queryKeys.notificationDevices(), devices);
  const ar = locale === "ar";

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <header>
        <p className="text-sm font-semibold text-primary">
          {ar ? "حسابي" : "My account"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {ar ? "الإشعارات" : "Notifications"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {ar
            ? "تابع تحديثات الإعلانات وطلبات التواصل ونتائج البحث المحفوظة."
            : "Follow listing, inquiry, and saved-search updates."}
        </p>
      </header>
      <QueryHydrationBoundary queryClient={queryClient}>
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0 lg:max-w-3xl">
            <NotificationList
              initialPage={initialPage}
              initialUnreadCount={initialUnreadCount}
              locale={locale}
            />
          </div>
          <aside
            className="lg:sticky lg:top-24"
            aria-label={ar ? "تفضيلات الإشعارات" : "Notification preferences"}
          >
            <PushOptIn
              locale={locale}
              initiallyRegistered={devices.data.length > 0}
            />
          </aside>
        </div>
      </QueryHydrationBoundary>
    </div>
  );
}
