import { assert, describe, expect, it } from "vitest";
import { filterCards, getCardFeeWaiver, groupCardsByInvestment } from "@/lib/cards";
import { extractInvestmentThreshold } from "@/lib/fee-waiver";

// Test the getInvestmentWaiverCards execute logic directly (same logic as the tool)
function executeGetInvestmentWaiverCards(
  userInvestedBrl: number | undefined,
  savedProfileInvested: number | null = null
) {
  const cards = filterCards({ feeWaiverByInvestment: true });
  const invested = userInvestedBrl ?? savedProfileInvested ?? null;
  const slim = (c: ReturnType<typeof filterCards>[number]) => ({
    id: c.card_stable_id,
    nome: c.display_name,
    emissor: c.issuer_raw,
    anuidade: c.facets_numeric_or_special.annual_fee_brl_best_estimate,
    textoIsencao: getCardFeeWaiver(c)?.texto ?? "",
    viaGasto: getCardFeeWaiver(c)?.viaGasto ?? false,
    isGratuito: getCardFeeWaiver(c)?.isGratuito ?? false,
  });
  if (invested !== null) {
    const { accessible, needsMore } = groupCardsByInvestment(cards, invested, extractInvestmentThreshold);
    return {
      totalEncontrado: cards.length,
      investidoUsuario: invested,
      acessiveisAgora: accessible.map(slim),
      precisamDeMaisInvestimento: needsMore.map(({ card, threshold, shortfall }) => ({
        ...slim(card),
        thresholdInvestimento: threshold,
        faltam: shortfall,
      })),
    };
  }
  return { totalEncontrado: cards.length, cartoes: cards.map(slim) };
}

describe("getInvestmentWaiverCards execute logic", () => {
  it("with R$10k — totalEncontrado is 45 and all cards are accounted for", () => {
    const result = executeGetInvestmentWaiverCards(10_000);
    expect(result.totalEncontrado).toBe(45);
    expect("acessiveisAgora" in result).toBe(true);
    if ("acessiveisAgora" in result) {
      expect(result.acessiveisAgora!.length + result.precisamDeMaisInvestimento!.length).toBe(45);
    }
  });

  it("with R$10k — C6 Mastercard Black is in precisamDeMaisInvestimento with faltam=10000", () => {
    const result = executeGetInvestmentWaiverCards(10_000);
    assert("precisamDeMaisInvestimento" in result, "expected grouped result");
    const c6 = result.precisamDeMaisInvestimento!.find((c) => c.nome === "C6 Mastercard Black");
    expect(c6).toBeDefined();
    expect(c6!.thresholdInvestimento).toBe(20_000);
    expect(c6!.faltam).toBe(10_000);
  });

  it("with R$70k — Nubank Ultravioleta is in acessiveisAgora", () => {
    const result = executeGetInvestmentWaiverCards(70_000);
    assert("acessiveisAgora" in result, "expected grouped result");
    const nubank = result.acessiveisAgora!.find((c) => c.nome === "Nubank Ultravioleta");
    expect(nubank).toBeDefined();
  });

  it("with R$10k — Nubank Ultravioleta is in precisamDeMaisInvestimento", () => {
    const result = executeGetInvestmentWaiverCards(10_000);
    assert("precisamDeMaisInvestimento" in result, "expected grouped result");
    const nubank = result.precisamDeMaisInvestimento!.find((c) => c.nome === "Nubank Ultravioleta");
    expect(nubank).toBeDefined();
    expect(nubank!.thresholdInvestimento).toBe(50_000);
    expect(nubank!.faltam).toBe(40_000);
  });

  it("uses savedProfile invested when userInvestedBrl is not passed", () => {
    const result = executeGetInvestmentWaiverCards(undefined, 70_000);
    assert("acessiveisAgora" in result, "expected grouped result");
    const nubank = result.acessiveisAgora!.find((c) => c.nome === "Nubank Ultravioleta");
    expect(nubank).toBeDefined();
  });

  it("with no profile or input — returns flat cartoes array with totalEncontrado:45", () => {
    const result = executeGetInvestmentWaiverCards(undefined, null);
    expect(result.totalEncontrado).toBe(45);
    assert("cartoes" in result, "expected flat result");
    expect(result.cartoes!).toHaveLength(45);
  });

  it("each card has textoIsencao with investment mention", () => {
    const result = executeGetInvestmentWaiverCards(undefined, null);
    assert("cartoes" in result, "expected flat result");
    for (const c of result.cartoes!) {
      const lower = c.textoIsencao.toLowerCase();
      expect(lower.includes("investimento") || lower.includes("investidos")).toBe(true);
    }
  });
});
