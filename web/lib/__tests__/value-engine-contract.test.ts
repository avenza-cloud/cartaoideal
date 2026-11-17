import { describe, expect, it } from "vitest";
import { createCardTools, resolveToolProfile } from "@/lib/ai-tools";
import {
  compareCardValueScores,
  DEFAULT_VALUE_ASSUMPTIONS,
  fxSpreadForCard,
  scoreCardInContext,
  scoreCardValue,
  scoreCardValues,
} from "@/lib/card-value";
import { filterCards, getAllCards, getCardById, getCardFeeWaiver } from "@/lib/cards";
import { evaluateFeeWaiver, extractFeeWaiverRules } from "@/lib/fee-waiver";
import { feeWaiverBadgesForCard } from "@/lib/fee-waiver-badges";
import { feeNote, feeTier } from "@/lib/roi";
import { scoreCards } from "@/lib/scoring";
import type { CardFacet, CardValueAssumptions, CardValueScore, UserProfile } from "@/types/cards";

// Perfil de referência da auditoria: renda 8.000, gasto 3.000, investido 50.000,
// sem gasto internacional, viaja às vezes (p = 0,5), prefere pontos, dólar 4,96.
const REF: UserProfile = {
  monthlySalaryBrl: 8000,
  avgMonthlySpendBrl: 3000,
  avgInvestedBrl: 50000,
  monthlyInternationalSpendBrl: 0,
  travelFrequency: "occasional",
  spendingCategories: [],
  preferences: {
    wantsLounge: false,
    prefersCashback: false,
    prefersPoints: true,
    prefersInvestback: false,
  },
};
const A: CardValueAssumptions = { ...DEFAULT_VALUE_ASSUMPTIONS, ptaxBrlPerUsd: 4.96 };

const ID = {
  nubankUV: "nubank-nubank-ultravioleta-3de87a375e",
  c6Black: "c6-bank-c6-mastercard-black-42584fec91",
  amexGold: "santander-santander-american-express-gold-card-f813c0b48b",
  golSmilesInfinite: "bradesco-bradesco-gol-smiles-visa-infinite-18c34f9e87",
  nomad: "nomad-nomad-explorer-visa-infinite-aae26793ed",
  sicrediBlack: "sicredi-sicredi-mastercard-black-5330201e3f",
  titan: "recargapay-recargapay-titan-mastercard-black-a32a999bff",
  uniqueBlack: "santander-santander-unique-mastercard-black-3733991841",
  digioOne: "digio-digio-one-visa-signature-9425d9a4be",
  vivo: "itau-vivo-cashback-visa-platinum-0b3b3ba0b0",
  personnaliteVI: "itau-itau-personnalite-visa-infinite-194dedbeda",
  btgTapBlack: "btg-pactual-tap-btg-pactual-black-0567cd725b",
  nCard: "itau-n-card",
  nubankBasic: "nubank-cartao-nubank-5feb686dbf",
  personnaliteBlack: "itau-itau-personnalite-mastercard-black-37922b9c11",
} as const;

function card(id: string): CardFacet {
  const found = getCardById(id);
  if (!found) throw new Error(`card ${id} missing from catalog`);
  return found;
}

function score(id: string, profile: UserProfile = REF, assumptions = A): CardValueScore {
  return scoreCardValue(card(id), profile, "profile", assumptions);
}

