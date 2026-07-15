import type { RunningWorkoutTemplate } from "@/lib/types";

const updatedAt = "2026-07-14T00:00:00.000Z";

export const RUNNING_WORKOUT_TEMPLATES: RunningWorkoutTemplate[] = [
  {
    id: "run-template-easy-30", name: "Corsa facile 30′", category: "easy", level: "beginner",
    objective: "Base aerobica e recupero attivo", estimatedMinutes: 30, safetyNotes: ["Mantieni frasi complete durante il talk test"], updatedAt,
    segments: [
      { id: "easy30-w", phase: "warmup", durationSeconds: 300, targetRpe: [2, 3], instructions: "Camminata veloce o corsa molto facile" },
      { id: "easy30-m", phase: "work", durationSeconds: 1200, targetRpe: [3, 4], targetHeartRateZone: "Z2", instructions: "Ritmo conversazionale regolare" },
      { id: "easy30-c", phase: "cooldown", durationSeconds: 300, targetRpe: [1, 2], instructions: "Rallenta gradualmente" },
    ],
  },
  {
    id: "run-template-long-60", name: "Lungo facile 60′", category: "long", level: "intermediate",
    objective: "Costruire volume aerobico", estimatedMinutes: 60, safetyNotes: ["Non aumentare il volume settimanale oltre il 10%"], updatedAt,
    segments: [
      { id: "long60-w", phase: "warmup", durationSeconds: 600, targetRpe: [2, 3], instructions: "Partenza molto controllata" },
      { id: "long60-m", phase: "work", durationSeconds: 2700, targetRpe: [3, 4], targetHeartRateZone: "Z2", instructions: "Ritmo facile e costante" },
      { id: "long60-c", phase: "cooldown", durationSeconds: 300, targetRpe: [1, 2], instructions: "Defaticamento camminando" },
    ],
  },
  {
    id: "run-template-tempo-40", name: "Tempo controllato 40′", category: "tempo", level: "intermediate",
    objective: "Migliorare la soglia senza lavoro massimale", estimatedMinutes: 40, safetyNotes: ["Interrompi il blocco se non mantieni una tecnica stabile"], updatedAt,
    segments: [
      { id: "tempo40-w", phase: "warmup", durationSeconds: 600, targetRpe: [2, 4], instructions: "Corsa facile progressiva" },
      { id: "tempo40-m", phase: "work", durationSeconds: 1200, targetRpe: [6, 7], instructions: "Impegnativo ma sostenibile" },
      { id: "tempo40-r", phase: "recovery", durationSeconds: 300, targetRpe: [2, 3], instructions: "Corsa facile" },
      { id: "tempo40-c", phase: "cooldown", durationSeconds: 300, targetRpe: [1, 2], instructions: "Defaticamento" },
    ],
  },
  {
    id: "run-template-intervals-400", name: "6 × 400 m controllati", category: "intervals", level: "intermediate",
    objective: "Economia di corsa e VO₂ con recupero completo", estimatedMinutes: 45, safetyNotes: ["Nessuna ripetuta all-out", "Riscaldamento obbligatorio"], updatedAt,
    segments: [
      { id: "i400-w", phase: "warmup", durationSeconds: 720, targetRpe: [2, 4], instructions: "Corsa facile + mobilità dinamica" },
      { id: "i400-m", phase: "work", repeats: 6, distanceMeters: 400, targetRpe: [7, 8], instructions: "Ritmo brillante e tecnica stabile" },
      { id: "i400-r", phase: "recovery", repeats: 6, durationSeconds: 120, targetRpe: [2, 3], instructions: "Trotto o camminata" },
      { id: "i400-c", phase: "cooldown", durationSeconds: 600, targetRpe: [1, 3], instructions: "Corsa facile" },
    ],
  },
  {
    id: "run-template-hills", name: "8 salite brevi", category: "hills", level: "advanced",
    objective: "Forza specifica e tecnica", estimatedMinutes: 40, safetyNotes: ["Recupera in discesa senza correre aggressivamente"], updatedAt,
    segments: [
      { id: "hills-w", phase: "warmup", durationSeconds: 720, targetRpe: [2, 4], instructions: "Corsa facile e drills" },
      { id: "hills-m", phase: "work", repeats: 8, durationSeconds: 45, targetRpe: [7, 8], instructions: "Salita controllata" },
      { id: "hills-r", phase: "recovery", repeats: 8, durationSeconds: 90, targetRpe: [1, 2], instructions: "Rientro camminando" },
      { id: "hills-c", phase: "cooldown", durationSeconds: 480, targetRpe: [1, 3], instructions: "Defaticamento facile" },
    ],
  },
];
