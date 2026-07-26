import { describe, expect, it } from "vitest";
import { getRemoteAuthCallbackParams, mapAuthNetworkError } from "./remote-sync";

describe("getRemoteAuthCallbackParams", () => {
  it("unisce query e hash nei deep link Capacitor", () => {
    const params = getRemoteAuthCallbackParams(
      "com.robertafunctional.app://auth?type=invite#access_token=access&refresh_token=refresh",
    );
    expect(params.get("type")).toBe("invite");
    expect(params.get("access_token")).toBe("access");
    expect(params.get("refresh_token")).toBe("refresh");
  });

  it("supporta i callback PKCE con code", () => {
    const params = getRemoteAuthCallbackParams("com.robertafunctional.app://auth?type=recovery&code=pkce-code");
    expect(params.get("type")).toBe("recovery");
    expect(params.get("code")).toBe("pkce-code");
  });
});

describe("mapAuthNetworkError", () => {
  it("traduce Failed to fetch in messaggio operativo", () => {
    const mapped = mapAuthNetworkError(new Error("Failed to fetch"));
    expect(mapped.message).toMatch(/Servizio account non raggiungibile/);
  });

  it("lascia invariati gli errori Auth di Supabase", () => {
    const mapped = mapAuthNetworkError(new Error("Invalid login credentials"));
    expect(mapped.message).toBe("Invalid login credentials");
  });
});
