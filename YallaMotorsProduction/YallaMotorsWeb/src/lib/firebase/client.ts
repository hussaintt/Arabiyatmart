"use client";

import { clientEnv } from "@/lib/env/client";
import type { Messaging } from "firebase/messaging";

async function getMessagingClient(): Promise<Messaging | null> {
  const apiKey = clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  const config: import("firebase/app").FirebaseOptions = {
    apiKey,
    projectId,
    messagingSenderId,
    appId,
  };
  if (clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
    config.authDomain = clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  }
  if (clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    config.storageBucket = clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  }

  const [{ getApp, getApps, initializeApp }, messagingModule] =
    await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await messagingModule.isSupported())) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return messagingModule.getMessaging(app);
}

export async function isFirebaseMessagingSupported(): Promise<boolean> {
  try {
    return (await getMessagingClient()) !== null;
  } catch {
    return false;
  }
}

export async function getWebPushToken(
  serviceWorkerRegistration: ServiceWorkerRegistration,
): Promise<string> {
  const messaging = await getMessagingClient();
  const vapidKey = clientEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!messaging || !vapidKey) {
    throw new Error("Push messaging is unavailable");
  }
  const { getToken } = await import("firebase/messaging");
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
  if (!token) throw new Error("Push messaging is unavailable");
  return token;
}

export async function deleteWebPushToken(): Promise<boolean> {
  const messaging = await getMessagingClient();
  if (!messaging) return false;
  const { deleteToken } = await import("firebase/messaging");
  return deleteToken(messaging);
}
