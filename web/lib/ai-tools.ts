import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  filterCards,
  getAllCards,
  getCardById,
  getCardsByIds,
  getCardFeeWaiver,
  groupCardsByInvestment,
  resolveCardByName,
} from "@/lib/cards";
import { extractInvestmentThreshold } from "@/lib/fee-waiver";
import {
  compareCardValueScores,
  DEFAULT_SCORING_PROFILE,
  DEFAULT_VALUE_ASSUMPTIONS,
  scoreCardValues,
} from "@/lib/card-value";
import type {
  CardFacet,
  CardFilters,
  CardValueAssumptions,
  CardValueScore,
  MarketSegment,
  UserProfile,
} from "@/types/cards";

// Campos opcionais sem default: o que a ferramenta não recebe vem do perfil
// salvo (e, sem perfil salvo, do perfil de referência).
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
    prefersCashback: z.boolean().optional(),
    prefersPoints: z.boolean().optional(),
    prefersInvestback: z.boolean().optional(),
    wantsLounge: z.boolean().optional(),
  });
}

export type ToolProfileInput = z.infer<ReturnType<typeof profileSchema>>;

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

export interface ResolvedToolProfile {
  profile: UserProfile;
  /** Nada veio da conversa nem do perfil salvo: perfil de referência. */
  isDefault: boolean;
  /** Campos preenchidos pelo perfil de referência. */
  defaultedFields: string[];
}

/**
 * Perfil usado pelas ferramentas, campo a campo: entrada da ferramenta ??
 * perfil salvo ?? perfil de referência. Assim "e se eu gastar R$10 mil?"
 * troca só o gasto e mantém o resto do perfil salvo.
 */
export function resolveToolProfile(
  input?: ToolProfileInput | null,
  savedProfile?: UserProfile | null
): ResolvedToolProfile {
  const saved = savedProfile ? toToolProfile(savedProfile) : null;
  const fallback = toToolProfile(DEFAULT_SCORING_PROFILE);
  const inputCashback =
    input?.prefersCashback === undefined && input?.prefersInvestback === undefined
      ? undefined
      : Boolean(input?.prefersCashback || input?.prefersInvestback);
  const defaultedFields: string[] = [];
  function pick<T>(field: string, fromInput: T | undefined, fromSaved: T | undefined, def: T): T {
    if (fromInput !== undefined) return fromInput;
    if (fromSaved !== undefined) return fromSaved;
    defaultedFields.push(field);
    return def;
  }

  const profile: UserProfile = {
    monthlySalaryBrl: pick(
      "monthlySalaryBrl",
      input?.monthlySalaryBrl,
      saved?.monthlySalaryBrl,
      fallback.monthlySalaryBrl
    ),
    avgMonthlySpendBrl: pick(
      "avgMonthlySpendBrl",
      input?.avgMonthlySpendBrl,
      saved?.avgMonthlySpendBrl,
      fallback.avgMonthlySpendBrl
    ),
    avgInvestedBrl: pick(
      "avgInvestedBrl",
      input?.avgInvestedBrl,
      saved?.avgInvestedBrl,
      fallback.avgInvestedBrl
    ),
    monthlyInternationalSpendBrl: pick(
      "monthlyInternationalSpendBrl",
      input?.monthlyInternationalSpendBrl,
      saved?.monthlyInternationalSpendBrl,
      fallback.monthlyInternationalSpendBrl
    ),
    travelFrequency: pick(
      "travelFrequency",
      input?.travelFrequency,
      saved?.travelFrequency,
      fallback.travelFrequency
    ),
    spendingCategories: savedProfile?.spendingCategories ?? [],
    preferences: {
      wantsLounge: pick(
        "wantsLounge",
        input?.wantsLounge,
        saved?.wantsLounge,
        fallback.wantsLounge
      ),
      prefersCashback: pick(
        "prefersCashback",
        inputCashback,
        saved?.prefersCashback,
        fallback.prefersCashback
      ),
      prefersPoints: pick(
        "prefersPoints",
        input?.prefersPoints,
        saved?.prefersPoints,
        fallback.prefersPoints
      ),
      prefersInvestback: false,
    },
  };
  // 8 campos do perfil: todos do padrão = perfil de referência.
  return { profile, isDefault: defaultedFields.length === 8, defaultedFields };
}

