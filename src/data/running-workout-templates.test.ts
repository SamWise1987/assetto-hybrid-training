import { describe, expect, it } from "vitest";
import { RUNNING_WORKOUT_TEMPLATES } from "./running-workout-templates";

describe("running workout library", () => {
  it("contains versionable structured workouts with warm-up and cool-down", () => {
    expect(new Set(RUNNING_WORKOUT_TEMPLATES.map((item) => item.id)).size).toBe(RUNNING_WORKOUT_TEMPLATES.length);
    for (const workout of RUNNING_WORKOUT_TEMPLATES) {
      expect(workout.segments.length).toBeGreaterThanOrEqual(3);
      expect(workout.segments[0]?.phase).toBe("warmup");
      expect(workout.segments.at(-1)?.phase).toBe("cooldown");
      expect(new Date(workout.updatedAt).toString()).not.toBe("Invalid Date");
    }
  });
});
