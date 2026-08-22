import { z } from "zod";

// Single source of truth for the card-data contract. types/cards.ts derives its
// data types from these schemas (z.infer); CI validates every card against them.
// Objects are strict on purpose: an unknown key in a data PR is a typo, not an
// extension — new fields must be added here first (see platform/data/README.md
// for the additive-evolution policy).
//
// Fields whose *values* are still dirty (issuer_raw, variant_band, product_kind,
// verification/source statuses) stay loose strings until the normalization
// migration tightens them into enums.

const unknown = z.literal("unknown");
export const numberOrUnknown = z.union([z.number(), unknown]);

export const CardNetworkSchema = z.enum(["Visa", "Mastercard", "Elo", "American Express"]);

// Card tier within the network/issuer line-up ("unknown" when the product has
// no public tier). Values may be ADDED (minor schema bump) — see data README.
export const VariantBandSchema = z.enum([
  "Nacional",
  "Internacional",
  "Básico",
  "Standard",
  "Classic",
  "Universitário",
  "Gold",
  "Platinum",
  "Signature",
  "Infinite",
  "Infinite Privilege",
  "Aeternum",
  "Black",
  "World Legend",
  "Centurion",
  "Grafite",
  "Nanquim",
  "Mais",
  "Diners Club",
  "Green",
  "Quartz",
  "Estelar",
  "unknown",
]);

export const SourceTierSchema = z.enum([
  "official_issuer",
  "trusted_catalog",
  "aggregator_secondary",
]);

export const EligibilitySourceStatusSchema = z.enum([
  "official",
  "official_partial",
  "aggregator",
  "manual_curated",
  "not_structured",
]);

export const VerificationStatusSchema = z.enum([
  "official_verified",
  "official_partial",
  "trusted_aggregator",
  "manual_curated",
]);

export const MarketSegmentSchema = z.enum([
  "ultra_premium",
  "premium",
  "upper_mass",
  "mass_or_general",
]);

export const CardAvailabilityStatusSchema = z.enum([
  "available",
  "unavailable",
  "invite_only",
  "private_or_segment_restricted",
  "unknown",
]);

export const FeeWaiverRuleCategorySchema = z.enum([
  "monthly_spend",
  "investment",
  "subscription",
  "cashback",
  "miles",
  "general",
  "pix_key",
  "promotional_period",
]);

export const BenefitGroupKeySchema = z.enum([
  "rewards",
  "travel",
  "insurance",
  "lifestyle",
  "fees",
  "eligibility",
  "issuer_specific",
]);

export const CardFacetsNumericSchema = z.strictObject({
  annual_fee_brl_best_estimate: z.union([
    z.number(),
    unknown,
    z.literal("variable_pricing_claim"),
    z.null(),
  ]),
  monthly_fee_brl_after_intro_official_hint: numberOrUnknown,
  minimum_income_brl_best_estimate: numberOrUnknown.optional(),
  minimum_investment_brl_best_estimate: numberOrUnknown,
  lounge_visits_per_year_hint: numberOrUnknown,
  official_forex_or_iof_note: z.string(),
});

export const CardFacetsBooleanSchema = z.strictObject({
  has_any_lounge_claim: z.boolean(),
  has_named_lounge_program: z.boolean(),
  lounge_unlimited_claim: z.boolean(),
  earn_points_or_miles: z.boolean(),
  earn_cashback: z.boolean(),
  earn_investback: z.boolean(),
  reward_return_cashlike: z.boolean(),
  mentions_travel_insurance: z.boolean(),
  mentions_concierge: z.boolean(),
  co_brand_name_detected: z.boolean(),
  issuer_multi_entity_row: z.boolean(),
  generic_article_not_single_product: z.boolean(),
});

export const CardMediaSchema = z.strictObject({
  card_art_url: z.string(),
  alt_text: z.string(),
  source_url: z.string(),
  art_provenance: z
    .strictObject({
      source_url: z.string().url(),
      retrieved_date: z.string(),
    })
    .optional(),
});

export const RewardReturnSchema = z.strictObject({
  has_cashlike_return: z.boolean(),
  subtypes: z.array(z.string()).optional(),
  earning_summary: z.string(),
});

export const LoungeAccessSchema = z.strictObject({
  has_lounge_access: z.boolean(),
  programs: z.array(z.string()).optional(),
  unlimited: z.boolean(),
  // Ausente quando o lounge é ilimitado (sem limite anual aplicável).
  annual_visits: numberOrUnknown.optional(),
  complimentary_visits_per_year: z.number().optional(),
  guest_policy: z.string(),
  complimentary_access_confirmed: z.boolean(),
  policy_varies_by_issuer: z.boolean(),
  summary: z.string(),
  // Quando há condições: usuário precisa cumprir TODAS ("and") ou UMA ("or").
  condition_logic: z.enum(["and", "or"]).optional(),
  condition_investment_brl: z.number().optional(),
  condition_monthly_spend_brl: z.number().optional(),
});

export const CardEligibilityFacetSchema = z.strictObject({
  requirements_text: z.string(),
  minimum_income_brl_best_estimate: numberOrUnknown,
  minimum_investment_brl_best_estimate: numberOrUnknown,
  requires_bank_account_claim: z.union([z.boolean(), unknown]),
  availability_status: CardAvailabilityStatusSchema,
  hard_gate_fields: z.array(z.string()),
  recommendation_blocking_unknowns: z.boolean(),
  source_status: EligibilitySourceStatusSchema,
});

