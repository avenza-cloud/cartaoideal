import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { filterCards, getAllCards, getCardById, getCardsByIds, getCardFeeWaiver, groupCardsByInvestment, resolveCardByName } from "@/lib/cards";
import { extractInvestmentThreshold } from "@/lib/fee-waiver";
import { scoreCardValue } from "@/lib/card-value";
import type { CardFacet, CardFilters, MarketSegment, UserProfile } from "@/types/cards";

function profileSchema() {
  return z.object({
    monthlySalaryBrl: z.number().optional(),
    avgMonthlySpendBrl: z.number().optional(),
    avgInvestedBrl: z.number().optional(),
    monthlyInternationalSpendBrl: z
      .number()
      .optional()
      .describe("Gasto internacional mensal base, antes de IOF e spread."),
    travelFrequency: z.enum(["none", "occasional", "frequent"]).optional(),
    prefersCashback: z.boolean().default(false),
    prefersPoints: z.boolean().default(false),
    prefersInvestback: z.boolean().default(false),
    wantsLounge: z.boolean().default(false),
  });
}

export function toToolProfile(profile: UserProfile) {
  return {
    monthlySalaryBrl: profile.monthlySalaryBrl,
    avgMonthlySpendBrl: profile.avgMonthlySpendBrl,
    avgInvestedBrl: profile.avgInvestedBrl,
    monthlyInternationalSpendBrl: profile.monthlyInternationalSpendBrl ?? 0,
    travelFrequency: profile.travelFrequency,
    prefersCashback: profile.preferences.prefersCashback || profile.preferences.prefersInvestback,
    prefersPoints: profile.preferences.prefersPoints,
    prefersInvestback: false,
    wantsLounge: profile.preferences.wantsLounge,
  };
}

function toUserProfile(
  input?: z.infer<ReturnType<typeof profileSchema>>,
  savedProfile?: UserProfile | null
): UserProfile | undefined {
  if (!input && !savedProfile) return undefined;
  const saved = savedProfile ? toToolProfile(savedProfile) : null;
  const monthlySalaryBrl = saved?.monthlySalaryBrl ?? input?.monthlySalaryBrl;
  const avgMonthlySpendBrl = saved?.avgMonthlySpendBrl ?? input?.avgMonthlySpendBrl;

  if (monthlySalaryBrl === undefined || avgMonthlySpendBrl === undefined) {
    return undefined;
  }

  return {
    monthlySalaryBrl,
    avgMonthlySpendBrl,
    avgInvestedBrl: saved?.avgInvestedBrl ?? input?.avgInvestedBrl ?? 0,
    monthlyInternationalSpendBrl:
      saved?.monthlyInternationalSpendBrl ?? input?.monthlyInternationalSpendBrl ?? 0,
    travelFrequency: saved?.travelFrequency ?? input?.travelFrequency ?? "none",
    spendingCategories: [],
    preferences: {
      wantsLounge: saved?.wantsLounge ?? input?.wantsLounge ?? false,
      prefersCashback:
        saved?.prefersCashback ??
        Boolean(input?.prefersCashback || input?.prefersInvestback),
      prefersPoints: saved?.prefersPoints ?? input?.prefersPoints ?? false,
      prefersInvestback: false,
    },
  };
}

function compactValue(card: CardFacet, profile?: UserProfile) {
  const score = profile ? scoreCardValue(card, profile, "profile") : scoreCardValue(card);
  return {
    pontuacao: score.score0To100,
    elegivel: score.eligible,
    bloqueios: score.eligibilityReasons,
    valorLiquidoMensal: score.netMonthlyValueBrl,
    valorLiquidoAnual: score.netAnnualValueBrl,
    retornoBrutoMensal: score.grossRewardMonthlyBrl,
    retornoPontosVendaMensal: score.pointsRewardMonthlySaleBrl,
    retornoPontosViagemMensal: score.pointsRewardMonthlyTravelBrl,
    beneficiosMensais: score.intangibleMonthlyValueBrl,
    anuidadeEfetivaMensal: score.effectiveMonthlyFeeBrl,
    anuidadeEfetivaAnual: score.effectiveAnnualFeeBrl,
    custoInternacionalMensal: score.internationalMonthlyCostBrl,
    pontoEquilibrioGastoMensal: score.breakEvenMonthlySpendBrl,
    pontoEquilibrioSoPorRetornoMensal: score.breakEvenByRewardsOnlyMonthlySpendBrl,
    motivoDaAnuidade: score.feeAppliedReason,
    veredito: score.verdict,
    motivo: score.rankReason,
    fatores: score.scoreDrivers,
  };
}

