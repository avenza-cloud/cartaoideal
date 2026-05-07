import { describe, expect, it } from "vitest";
import { filterCards, getCardFeeWaiver } from "@/lib/cards";

describe("getCardFeeWaiver", () => {
  it("Nubank Ultravioleta — viaInvestimento + viaGasto", () => {
    const results = filterCards({ search: "nubank ultravioleta" });
    const card = results.find((c) => c.card_stable_id.includes("nubank") && c.display_name.toLowerCase().includes("ultravioleta"));
    expect(card).toBeDefined();
    const waiver = getCardFeeWaiver(card!);
    expect(waiver).not.toBeNull();
    expect(waiver!.viaInvestimento).toBe(true);
    expect(waiver!.viaGasto).toBe(true);
  });

  it("C6 Mastercard Black — viaInvestimento + viaGasto", () => {
    const results = filterCards({ search: "c6 mastercard black" });
    const card = results.find((c) => c.display_name === "C6 Mastercard Black");
    expect(card).toBeDefined();
    const waiver = getCardFeeWaiver(card!);
    expect(waiver).not.toBeNull();
    expect(waiver!.viaInvestimento).toBe(true);
    expect(waiver!.viaGasto).toBe(true);
  });

  it("Bradesco Prime Elo Grafite — viaInvestimento only", () => {
    const results = filterCards({ search: "bradesco prime elo grafite" });
    const card = results.find((c) => c.display_name === "Bradesco Prime Elo Grafite");
    expect(card).toBeDefined();
    const waiver = getCardFeeWaiver(card!);
    expect(waiver).not.toBeNull();
    expect(waiver!.viaInvestimento).toBe(true);
    expect(waiver!.viaGasto).toBe(false);
  });

  it("card without fee_waiver returns null", () => {
    // Find a card that definitely has no waiver characteristic set
    const cards = filterCards({});
    const noWaiver = cards.find((c) => {
      const char = c.characteristics?.find((x) => x.key === "fee_waiver");
      return !char || char.value === "unknown" || !char.value;
    });
    if (noWaiver) {
      expect(getCardFeeWaiver(noWaiver)).toBeNull();
    }
  });
});

describe("filterCards", () => {
  it("no filters returns all real cards (> 200)", () => {
    const all = filterCards({});
    expect(all.length).toBeGreaterThan(200);
  });

  it("search for inter prioritizes Inter products over Internacional variants", () => {
    const cards = filterCards({ search: "inter" });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.slice(0, 4).every((card) => card.display_name.toLowerCase().includes("inter"))).toBe(true);
    expect(cards.some((card) => card.display_name === "LATAM Pass Itaú Visa Internacional")).toBe(false);
  });

  it("feeWaiverByInvestment:true returns exactly 46 cards", () => {
    const cards = filterCards({ feeWaiverByInvestment: true });
    expect(cards).toHaveLength(46);
  });

  it("feeWaiverByInvestment result is sorted by fee ascending", () => {
    const cards = filterCards({ feeWaiverByInvestment: true });
    for (let i = 0; i < cards.length - 1; i++) {
      const fa = cards[i].facets_numeric_or_special.annual_fee_brl_best_estimate;
      const fb = cards[i + 1].facets_numeric_or_special.annual_fee_brl_best_estimate;
      const na = typeof fa === "number" ? fa : 999999;
      const nb = typeof fb === "number" ? fb : 999999;
      expect(na).toBeLessThanOrEqual(nb);
    }
  });

  it("all cards in feeWaiverByInvestment result have viaInvestimento:true", () => {
    const cards = filterCards({ feeWaiverByInvestment: true });
    for (const c of cards) {
      expect(getCardFeeWaiver(c)?.viaInvestimento).toBe(true);
    }
  });
});
