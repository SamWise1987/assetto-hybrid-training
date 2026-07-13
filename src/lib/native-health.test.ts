import { describe, expect, it } from "vitest";
import { nativeWorkoutToRunSession } from "./native-health";

describe("nativeWorkoutToRunSession", () => {
  it("maps running workouts from Apple Health", () => {
    const run = nativeWorkoutToRunSession(
      {
        workoutType: "running",
        duration: 2700,
        totalDistance: 5500,
        startDate: "2026-07-08T07:00:00.000Z",
        endDate: "2026-07-08T07:45:00.000Z",
        platformId: "hk-123",
        sourceName: "Apple Watch",
      },
      "ios",
    );

    expect(run).toMatchObject({
      type: "easy",
      durationMinutes: 45,
      distanceKm: 5.5,
      source: "apple_health",
      externalId: "hk-123",
      status: "complete",
    });
  });

  it("maps walking as walk and skips cycling", () => {
    const walk = nativeWorkoutToRunSession(
      {
        workoutType: "walking",
        duration: 1800,
        totalDistance: 2000,
        startDate: "2026-07-08T07:00:00.000Z",
        endDate: "2026-07-08T07:30:00.000Z",
        platformId: "hc-1",
      },
      "android",
    );
    expect(walk?.type).toBe("walk");
    expect(walk?.source).toBe("health_connect");

    const bike = nativeWorkoutToRunSession(
      {
        workoutType: "cycling",
        duration: 3600,
        totalDistance: 20000,
        startDate: "2026-07-08T07:00:00.000Z",
        endDate: "2026-07-08T08:00:00.000Z",
      },
      "android",
    );
    expect(bike).toBeNull();
  });
});
