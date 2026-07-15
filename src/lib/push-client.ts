"use client";

import { Capacitor } from "@capacitor/core";
import { getOrCreateDeviceId } from "./supabase/client";
import { getRemoteAccessToken } from "./remote-sync";

function vapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function registerPayload(payload: Record<string, unknown>) {
  const token = await getRemoteAccessToken(); if (!token) throw new Error("Accesso richiesto.");
  const response = await fetch("/api/push/register", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Registrazione notifiche non riuscita.");
  }
}

function currentPlatform() {
  return Capacitor.isNativePlatform() ? Capacitor.getPlatform() as "ios" | "android" : "web" as const;
}

export async function getPushNotificationStatus() {
  const token = await getRemoteAccessToken(); if (!token) throw new Error("Accesso richiesto.");
  const platform = currentPlatform();
  const deviceId = getOrCreateDeviceId();
  const response = await fetch("/api/push/register", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Stato notifiche non disponibile.");
  const body = await response.json() as { subscriptions?: Array<{ platform: string; device_id: string }> };
  return {
    enabled: (body.subscriptions ?? []).some((item) => item.platform === platform && item.device_id === deviceId),
    platform,
  };
}

export async function disablePushNotifications() {
  const token = await getRemoteAccessToken(); if (!token) throw new Error("Accesso richiesto.");
  const platform = currentPlatform();
  const deviceId = getOrCreateDeviceId();
  const response = await fetch("/api/push/register", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ platform, deviceId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Disattivazione notifiche non riuscita.");
  }
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister().catch(() => undefined);
  } else if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe().catch(() => false);
  }
  return platform;
}

export async function enablePushNotifications() {
  const deviceId = getOrCreateDeviceId();
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") throw new Error("Permesso notifiche non concesso.");
    const platform = currentPlatform() as "ios" | "android";
    const nativeToken = await new Promise<string>((resolve, reject) => {
      let settled = false;
      let timer = 0;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        Promise.all(handles.map((handle) => handle.then((listener) => listener.remove()))).finally(callback);
      };
      const handles = [
        PushNotifications.addListener("registration", ({ value }) => finish(() => resolve(value))),
        PushNotifications.addListener("registrationError", (error) => finish(() => reject(new Error(error.error)))),
      ];
      Promise.all(handles).then(() => PushNotifications.register()).catch((error) => finish(() => reject(error)));
      timer = window.setTimeout(() => finish(() => reject(new Error("Registrazione push scaduta."))), 15_000);
    });
    await registerPayload({ platform, deviceId, nativeToken });
    return platform;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Web Push non supportato da questo browser.");
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  if (!publicKey) throw new Error("Web Push non ancora configurato. L'inbox resta attiva.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permesso notifiche non concesso.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) });
  const json = subscription.toJSON();
  await registerPayload({ platform: "web", deviceId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
  return "web";
}
