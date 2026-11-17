import type {
  CardFacet,
  CardScore,
  CardValueAssumptions,
  CardValueScore,
  UserProfile,
} from "@/types/cards";
import { scoreCardValues } from "@/lib/card-value";

/**
 * Converte a saída de `scoreCardValues` (já ordenada, com score percentil) em
 * `CardScore` dos elegíveis, sem reordenar: `totalScore` = `score0To100 / 100`.
 */
export function cardScoresFromValueScores(valueScores: CardValueScore[]): CardScore[] {
  return valueScores
    .filter((valueScore) => valueScore.eligible)
    .map(
      (valueScore): CardScore => ({
        card: valueScore.card,
        totalScore: valueScore.score0To100 / 100,
        valueScore,
        breakdown: {
          eligibilityMet: valueScore.eligible,
          feeAffordability: !valueScore.feeKnown
            ? 0
            : valueScore.effectiveMonthlyFeeBrl <= 0
              ? 1
              : Math.max(0, 1 - valueScore.effectiveMonthlyFeeBrl / 250),
          rewardsMatch: Math.min(1, valueScore.grossRewardMonthlyBrl / 150),
          travelBenefits: Math.min(1, valueScore.intangibleMonthlyValueBrl / 250),
          segmentFit: valueScore.score0To100 / 100,
        },
      })
    );
}

export function scoreCards(
  cards: CardFacet[],
  profile: UserProfile,
  assumptions?: CardValueAssumptions
): CardScore[] {
  return cardScoresFromValueScores(scoreCardValues(cards, profile, "profile", assumptions));
}