function rewardOriginLabel(card: CardFacet): string | null {
  const summary = card.reward_return.earning_summary;
  if (!summary || summary === "unknown") return null;
  const percent = summary.match(/(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s*)?(cashback|investback)?/i);
  if (percent) {
    const kind = percent[2]?.toLowerCase() ?? "retorno";
    return `${percent[1]}% ${kind}`;
  }
  const points = summary.match(/(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)(?:\s*(?:por|\/)\s*(?:d[oó]lar|usd)|\/usd)/i);
  if (points) {
    return `${points[1]} pts/USD`;
  }
  return summary.length <= 32 ? summary : null;
}

export function createCardTools(savedProfile?: UserProfile | null) {
  return {
    filterCards: tool({
    description:
      "Filtra cartões de crédito brasileiros por segmento, bandeira, benefícios e taxa anual. Use para responder perguntas como 'quais cartões têm cashback' ou 'cartões sem anuidade'.",
    inputSchema: z.object({
      segment: z
        .enum(["mass_or_general", "upper_mass", "premium", "ultra_premium"])
        .optional()
        .describe("Segmento de mercado do cartão"),
      network: z
        .string()
        .optional()
        .describe("Bandeira: Visa, Mastercard, American Express, Elo, Hipercard"),
      lounge: z.boolean().optional().describe("Somente cartões com acesso a lounge"),
      rewardReturn: z
        .boolean()
        .optional()
        .describe("Somente cartões com retorno financeiro, como cashback"),
      points: z.boolean().optional().describe("Somente cartões com pontos ou milhas"),
      zeroFee: z.boolean().optional().describe("Somente cartões sem anuidade"),
      maxFee: z.number().optional().describe("Anuidade máxima em reais"),
      search: z.string().optional().describe("Busca por nome do cartão ou emissor"),
    }),
    execute: async (input) => {
      const filters: CardFilters = { ...input, segment: input.segment as MarketSegment };
      const cards = filterCards(filters).slice(0, 16);
      return cards.map((c) => ({
        id: c.card_stable_id,
        nome: c.display_name,
        emissor: c.issuer_raw,
        bandeira: c.network_primary,
        segmento: c.market_segment_guess,
        anuidade: c.facets_numeric_or_special.annual_fee_brl_best_estimate,
        investimentoMinimo: c.facets_numeric_or_special.minimum_investment_brl_best_estimate,
        lounge: c.lounge_access,
        retornoFinanceiro: c.reward_return,
        pontos: c.facets_boolean.earn_points_or_miles,
        isentaAnuidade: getCardFeeWaiver(c),
        regrasIsencao: getCardFeeWaiver(c)?.rules ?? [],
        fonte: c.source_label,
        cardArtUrl: c.media.card_art_url,
        altText: c.media.alt_text,
      }));
    },
  }),

    getCardDetail: tool({
    description:
      "Busca detalhes completos de um cartão pelo ID estável. Use quando o usuário quiser saber mais sobre um cartão específico.",
    inputSchema: z.object({
      cardId: z.string().describe("ID estável do cartão (card_stable_id)"),
      profile: profileSchema()
        .optional()
        .describe("Perfil financeiro do usuário para cálculo numérico personalizado"),
    }),
    execute: async ({ cardId, profile }) => {
      const card = getCardById(cardId);
      if (!card) return { erro: "Cartão não encontrado" };
      const userProfile = toUserProfile(profile, savedProfile);
      const score = userProfile
        ? scoreCardValue(card, userProfile, "profile")
        : scoreCardValue(card);
      return {
        id: card.card_stable_id,
        nome: card.display_name,
        emissor: card.issuer_raw,
        bandeira: card.network_primary,
        segmento: card.market_segment_guess,
        anuidade: card.facets_numeric_or_special.annual_fee_brl_best_estimate,
        investimentoMinimo: card.facets_numeric_or_special.minimum_investment_brl_best_estimate,
        lounge: card.lounge_access,
        iof: card.facets_numeric_or_special.official_forex_or_iof_note,
        isentaAnuidade: getCardFeeWaiver(card),
        regrasIsencao: getCardFeeWaiver(card)?.rules ?? [],
        retornoFinanceiro: card.reward_return,
        valorEstimado: {
          pontuacao: score.score0To100,
          valorLiquidoMensal: score.netMonthlyValueBrl,
          valorLiquidoAnual: score.netAnnualValueBrl,
          anuidadeEfetivaMensal: score.effectiveMonthlyFeeBrl,
          retornoBrutoMensal: score.grossRewardMonthlyBrl,
          retornoPontosVendaMensal: score.pointsRewardMonthlySaleBrl,
          retornoPontosViagemMensal: score.pointsRewardMonthlyTravelBrl,
          beneficiosIntangiveisMensais: score.intangibleMonthlyValueBrl,
          custoInternacionalMensal: score.internationalMonthlyCostBrl,
          pontoEquilibrioGastoMensal: score.breakEvenMonthlySpendBrl,
          pontoEquilibrioSoPorRetornoMensal: score.breakEvenByRewardsOnlyMonthlySpendBrl,
          veredito: score.verdict,
          motivoDoRanking: score.rankReason,
          motivoDaAnuidade: score.feeAppliedReason,
          roiSobreAnuidade: score.roiMultiple,
          pesoAnuidadeNoGastoAnual: score.feeBurdenPctOfAnnualSpend,
          fatores: score.scoreDrivers,
          componentes: score.components,
          observacoes: score.dataQualityNotes,
        },
        beneficiosAgrupados: card.benefit_groups,
        fonte: card.source_label,
        fonteUrl: card.source_url,
      };
    },
  }),

    compareCards: tool({
    description:
      "Compara de 2 a 4 cartões lado a lado. Aceita IDs ou nomes exatos/aproximados. Use esta ferramenta sempre que o usuário pedir para comparar cartões, especialmente quando pedir 'vale trocar' ou 'para meu perfil'.",
    inputSchema: z.object({
      cardIds: z
        .array(z.string())
        .max(4)
        .optional()
        .describe("Lista de IDs dos cartões a comparar, se conhecidos"),
      cardNames: z
        .array(z.string())
        .max(4)
        .optional()
        .describe("Nomes dos cartões a comparar quando o usuário informar por nome"),
      profile: profileSchema()
        .optional()
        .describe("Perfil financeiro do usuário para cálculo numérico personalizado"),
    }),
    execute: async ({ cardIds, cardNames, profile }) => {
      const byId = cardIds?.length ? getCardsByIds(cardIds) : [];
      const byName = (cardNames ?? []).flatMap((name) => {
        const card = resolveCardByName(name);
        return card ? [card] : [];
      });
      const cards = [...byId, ...byName].filter(
        (card, index, arr) =>
          arr.findIndex((other) => other.card_stable_id === card.card_stable_id) === index
      ).slice(0, 4);
      const userProfile = toUserProfile(profile, savedProfile);
      const values = cards.map((c) => compactValue(c, userProfile));
      const delta =
        values.length >= 2
          ? {
              valorLiquidoMensal: values[1].valorLiquidoMensal - values[0].valorLiquidoMensal,
              valorLiquidoAnual: values[1].valorLiquidoAnual - values[0].valorLiquidoAnual,
              retornoBrutoMensal: values[1].retornoBrutoMensal - values[0].retornoBrutoMensal,
              anuidadeMensal: values[1].anuidadeEfetivaMensal - values[0].anuidadeEfetivaMensal,
              beneficiosMensais: values[1].beneficiosMensais - values[0].beneficiosMensais,
              origemRetorno: rewardOriginLabel(cards[1]),
            }
          : null;
      return {
        cards: cards.map((c, index) => ({
        id: c.card_stable_id,
        nome: c.display_name,
        emissor: c.issuer_raw,
        anuidade: c.facets_numeric_or_special.annual_fee_brl_best_estimate,
        investimentoMinimo: c.eligibility?.minimum_investment_brl_best_estimate,
        elegibilidade: c.eligibility,
        lounge: c.lounge_access,
        retornoFinanceiro: c.reward_return,
        pontos: c.facets_boolean.earn_points_or_miles,
        seguroViagem: c.facets_boolean.mentions_travel_insurance,
        concierge: c.facets_boolean.mentions_concierge,
        isentaAnuidade: getCardFeeWaiver(c),
        regrasIsencao: getCardFeeWaiver(c)?.rules ?? [],
        fonte: c.source_label,
        cardArtUrl: c.media.card_art_url,
        altText: c.media.alt_text,
        valorEstimado: values[index],
      })),
        delta,
        perfilUsado: userProfile
          ? {
              rendaMensal: userProfile.monthlySalaryBrl,
              gastoMensal: userProfile.avgMonthlySpendBrl,
              investido: userProfile.avgInvestedBrl,
              gastoInternacionalMensal: userProfile.monthlyInternationalSpendBrl ?? 0,
              viagens: userProfile.travelFrequency,
            }
          : null,
        naoEncontrados: (cardNames ?? []).filter((name) => !resolveCardByName(name)),
      };
    },
  }),

    getInvestmentWaiverCards: tool({
    description:
      "Lista TODOS os cartões brasileiros que permitem isenção de anuidade via investimento, agrupados por acessibilidade. Use SEMPRE que o usuário perguntar sobre isentar anuidade com investimento, quanto precisa manter investido, ou cartões gratuitos com investimento. Nunca use filterCards para esse fim.",
    inputSchema: z.object({
      userInvestedBrl: z
        .number()
        .optional()
        .describe("Valor total investido pelo usuário em reais (do perfil ou da conversa)"),
    }),
    execute: async ({ userInvestedBrl }) => {
      const cards = filterCards({ feeWaiverByInvestment: true });
      const invested = userInvestedBrl ?? savedProfile?.avgInvestedBrl ?? null;
      const slim = (c: CardFacet) => ({
        id: c.card_stable_id,
        nome: c.display_name,
        emissor: c.issuer_raw,
        bandeira: c.network_primary,
        anuidade: c.facets_numeric_or_special.annual_fee_brl_best_estimate,
        textoIsencao: getCardFeeWaiver(c)?.texto ?? "",
        regrasIsencao: getCardFeeWaiver(c)?.rules ?? [],
        viaGasto: getCardFeeWaiver(c)?.viaGasto ?? false,
        isGratuito: getCardFeeWaiver(c)?.isGratuito ?? false,
        cardArtUrl: c.media.card_art_url,
        altText: c.media.alt_text,
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
    },
  }),

    rankCardsForProfile: tool({
    description:
      "Pontua e ordena cartões de acordo com o perfil financeiro do usuário: renda, gastos, patrimônio investido e preferências.",
    inputSchema: z.object({
      monthlySalaryBrl: z.number().optional().describe("Renda mensal em reais"),
      avgMonthlySpendBrl: z.number().optional().describe("Gasto médio mensal no cartão"),
      avgInvestedBrl: z.number().optional().describe("Patrimônio investido em reais"),
      monthlyInternationalSpendBrl: z
        .number()
        .optional()
        .describe("Gasto internacional mensal base no cartão, antes de IOF e spread."),
      travelFrequency: z
        .enum(["none", "occasional", "frequent"])
        .optional()
        .describe("Frequência de viagens"),
      prefersCashback: z.boolean().default(false),
      prefersPoints: z.boolean().default(false),
      prefersInvestback: z.boolean().default(false).describe("Legado: trate como cashback."),
      wantsLounge: z.boolean().default(false),
    }),
    execute: async (input) => {
      const { scoreCards: sc } = await import("@/lib/scoring");
      const all = getAllCards();
      const userProfile = toUserProfile(input, savedProfile);
      if (!userProfile) return { erro: "Perfil financeiro não informado" };
      const scored = sc(all, userProfile).slice(0, 6);
      return scored.map((s) => ({
        id: s.card.card_stable_id,
        nome: s.card.display_name,
        emissor: s.card.issuer_raw,
        pontuacao: Math.round(s.totalScore * 100),
        valorEstimado: s.valueScore
          ? {
              valorLiquidoMensal: s.valueScore.netMonthlyValueBrl,
              valorLiquidoAnual: s.valueScore.netAnnualValueBrl,
              anuidadeEfetivaMensal: s.valueScore.effectiveMonthlyFeeBrl,
              retornoBrutoMensal: s.valueScore.grossRewardMonthlyBrl,
              beneficiosIntangiveisMensais: s.valueScore.intangibleMonthlyValueBrl,
              custoInternacionalMensal: s.valueScore.internationalMonthlyCostBrl,
              pontoEquilibrioGastoMensal: s.valueScore.breakEvenMonthlySpendBrl,
              veredito: s.valueScore.verdict,
              motivoDoRanking: s.valueScore.rankReason,
              motivoDaAnuidade: s.valueScore.feeAppliedReason,
              roiSobreAnuidade: s.valueScore.roiMultiple,
              pesoAnuidadeNoGastoAnual: s.valueScore.feeBurdenPctOfAnnualSpend,
              fatores: s.valueScore.scoreDrivers,
              componentes: s.valueScore.components,
              observacoes: s.valueScore.dataQualityNotes,
            }
          : null,
        anuidade: s.card.facets_numeric_or_special.annual_fee_brl_best_estimate,
        lounge: s.card.lounge_access,
        retornoFinanceiro: s.card.reward_return,
        regrasIsencao: getCardFeeWaiver(s.card)?.rules ?? [],
        cardArtUrl: s.card.media.card_art_url,
        altText: s.card.media.alt_text,
      }));
    },
  }),
  };
}

export const SYSTEM_PROMPT = `Você é um assistente especializado em cartões de crédito brasileiros. Você tem acesso a um catálogo de ${getAllCards().length} cartões com dados verificados.

Regras importantes:
- Sempre responda em português (pt-BR)
- Use as ferramentas disponíveis para buscar dados reais — nunca invente informações sobre cartões
- Quando o usuário pedir comparação, troca de cartão, "vale trocar" ou "com números", use compareCards. Resolva por nome se o usuário não passar ID.
- As ferramentas recebem o perfil salvo automaticamente. Não peça gasto/renda/investimento de novo quando já estiverem no contexto.
- Para comparações, a interface JÁ EXIBE visualmente delta mensal/anual, retorno, anuidade, benefícios e a tabela. NÃO repita esses números nem reescreva a tabela em texto.
- Em comparações, responda em no máximo 3 frases: decisão prática ("trocar", "ficar" ou "depende"), motivo novo que não esteja óbvio na tabela, e bloqueio/ressalva de elegibilidade se existir.
- Ao citar dados de cartões, mencione a fonte quando for relevante
- Para regras contratuais, tarifas e elegibilidade final, recomende verificação direta com o emissor
- Seja objetivo e direto nas comparações
- Data de referência do catálogo: maio de 2026

Isenção de anuidade por investimento:
- Para QUALQUER pergunta sobre isentar anuidade com investimento, use SOMENTE a ferramenta \`getInvestmentWaiverCards\`. Nunca use \`filterCards\` para esse fim.
- Passe \`userInvestedBrl\` com o valor investido do usuário (do perfil ou da conversa).
- Os cartões JÁ SÃO EXIBIDOS VISUALMENTE pela interface logo acima desta mensagem. PROIBIDO repetir nomes, anuidades ou critérios de cartões em texto.
- Escreva APENAS: "Encontrei [totalEncontrado] cartões. [N] já acessíveis com seus R$ X investidos, [M] precisam de mais." — uma frase, nada mais.
- Se o usuário perguntar sobre um emissor específico, use getCardDetail. Não resuma dados da lista em prosa.`;
