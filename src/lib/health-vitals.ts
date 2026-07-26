import type { HealthMetricSample, HealthMetricType } from "./types";

const LABELS: Record<HealthMetricType, string> = {
  restingHeartRate: "FC a riposo",
  heartRateVariability: "HRV",
  respiratoryRate: "Respiro",
  oxygenSaturation: "SpO₂",
  steps: "Passi",
  sleepMinutes: "Sonno",
};

const UNITS: Record<HealthMetricType, string> = {
  restingHeartRate: "bpm",
  heartRateVariability: "ms",
  respiratoryRate: "/min",
  oxygenSaturation: "%",
  steps: "",
  sleepMinutes: "min",
};

export interface HealthVitalSummary {
  key: HealthMetricType;
  label: string;
  display: string;
  when: string;
  value: number;
}

export function summarizeHealthVitals(samples: HealthMetricSample[]): HealthVitalSummary[] {
  const latestByType = new Map<HealthMetricType, HealthMetricSample>();
  for (const sample of samples) {
    const current = latestByType.get(sample.type);
    if (!current || new Date(sample.recordedAt).getTime() > new Date(current.recordedAt).getTime()) {
      latestByType.set(sample.type, sample);
    }
  }

  return (Object.keys(LABELS) as HealthMetricType[])
    .map((type) => {
      const sample = latestByType.get(type);
      if (!sample) return null;
      const unit = UNITS[type];
      const display = type === "oxygenSaturation"
        ? `${Math.round(sample.value * (sample.value <= 1 ? 100 : 1))}%`
        : type === "steps"
          ? `${Math.round(sample.value)}`
          : `${Math.round(sample.value)}${unit ? ` ${unit}` : ""}`;
      return {
        key: type,
        label: LABELS[type],
        display,
        when: new Date(sample.recordedAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        value: sample.value,
      };
    })
    .filter((item): item is HealthVitalSummary => Boolean(item));
}
