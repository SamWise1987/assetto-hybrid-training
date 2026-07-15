import { describe, expect, it } from "vitest";
import { sanitizeErrorContext, sanitizeErrorMessage } from "./error-sanitizer";

describe("privacy-safe error monitoring", () => {
  it("rimuove credenziali, email, URL, identificativi e percorsi locali", () => {
    const message = sanitizeErrorMessage(
      "POST https://api.example.test/users?id=1 failed for alex@example.com authorization=Bearer secret-token user 11111111-1111-4111-8111-111111111111 at /Users/alex/app/file.ts",
      "api",
    );

    expect(message).not.toContain("alex@example.com");
    expect(message).not.toContain("secret-token");
    expect(message).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(message).not.toContain("/Users/alex");
    expect(message).toContain("[email]");
    expect(message).toContain("[redacted]");
  });

  it("generalizza gli errori Health prima che siano visibili all'admin", () => {
    expect(sanitizeErrorMessage("HealthKit permission denied for shoulder pain samples", "health")).toBe("Permesso Health non concesso.");
    expect(sanitizeErrorMessage("Unexpected workout payload with medical notes", "health")).toBe("Sincronizzazione Health non riuscita.");
  });

  it("conserva soltanto metadati diagnostici esplicitamente ammessi", () => {
    expect(sanitizeErrorContext({
      status: 409,
      itemCount: 3,
      route: "https://example.test/api/sync?token=secret",
      limitations: ["dolore spalla"],
      healthPayload: { heartRate: 180 },
      email: "alex@example.com",
    })).toEqual({ status: 409, itemCount: 3, route: "[url]" });
  });
});
