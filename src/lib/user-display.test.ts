import { describe, expect, it } from "vitest";
import { RUNNING_EXERCISES } from "@/data/running-exercises";
import { getAllExercises, getExercisePatterns, getRunningExercises } from "@/lib/exercise-library";
import { getDisplayName, getWelcomeGreeting } from "@/lib/user-display";
import { TEMPLATES } from "@/lib/program";

describe("user display", () => {
  it("prefers account displayName then profile name", () => {
    expect(getDisplayName({ displayName: "Roberta", email: "r@x.it" }, { name: "Atleta" })).toBe("Roberta");
    expect(getDisplayName(null, { name: "Alex" })).toBe("Alex");
    expect(getDisplayName({ displayName: "", email: "mia@x.it" }, { name: "Atleta" })).toBe("mia");
  });

  it("builds gendered welcome messages", () => {
    expect(getWelcomeGreeting("Alex", "benvenuto")).toBe("Benvenuto Alex");
    expect(getWelcomeGreeting("Alex", "benvenuta")).toBe("Benvenuta Alex");
    expect(getWelcomeGreeting("Alex", "neutral")).toBe("Benvenuto/a Alex");
  });
});

describe("running exercise dataset", () => {
  it("includes a dedicated corsa pattern set", () => {
    expect(RUNNING_EXERCISES.length).toBeGreaterThanOrEqual(12);
    expect(getRunningExercises().every((exercise) => exercise.pattern === "corsa")).toBe(true);
    expect(getExercisePatterns()).toContain("corsa");
    expect(getAllExercises().some((exercise) => exercise.id === "run-easy")).toBe(true);
  });
});

describe("scheda prescriptions", () => {
  it("exposes carico, pausa and hint on strength templates", () => {
    const strength = TEMPLATES.filter((template) => template.kind === "strength");
    expect(strength.length).toBeGreaterThan(0);
    for (const template of strength) {
      for (const prescription of template.prescriptions) {
        expect(prescription.restSeconds).toBeGreaterThan(0);
        expect(prescription.hint || prescription.variant).toBeTruthy();
      }
    }
  });
});
