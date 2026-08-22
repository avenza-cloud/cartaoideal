import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import artifact from "@/data/generated/cards.json";
import { CardFacetSchema, FacetsFileSchema } from "@/lib/card-schema";

// The data contract: every per-card source file must parse against the Zod
// schema, and the compiled artifact must agree with the sources. Failures
// print per-card, per-path issues so a data PR author can fix their file
// without digging through a giant aggregate error.
const cardsDir = join(__dirname, "..", "..", "..", "data", "cards");
const sourceFiles = readdirSync(cardsDir).filter((f) => f.endsWith(".json"));

describe("card data contract", () => {
  it("every source card file parses against CardFacetSchema", () => {
    const failures: string[] = [];
    for (const file of sourceFiles) {
      const card = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
      const result = CardFacetSchema.safeParse(card);
      if (!result.success) {
        for (const issue of result.error.issues) {
          failures.push(`${file}: ${issue.path.join(".")} — ${issue.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("file names match card_stable_id", () => {
    const mismatches = sourceFiles.filter((file) => {
      const card = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
      return card.card_stable_id !== basename(file, ".json");
    });
    expect(mismatches).toEqual([]);
  });

  it("the compiled artifact parses whole (meta included)", () => {
    expect(() => FacetsFileSchema.parse(artifact)).not.toThrow();
  });

  it("artifact matches the source set", () => {
    expect(artifact.cards.length).toBe(sourceFiles.length);
    const artifactIds = new Set(artifact.cards.map((c) => c.card_stable_id));
    for (const file of sourceFiles) {
      expect(artifactIds.has(basename(file, ".json"))).toBe(true);
    }
  });

  it("has a real catalog (>200 cards)", () => {
    expect(artifact.cards.length).toBeGreaterThan(200);
  });

  it("stable ids are unique", () => {
    const ids = artifact.cards.map((c) => c.card_stable_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("issuer_id and issuer_raw map one-to-one", () => {
    const idToRaw = new Map<string, string>();
    const rawToId = new Map<string, string>();
    const conflicts: string[] = [];
    for (const c of artifact.cards) {
      const card = c as { card_stable_id: string; issuer_id: string; issuer_raw: string };
      const prevRaw = idToRaw.get(card.issuer_id);
      if (prevRaw && prevRaw !== card.issuer_raw) {
        conflicts.push(
          `${card.card_stable_id}: issuer_id ${card.issuer_id} → "${prevRaw}" e "${card.issuer_raw}"`
        );
      }
      const prevId = rawToId.get(card.issuer_raw);
      if (prevId && prevId !== card.issuer_id) {
        conflicts.push(
          `${card.card_stable_id}: issuer "${card.issuer_raw}" → ${prevId} e ${card.issuer_id}`
        );
      }
      idToRaw.set(card.issuer_id, card.issuer_raw);
      rawToId.set(card.issuer_raw, card.issuer_id);
    }
    expect(conflicts).toEqual([]);
  });

  it("every card has eligibility data", () => {
    const missing = artifact.cards.filter((c) => !c.eligibility).map((c) => c.card_stable_id);
    expect(missing).toEqual([]);
  });
});
