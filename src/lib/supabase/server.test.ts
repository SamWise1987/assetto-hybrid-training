import { afterEach, describe, expect, it, vi } from "vitest";
import { probeSupabaseReachable } from "./server";

describe("probeSupabaseReachable", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("restituisce null se le env non sono configurate", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    await expect(probeSupabaseReachable()).resolves.toBeNull();
  });

  it("restituisce true quando Auth health risponde ok", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(probeSupabaseReachable()).resolves.toBe(true);
  });

  it("restituisce false quando il fetch fallisce", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(probeSupabaseReachable()).resolves.toBe(false);
  });
});
