import { getAllCards } from "@/lib/cards";
import { scoreCards } from "@/lib/scoring";
import type { UserProfile, CardScore } from "@/types/cards";

const MILESTONES = [50_000, 100_000, 250_000];

function eligibleIds(cards: CardScore[]): Set<string> {
  return new Set(cards.map((s) => s.card.card_stable_id));
}

export async function POST(req: Request) {
  const start = Date.now();
  const body = await req.json();
  const profile = body.profile as UserProfile;

  if (!profile || typeof profile.monthlySalaryBrl !== "number") {
    return Response.json({ error: "Perfil inválido" }, { status: 400 });
  }

  const allCards = getAllCards();

  const current = scoreCards(allCards, profile)
    .filter((s) => s.breakdown.eligibilityMet)
    .slice(0, 5);
  const currentIds = eligibleIds(current);

  const tiers = MILESTONES.filter((m) => m > profile.avgInvestedBrl).map((milestone) => {
    const hypothetical: UserProfile = { ...profile, avgInvestedBrl: milestone };
    const atMilestone = scoreCards(allCards, hypothetical)
      .filter((s) => s.breakdown.eligibilityMet && !currentIds.has(s.card.card_stable_id));
    // Deduplicate with earlier tiers
    const newCards = atMilestone.slice(0, 4);
    return { requiredInvestment: milestone, newCards };
  });

  console.log(
    JSON.stringify({
      level: "info",
      route: "/api/progression",
      currentCount: current.length,
      tierCount: tiers.length,
      ms: Date.now() - start,
    })
  );

  return Response.json({ current, tiers });
}
