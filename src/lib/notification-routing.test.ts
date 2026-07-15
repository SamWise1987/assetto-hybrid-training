import { describe, expect, it } from "vitest";
import { notificationHrefForTab, notificationTabFromHref } from "./notification-routing";

describe("notification routing", () => {
  it("riconosce i deep link interni supportati", () => {
    expect(notificationTabFromHref("/?tab=analysis")).toBe("analysis");
    expect(notificationTabFromHref("https://app.robertafunctional.local/?tab=clients")).toBe("clients");
  });

  it("rifiuta destinazioni esterne o tab sconosciute", () => {
    expect(notificationTabFromHref("https://example.com/?tab=today")).toBeNull();
    expect(notificationTabFromHref("/?tab=billing")).toBeNull();
    expect(notificationTabFromHref()).toBeNull();
  });

  it("genera un URL condivisibile per web e Capacitor", () => {
    expect(notificationHrefForTab("inbox")).toBe("/?tab=inbox");
  });
});
