import { describe, expect, it } from "vitest";
import facetsFile from "@/data/cards_brazil_ai_comparison_facets.json";
import type {
  CardFacet,
  FacetsFile,
  FeeWaiverRuleCategory,
  MarketSegment,
} from "@/types/cards";

const data = facetsFile as FacetsFile;

const REQUIRED_KEYS: (keyof CardFacet)[] = [
  "card_stable_id",
  "display_name",
  "issuer_raw",
  "network_primary",
  "variant_band",
  "market_segment_guess",
  "product_kind",
  "verification_cross_check_status",
  "verification_confidence_0_to_1",
  "primary_evidence_url",
  "source_label",
  "source_tier",
  "source_url",
  "ranking_position",
  "ranking_score",
  "media",
  "reward_return",
  "lounge_access",
  "benefit_groups",
  "facets_numeric_or_special",
  "facets_boolean",
  "labels_for_filtering",
];

const FEE_WAIVER_CATEGORIES: FeeWaiverRuleCategory[] = [
  "monthly_spend",
  "investment",
  "subscription",
  "cashback",
  "miles",
  "general",
  "pix_key",
  "promotional_period",
];

const SEGMENTS: MarketSegment[] = [
  "mass_or_general",
  "upper_mass",
  "premium",
  "ultra_premium",
];

describe("facets data schema", () => {
  it("has the expected number of cards", () => {
    expect(data.cards.length).toBeGreaterThan(200);
  });

  it("every card has every required field", () => {
    const missing = data.cards
      .map((card) => {
        const absent = REQUIRED_KEYS.filter((key) => !(key in card));
        return absent.length > 0 ? `${card.card_stable_id}: ${absent.join(", ")}` : null;
      })
      .filter(Boolean);
    expect(missing).toEqual([]);
  });

  it("stable ids are unique", () => {
    const ids = data.cards.map((c) => c.card_stable_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ranking_position is present and typed correctly", () => {
    for (const card of data.cards) {
      expect(card.ranking_position).not.toBeUndefined();
      if (card.ranking_position !== "unknown") {
        expect(typeof card.ranking_position).toBe("number");
      }
    }
  });

  it("market_segment_guess is within the known union", () => {
    for (const card of data.cards) {
      expect(SEGMENTS).toContain(card.market_segment_guess);
    }
  });

  it("annual fee estimate is number | unknown | variable_pricing_claim | null", () => {
    for (const card of data.cards) {
      const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
      const ok =
        typeof fee === "number" ||
        fee === "unknown" ||
        fee === "variable_pricing_claim" ||
        fee === null;
      expect(ok, `${card.card_stable_id}: bad annual fee ${String(fee)}`).toBe(true);
    }
  });

  it("fee_waiver_rules categories are within the union", () => {
    const bad: string[] = [];
    for (const card of data.cards) {
      for (const rule of card.fee_waiver_rules ?? []) {
        if (!FEE_WAIVER_CATEGORIES.includes(rule.category)) {
          bad.push(`${card.card_stable_id}: ${rule.category}`);
        }
        if (typeof rule.full_waiver !== "boolean") {
          bad.push(`${card.card_stable_id}: missing full_waiver`);
        }
        if (typeof rule.description !== "string") {
          bad.push(`${card.card_stable_id}: missing description`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("media has alt_text and source_url", () => {
    const bad: string[] = [];
    for (const card of data.cards) {
      if (typeof card.media.alt_text !== "string") bad.push(`${card.card_stable_id}: alt_text`);
      if (typeof card.media.source_url !== "string") bad.push(`${card.card_stable_id}: source_url`);
    }
    expect(bad).toEqual([]);
  });

  it("lounge_access shape is valid", () => {
    for (const card of data.cards) {
      const lounge = card.lounge_access;
      expect(typeof lounge.has_lounge_access).toBe("boolean");
      expect(typeof lounge.unlimited).toBe("boolean");
      if (lounge.annual_visits !== undefined && lounge.annual_visits !== "unknown") {
        expect(typeof lounge.annual_visits).toBe("number");
      }
    }
  });
});
