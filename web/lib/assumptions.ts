import type { CardValueAssumptions, TravelFrequency } from "@/types/cards";

/**
 * Parâmetros econômicos do motor de valor. Fonte única para os valores
 * negociáveis do modelo (câmbio, pontos/milhas, IOF, lounge, seguros).
 */
export const DEFAULT_VALUE_ASSUMPTIONS: CardValueAssumptions = {
  // Fallback do dólar comercial (cotação de compra AwesomeAPI USD-BRL), não PTAX. Mai/2026.
  ptaxBrlPerUsd: 4.96,
  mileValuePerThousandBrl: 22,
  liveloPointSaleValuePerThousandBrl: 22,
  liveloPointTravelValuePerThousandBrl: 45,
  membershipRewardsPointTravelValuePerThousandBrl: 95,
  membershipRewardsPointSaleValuePerThousandBrl: 45,
  defaultPointValuePerThousandBrl: 22,
  iof: 0.035,
  // Valor de uma visita a sala VIP para quem viaja; decisão do produto (nov/2026), era R$160.
  loungeVisitValueBrl: 80,
  travelInsuranceMonthlyValueBrl: 25,
  conciergeMonthlyValueBrl: 15,
};

/** Spread de câmbio aplicado por tipo de emissor (banco de varejo / padrão / cooperativa). */
export const RETAIL_BANK_SPREAD = 0.055;
export const DEFAULT_SPREAD = 0.045;
export const COOPERATIVE_SPREAD = 0.01;

/** Teto de sanidade do spread lido de dados/texto: nenhum emissor no Brasil cobra acima de ~6%. Nov/2026. */
export const MAX_FX_SPREAD = 0.1;

/**
 * Probabilidade de usar pontos em viagem (valor de utilização) em vez de
 * vendê-los, por frequência de viagem. Pondera o valor de decisão.
 */
export const TRAVEL_REDEMPTION_WEIGHT = {
  none: 0,
  occasional: 0.5,
  frequent: 0.8,
} as const;

/**
 * Viagens por ano usadas para valorizar sala VIP, seguro viagem e concierge.
 * "Não viajo" = 0: quem não viaja não recebe valor de benefícios de viagem. Nov/2026.
 */
export const ANNUAL_TRIPS_BY_TRAVEL_FREQUENCY: Record<TravelFrequency, number> = {
  none: 0,
  occasional: 6,
  frequent: 10,
};

/**
 * Acessos/ano assumidos quando o cartão tem sala VIP sem limite anual
 * estruturado (Black/Infinite/premium vs demais). Estimativa conservadora, mai/2026.
 */
export const FALLBACK_LOUNGE_VISITS_PREMIUM = 2;
export const FALLBACK_LOUNGE_VISITS_STANDARD = 1;

/** Teto de valor de venda de pontos/milhas para quem não viaja (qualquer programa). Mai/2026. */
export const NON_TRAVELER_DEFAULT_POINT_SALE_VALUE_PER_THOUSAND_BRL = 20;

/**
 * Programa de pontos não identificado: valor de utilização estimado (era fixo
 * no código). Limitado ao valor de utilização da Livelo, porque pontos de
 * programa próprio raramente valem mais que um programa de coalizão. Mai/2026.
 */
export const UNKNOWN_PROGRAM_POINT_TRAVEL_VALUE_PER_THOUSAND_BRL = 55;

/** Cashback sem taxa estruturada: retorno conservador assumido. Mai/2026. */
export const UNSTRUCTURED_CASHBACK_FALLBACK_RATE = 0.01;

// Card-specific tiers/bundles (Nomad, Smiles) live in data/card_overrides.json
// via lib/card-overrides.ts — data, not code.
export { NOMAD_CARD_ID, NOMAD_TIERS } from "@/lib/card-overrides";
