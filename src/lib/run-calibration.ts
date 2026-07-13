import { addDays, getDay, startOfWeek } from "date-fns";
import type { RunCalibrationDecision, RunPlan, RunSession } from "./types";
import { capWeeklyRunMinutes } from "./autoregulation";

export const RUN_DAYS = { tuesday: 2, saturday: 6 } as const;

export interface WeeklyRunContext {
  weekNumber: number;
  previousWeekTotalMinutes: number;
  runsEasyOnly: boolean;
  legSoreness?: number;
  fridayLowerBodyHeavy?: boolean;
}

export interface RunCalibrationInput {
  tuesdayPlanned: Pick<RunPlan, "durationMinutes" | "type">;
  tuesdayActual: RunSession;
  saturdayOriginal: Pick<RunPlan, "durationMinutes" | "type">;
  context: WeeklyRunContext;
  targetDate: string;
}

const roundMinutes = (value: number) => Math.max(5, Math.round(value / 5) * 5);

const makeDecision = (
  input: RunCalibrationInput,
  rule: string,
  reason: string,
  output: Pick<RunPlan, "type" | "durationMinutes">,
): RunCalibrationDecision => ({
  id: `run-cal-${input.targetDate}-${Date.now()}`,
  date: input.tuesdayActual.date,
  targetDate: input.targetDate,
  targetDayOfWeek: RUN_DAYS.saturday,
  rule,
  reason,
  inputs: {
    tuesdayPlanned: input.tuesdayPlanned.durationMinutes,
    tuesdayActual: input.tuesdayActual.durationMinutes,
    tuesdayRpe: input.tuesdayActual.rpe,
    tuesdaySymptoms: input.tuesdayActual.symptomsDuring,
    saturdayOriginal: input.saturdayOriginal,
    context: input.context,
  },
  previousPlan: {
    type: input.saturdayOriginal.type,
    durationMinutes: input.saturdayOriginal.durationMinutes,
  },
  outputPlan: output,
});

export function calibrateSaturdayRun(input: RunCalibrationInput): RunCalibrationDecision {
  const { tuesdayPlanned, tuesdayActual, saturdayOriginal, context } = input;
  const shortfall = Math.max(0, tuesdayPlanned.durationMinutes - tuesdayActual.durationMinutes);
  const weeklyLimit = capWeeklyRunMinutes(context.previousWeekTotalMinutes, Number.MAX_SAFE_INTEGER);
  const remainingBudget = Math.max(0, weeklyLimit - tuesdayActual.durationMinutes);

  if (
    tuesdayActual.status === "stopped" ||
    tuesdayActual.symptomsDuring > 3 ||
    tuesdayActual.rpe >= 8
  ) {
    const duration = roundMinutes(Math.min(saturdayOriginal.durationMinutes * 0.75, remainingBudget));
    return makeDecision(
      input,
      "SYMPTOMS_OR_HIGH_RPE",
      "Martedì difficile o con sintomi: sabato più corto e sempre facile.",
      { type: "easy", durationMinutes: duration },
    );
  }

  if (context.legSoreness !== undefined && context.legSoreness >= 7) {
    return makeDecision(
      input,
      "LEG_SORENESS_CONVERT_EASY",
      "Gambe affaticate dopo il venerdì: sabato convertito in corsa facile.",
      {
        type: "easy",
        durationMinutes: roundMinutes(Math.min(saturdayOriginal.durationMinutes, remainingBudget)),
      },
    );
  }

  if (context.runsEasyOnly || context.weekNumber <= 2) {
    const duration = roundMinutes(Math.min(saturdayOriginal.durationMinutes, remainingBudget));
    return makeDecision(
      input,
      "EARLY_BLOCK_EASY_ONLY",
      "Settimane 1–2: sabato resta facile entro il tetto settimanale.",
      { type: "easy", durationMinutes: duration },
    );
  }

  if (shortfall === 0) {
    const duration = roundMinutes(Math.min(saturdayOriginal.durationMinutes, remainingBudget));
    return makeDecision(
      input,
      "TUESDAY_ON_PLAN",
      "Martedì completato come previsto: sabato invariato entro il tetto +10%.",
      { type: saturdayOriginal.type, durationMinutes: duration },
    );
  }

  const shortfallRatio = shortfall / tuesdayPlanned.durationMinutes;

  if (shortfallRatio > 0.4 || tuesdayActual.rpe >= 6) {
    const duration = roundMinutes(
      Math.min(saturdayOriginal.durationMinutes * 0.9, remainingBudget),
    );
    return makeDecision(
      input,
      "LARGE_SHORTFALL_NO_AGGRESSIVE_CATCHUP",
      `Martedì −${shortfall} min con fatica percepita: sabato leggermente ridotto, senza recupero aggressivo.`,
      {
        type: saturdayOriginal.type === "controlled-quality" ? "long-easy" : "easy",
        durationMinutes: duration,
      },
    );
  }

  const catchUp = Math.min(shortfall * 0.5, 15);
  const duration = roundMinutes(
    Math.min(saturdayOriginal.durationMinutes + catchUp, remainingBudget),
  );
  return makeDecision(
    input,
    "PARTIAL_CATCHUP_SMART",
    `Martedì −${shortfall} min con RPE basso: sabato +${catchUp} min, entro il tetto settimanale.`,
    { type: saturdayOriginal.type, durationMinutes: duration },
  );
}

export function defaultRunPlanForDay(
  week: number,
  dayOfWeek: number,
  date: string,
): RunPlan | null {
  if (dayOfWeek === RUN_DAYS.tuesday) {
    return {
      id: `plan-${date}`,
      date,
      dayOfWeek,
      week,
      type: "easy",
      durationMinutes: week <= 2 ? 35 : 50,
      status: "planned",
      notes: ["RPE 3–4", "Talk test: frasi complete"],
    };
  }
  if (dayOfWeek === RUN_DAYS.saturday) {
    const qualityWeek = week >= 3 && week % 2 === 1;
    return {
      id: `plan-${date}`,
      date,
      dayOfWeek,
      week,
      type: week <= 2 ? "easy" : qualityWeek ? "controlled-quality" : "long-easy",
      durationMinutes: week <= 2 ? 40 : qualityWeek ? 50 : 55,
      status: "planned",
      notes: week <= 2 ? ["Sempre facile nelle prime due settimane"] : undefined,
    };
  }
  return null;
}

export function weekDates(reference = new Date()) {
  const monday = startOfWeek(reference, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return { date: date.toISOString().slice(0, 10), dayOfWeek: getDay(date) };
  });
}

export function sumRunMinutes(runs: readonly Pick<RunSession, "durationMinutes">[]) {
  return runs.reduce((total, run) => total + run.durationMinutes, 0);
}
