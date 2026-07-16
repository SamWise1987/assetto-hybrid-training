import { describe, expect, it } from "vitest";
import { nativeHealthReadTypes, nativeHealthSyncStartDate, nativeWorkoutToExternalWorkout, nativeWorkoutToRunSession } from "./native-health";

describe("nativeWorkoutToRunSession", () => {
  it("richiede solo tipi supportati dalla piattaforma", () => {
    expect(nativeHealthReadTypes("ios")).toContain("exerciseTime");
    expect(nativeHealthReadTypes("android")).not.toContain("exerciseTime");
  });

  it("usa 30 giorni al primo import e poi riparte dall'ultimo sync con overlap", () => {
    const now = Date.parse("2026-07-14T12:00:00.000Z");
    expect(nativeHealthSyncStartDate(30, undefined, now)).toBe("2026-06-14T12:00:00.000Z");
    expect(nativeHealthSyncStartDate(30, "2026-07-14T10:00:00.000Z", now)).toBe("2026-07-12T10:00:00.000Z");
    expect(nativeHealthSyncStartDate(30, "non-valido", now)).toBe("2026-06-14T12:00:00.000Z");
  });

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

  it("imports Apple strength workouts as external summaries without fake sets", () => {
    const workout = nativeWorkoutToExternalWorkout(
      {
        workoutType: "traditionalStrengthTraining",
        duration: 3300,
        totalEnergyBurned: 410,
        startDate: "2026-07-13T17:00:00.000Z",
        endDate: "2026-07-13T17:55:00.000Z",
        platformId: "hk-strength-1",
        sourceName: "Apple Watch",
      },
      "ios",
    );

    expect(workout).toMatchObject({
      externalId: "hk-strength-1",
      source: "apple_health",
      platform: "ios",
      kind: "strength",
      durationMinutes: 55,
      caloriesKcal: 410,
    });
    expect(workout).not.toHaveProperty("setLogs");
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
