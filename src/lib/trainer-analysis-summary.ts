export interface TrainerAnalysisActivity {
  id: string;
  date: string;
  kind: string;
  source: string;
  status: string;
  label: string;
}

export interface TrainerAnalysisExternalActivity {
  id: string;
  kind: string;
  source: string;
  start_date: string;
}

export interface TrainerSourceFreshness {
  source: string;
  count: number;
  latestAt: string;
  quality: string;
}

const qualityBySource: Record<string, string> = {
  app: "Registrazione completa nell’app",
  web: "Registrazione effettuata dalla webapp",
  apple_health: "Dati Apple Health; la forza non include serie inventate",
  health_connect: "Dati Health Connect; la forza non include serie inventate",
  gpx: "Traccia GPS importata",
  strava: "Attività sincronizzata da Strava",
};

function activityTimestamp(date: string) {
  return date.includes("T") ? date : `${date}T12:00:00.000Z`;
}

export function buildTrainerSourceFreshness(input: {
  calendar: readonly TrainerAnalysisActivity[];
  external: readonly TrainerAnalysisExternalActivity[];
}) {
  const activities = new Map<string, { source: string; date: string }>();

  // Le attività esterne hanno la fonte più precisa. I log normalizzati con lo
  // stesso UUID vengono ignorati per evitare di contare due volte Health/GPX.
  for (const item of input.external) {
    activities.set(item.id, { source: item.source, date: item.start_date });
  }
  for (const item of input.calendar) {
    if (!activities.has(item.id)) {
      activities.set(item.id, { source: item.source || "app", date: activityTimestamp(item.date) });
    }
  }

  const grouped = new Map<string, TrainerSourceFreshness>();
  for (const item of activities.values()) {
    const source = item.source || "app";
    const current = grouped.get(source);
    if (!current) {
      grouped.set(source, {
        source,
        count: 1,
        latestAt: item.date,
        quality: qualityBySource[source] ?? "Attività registrata",
      });
    } else {
      current.count += 1;
      if (item.date > current.latestAt) current.latestAt = item.date;
    }
  }

  return [...grouped.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}
