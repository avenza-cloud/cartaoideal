import { describe, expect, it } from "vitest";
import facetsFile from "@/data/cards_brazil_ai_comparison_facets.json";
import { CardFacetSchema, FacetsFileSchema } from "@/lib/card-schema";

// The data contract: every card in the catalog must parse against the Zod
// schema. Failures print per-card, per-path issues so a data PR author can fix
// their file without digging through a giant aggregate error.
describe("card data contract", () => {
  const file = facetsFile as { cards: Array<Record<string, unknown>> };

  it("every card parses against CardFacetSchema", () => {
    const failures: string[] = [];
    for (const card of file.cards) {
      const result = CardFacetSchema.safeParse(card);
      if (!result.success) {
        const id = typeof card.card_stable_id === "string" ? card.card_stable_id : "<sem id>";
        for (const issue of result.error.issues) {
          failures.push(`${id}: ${issue.path.join(".")} — ${issue.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("the file as a whole parses (meta included)", () => {
    expect(() => FacetsFileSchema.parse(facetsFile)).not.toThrow();
  });

  it("has a real catalog (>200 cards)", () => {
    expect(file.cards.length).toBeGreaterThan(200);
  });

  it("stable ids are unique", () => {
    const ids = file.cards.map((c) => c.card_stable_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every card has eligibility data", () => {
    const missing = file.cards
      .filter((c) => !c.eligibility)
      .map((c) => c.card_stable_id);
    expect(missing).toEqual([]);
  });
});
