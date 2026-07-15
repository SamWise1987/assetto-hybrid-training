import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env.local");
const values = {};

if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
}

const checks = [];
const add = (label, ok, detail) => checks.push({ label, ok, detail });
const configured = (key) => {
  const value = process.env[key] ?? values[key] ?? "";
  return Boolean(value && !/^(your@|sb_(publishable|secret)_\.\.\.|sk-\.\.\.|\.\.\.)/i.test(value));
};

const groups = {
  "Backend condiviso": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL", "CAPACITOR_SERVER_URL"],
  "Web Push": ["NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY", "WEB_PUSH_PRIVATE_KEY", "WEB_PUSH_SUBJECT"],
  "Android FCM": ["FCM_PROJECT_ID", "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY"],
  "iOS APNs": ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_PRIVATE_KEY", "APNS_BUNDLE_ID", "APNS_ENVIRONMENT"],
};

for (const [label, keys] of Object.entries(groups)) {
  const missing = keys.filter((key) => !configured(key));
  add(label, missing.length === 0, missing.length ? `mancano: ${missing.join(", ")}` : "variabili locali configurate");
}

const googlePath = resolve(root, "android/app/google-services.json");
let googleValid = false;
let googleDetail = "file assente";
if (existsSync(googlePath)) {
  try {
    const json = JSON.parse(readFileSync(googlePath, "utf8"));
    const packages = (json.client ?? []).map((client) => client?.client_info?.android_client_info?.package_name).filter(Boolean);
    googleValid = packages.includes("com.robertafunctional.app");
    googleDetail = googleValid ? "package com.robertafunctional.app corretto" : "package Android non corrispondente";
  } catch {
    googleDetail = "JSON non valido";
  }
}
add("google-services.json", googleValid, googleDetail);

const infoPlist = readFileSync(resolve(root, "ios/App/App/Info.plist"), "utf8");
const entitlements = readFileSync(resolve(root, "ios/App/App/App.entitlements"), "utf8");
add("iOS Remote notifications", infoPlist.includes("remote-notification"), "UIBackgroundModes");
add("iOS Push entitlement", entitlements.includes("aps-environment"), "aps-environment");
add("iOS HealthKit entitlement", entitlements.includes("com.apple.developer.healthkit"), "HealthKit");

for (const migration of ["004_platform_foundation.sql", "005_privacy_hardening.sql", "006_notification_idempotency.sql", "007_onboarding_consent.sql", "008_pending_plan_activation_notification.sql"]) {
  add(`Migrazione ${migration.slice(0, 3)}`, existsSync(resolve(root, "supabase/migrations", migration)), migration);
}

for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.label}: ${check.detail}`);
const missing = checks.filter((check) => !check.ok).length;
console.log(missing ? `\nProntezza incompleta: ${missing} controllo/i da completare.` : "\nConfigurazione locale pronta per i test di produzione.");
process.exitCode = missing ? 1 : 0;
