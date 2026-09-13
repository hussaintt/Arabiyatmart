"use client";

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { browserApiRequest } from "@/lib/api/browser";
import { BFF_ENDPOINTS } from "@/lib/api/endpoints";
import { generateRequestId } from "@/lib/api/request-id";
import { MutationAckResponseSchema } from "@/lib/api/schemas/common";
import {
  DeviceRegistrationResponseSchema,
  RegisterDeviceInputSchema,
  UnregisterDeviceInputSchema,
} from "@/lib/api/schemas/notification";
import { deleteWebPushToken, getWebPushToken } from "@/lib/firebase/client";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";

interface PushOptInProps {
  locale: AppLocale;
  initiallyRegistered: boolean;
}

export function PushOptIn({ locale, initiallyRegistered }: PushOptInProps) {
  const ar = locale === "ar";
  const permission = useNotificationPermission();
  const [registered, setRegistered] = React.useState(initiallyRegistered);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (permission.state === "checking") {
    return (
      <div className="h-32 animate-pulse rounded-xl bg-muted" aria-hidden />
    );
  }

  if (permission.state === "unsupported") {
    return (
      <section
        className="rounded-xl border bg-card p-5"
        data-testid="push-unsupported"
      >
        <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 font-bold">
          {ar ? "إشعارات المتصفح غير متاحة" : "Browser push is unavailable"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "يمكنك متابعة الإشعارات من هذه الصفحة."
            : "You can still follow notifications from this inbox."}
        </p>
      </section>
    );
  }

  const enable = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const status =
        permission.state === "default"
          ? await permission.requestPermission()
          : permission.state;
      if (status !== "granted") {
        setError(
          ar
            ? "لم يتم منح إذن إشعارات المتصفح."
            : "Browser notification permission was not granted.",
        );
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      const token = await getWebPushToken(registration);
      await browserApiRequest({
        path: BFF_ENDPOINTS.notificationDevices(),
        method: "POST",
        input: {
          token,
          platform: "WEB",
          appVersion: null,
          locale,
        },
        inputSchema: RegisterDeviceInputSchema,
        outputSchema: DeviceRegistrationResponseSchema,
        idempotencyKey: generateRequestId(),
      });
      setRegistered(true);
    } catch {
      setError(
        ar
          ? "تعذّر تشغيل إشعارات المتصفح. حاول مرة أخرى."
          : "Browser notifications could not be enabled. Try again.",
      );
    } finally {
      setPending(false);
    }
  };

  const disable = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (registration) {
        const token = await getWebPushToken(registration);
        await browserApiRequest({
          path: BFF_ENDPOINTS.notificationDevices(),
          method: "DELETE",
          input: { token },
          inputSchema: UnregisterDeviceInputSchema,
          outputSchema: MutationAckResponseSchema,
          idempotencyKey: generateRequestId(),
        });
        const cleanup = await Promise.allSettled([
          deleteWebPushToken(),
          registration.unregister(),
        ]);
        if (cleanup.some((result) => result.status === "rejected")) {
          setError(
            ar
              ? "تم إيقاف التنبيهات للحساب، لكن تعذّر تنظيف إعدادات المتصفح بالكامل."
              : "Account alerts were disabled, but browser cleanup was incomplete.",
          );
        }
      }
      setRegistered(false);
    } catch {
      setError(
        ar
          ? "تعذّر إيقاف إشعارات المتصفح."
          : "Browser notifications could not be disabled.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="rounded-xl border bg-card p-5 lg:sticky lg:top-24"
      data-testid="push-opt-in"
    >
      <Bell className="h-5 w-5 text-primary" aria-hidden />
      <h2 className="mt-3 font-bold">
        {ar ? "إشعارات المتصفح" : "Browser notifications"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {permission.state === "denied"
          ? ar
            ? "الإذن مرفوض. غيّره من إعدادات المتصفح."
            : "Permission is blocked. Change it in browser settings."
          : registered
            ? ar
              ? "هذا المتصفح مسجل لاستقبال التنبيهات."
              : "This browser is registered for alerts."
            : ar
              ? "فعّل التنبيهات لتصلك تحديثات عمليات البحث وطلبات التواصل."
              : "Enable alerts for saved-search and inquiry updates."}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4 w-full"
        variant={registered ? "outline" : "default"}
        disabled={pending || (!registered && permission.state === "denied")}
        onClick={() => void (registered ? disable() : enable())}
        data-testid={registered ? "push-disable" : "push-enable"}
      >
        {pending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
        {registered
          ? ar
            ? "إيقاف الإشعارات"
            : "Disable notifications"
          : ar
            ? "تفعيل الإشعارات"
            : "Enable notifications"}
      </Button>
    </section>
  );
}