function perfilUsado(resolved: ResolvedToolProfile, assumptions: CardValueAssumptions) {
  const { profile } = resolved;
  return {
    rendaMensal: profile.monthlySalaryBrl,
    gastoMensal: profile.avgMonthlySpendBrl,
    investido: profile.avgInvestedBrl,
    gastoInternacionalMensal: profile.monthlyInternationalSpendBrl ?? 0,
    viagens: profile.travelFrequency,
    perfilPadrao: resolved.isDefault,
    camposDoPerfilPadrao: resolved.defaultedFields,
    dolarComercial: assumptions.ptaxBrlPerUsd,
  };
}

/** Anuidade para o chat: nunca `null`/"unknown" cru, que a UI mostraria como texto técnico. */
function chatAnnualFee(card: CardFacet): number | string {
  const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  if (typeof fee === "number") return fee;
  if (fee === "variable_pricing_claim") return "variável";
  return "não informada";
}

/** Scores do catálogo inteiro para o perfil, por id: mesmo percentil do ranking. */
function scoreCatalog(profile: UserProfile, assumptions: CardValueAssumptions) {
  const scored = scoreCardValues(getAllCards(), profile, "profile", assumptions);
  return new Map(scored.map((score) => [score.card.card_stable_id, score]));
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function compactValue(score: CardValueScore) {
  return {
    pontuacao: score.score0To100,
    elegivel: score.eligible,
    bloqueios: score.eligibilityReasons,
    // Valor de decisão: o mesmo número do ranking, do veredito e do vencedor.
    valorLiquidoMensal: score.decisionMonthlyValueBrl,
    valorLiquidoAnual: roundCents(score.decisionMonthlyValueBrl * 12),
    valorLiquidoMensalPontosVendidos: score.netMonthlyValueBrl,
    valorLiquidoMensalPontosEmViagem: score.netMonthlyValueRangeHighBrl,
    anuidadeConhecida: score.feeKnown,
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
  const points = summary.match(
    /(\d+(?:[,.]\d+)?)\s*(?:pontos?|pts?)(?:\s*(?:por|\/)\s*(?:d[oó]lar|usd)|\/usd)/i
  );
  if (points) {
    return `${points[1]} pts/USD`;
  }
  return summary.length <= 32 ? summary : null;
}

/**
 * Ferramentas do chat. `assumptions` deve ser o mesmo câmbio ao vivo que a UI
 * e /api/recommend usam (getValueAssumptionsWithLiveUsd), para o chat dar os
 * mesmos números.
 */
export function createCardTools(
  savedProfile?: UserProfile | null,
  assumptions: CardValueAssumptions = DEFAULT_VALUE_ASSUMPTIONS
) {
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
          .describe("Bandeira: Visa, Mastercard, American Express, Elo"),
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
          anuidade: chatAnnualFee(c),
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
          .describe("Só os campos que o usuário mudou na conversa; o resto vem do perfil salvo"),
      }),
      execute: async ({ cardId, profile }) => {
        const card = getCardById(cardId);
        if (!card) return { erro: "Cartão não encontrado" };
        const resolved = resolveToolProfile(profile, savedProfile);
        const score = scoreCatalog(resolved.profile, assumptions).get(card.card_stable_id);
        if (!score) return { erro: "Cartão não encontrado" };
        return {
          id: card.card_stable_id,
          nome: card.display_name,
          emissor: card.issuer_raw,
          bandeira: card.network_primary,
          segmento: card.market_segment_guess,
          anuidade: chatAnnualFee(card),
          investimentoMinimo: card.facets_numeric_or_special.minimum_investment_brl_best_estimate,
          lounge: card.lounge_access,
          iof: card.facets_numeric_or_special.official_forex_or_iof_note,
          isentaAnuidade: getCardFeeWaiver(card),
          regrasIsencao: getCardFeeWaiver(card)?.rules ?? [],
          retornoFinanceiro: card.reward_return,
          valorEstimado: {
            ...compactValue(score),
            beneficiosIntangiveisMensais: score.intangibleMonthlyValueBrl,
            motivoDoRanking: score.rankReason,
            roiSobreAnuidade: score.roiMultiple,
            pesoAnuidadeNoGastoAnual: score.feeBurdenPctOfAnnualSpend,
            componentes: score.components,
            observacoes: score.dataQualityNotes,
          },
          perfilUsado: perfilUsado(resolved, assumptions),
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
          .describe(
            "Só os campos que o usuário mudou na conversa (ex.: gasto mensal); o resto vem do perfil salvo"
          ),
      }),
      execute: async ({ cardIds, cardNames, profile }) => {
        const byId = cardIds?.length ? getCardsByIds(cardIds) : [];
        const byName = (cardNames ?? []).flatMap((name) => {
          const card = resolveCardByName(name);
          return card ? [card] : [];
        });
        const cards = [...byId, ...byName]
          .filter(
            (card, index, arr) =>
              arr.findIndex((other) => other.card_stable_id === card.card_stable_id) === index
          )
          .slice(0, 4);
        const resolved = resolveToolProfile(profile, savedProfile);
        const catalog = scoreCatalog(resolved.profile, assumptions);
        const scores = cards.flatMap((c) => {
          const score = catalog.get(c.card_stable_id);
          return score ? [score] : [];
        });
        const values = scores.map(compactValue);
        // Vencedor pela ordem canônica do ranking (elegível → anuidade conhecida → valor).
        const winner = scores.length >= 2 ? [...scores].sort(compareCardValueScores)[0] : null;
        const delta =
          values.length >= 2
            ? {
                valorLiquidoMensal: roundCents(
                  values[1].valorLiquidoMensal - values[0].valorLiquidoMensal
                ),
                valorLiquidoAnual: roundCents(
                  values[1].valorLiquidoAnual - values[0].valorLiquidoAnual
                ),
                retornoBrutoMensal: roundCents(
                  values[1].retornoBrutoMensal - values[0].retornoBrutoMensal
                ),
                anuidadeMensal: roundCents(
                  values[1].anuidadeEfetivaMensal - values[0].anuidadeEfetivaMensal
                ),
                beneficiosMensais: roundCents(
                  values[1].beneficiosMensais - values[0].beneficiosMensais
                ),
                origemRetorno: rewardOriginLabel(cards[1]),
              }
            : null;
        return {
          cards: cards.map((c, index) => ({
            id: c.card_stable_id,
            nome: c.display_name,
            emissor: c.issuer_raw,
            anuidade: chatAnnualFee(c),
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
          vencedor: winner
            ? {
                id: winner.card.card_stable_id,
                nome: winner.card.display_name,
                valorLiquidoMensal: winner.decisionMonthlyValueBrl,
                motivo: winner.rankReason,
              }
            : null,
          perfilUsado: perfilUsado(resolved, assumptions),
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
          anuidade: chatAnnualFee(c),
          textoIsencao: getCardFeeWaiver(c)?.texto ?? "",
          regrasIsencao: getCardFeeWaiver(c)?.rules ?? [],
          viaGasto: getCardFeeWaiver(c)?.viaGasto ?? false,
          isGratuito: getCardFeeWaiver(c)?.isGratuito ?? false,
          cardArtUrl: c.media.card_art_url,
          altText: c.media.alt_text,
        });
        if (invested !== null) {
          const { accessible, needsMore } = groupCardsByInvestment(
            cards,
            invested,
            extractInvestmentThreshold
          );
          const brl = (v: number) => v.toLocaleString("pt-BR");
          return {
            totalEncontrado: cards.length,
            investidoUsuario: invested,
            // Pré-formatado no servidor: o modelo copia, não conta — evita
            // discrepância entre a frase e os grupos exibidos pelo widget.
            resumo: `Encontrei ${cards.length} cartões. ${accessible.length} já acessíveis com seus R$ ${brl(invested)} investidos, ${needsMore.length} precisam de mais.`,
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
        "Pontua e ordena cartões de acordo com o perfil financeiro do usuário: renda, gastos, patrimônio investido e preferências. Passe só os campos que o usuário mudou na conversa; o resto vem do perfil salvo.",
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
        prefersCashback: z.boolean().optional(),
        prefersPoints: z.boolean().optional(),
        prefersInvestback: z.boolean().optional().describe("Legado: trate como cashback."),
        wantsLounge: z.boolean().optional(),
      }),
      execute: async (input) => {
        const { scoreCards: sc } = await import("@/lib/scoring");
        const resolved = resolveToolProfile(input, savedProfile);
        if (resolved.isDefault) return { erro: "Perfil financeiro não informado" };
        const scored = sc(getAllCards(), resolved.profile, assumptions).slice(0, 6);
        return scored.map((s) => ({
          id: s.card.card_stable_id,
          nome: s.card.display_name,
          emissor: s.card.issuer_raw,
          pontuacao: Math.round(s.totalScore * 100),
          valorEstimado: s.valueScore
            ? {
                ...compactValue(s.valueScore),
                beneficiosIntangiveisMensais: s.valueScore.intangibleMonthlyValueBrl,
                motivoDoRanking: s.valueScore.rankReason,
                roiSobreAnuidade: s.valueScore.roiMultiple,
                pesoAnuidadeNoGastoAnual: s.valueScore.feeBurdenPctOfAnnualSpend,
                componentes: s.valueScore.components,
                observacoes: s.valueScore.dataQualityNotes,
              }
            : null,
          anuidade: chatAnnualFee(s.card),
          lounge: s.card.lounge_access,
          retornoFinanceiro: s.card.reward_return,
          regrasIsencao: getCardFeeWaiver(s.card)?.rules ?? [],
          cardArtUrl: s.card.media.card_art_url,
          altText: s.card.media.alt_text,
          perfilPadraoParcial: resolved.defaultedFields.length > 0,
        }));
      },
    }),
  };
}

