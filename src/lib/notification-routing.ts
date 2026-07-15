import type { AppTab } from "./store";

const NOTIFICATION_TABS = new Set<AppTab>([
  "today",
  "calendar",
  "progress",
  "analysis",
  "exercises",
  "clients",
  "coach",
  "inbox",
  "settings",
]);

/**
 * Converte esclusivamente deep link interni dell'app in una tab nota.
 * URL esterni o valori non riconosciuti non devono poter pilotare la shell.
 */
export function notificationTabFromHref(href?: string, currentOrigin = "https://app.robertafunctional.local"): AppTab | null {
  if (!href) return null;
  try {
    const base = new URL(currentOrigin);
    const url = new URL(href, base);
    const isCapacitorLink = url.protocol === "com.robertafunctional.app:";
    const isInternalWebLink = (url.protocol === "http:" || url.protocol === "https:") && url.origin === base.origin;
    if (!isCapacitorLink && !isInternalWebLink) return null;
    const tab = url.searchParams.get("tab") as AppTab | null;
    return tab && NOTIFICATION_TABS.has(tab) ? tab : null;
  } catch {
    return null;
  }
}

export function notificationHrefForTab(tab: AppTab) {
  return `/?tab=${encodeURIComponent(tab)}`;
}
