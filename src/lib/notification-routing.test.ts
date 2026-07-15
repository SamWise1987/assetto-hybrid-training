import { describe, expect, it } from "vitest";
import { notificationHrefForTab, notificationTabFromHref } from "./notification-routing";

describe("notification routing", () => {
  it("riconosce i deep link interni supportati", () => {
    expect(notificationTabFromHref("/?tab=analysis")).toBe("analysis");
    expect(notificationTabFromHref("https://app.robertafunctional.local/?tab=clients")).toBe("clients");
    expect(notificationTabFromHref("https://assetto-hybrid-training.vercel.app/?tab=inbox", "https://assetto-hybrid-training.vercel.app")).toBe("inbox");
    expect(notificationTabFromHref("com.robertafunctional.app://open?tab=settings", "https://assetto-hybrid-training.vercel.app")).toBe("settings");
  });

  it("rifiuta destinazioni esterne o tab sconosciute", () => {
    expect(notificationTabFromHref("https://example.com/?tab=today")).toBeNull();
    expect(notificationTabFromHref("https://example.com/?tab=today", "https://assetto-hybrid-training.vercel.app")).toBeNull();
    expect(notificationTabFromHref("/?tab=billing")).toBeNull();
    expect(notificationTabFromHref()).toBeNull();
  });

  it("genera un URL condivisibile per web e Capacitor", () => {
    expect(notificationHrefForTab("inbox")).toBe("/?tab=inbox");
  });
});