export const SYSTEM_PROMPT = `Você é um assistente especializado em cartões de crédito brasileiros. Você tem acesso a um catálogo de ${getAllCards().length} cartões com dados verificados.

Regras importantes:
- Sempre responda em português (pt-BR)
- RESPOSTAS SEMPRE CURTAS E AFIADAS: no máximo 2–3 frases por resposta. Os widgets acima da mensagem já mostram os dados — seu texto adiciona apenas a conclusão prática. Nunca escreva listas, tabelas ou parágrafos longos em texto.
- Use as ferramentas disponíveis para buscar dados reais — nunca invente informações sobre cartões
- Quando o usuário pedir comparação, troca de cartão, "vale trocar" ou "com números", use compareCards. Resolva por nome se o usuário não passar ID.
- As ferramentas recebem o perfil salvo automaticamente. Não peça gasto/renda/investimento de novo quando já estiverem no contexto.
- Em hipóteses ("e se eu gastar R$10 mil?"), passe em \`profile\` só o campo que mudou; o resto vem do perfil salvo. Se \`perfilUsado.perfilPadrao\` for verdadeiro, avise que o cálculo usa um perfil de referência.
- \`valorLiquidoMensal\` é o valor esperado usado no ranking. Em comparações, o melhor cartão é \`vencedor\`; não escolha outro.
- Anuidade "não informada" nunca é "sem anuidade".
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
- Escreva APENAS o campo \`resumo\` retornado pela ferramenta, literalmente — uma frase, nada mais. Não conte os cartões você mesmo.
- Se o usuário perguntar sobre um emissor específico, use getCardDetail. Não resuma dados da lista em prosa.`;
