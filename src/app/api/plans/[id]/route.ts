import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { mapRemotePlan, requireStaff, staffClient } from "@/lib/supabase/profiles";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  sessions: z.array(
    z.object({
      templateId: z.string(),
      dayOfWeek: z.number().int().min(0).max(6),
      displayName: z.string().min(1).max(120),
      kind: z.enum(["strength", "run", "recovery", "free"]),
      estimatedMinutes: z.number().int().min(0).max(300),
      notes: z.array(z.string()).optional(),
    }),
  ).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Solo admin e coach possono modificare i piani.", 403);

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Aggiornamento non valido.");

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const { data, error } = await client
    .from("training_plans")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ plan: mapRemotePlan(data) });
}
