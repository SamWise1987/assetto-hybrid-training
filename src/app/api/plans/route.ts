import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-utils";
import { defaultTrainingPlan } from "@/lib/plans";
import { mapRemotePlan, requireStaff, staffClient } from "@/lib/supabase/profiles";
import type { Database } from "@/lib/supabase/client";
import type { TrainingPlanSession } from "@/lib/types";

const createSchema = z.object({
  name: z.string().min(2).max(120),
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

export async function GET(request: Request) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Solo admin e coach possono gestire i piani.", 403);

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const { data, error } = await client
    .from("training_plans")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk({ plans: (data ?? []).map(mapRemotePlan) });
}

export async function POST(request: Request) {
  const staff = await requireStaff(request);
  if (!staff) return jsonError("Solo admin e coach possono creare piani.", 403);

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Piano non valido.");

  const client = staffClient(request);
  if (!client) return jsonError("Supabase non configurato.", 503);

  const fallback = defaultTrainingPlan(staff.userId);
  const sessions: TrainingPlanSession[] = parsed.data.sessions ?? fallback.sessions;

  const { data, error } = await client
    .from("training_plans")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? fallback.description,
      sessions: sessions as unknown as Database["public"]["Tables"]["training_plans"]["Insert"]["sessions"],
      created_by: staff.userId,
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ plan: mapRemotePlan(data) });
}
