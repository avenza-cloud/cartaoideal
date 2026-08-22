import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllCards, getCardById } from "@/lib/cards";
import { ALL_OVERRIDE_CARD_IDS } from "@/lib/card-overrides";
import { AFFILIATE_OVERRIDES } from "@/lib/affiliate";

const platformRoot = join(__dirname, "..", "..");

// Referential integrity: every card id referenced outside the dataset must
// exist in it, so a catalog regeneration or rename fails loudly in CI instead
// of silently breaking curated lists, scoring overrides or e2e fixtures.
describe("cross-reference integrity", () => {
  it("card_overrides.json ids exist in the catalog", () => {
    const missing = ALL_OVERRIDE_CARD_IDS.filter((id) => !getCardById(id));
    expect(missing).toEqual([]);
  });

  it("affiliate override ids exist in the catalog", () => {
    const missing = Object.keys(AFFILIATE_OVERRIDES).filter((id) => !getCardById(id));
    expect(missing).toEqual([]);
  });

  it("card ids hardcoded in e2e specs exist in the catalog", () => {
    const spec = readFileSync(join(platformRoot, "tests", "e2e", "mobile.spec.ts"), "utf8");
    const ids = [...spec.matchAll(/"([a-z0-9-]+-[0-9a-f]{10})"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    const missing = ids.filter((id) => !getCardById(id));
    expect(missing).toEqual([]);
  });

  it("every non-unknown card_art_url resolves to a file in public/", () => {
    const missing = getAllCards()
      .filter((c) => c.media.card_art_url !== "unknown")
      .filter((c) => !existsSync(join(platformRoot, "public", c.media.card_art_url)))
      .map((c) => c.card_stable_id);
    expect(missing).toEqual([]);
  });
});
