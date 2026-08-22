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

// Nomad Explorer earning tiers (investment in USD)
export const NOMAD_CARD_ID = "nomad-nomad-explorer-visa-infinite-aae26793ed";
export const NOMAD_TIERS: { minUsd: number; rate: number }[] = [
  { minUsd: 5000, rate: 3.0 },
  { minUsd: 2500, rate: 2.2 },
  { minUsd: 1000, rate: 1.6 },
];
