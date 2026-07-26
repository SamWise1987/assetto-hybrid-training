import { describe, expect, it } from "vitest";
import { summarizeHealthVitals } from "./health-vitals";
import type { HealthMetricSample } from "./types";

describe("summarizeHealthVitals", () => {
  it("keeps the latest sample per metric type", () => {
    const samples: HealthMetricSample[] = [
      {
        id: "a",
        type: "restingHeartRate",
        value: 58,
        unit: "bpm",
        recordedAt: "2026-07-20T08:00:00.000Z",
        source: "apple_health",
        platform: "ios",
        importedAt: "2026-07-20T09:00:00.000Z",
      },
      {
        id: "b",
        type: "restingHeartRate",
        value: 52,
        unit: "bpm",
        recordedAt: "2026-07-21T08:00:00.000Z",
        source: "apple_health",
        platform: "ios",
        importedAt: "2026-07-21T09:00:00.000Z",
      },
      {
        id: "c",
        type: "oxygenSaturation",
        value: 0.98,
        unit: "percent",
        recordedAt: "2026-07-21T07:00:00.000Z",
        source: "apple_health",
        platform: "ios",
        importedAt: "2026-07-21T09:00:00.000Z",
      },
    ];

    const summary = summarizeHealthVitals(samples);
    expect(summary.find((item) => item.key === "restingHeartRate")?.display).toBe("52 bpm");
    expect(summary.find((item) => item.key === "oxygenSaturation")?.display).toBe("98%");
  });
});
