// Facets — flattened format for filtering, LLM calls, and scoring.
// Data shapes derive from the Zod contract in lib/card-schema.ts (the single
// source of truth, validated over the whole catalog in CI); this module
// re-exports them so existing import paths keep working.
import type { z } from "zod";
import type {
  BenefitGroupKeySchema,
  BenefitGroupsSchema,
  CardAvailabilityStatusSchema,
  CardCharacteristicSchema,
  CardEligibilityFacetSchema,
  CardFacetSchema,
  CardFacetsBooleanSchema,
  CardFacetsNumericSchema,
  CardMediaSchema,
  FacetsFileSchema,
  FacetsMetaSchema,
  FeeWaiverRuleCategorySchema,
  FeeWaiverRuleSchema,
  LoungeAccessSchema,
  MarketSegmentSchema,
  RewardReturnSchema,
} from "@/lib/card-schema";

export type CardFacetsNumeric = z.infer<typeof CardFacetsNumericSchema>;
export type CardFacetsBoolean = z.infer<typeof CardFacetsBooleanSchema>;
export type CardMedia = z.infer<typeof CardMediaSchema>;
export type RewardReturn = z.infer<typeof RewardReturnSchema>;
export type LoungeAccess = z.infer<typeof LoungeAccessSchema>;
export type CardAvailabilityStatus = z.infer<typeof CardAvailabilityStatusSchema>;
export type CardEligibilityFacet = z.infer<typeof CardEligibilityFacetSchema>;
export type BenefitGroupKey = z.infer<typeof BenefitGroupKeySchema>;
export type BenefitGroups = z.infer<typeof BenefitGroupsSchema>;
export type CardCharacteristic = z.infer<typeof CardCharacteristicSchema>;
export type FeeWaiverRuleCategory = z.infer<typeof FeeWaiverRuleCategorySchema>;
export type FeeWaiverRule = z.infer<typeof FeeWaiverRuleSchema>;
export type MarketSegment = z.infer<typeof MarketSegmentSchema>;
export type CardFacet = z.infer<typeof CardFacetSchema>;
export type FacetsMeta = z.infer<typeof FacetsMetaSchema>;
export type FacetsFile = z.infer<typeof FacetsFileSchema>;

// Scoring types
export type TravelFrequency = "none" | "occasional" | "frequent";
export type SpendingCategory =
  | "supermercado"
  | "combustivel"
  | "restaurantes"
  | "viagens"
  | "streaming";

export interface UserProfile {
  monthlySalaryBrl: number;
  avgMonthlySpendBrl: number;
  avgInvestedBrl: number;
  // Base da compra internacional antes de IOF e spread; o motor adiciona esse custo.
  monthlyInternationalSpendBrl?: number;
  currentPrimaryCardId?: string;
  currentPrimaryCardName?: string;
  travelFrequency: TravelFrequency;
  spendingCategories: SpendingCategory[];
  preferences: {
    wantsLounge: boolean;
    prefersCashback: boolean;
    prefersPoints: boolean;
    prefersInvestback: boolean;
  };
}

export interface ScoreBreakdown {
  eligibilityMet: boolean;
  feeAffordability: number;
  rewardsMatch: number;
  travelBenefits: number;
  segmentFit: number;
}

export type CardScoreMode = "default" | "profile";

export interface CardValueAssumptions {
  ptaxBrlPerUsd: number;
  mileValuePerThousandBrl: number;
  liveloPointSaleValuePerThousandBrl: number;
  liveloPointTravelValuePerThousandBrl: number;
  membershipRewardsPointTravelValuePerThousandBrl: number;
  membershipRewardsPointSaleValuePerThousandBrl: number;
  defaultPointValuePerThousandBrl: number;
  iof: number;
  loungeVisitValueBrl: number;
  travelInsuranceMonthlyValueBrl: number;
  conciergeMonthlyValueBrl: number;
}

export interface CardValueComponent {
  key: string;
  label: string;
  valueBrl: number;
  normalizedContribution: number;
  explanation: string;
  dataQualityNote?: string;
}

export interface CardValueScore {
  card: CardFacet;
  mode: CardScoreMode;
  eligible: boolean;
  eligibilityReasons: string[];
  score0To100: number;
  rankReason: string;
  feeAppliedReason: string;
  roiMultiple: number | null;
  feeBurdenPctOfAnnualSpend: number | null;
  scoreDrivers: string[];
  netMonthlyValueBrl: number;
  /** Com pontos/milhas: teto de valor líquido mensal se os pontos forem usados em viagem (preço de utilização). Igual a `netMonthlyValueBrl` quando só há cashback ou não há spread. */
  netMonthlyValueRangeHighBrl: number;
  netAnnualValueBrl: number;
  effectiveMonthlyFeeBrl: number;
  effectiveAnnualFeeBrl: number;
  grossRewardMonthlyBrl: number;
  /** Teto de retorno bruto mensal com pontos valorados em utilização (viagem); igual a `grossRewardMonthlyBrl` quando só há cashback ou não há spread. */
  grossRewardMonthlyRangeHighBrl: number;
  pointsRewardMonthlyBrl: number;
  pointsRewardMonthlySaleBrl: number;
  pointsRewardMonthlyTravelBrl: number;
  cashlikeRewardMonthlyBrl: number;
  intangibleMonthlyValueBrl: number;
  internationalMonthlyCostBrl: number;
  breakEvenMonthlySpendBrl: number | null;
  breakEvenByRewardsOnlyMonthlySpendBrl: number | null;
  verdict: string;
  components: CardValueComponent[];
  assumptions: CardValueAssumptions;
  dataQualityNotes: string[];
}

export interface CardScore {
  card: CardFacet;
  totalScore: number;
  breakdown: ScoreBreakdown;
  valueScore?: CardValueScore;
}

// Filter params for the /api/cards endpoint
export interface CardFilters {
  segment?: MarketSegment;
  network?: string;
  lounge?: boolean;
  cashback?: boolean;
  points?: boolean;
  investback?: boolean;
  rewardReturn?: boolean;
  zeroFee?: boolean;
  maxFee?: number;
  search?: string;
  feeWaiverByInvestment?: boolean;
}