describe("reference profile — exact numbers (lounge R$80, unknown-program travel ≤ Livelo)", () => {
  it("Nubank Ultravioleta", () => {
    // Anuidade R$1.068 isenta: investido 50.000 ≥ 50.000.
    // Cashback 1,25% × 3.000 = 37,50. Sala VIP: 4 acessos/ano (teto do cartão < 6 viagens)
    // × R$80 / 12 = 26,667. Sem pontos → venda = viagem = decisão = 37,50 + 26,667 = 64,17.
    const s = score(ID.nubankUV);
    expect(s.effectiveAnnualFeeBrl).toBe(0);
    expect(s.intangibleMonthlyValueBrl).toBe(26.67);
    expect(s.netMonthlyValueBrl).toBe(64.17);
    expect(s.netMonthlyValueRangeHighBrl).toBe(64.17);
    expect(s.decisionMonthlyValueBrl).toBe(64.17);
  });

  it("C6 Mastercard Black", () => {
    // Anuidade 600/ano = 50/mês (gasto 3.000 < meta 5.000).
    // Pontos: 3.000 / 4,96 × 2 = 1.209,68 pts. Programa não identificado: venda R$22/1k = 26,61;
    // viagem min(55, Livelo 45) = R$45/1k = 54,435. Cashback 1% = 30,00 → bruto venda 30,00.
    // Benefícios: sala ilimitada 6 viagens × 80 / 12 = 40 + seguro 25 × 0,6 = 15 + concierge 15 × 0,6 = 9 → 64.
    // Venda: 30 + 64 − 50 = 44,00. Viagem: 54,435 + 64 − 50 = 68,435 → 68,44.
    // Decisão: 44 + 0,5 × 24,435 = 56,218 → 56,22.
    const s = score(ID.c6Black);
    expect(s.effectiveAnnualFeeBrl).toBe(600);
    expect(s.intangibleMonthlyValueBrl).toBe(64);
    expect(s.netMonthlyValueBrl).toBe(44);
    expect(s.netMonthlyValueRangeHighBrl).toBe(68.44);
    expect(s.decisionMonthlyValueBrl).toBe(56.22);
    // Benefícios fixos (64) ≥ mensalidade (50): o cartão se paga com qualquer gasto.
    expect(s.breakEvenMonthlySpendBrl).toBe(0);
  });

  it("Santander American Express Gold", () => {
    // Anuidade 550/12 = 45,833. 1,2 pts/USD × 604,839 = 725,806 pts (Membership Rewards).
    // Venda R$45/1k = 32,661; viagem R$95/1k = 68,952. Sem benefícios.
    // Venda: 32,661 − 45,833 = −13,172 → −13,17. Viagem: 68,952 − 45,833 = 23,118 → 23,12.
    // Decisão: −13,172 + 0,5 × 36,290 = 4,973 → 4,97.
    const s = score(ID.amexGold);
    expect(s.netMonthlyValueBrl).toBe(-13.17);
    expect(s.netMonthlyValueRangeHighBrl).toBe(23.12);
    expect(s.decisionMonthlyValueBrl).toBe(4.97);
    // Equilíbrio: retorno esperado 725,806 × (45 + 0,5 × 50)/1000 = 50,806 → taxa 50,806/3.000;
    // 45,833 / (50,806/3.000) = 2.706,35.
    expect(s.breakEvenMonthlySpendBrl).toBe(2706.35);
    // "Não há nenhuma publicada" não é menção de isenção.
    expect(s.dataQualityNotes.join(" ")).not.toMatch(/menção de isenção|exige/);
    // Veredito e motivo seguem a decisão (positiva), não o piso negativo.
    expect(s.verdict).toBe("Pode compensar, dependendo do uso real.");
    expect(s.rankReason).toContain("R$4,97/mês");
  });

  it("Bradesco Gol Smiles Visa Infinite", () => {
    // Anuidade 1.428 + Clube Smiles 43,70 × 12 = 524,40 → 1.952,40/ano = 162,70/mês.
    // 5,5 milhas/USD × 604,839 = 3.326,61 milhas: venda R$22/1k = 73,185; viagem R$45/1k = 149,698.
    // Sala VIP: 2 acessos × 80 / 12 = 13,333.
    // Venda: 73,185 + 13,333 − 162,70 = −76,181 → −76,18. Viagem: 149,698 + 13,333 − 162,70 = 0,331 → 0,33.
    // Decisão: −76,181 + 0,5 × 76,512 = −37,925 → −37,93.
    const s = score(ID.golSmilesInfinite);
    expect(s.effectiveAnnualFeeBrl).toBe(1952.4);
    expect(s.intangibleMonthlyValueBrl).toBe(13.33);
    expect(s.netMonthlyValueBrl).toBe(-76.18);
    expect(s.netMonthlyValueRangeHighBrl).toBe(0.33);
    expect(s.decisionMonthlyValueBrl).toBe(-37.93);
    expect(s.verdict).toBe("Tende a destruir valor neste perfil.");
  });

  it("Nomad Explorer Visa Infinite", () => {
    // Investido 50.000 / 4,96 = US$10.081 ≥ 5.000 → 3,0 pts/USD × 604,839 = 1.814,52 pts (Livelo).
    // Venda R$22/1k = 39,919; viagem R$45/1k = 81,653. Sala VIP 4 × 80 / 12 = 26,667. Sem anuidade.
    // Venda: 66,586 → 66,59. Viagem: 108,320 → 108,32. Decisão: 66,586 + 0,5 × 41,734 = 87,453 → 87,45.
    const s = score(ID.nomad);
    expect(s.netMonthlyValueBrl).toBe(66.59);
    expect(s.netMonthlyValueRangeHighBrl).toBe(108.32);
    expect(s.decisionMonthlyValueBrl).toBe(87.45);
  });
});

