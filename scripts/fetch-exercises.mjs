#!/usr/bin/env node
/**
 * Scarica la libreria esercizi da wger.de (open source, CC-BY-SA)
 * Uso: npm run fetch-exercises
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IT = 13;
const EN = 2;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/data/exercise-library.json");

const categories = {};
const muscles = {};
const equipment = {};

async function fetchAll(url) {
  const items = [];
  let next = url;
  while (next) {
    const res = await fetch(next);
    const data = await res.json();
    items.push(...data.results);
    next = data.next;
    process.stderr.write(`Fetched ${items.length}/${data.count}\r`);
  }
  process.stderr.write("\n");
  return items;
}

for (const [key, url] of Object.entries({
  categories: "https://wger.de/api/v2/exercisecategory/?limit=100",
  muscles: "https://wger.de/api/v2/muscle/?limit=100",
  equipment: "https://wger.de/api/v2/equipment/?limit=100",
})) {
  const items = await fetchAll(url);
  for (const item of items) {
    if (key === "categories") categories[item.id] = item.name;
    if (key === "muscles") muscles[item.id] = item.name;
    if (key === "equipment") equipment[item.id] = item.name;
  }
}

const exercises = await fetchAll("https://wger.de/api/v2/exerciseinfo/?limit=100");

const mapCategory = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("chest") || n.includes("petto")) return "spinta orizzontale";
  if (n.includes("back") || n.includes("schiena")) return "tirata orizzontale";
  if (n.includes("shoulder") || n.includes("spalle")) return "spinta verticale";
  if (n.includes("arms") || n.includes("braccia")) return "braccia";
  if (n.includes("legs") || n.includes("gambe")) return "squat";
  if (n.includes("abs") || n.includes("addom")) return "core anti-estensione";
  if (n.includes("cardio")) return "cardio";
  if (n.includes("calves") || n.includes("polpacci")) return "polpacci";
  return name || "generale";
};

const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);

const library = exercises
  .map((ex) => {
    const itTrans =
      ex.translations?.find((t) => t.language === IT) ||
      ex.translations?.find((t) => t.language === EN) ||
      ex.translations?.[0];
    const name = itTrans?.name || "Esercizio";
    const muscleGroups = [
      ...(ex.muscles || []).map((m) => muscles[m.id] || m.name_en || m.name).filter(Boolean),
      ...(ex.muscles_secondary || []).map((m) => muscles[m.id] || m.name_en || m.name).filter(Boolean),
    ].slice(0, 4);
    const equip = (ex.equipment || []).map((e) => equipment[e.id] || e.name).filter(Boolean);
    const image = ex.images?.find((i) => i.is_main)?.image || ex.images?.[0]?.image || null;
    const catName = categories[ex.category?.id] || ex.category?.name || "";
    return {
      id: `wger-${ex.uuid}`,
      name,
      pattern: mapCategory(catName),
      muscleGroups: muscleGroups.length ? muscleGroups : [catName || "Generale"],
      equipment: equip,
      substitutions: [],
      description: stripHtml(itTrans?.description),
      imageUrl: image,
      category: catName,
      unilateral: /unilateral|one.?leg|one.?arm|single/i.test(`${name} ${itTrans?.description || ""}`),
      upperBody: /chest|back|shoulder|arm|petto|schiena|spall|bracc/i.test(muscleGroups.join(" ")),
    };
  })
  .filter((e) => e.name && e.name !== "Esercizio");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ count: library.length, fetchedAt: new Date().toISOString(), exercises: library }));
console.log(`Saved ${library.length} exercises to ${OUT}`);
