import { describe, expect, it } from "vitest";
import { notificationDedupeKey } from "./notification-events";
import { apnsDeliveryResult } from "./push-delivery";

describe("notificationDedupeKey", () => {
  it("resta stabile per i retry dello stesso evento", () => {
    const input = { recipientUserId: "trainer-1", type: "workout_completed", entityId: "session-1" };
    expect(notificationDedupeKey(input)).toBe(notificationDedupeKey(input));
  });

  it("distingue versioni successive dello stesso piano", () => {
    const base = { recipientUserId: "athlete-1", type: "plan_updated", entityId: "plan-1" };
    expect(notificationDedupeKey({ ...base, revision: 2 })).not.toBe(notificationDedupeKey({ ...base, revision: 3 }));
  });
});

describe("apnsDeliveryResult", () => {
  it("rimuove solo i token APNs definitivamente non validi", () => {
    expect(apnsDeliveryResult(200)).toBe(1);
    expect(apnsDeliveryResult(410, "Unregistered")).toBe(-1);
    expect(apnsDeliveryResult(400, "BadDeviceToken")).toBe(-1);
    expect(apnsDeliveryResult(400, "DeviceTokenNotForTopic")).toBe(-1);
    expect(apnsDeliveryResult(429, "TooManyRequests")).toBe(0);
    expect(apnsDeliveryResult(403, "InvalidProviderToken")).toBe(0);
  });
});