describe("ranking consistency", () => {
  const ranked = scoreCardValues(getAllCards(), REF, "profile", A);

  it("score never increases down the ranking", () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score0To100).toBeLessThanOrEqual(ranked[i - 1].score0To100);
    }
  });

  it("decision value never increases within each (eligible, feeKnown) group", () => {
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1];
      const cur = ranked[i];
      if (prev.eligible === cur.eligible && prev.feeKnown === cur.feeKnown) {
        expect(cur.decisionMonthlyValueBrl).toBeLessThanOrEqual(prev.decisionMonthlyValueBrl);
      }
    }
  });

  it("ineligible cards score exactly 0, in the list and alone", () => {
    const ineligible = ranked.filter((s) => !s.eligible);
    expect(ineligible.length).toBeGreaterThan(0);
    expect(ineligible.every((s) => s.score0To100 === 0)).toBe(true);
    expect(scoreCardValue(ineligible[0].card, REF, "profile", A).score0To100).toBe(0);
  });

  it("scoreCardInContext gives the same score and value as the full ranking", () => {
    const fromRanking = ranked.find((s) => s.card.card_stable_id === ID.c6Black)!;
    const inContext = scoreCardInContext(card(ID.c6Black), getAllCards(), REF, A);
    expect(inContext.score0To100).toBe(fromRanking.score0To100);
    expect(inContext.decisionMonthlyValueBrl).toBe(fromRanking.decisionMonthlyValueBrl);
  });

  it("scoreCards (API/chat ranking) keeps the same order and score", () => {
    const viaScoring = scoreCards(getAllCards(), REF, A);
    const eligible = ranked.filter((s) => s.eligible);
    expect(viaScoring.map((s) => s.card.card_stable_id)).toEqual(
      eligible.map((s) => s.card.card_stable_id)
    );
    expect(viaScoring.map((s) => Math.round(s.totalScore * 100))).toEqual(
      eligible.map((s) => s.score0To100)
    );
  });
});

describe("unknown annual fee", () => {
  it("null fee → feeKnown false, never free, ranked after known-fee cards", () => {
    const nCard = card(ID.nCard);
    expect(nCard.facets_numeric_or_special.annual_fee_brl_best_estimate).toBeNull();
    const s = score(ID.nCard);
    expect(s.feeKnown).toBe(false);
    expect(s.breakEvenMonthlySpendBrl).toBeNull();
    expect([s.feeAppliedReason, s.rankReason, ...s.scoreDrivers].join(" ")).not.toMatch(
      /Sem anuidade|todo retorno é ganho|Grátis/i
    );
    // Elegível com anuidade desconhecida: veredito pede para confirmar o custo.
    const eligibleUnknown = scoreCardValues(getAllCards(), REF, "profile", A).find(
      (x) => x.eligible && !x.feeKnown
    );
    expect(eligibleUnknown?.verdict).toMatch(/Anuidade não informada/);
    expect(feeTier(nCard, 3000, s.effectiveAnnualFeeBrl)).toBe("unknown");
    expect(feeNote(nCard, 3000, s.effectiveAnnualFeeBrl)).toBe("Anuidade não informada");
    expect(filterCards({ zeroFee: true }).some((c) => c.card_stable_id === ID.nCard)).toBe(false);

    const ranked = scoreCardValues(getAllCards(), REF, "profile", A).filter((x) => x.eligible);
    const lastKnown = ranked.map((x) => x.feeKnown).lastIndexOf(true);
    const firstUnknown = ranked.findIndex((x) => !x.feeKnown);
    expect(firstUnknown).toBeGreaterThan(lastKnown);
  });

  it("fee zero only because a waiver was met is not described as no-fee", () => {
    const s = score(ID.nubankUV);
    expect(feeTier(card(ID.nubankUV), 3000, s.effectiveAnnualFeeBrl)).toBe("free");
    expect(feeNote(card(ID.nubankUV), 3000, s.effectiveAnnualFeeBrl)).toMatch(
      /isenta pela condição que você atende/
    );
    expect(feeNote(card(ID.nubankBasic), 3000, 0)).toBe(
      "Sem anuidade — todo retorno é ganho líquido"
    );
  });
});

