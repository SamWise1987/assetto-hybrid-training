import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function workspaceFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("configurazione nativa", () => {
  it("mantiene Health Connect in sola lettura e abilita le notifiche Android", () => {
    const manifest = workspaceFile("android/app/src/main/AndroidManifest.xml");
    const healthPluginManifest = workspaceFile("node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml");
    expect(manifest).toContain("android.permission.POST_NOTIFICATIONS");
    expect(manifest).toContain("android.permission.health.READ_HEALTH_DATA_HISTORY");
    expect(manifest).toContain('android.permission.health.WRITE_HEART_RATE" tools:node="remove"');
    expect(healthPluginManifest).toContain("android.permission.health.READ_EXERCISE");
  });

  it("mantiene HealthKit, push e deep link nel progetto iOS", () => {
    const info = workspaceFile("ios/App/App/Info.plist");
    const entitlements = workspaceFile("ios/App/App/App.entitlements");
    expect(info).toContain("NSHealthShareUsageDescription");
    expect(info).toContain("com.robertafunctional.app");
    expect(entitlements).toContain("com.apple.developer.healthkit");
    expect(entitlements).toContain("aps-environment");
  });
});
