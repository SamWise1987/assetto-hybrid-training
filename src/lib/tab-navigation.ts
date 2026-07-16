"use client";

import { useCallback } from "react";
import { notificationHrefForTab, notificationTabFromHref } from "./notification-routing";
import { useAppStore, type AppTab } from "./store";

interface TabNavigationOptions {
  replace?: boolean;
}

export function syncBrowserTabHref(tab: AppTab, options: TabNavigationOptions = {}) {
  if (typeof window === "undefined") return;
  const href = notificationHrefForTab(tab);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === href) return;
  window.history[options.replace ? "replaceState" : "pushState"]({}, "", href);
}

export function tabFromBrowserLocation() {
  if (typeof window === "undefined") return null;
  return notificationTabFromHref(window.location.href, window.location.origin);
}

/** Mantiene stato React, URL web e cronologia browser sullo stesso tab. */
export function useTabNavigation() {
  const setTab = useAppStore((state) => state.setTab);
  return useCallback((tab: AppTab, options: TabNavigationOptions = {}) => {
    setTab(tab);
    syncBrowserTabHref(tab, options);
  }, [setTab]);
}
