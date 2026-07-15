import { Capacitor } from "@capacitor/core";
import type { PlatformSource } from "./types";

export function currentPlatform(): PlatformSource {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}
