import type { CardFacet, CardScore, CardValueAssumptions, UserProfile } from "@/types/cards";
import { scoreCardValues } from "@/lib/card-value";

export function scoreCards(
  cards: CardFacet[],
  profile: UserProfile,
  assumptions?: CardValueAssumptions
): CardScore[] {
  return scoreCardValues(cards, profile, "profile", assumptions)
    .filter((valueScore) => valueScore.eligible)
    .map((valueScore): CardScore => ({
      card: valueScore.card,
      totalScore: valueScore.score0To100 / 100,
      valueScore,
      breakdown: {
        eligibilityMet: valueScore.eligible,
        feeAffordability:
          valueScore.effectiveMonthlyFeeBrl <= 0
            ? 1
            : Math.max(0, 1 - valueScore.effectiveMonthlyFeeBrl / 250),
        rewardsMatch: Math.min(1, valueScore.grossRewardMonthlyBrl / 150),
        travelBenefits: Math.min(1, valueScore.intangibleMonthlyValueBrl / 250),
        segmentFit: valueScore.score0To100 / 100,
      },
    }));
}
