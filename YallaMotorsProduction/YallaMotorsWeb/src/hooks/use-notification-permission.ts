"use client";

import * as React from "react";
import { isFirebaseMessagingSupported } from "@/lib/firebase/client";

export type NotificationPermissionState =
  "checking" | "unsupported" | NotificationPermission;

export interface NotificationPermissionController {
  state: NotificationPermissionState;
  requestPermission: () => Promise<NotificationPermissionState>;
}

export function useNotificationPermission(): NotificationPermissionController {
  const [state, setState] =
    React.useState<NotificationPermissionState>("checking");

  React.useEffect(() => {
    let active = true;
    const detect = async () => {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !(await isFirebaseMessagingSupported())
      ) {
        if (active) setState("unsupported");
        return;
      }
      if (active) setState(Notification.permission);
    };
    void detect();
    return () => {
      active = false;
    };
  }, []);

  const requestPermission = React.useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      state === "unsupported"
    ) {
      setState("unsupported");
      return "unsupported" as const;
    }
    const permission = await Notification.requestPermission();
    setState(permission);
    return permission;
  }, [state]);

  return { state, requestPermission };
}
