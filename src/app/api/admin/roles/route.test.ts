import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRemoteUserProfile: vi.fn(),
  createServiceSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getRemoteUserProfile: mocks.getRemoteUserProfile,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceSupabaseClient: mocks.createServiceSupabaseClient,
}));

import { POST } from "./route";

type RoleRow = { user_id: string; email: string; role: "admin" | "coach" | "athlete" };

function createService(existing: RoleRow | null, updated: RoleRow | null = null) {
  const update = vi.fn();
  const auditInsert = vi.fn(async () => ({ error: null }));

  const service = {
    from: vi.fn((table: string) => {
      if (table === "audit_log") return { insert: auditInsert };
      if (table !== "user_roles") throw new Error(`Tabella inattesa: ${table}`);

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
          })),
        })),
        update: update.mockImplementation((payload: { role: RoleRow["role"] }) => ({
          eq: vi.fn((column: string, value: string) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: updated ?? (existing ? { ...existing, role: payload.role } : null),
                error: null,
              })),
            })),
            column,
            value,
          })),
        })),
      };
    }),
  };

  return { service, update, auditInsert };
}

function roleRequest(email: string, role: RoleRow["role"]) {
  return new Request("http://localhost/api/admin/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

describe("POST /api/admin/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemoteUserProfile.mockResolvedValue({ userId: "admin-id", role: "admin" });
  });

  it("restituisce 404 senza dichiarare successo se l'email non esiste", async () => {
    const { service, update, auditInsert } = createService(null);
    mocks.createServiceSupabaseClient.mockReturnValue(service);

    const response = await POST(roleRequest("Missing@Example.com", "coach"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Account non trovato." });
    expect(update).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("aggiorna il ruolo e registra attore, destinatario e variazione", async () => {
    const existing: RoleRow = { user_id: "athlete-id", email: "user@example.com", role: "athlete" };
    const { service, update, auditInsert } = createService(existing);
    mocks.createServiceSupabaseClient.mockReturnValue(service);

    const response = await POST(roleRequest("USER@EXAMPLE.COM", "coach"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ email: "user@example.com", role: "coach" });
    expect(update).toHaveBeenCalledWith({ role: "coach" });
    expect(auditInsert).toHaveBeenCalledWith({
      actor_user_id: "admin-id",
      action: "role_updated",
      entity_type: "user",
      entity_id: "athlete-id",
      target_user_id: "athlete-id",
      metadata: {
        previousRole: "athlete",
        nextRole: "coach",
        email: "user@example.com",
      },
    });
  });
});
