import type { CardValueAssumptions } from "@/types/cards";

/**
 * Parâmetros econômicos do motor de valor. Fonte única para os valores
 * negociáveis do modelo (câmbio, pontos/milhas, IOF, lounge, seguros).
 */
export const DEFAULT_VALUE_ASSUMPTIONS: CardValueAssumptions = {
  ptaxBrlPerUsd: 4.96,
  mileValuePerThousandBrl: 22,
  liveloPointSaleValuePerThousandBrl: 22,
  liveloPointTravelValuePerThousandBrl: 45,
  membershipRewardsPointTravelValuePerThousandBrl: 95,
  membershipRewardsPointSaleValuePerThousandBrl: 45,
  defaultPointValuePerThousandBrl: 22,
  iof: 0.035,
  loungeVisitValueBrl: 160,
  travelInsuranceMonthlyValueBrl: 25,
  conciergeMonthlyValueBrl: 15,
};

/** Spread de câmbio aplicado por tipo de emissor (banco de varejo / padrão / cooperativa). */
export const RETAIL_BANK_SPREAD = 0.055;
export const DEFAULT_SPREAD = 0.045;
export const COOPERATIVE_SPREAD = 0.01;

/** Teto de valor de venda de pontos para quem não viaja. */
export const NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL = 20;

// Card-specific tiers/bundles (Nomad, Smiles) live in data/card_overrides.json
// via lib/card-overrides.ts — data, not code.
export { NOMAD_CARD_ID, NOMAD_TIERS } from "@/lib/card-overrides";
