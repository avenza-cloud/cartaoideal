import overrides from "@/data/generated/card_overrides.json";

/**
 * Card-specific business data that used to be hardcoded in TS. Lives in
 * data/card_overrides.json so a catalog regeneration or data PR can keep it in
 * sync; lib/__tests__/card-overrides.test.ts asserts every referenced
 * card_stable_id exists in the catalog. The file is tiny and non-secret, so
 * client bundles may include it (card-value.ts runs client-side on prop-fed
 * cards).
 */
export interface CuratedPopularEntry {
  card_stable_id: string;
  description_pt: string;
}

export const CURATED_POPULAR: CuratedPopularEntry[] = overrides.curated_popular;

export const NOMAD_CARD_ID: string = overrides.nomad_tiers.card_stable_id;
export const NOMAD_TIERS: { minUsd: number; rate: number }[] = overrides.nomad_tiers.tiers.map(
  (tier) => ({ minUsd: tier.min_usd, rate: tier.rate })
);

export const SMILES_CLUB_ENTRY_MONTHLY_BRL: number = overrides.smiles_club_bundle.monthly_brl;
export const GOL_SMILES_INFINITE_STABLE_IDS: ReadonlySet<string> = new Set(
  overrides.smiles_club_bundle.card_stable_ids
);

/** Every card id referenced by overrides — used by the referential-integrity test. */
export const ALL_OVERRIDE_CARD_IDS: string[] = [
  ...overrides.curated_popular.map((c) => c.card_stable_id),
  overrides.nomad_tiers.card_stable_id,
  ...overrides.smiles_club_bundle.card_stable_ids,
];
