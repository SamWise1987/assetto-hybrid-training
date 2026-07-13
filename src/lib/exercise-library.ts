import libraryData from "@/data/exercise-library.json";
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
  const coreIds = new Set(EXERCISES.map((exercise) => exercise.id));
  return [...EXERCISES, ...wgerExercises.filter((exercise) => !coreIds.has(exercise.id))];
}

export function getExercisePatterns(): string[] {
  return [...new Set(getAllExercises().map((exercise) => exercise.pattern))].sort();
}

export function getExerciseCount(): number {
  return getAllExercises().length;
}
