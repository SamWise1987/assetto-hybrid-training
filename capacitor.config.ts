import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell remoto-first: Capacitor carica il frontend Next.js su Vercel
 * e espone HealthKit / Health Connect. Imposta CAPACITOR_SERVER_URL o
 * NEXT_PUBLIC_APP_URL prima di `npx cap sync`.
 */
const remoteUrl =
  process.env.CAPACITOR_SERVER_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "";

const config: CapacitorConfig = {
  appId: "com.robertafunctional.app",
  appName: "RobertaFunctional",
  webDir: "www",
  server: remoteUrl
    ? {
        url: remoteUrl,
        cleartext: remoteUrl.startsWith("http://"),
        allowNavigation: [
          "localhost",
          "127.0.0.1",
          "*.vercel.app",
          "*.supabase.co",
        ],
      }
    : undefined,
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "RobertaFunctional",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#0b1a22",
  },
};

export default config;
