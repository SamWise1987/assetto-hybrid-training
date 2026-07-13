import libraryData from "@/data/exercise-library.json";
import { RUNNING_EXERCISES } from "@/data/running-exercises";
import { EXERCISES } from "./program";
import type { ExerciseDefinition } from "./types";

export type LibraryExercise = ExerciseDefinition & {
  equipment?: string[];
  description?: string;
  imageUrl?: string | null;
  category?: string;
};

const wgerExercises = libraryData.exercises as LibraryExercise[];

export function getAllExercises(): LibraryExercise[] {
  const seen = new Set<string>();
  const merged: LibraryExercise[] = [];
  for (const exercise of [...EXERCISES, ...RUNNING_EXERCISES, ...wgerExercises]) {
    if (seen.has(exercise.id)) continue;
    seen.add(exercise.id);
    merged.push(exercise);
  }
  return merged;
}

export function getExerciseById(id: string): LibraryExercise | undefined {
  return getAllExercises().find((exercise) => exercise.id === id);
}

export function getExercisePatterns(): string[] {
  return [...new Set(getAllExercises().map((exercise) => exercise.pattern))].sort();
}

export function getExerciseCount(): number {
  return getAllExercises().length;
}

export function getRunningExercises(): LibraryExercise[] {
  return RUNNING_EXERCISES;
}
