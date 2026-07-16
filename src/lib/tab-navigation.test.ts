import { afterEach, describe, expect, it, vi } from "vitest";
import { syncBrowserTabHref, tabFromBrowserLocation } from "./tab-navigation";

function browserWindow(pathname = "/", search = "") {
  const pushState = vi.fn();
  const replaceState = vi.fn();
  vi.stubGlobal("window", {
    location: {
      origin: "https://app.example.com",
      href: `https://app.example.com${pathname}${search}`,
      pathname,
      search,
    },
    history: { pushState, replaceState },
  });
  return { pushState, replaceState };
}

describe("tab navigation URL", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aggiunge alla cronologia una nuova sezione", () => {
    const history = browserWindow();
    syncBrowserTabHref("calendar");
    expect(history.pushState).toHaveBeenCalledWith({}, "", "/?tab=calendar");
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("sostituisce una route non consentita senza aggiungere una voce", () => {
    const history = browserWindow("/", "?tab=clients");
    syncBrowserTabHref("today", { replace: true });
    expect(history.replaceState).toHaveBeenCalledWith({}, "", "/?tab=today");
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it("ripristina il tab da un URL web interno", () => {
    browserWindow("/", "?tab=analysis");
    expect(tabFromBrowserLocation()).toBe("analysis");
  });
});
