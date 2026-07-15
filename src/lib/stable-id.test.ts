import { describe, expect, it } from "vitest";
import { stableRecordId } from "./stable-id";

describe("stableRecordId", () => {
  it("returns the same valid UUID for the same native record", () => {
    const first = stableRecordId("apple_health", "native-123");
    expect(stableRecordId("apple_health", "native-123")).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("separates platforms and native ids", () => {
    expect(stableRecordId("apple_health", "native-123")).not.toBe(stableRecordId("health_connect", "native-123"));
    expect(stableRecordId("apple_health", "native-123")).not.toBe(stableRecordId("apple_health", "native-456"));
  });
});