describe("travel perks", () => {
  it("non-traveler gets zero perks even when wanting lounge, and sells points at the cap", () => {
    const nonTraveler: UserProfile = {
      ...REF,
      travelFrequency: "none",
      preferences: { ...REF.preferences, wantsLounge: true, prefersPoints: true },
    };
    const s = score(ID.c6Black, nonTraveler);
    expect(s.intangibleMonthlyValueBrl).toBe(0);
    // Pontos vendidos a R$20/1k (teto de não-viajante) = 24,19 < cashback 30 → bruto 30.
    // Decisão = venda (p = 0) = 30 − 50 = −20.
    expect(s.decisionMonthlyValueBrl).toBe(-20);
    expect(s.components.find((c) => c.key === "intangibles")?.explanation).toMatch(/não viaja/);
  });

  it("non-traveler cap applies to Membership Rewards and airline miles too", () => {
    const nonTraveler: UserProfile = { ...REF, travelFrequency: "none" };
    // MR: 725,806 pts × R$20/1k = 14,52 (antes R$45/1k).
    expect(score(ID.amexGold, nonTraveler).pointsRewardMonthlySaleBrl).toBe(14.52);
    // Smiles: 3.326,61 milhas × R$20/1k = 66,53 (antes R$22/1k).
    expect(score(ID.golSmilesInfinite, nonTraveler).pointsRewardMonthlySaleBrl).toBe(66.53);
  });
});

describe("FX spread", () => {
  it("every card's spread is within [0, 10%]", () => {
    const outOfRange = getAllCards().filter((c) => {
      const { spread } = fxSpreadForCard(c);
      return !(spread >= 0 && spread <= 0.1);
    });
    expect(outOfRange.map((c) => c.card_stable_id)).toEqual([]);
  });

  it("'100% de isenção', cashback % or 'X pontos por dólar' are not read as spread", () => {
    // Itaú Personnalité Black: o parser antigo lia 100%.
    expect(fxSpreadForCard(card(ID.personnaliteBlack))).toMatchObject({
      spread: 0.055,
      source: "issuer_fallback",
    });
    // C6 Black: o parser antigo lia o 1% de cashback.
    expect(fxSpreadForCard(card(ID.c6Black)).spread).toBe(0.045);
  });

  it("uses fx_spread_pct, then an explicit spread phrase, then the issuer fallback", () => {
    expect(fxSpreadForCard(card(ID.titan))).toMatchObject({ spread: 0, source: "facet" });

    const base = card(ID.sicrediBlack);
    const withNote = (note: string): CardFacet => ({
      ...base,
      facets_numeric_or_special: {
        ...base.facets_numeric_or_special,
        official_forex_or_iof_note: note,
      },
    });
    expect(fxSpreadForCard(withNote("0% spread em compras internacionais"))).toMatchObject({
      spread: 0,
      source: "text",
    });
    expect(fxSpreadForCard(withNote("Spread de 2,5% sobre o dólar comercial")).spread).toBe(0.025);
    // Fora de [0, 10%] é descartado → fallback cooperativa 1%.
    expect(fxSpreadForCard(withNote("ágio de 40% no câmbio")).spread).toBe(0.01);
  });

  it("Sicredi Black with R$500 international spend has a sane FX cost", () => {
    // Cooperativa: spread 1%, IOF 3,5%: 500 × (1,01 × 1,035 − 1) = 500 × 0,04535 = 22,675 → 22,68.
    const s = score(ID.sicrediBlack, { ...REF, monthlyInternationalSpendBrl: 500 });
    expect(s.internationalMonthlyCostBrl).toBe(22.68);
  });

  it("international spend is capped at total spend", () => {
    const capped = score(ID.c6Black, { ...REF, monthlyInternationalSpendBrl: 5000 });
    const atTotal = score(ID.c6Black, { ...REF, monthlyInternationalSpendBrl: 3000 });
    expect(capped.internationalMonthlyCostBrl).toBe(atTotal.internationalMonthlyCostBrl);
    expect(capped.dataQualityNotes.join(" ")).toMatch(/maior que o gasto total/);
  });
});

