import type { RunSession } from "./types";

export interface GpxTrackPoint {
  lat: number;
  lon: number;
  elevation?: number;
  time?: string;
}

export interface ParsedGpxActivity {
  name: string;
  startTime: string;
  durationMinutes: number;
  distanceKm: number;
  elevationGainM: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

function parseCoordinate(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function haversineKm(a: GpxTrackPoint, b: GpxTrackPoint) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function parseGpx(xml: string): ParsedGpxActivity | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;

  const trkpts = [...doc.querySelectorAll("trkpt")];
  if (!trkpts.length) return null;

  const points: GpxTrackPoint[] = trkpts.map((node) => ({
    lat: parseCoordinate(node.getAttribute("lat")),
    lon: parseCoordinate(node.getAttribute("lon")),
    elevation: parseCoordinate(node.querySelector("ele")?.textContent ?? null) || undefined,
    time: node.querySelector("time")?.textContent ?? undefined,
  }));

  const startTime = points.find((point) => point.time)?.time ?? new Date().toISOString();
  const endTime = [...points].reverse().find((point) => point.time)?.time ?? startTime;
  const durationMinutes = Math.max(
    1,
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000),
  );

  let distanceKm = 0;
  let elevationGainM = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceKm += haversineKm(points[index - 1], points[index]);
    if (points[index].elevation !== undefined && points[index - 1].elevation !== undefined) {
      const delta = points[index].elevation! - points[index - 1].elevation!;
      if (delta > 0) elevationGainM += delta;
    }
  }

  const name =
    doc.querySelector("trk > name")?.textContent ??
    doc.querySelector("metadata > name")?.textContent ??
    "Import GPX";

  return {
    name,
    startTime,
    durationMinutes,
    distanceKm: Math.round(distanceKm * 100) / 100,
    elevationGainM: Math.round(elevationGainM),
  };
}

export function gpxToRunSession(activity: ParsedGpxActivity, type: RunSession["type"] = "easy"): RunSession {
  const date = activity.startTime.slice(0, 10);
  const paceMinutes = activity.distanceKm > 0 ? activity.durationMinutes / activity.distanceKm : 0;
  return {
    id: crypto.randomUUID(),
    date,
    type,
    status: "complete",
    durationMinutes: activity.durationMinutes,
    distanceKm: activity.distanceKm,
    averagePace: activity.distanceKm
      ? `${Math.floor(paceMinutes)}:${String(Math.round((paceMinutes % 1) * 60)).padStart(2, "0")}`
      : undefined,
    rpe: 4,
    talkTest: "full-sentences",
    symptomsDuring: 0,
    source: "gpx",
    externalId: `gpx-${activity.startTime}`,
    elevationGainM: activity.elevationGainM,
    averageHeartRate: activity.averageHeartRate,
    maxHeartRate: activity.maxHeartRate,
  };
}