// Characteristics accept one extra bucket ("other") beyond the benefit-group
// keys — used for perks that fit no group (e.g. social-impact programs).
export const CharacteristicCategorySchema = z.enum([...BenefitGroupKeySchema.options, "other"]);

export const CardCharacteristicSchema = z.strictObject({
  category: CharacteristicCategorySchema,
  key: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  details: z.string().optional(),
  source_excerpt: z.string().optional(),
});

export const FeeWaiverRuleSchema = z.strictObject({
  category: FeeWaiverRuleCategorySchema,
  threshold_brl: z.number().optional(),
  period: z.enum(["monthly", "annual"]).optional(),
  full_waiver: z.boolean(),
  discount_brl: z.number().optional(),
  discount_pct: z.number().optional(),
  requires_bank_account: z.boolean().optional(),
  description: z.string(),
  raw_text: z.string(),
});

export const BenefitGroupsSchema = z.partialRecord(BenefitGroupKeySchema, z.array(z.string()));

export const SourceClaimSchema = z.strictObject({
  field_path: z.string(),
  value_text: z.string().optional(),
  source_url: z.string(),
  source_type: z.string(),
  captured_at: z.string().optional(),
  last_verified_at: z.string().optional(),
  confidence_0_to_1: z.number().optional(),
  dynamic: z.boolean().optional(),
  raw_excerpt: z.string().optional(),
});

export const ApplicationAvailabilitySchema = z.strictObject({
  channels: z.array(z.string()),
  notes: z.string().optional(),
});

export const StoreBenefitSchema = z.strictObject({
  partner_name: z.string(),
  benefit_type: z.string(),
  description: z.string(),
});

export const SecuredLimitOptionSchema = z.strictObject({
  product_name: z.string(),
  backing_asset: z.string(),
  description: z.string(),
});

export const CashbackDetailsSchema = z.strictObject({
  rate_text: z.string(),
  destination: z.string().optional(),
  conditions_text: z.string().optional(),
});

export const CoBrandSchema = z.strictObject({
  partner_name: z.string(),
  partner_category: z.string().optional(),
});

// Community corrections that need maintainer judgment live inside the card
// file (visible, reviewable) until applied — written by apply-correction.mjs.
export const PendingCorrectionSchema = z.strictObject({
  field: z.string(),
  suggested_value: z.string(),
  source_url: z.string(),
  notes: z.string().optional(),
  submitted_at: z.string(),
  issue_number: z.number().optional(),
});

export const CardProvenanceSchema = z.strictObject({
  sources: z.array(
    z.strictObject({
      url: z.string(),
      label: z.string().optional(),
      tier: z.string().optional(),
    })
  ),
  last_verified_date: z.string(),
  verification_note: z.string().optional(),
});

export const CardFacetSchema = z.strictObject({
  card_stable_id: z.string().min(1),
  display_name: z.string().min(1),
  issuer_raw: z.string().min(1),
  issuer_id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  network_primary: CardNetworkSchema,
  network_alternatives: z.array(CardNetworkSchema).optional(),
  variant_band: VariantBandSchema,
  market_segment_guess: MarketSegmentSchema,
  product_kind: z.literal("named_credit_card_product"),
  verification_cross_check_status: VerificationStatusSchema,
  primary_evidence_url: z.string(),
  application_url: z.string().optional(),
  review_source_url: z.string().optional(),
  source_label: z.string(),
  review_source_label: z.string().optional(),
  source_tier: SourceTierSchema,
  source_url: z.string(),
  ranking_position: numberOrUnknown,
  ranking_score: numberOrUnknown,
  media: CardMediaSchema,
  reward_return: RewardReturnSchema,
  lounge_access: LoungeAccessSchema,
  eligibility: CardEligibilityFacetSchema.optional(),
  fee_waiver_rules: z.array(FeeWaiverRuleSchema).optional(),
  benefit_groups: BenefitGroupsSchema,
  characteristics: z.array(CardCharacteristicSchema).optional(),
  facets_numeric_or_special: CardFacetsNumericSchema,
  facets_boolean: CardFacetsBooleanSchema,
  labels_for_filtering: z.array(z.string()),
  application_availability: ApplicationAvailabilitySchema.nullish(),
  source_claims: z.array(SourceClaimSchema).nullish(),
  store_benefits: z.array(StoreBenefitSchema).nullish(),
  secured_limit_options: z.array(SecuredLimitOptionSchema).nullish(),
  cashback_details: CashbackDetailsSchema.nullish(),
  co_brand: CoBrandSchema.nullish(),
  data_quality_notes: z.array(z.string()).nullish(),
  pending_corrections: z.array(PendingCorrectionSchema).optional(),
  provenance: CardProvenanceSchema,
});

export const FacetsMetaSchema = z.strictObject({
  schema_version: z.string(),
  unknown_sentinel: z.literal("unknown"),
  purpose: z.string(),
  paired_nested_catalog: z.string().optional(),
  source: z.string().optional(),
});

export const FacetsFileSchema = z.strictObject({
  facets_meta: FacetsMetaSchema,
  cards: z.array(CardFacetSchema),
});
