import { getAllCards } from "@/lib/cards";
import { scoreCards } from "@/lib/scoring";
import { getValueAssumptionsWithLiveUsd } from "@/lib/exchange-rate";
import type { UserProfile } from "@/types/cards";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const start = Date.now();
  const body = await req.json();
  const profile = body.profile as UserProfile;

  if (!profile || typeof profile.monthlySalaryBrl !== "number") {
    return Response.json({ error: "Perfil inválido" }, { status: 400 });
  }

  const cards = getAllCards();
  const assumptions = await getValueAssumptionsWithLiveUsd();
  const scored = scoreCards(cards, profile, assumptions).slice(0, 10);

  console.log(
    JSON.stringify({ level: "info", route: "/api/recommend", count: scored.length, ms: Date.now() - start })
  );

  return Response.json(scored);
}