describe("fee waivers — one evaluation for score, badges and chat", () => {
  it("Santander Unique needs two of three criteria; one criterion gives 50%", () => {
    // Só investimento (50.000) → 1 critério → 50% de 1.155 = 577,50.
    expect(score(ID.uniqueBlack).effectiveAnnualFeeBrl).toBe(577.5);
    // Gasto 8.000 + investimento 50.000 → 2 critérios → isento.
    expect(score(ID.uniqueBlack, { ...REF, avgMonthlySpendBrl: 8000 }).effectiveAnnualFeeBrl).toBe(
      0
    );
    // Nenhum critério → anuidade cheia, com a condição explicada.
    const none = score(ID.uniqueBlack, { ...REF, avgInvestedBrl: 0 });
    expect(none.effectiveAnnualFeeBrl).toBe(1155);
    expect(none.dataQualityNotes.join(" ")).toMatch(/cumprir 2 critérios/);
    // Badges e chat leem as mesmas regras.
    expect(feeWaiverBadgesForCard(card(ID.uniqueBlack)).map((b) => b.label)).toContain(
      "Isento com 2 critérios"
    );
    expect(getCardFeeWaiver(card(ID.uniqueBlack))?.rules.some((r) => r.min_conditions === 2)).toBe(
      true
    );
  });

  it("text-only 'dois dos seguintes critérios' sets min_conditions", () => {
    const rules = extractFeeWaiverRules(
      "100% de isenção ao cumprir dois dos seguintes critérios: faturas acima de R$ 8 mil, investimentos acima de R$ 50 mil."
    );
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.every((r) => r.min_conditions === 2)).toBe(true);
    expect(
      evaluateFeeWaiver(rules, 1000, { avgMonthlySpendBrl: 9000, avgInvestedBrl: 0 })
        .effectiveAnnualFee
    ).toBe(1000);
    expect(
      evaluateFeeWaiver(rules, 1000, { avgMonthlySpendBrl: 9000, avgInvestedBrl: 60000 })
        .effectiveAnnualFee
    ).toBe(0);
  });

  it("Digio One: 5% at R$2k, 100% above R$4k", () => {
    expect(score(ID.digioOne, { ...REF, avgMonthlySpendBrl: 1999 }).effectiveAnnualFeeBrl).toBe(
      539
    );
    // 539 × 0,95 = 512,05.
    expect(score(ID.digioOne, { ...REF, avgMonthlySpendBrl: 2000 }).effectiveAnnualFeeBrl).toBe(
      512.05
    );
    expect(score(ID.digioOne, { ...REF, avgMonthlySpendBrl: 4000 }).effectiveAnnualFeeBrl).toBe(0);
  });

  it("partial investment waivers apply (discount_pct)", () => {
    const rules = [
      {
        category: "investment" as const,
        threshold_brl: 100_000,
        full_waiver: false,
        discount_pct: 50,
        description: "50% com R$ 100 mil investidos",
        raw_text: "x",
      },
    ];
    expect(
      evaluateFeeWaiver(rules, 1000, { avgMonthlySpendBrl: 0, avgInvestedBrl: 100_000 })
        .effectiveAnnualFee
    ).toBe(500);
    expect(
      evaluateFeeWaiver(rules, 1000, { avgMonthlySpendBrl: 0, avgInvestedBrl: 99_999 })
        .effectiveAnnualFee
    ).toBe(1000);
  });

  it("progressive monthly discount: BTG Tap Black R$10 per R$1k spent", () => {
    // Mensalidade 100 − 3 × 10 = 70 → 840/ano.
    expect(score(ID.btgTapBlack, { ...REF, avgInvestedBrl: 0 }).effectiveAnnualFeeBrl).toBe(840);
  });

  it("partner-only spend (R$350 em compras Vivo) is not a general spend waiver", () => {
    const vivoText = String(
      card(ID.vivo).characteristics?.find((c) => c.key === "fee_waiver")?.value
    );
    expect(extractFeeWaiverRules(vivoText).some((r) => r.category === "monthly_spend")).toBe(false);
    expect(score(ID.vivo, { ...REF, avgMonthlySpendBrl: 10_000 }).effectiveAnnualFeeBrl).toBe(434);
  });

  it("an introductory free period is not a permanent waiver", () => {
    // Itaú Personnalité VI sem investimento e gasto 3.000: nenhuma regra atendida → 1.056.
    expect(score(ID.personnaliteVI, { ...REF, avgInvestedBrl: 0 }).effectiveAnnualFeeBrl).toBe(
      1056
    );
  });
});

