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
export function notificationTabFromHref(href?: string): AppTab | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://app.robertafunctional.local");
    if (url.origin !== "https://app.robertafunctional.local") return null;
    const tab = url.searchParams.get("tab") as AppTab | null;
    return tab && NOTIFICATION_TABS.has(tab) ? tab : null;
  } catch {
    return null;
  }
}

export function notificationHrefForTab(tab: AppTab) {
  return `/?tab=${encodeURIComponent(tab)}`;
}
