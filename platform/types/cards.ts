// Facets — flattened format for filtering, LLM calls, and scoring
export interface CardFacetsNumeric {
  annual_fee_brl_best_estimate: number | "unknown" | "variable_pricing_claim";
  monthly_fee_brl_after_intro_official_hint: number | "unknown";
  minimum_income_brl_best_estimate?: number | "unknown";
  minimum_investment_brl_best_estimate: number | "unknown";
  lounge_visits_per_year_hint: number | "unknown";
  official_forex_or_iof_note: string;
}

export interface CardFacetsBoolean {
  has_any_lounge_claim: boolean;
  has_named_lounge_program: boolean;
  lounge_unlimited_claim: boolean;
  earn_points_or_miles: boolean;
  earn_cashback: boolean;
  earn_investback: boolean;
  reward_return_cashlike: boolean;
  mentions_travel_insurance: boolean;
  mentions_concierge: boolean;
  co_brand_name_detected: boolean;
  issuer_multi_entity_row: boolean;
  generic_article_not_single_product: boolean;
}

export interface CardMedia {
  card_art_url: string;
  alt_text: string;
  source_url: string;
}

export interface RewardReturn {
  has_cashlike_return: boolean;
  subtypes?: string[];
  earning_summary: string;
}

export interface LoungeAccess {
  has_lounge_access: boolean;
  programs?: string[];
  unlimited: boolean;
  annual_visits: number | "unknown";
  guest_policy: string;
  complimentary_access_confirmed: boolean;
  policy_varies_by_issuer: boolean;
  summary: string;
}

export type CardAvailabilityStatus =
  | "available"
  | "unavailable"
  | "invite_only"
  | "private_or_segment_restricted"
  | "unknown";

export interface CardEligibilityFacet {
  requirements_text: string;
  minimum_income_brl_best_estimate: number | "unknown";
  minimum_investment_brl_best_estimate: number | "unknown";
  requires_bank_account_claim: boolean | "unknown";
  availability_status: CardAvailabilityStatus;
  hard_gate_fields: string[];
  recommendation_blocking_unknowns: boolean;
  source_status: string;
}

export type BenefitGroupKey =
  | "rewards"
  | "travel"
  | "insurance"
  | "lifestyle"
  | "fees"
  | "eligibility"
  | "issuer_specific";

export type BenefitGroups = Partial<Record<BenefitGroupKey, string[]>>;

export interface CardCharacteristic {
  category: BenefitGroupKey;
  key: string;
  label: string;
  value: string | number | boolean;
  details?: string;
  source_excerpt?: string;
}

export type FeeWaiverRuleCategory =
  | "monthly_spend"
  | "investment"
  | "subscription"
  | "cashback"
  | "miles"
  | "general";

export interface FeeWaiverRule {
  category: FeeWaiverRuleCategory;
  threshold_brl?: number;
  period?: "monthly" | "annual";
  full_waiver: boolean;
  discount_brl?: number;
  description: string;
  raw_text: string;
}

export type MarketSegment =
  | "ultra_premium"
  | "premium"
  | "upper_mass"
  | "mass_or_general";

export interface CardFacet {
  card_stable_id: string;
  display_name: string;
  issuer_raw: string;
  network_primary: string;
  variant_band: string;
  market_segment_guess: MarketSegment;
  product_kind: string;
  verification_cross_check_status: string;
  verification_confidence_0_to_1: number;
  primary_evidence_url: string;
  application_url?: string;
  review_source_url?: string;
  source_label: string;
  review_source_label?: string;
  source_tier: string;
  source_url: string;
  ranking_position: number | "unknown";
  ranking_score: number | "unknown";
  media: CardMedia;
  reward_return: RewardReturn;
  lounge_access: LoungeAccess;
  eligibility?: CardEligibilityFacet;
  fee_waiver_rules?: FeeWaiverRule[];
  benefit_groups: BenefitGroups;
  characteristics?: CardCharacteristic[];
  facets_numeric_or_special: CardFacetsNumeric;
  facets_boolean: CardFacetsBoolean;
  labels_for_filtering: string[];
  text_for_embedding_compare: string;
}

export interface FacetsMeta {
  schema_version: string;
  unknown_sentinel: string;
  purpose: string;
  paired_nested_catalog: string;
}

export interface FacetsFile {
  facets_meta: FacetsMeta;
  cards: CardFacet[];
}

// Catalog — nested, full-detail format
export interface CatalogIssuer {
  raw: string;
  normalized: string;
  is_multi_issuer_listing: boolean;
}

export interface CatalogIdentity {
  stable_id: string;
  display_name: string;
  issuer: CatalogIssuer;
  network_primary: string;
  variant_band: string;
  product_kind: string;
}

export interface CatalogAnnualFee {
  has_explicit_amount: boolean;
  raw_text: string;
  amount_brl_numeric: number | null;
  is_zero_fee_claim: boolean;
}

export interface CatalogWaiver {
  policy_text: string;
  rules?: FeeWaiverRule[];
  has_full_waiver_option?: boolean;
  has_partial_waiver_option?: boolean;
  has_promotional_period?: boolean;
}

export interface CatalogFees {
  annual: CatalogAnnualFee;
  waiver_and_discounts?: CatalogWaiver;
  subscription_monthly?: { amount_brl?: number; condition_text?: string };
}

export interface CatalogRewards {
  earning_rules_text?: string;
  loyalty_programs_text?: string;
  earn_points_or_miles?: boolean;
  earn_cashback?: boolean;
  earn_investback?: boolean;
  has_loyalty_transfer?: boolean;
}

export interface CatalogTravel {
  airport_lounge_offered?: boolean;
  airport_lounge_unlimited_claim?: boolean;
  airport_lounge_annual_visits_hint?: number;
  airport_lounge_programs_detected?: string[];
  concierge_mentioned?: boolean;
  travel_insurance_mentioned?: boolean;
  lost_delay_baggage_mentioned?: boolean;
  rental_car_coverage_mentioned?: boolean;
  forex_spread_or_iof_text?: string;
}

export interface CatalogBenefits {
  atomic_benefit_statements?: string[];
  official_highlights?: string[];
}

export interface CatalogEligibility {
  requirements_text?: string;
  requires_bank_account_claim?: boolean;
  minimum_income_brl?: number;
  minimum_investment_brl?: number;
}

export interface CatalogVerification {
  cross_check_status: string;
  confidence_score_0_to_1: number;
  machine_truthfulness_note_pt?: string;
  recommended_human_cross_check_actions?: string[];
}

export interface CatalogCard {
  identity: CatalogIdentity;
  categorization: { market_segment_guess: MarketSegment; co_brand_detected_from_name?: boolean };
  card_physical?: { material?: string; is_metal_claim?: boolean };
  eligibility?: CatalogEligibility;
  fees: CatalogFees;
  rewards?: CatalogRewards;
  travel_and_protection?: CatalogTravel;
  benefits?: CatalogBenefits;
  constraints?: { caveats_text?: string };
  evidence?: { primary_evidence_url?: string; source_is_official_issuer_domain?: boolean };
  flags?: Record<string, boolean>;
  verification: CatalogVerification;
  data_quality_notes?: string[];
}

export interface CatalogFile {
  catalog_meta: { version: string; reference_date: string };
  cards: CatalogCard[];
}

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
  netAnnualValueBrl: number;
  effectiveMonthlyFeeBrl: number;
  effectiveAnnualFeeBrl: number;
  grossRewardMonthlyBrl: number;
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