describe("points rate parsing", () => {
  it("'categoria' is not read as 'até' (ceiling)", () => {
    const base = card(ID.c6Black);
    const synthetic: CardFacet = {
      ...base,
      reward_return: {
        ...base.reward_return,
        has_cashlike_return: false,
        earning_summary: "1,5 ponto por dólar em qualquer categoria",
      },
      characteristics: (base.characteristics ?? []).filter(
        (c) => c.key !== "earning_rate" && c.key !== "earning_detail"
      ),
    };
    const s = scoreCardValue(synthetic, REF, "profile", A);
    // 604,839 × 1,5 = 907,26 pts × R$22/1k = 19,96.
    expect(s.pointsRewardMonthlySaleBrl).toBe(19.96);
    expect(s.dataQualityNotes.join(" ")).not.toMatch(/teto/);
  });
});

describe("chat parity", () => {
  type ToolLike = { execute?: (input: unknown, options: unknown) => unknown };
  async function run<T>(t: unknown, input: unknown): Promise<T> {
    const exec = (t as ToolLike).execute;
    if (!exec) throw new Error("tool without execute");
    return (await exec(input, { toolCallId: "test", messages: [] })) as T;
  }
  interface ComparePayload {
    cards: Array<{ id: string; valorEstimado: { valorLiquidoMensal: number; pontuacao: number } }>;
    delta: { valorLiquidoMensal: number } | null;
    vencedor: { id: string } | null;
    perfilUsado: {
      gastoMensal: number;
      investido: number;
      perfilPadrao: boolean;
      dolarComercial: number;
    };
  }
  const ids = [ID.amexGold, ID.c6Black, ID.nubankUV];

  it("compare winner equals the compareCardValueScores winner (same profile and rate)", async () => {
    const live = { ...A, ptaxBrlPerUsd: 5.5 };
    const tools = createCardTools(REF, live);
    const out = await run<ComparePayload>(tools.compareCards, { cardIds: ids });
    const expected = ids
      .map((id) => scoreCardInContext(card(id), getAllCards(), REF, live))
      .sort(compareCardValueScores)[0];
    expect(out.vencedor?.id).toBe(expected.card.card_stable_id);
    for (const c of out.cards) {
      const s = scoreCardInContext(card(c.id), getAllCards(), REF, live);
      expect(c.valorEstimado.valorLiquidoMensal).toBe(s.decisionMonthlyValueBrl);
      expect(c.valorEstimado.pontuacao).toBe(s.score0To100);
    }
    expect(out.perfilUsado.dolarComercial).toBe(5.5);
    // O câmbio ao vivo muda o valor de quem pontua por dólar.
    expect(out.cards[0].valorEstimado.valorLiquidoMensal).not.toBe(
      score(ID.amexGold).decisionMonthlyValueBrl
    );
  });

  it("tool input overrides the saved profile field by field", async () => {
    const resolved = resolveToolProfile({ avgMonthlySpendBrl: 10_000 }, REF);
    expect(resolved.profile.avgMonthlySpendBrl).toBe(10_000);
    expect(resolved.profile.avgInvestedBrl).toBe(50_000);
    expect(resolved.profile.preferences.prefersPoints).toBe(true);
    expect(resolved.isDefault).toBe(false);

    const tools = createCardTools(REF, A);
    const out = await run<ComparePayload>(tools.compareCards, {
      cardIds: ids,
      profile: { avgMonthlySpendBrl: 10_000 },
    });
    expect(out.perfilUsado.gastoMensal).toBe(10_000);
    expect(out.perfilUsado.investido).toBe(50_000);
    const expectedC6 = scoreCardInContext(card(ID.c6Black), getAllCards(), resolved.profile, A);
    expect(out.cards[1].valorEstimado.valorLiquidoMensal).toBe(expectedC6.decisionMonthlyValueBrl);
  });

  it("flags the default reference profile when nothing was given", async () => {
    const tools = createCardTools(null, A);
    const out = await run<ComparePayload>(tools.compareCards, { cardIds: ids });
    expect(out.perfilUsado.perfilPadrao).toBe(true);
    const rank = await run<{ erro?: string }>(tools.rankCardsForProfile, {});
    expect(rank.erro).toBe("Perfil financeiro não informado");
  });

  it("rankCardsForProfile ranks with the merged profile", async () => {
    const tools = createCardTools(REF, A);
    const out = await run<Array<{ id: string; pontuacao: number }>>(tools.rankCardsForProfile, {
      avgMonthlySpendBrl: 10_000,
    });
    const expected = scoreCards(getAllCards(), { ...REF, avgMonthlySpendBrl: 10_000 }, A).slice(
      0,
      6
    );
    expect(out.map((o) => o.id)).toEqual(expected.map((e) => e.card.card_stable_id));
  });
});
