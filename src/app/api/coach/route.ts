import OpenAI from "openai";
import {
  COACH_SYSTEM_PROMPT,
  deterministicCoachReview,
  parseCoachResponse,
  type TrainingSnapshot,
} from "@/lib/ai-coach";
import { jsonError, jsonOk } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { snapshot?: TrainingSnapshot };
    if (!body.snapshot) return jsonError("Snapshot allenamento mancante.");

    const headerKey = request.headers.get("x-assetto-openai-key");
    const apiKey = process.env.OPENAI_API_KEY ?? headerKey ?? "";
    if (!apiKey) {
      return jsonOk({
        review: deterministicCoachReview(body.snapshot),
        fallback: true,
      });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analizza questo snapshot settimanale e proponi calibrazioni:\n${JSON.stringify(body.snapshot, null, 2)}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return jsonOk({
        review: deterministicCoachReview(body.snapshot),
        fallback: true,
      });
    }

    return jsonOk({
      review: parseCoachResponse(content, body.snapshot.week),
      fallback: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore coach AI";
    return jsonError(message, 500);
  }
}
