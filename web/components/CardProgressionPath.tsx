"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/store";
import { scoreCardValue } from "@/lib/card-value";
import { formatBrlCurrency, formatBrlInput, parseBrlInput } from "@/lib/brl";
import { fetchRecommendations } from "@/lib/recommend-client";
import { useCardDetailHref } from "@/lib/use-card-detail-href";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import { Button } from "@/components/ui/button";
import { CardArt, LeadFact, Tag } from "@/components/card";
import { ArrowRight } from "lucide-react";
import type { CardScore } from "@/types/cards";

const FEE_UNKNOWN = "Anuidade não informada";

function shortMoney(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return `R$${v.toLocaleString("pt-BR")}`;
}

function brl(value: number) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}R$ ${Math.abs(rounded).toLocaleString("pt-BR")}`;
}

function feeLeadValue(
  fee: CardScore["card"]["facets_numeric_or_special"]["annual_fee_brl_best_estimate"]
) {
  if (fee === 0) return "Sem anuidade";
  if (typeof fee === "number") return `${brl(fee)}/ano`;
  if (fee === "variable_pricing_claim") return "Variável";
  return FEE_UNKNOWN;
}

function CardRow({
  scored,
  caption,
  tag,
}: Readonly<{
  scored: CardScore;
  caption?: string;
  tag?: string;
}>) {
  const { card, valueScore } = scored;
  const detailHref = useCardDetailHref(card.card_stable_id);
  const labelForA11y = caption ? `${caption}: ${card.display_name}` : card.display_name;

  const low = valueScore
    ? Math.min(valueScore.netMonthlyValueBrl, valueScore.netMonthlyValueRangeHighBrl)
    : 0;
  const high = valueScore
    ? Math.max(valueScore.netMonthlyValueBrl, valueScore.netMonthlyValueRangeHighBrl)
    : 0;
  const feeValue = feeLeadValue(card.facets_numeric_or_special.annual_fee_brl_best_estimate);

  return (
    <Link
      href={detailHref}
      aria-label={labelForA11y}
      className="flex items-start gap-3 rounded-panel border border-line bg-raised p-3.5 text-left transition-colors duration-100 hover:border-line-strong"
    >
      <CardArt
        compact
        artUrl={card.media.card_art_url}
        issuerRaw={card.issuer_raw}
        network={card.network_primary}
        displayName={card.display_name}
        className="h-9 w-14"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{card.display_name}</p>
        <p className="truncate text-xs text-fg-3">{card.issuer_raw}</p>
        {valueScore ? (
          <LeadFact
            size="sm"
            className="mt-2"
            value={`${valueScore.decisionMonthlyValueBrl > 0 ? "+" : ""}${brl(valueScore.decisionMonthlyValueBrl)}/mês`}
            label="valor líquido estimado"
            hint={high - low >= 1 ? `${brl(low)} a ${brl(high)}` : undefined}
            tone={
              valueScore.decisionMonthlyValueBrl < 0
                ? "negative"
                : valueScore.decisionMonthlyValueBrl > 0
                  ? "positive"
                  : "default"
            }
          />
        ) : (
          <LeadFact
            size="sm"
            className="mt-2"
            value={feeValue}
            label={feeValue === FEE_UNKNOWN ? "consulte o emissor" : "anuidade"}
          />
        )}
        {valueScore && !valueScore.feeKnown && (
          <p className="mt-0.5 text-xs text-fg-3">{FEE_UNKNOWN}</p>
        )}
        {tag && (
          <div className="mt-2 flex">
            <Tag variant="brand">{tag}</Tag>
          </div>
        )}
      </div>
    </Link>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-fg-3">{children}</p>;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-panel border border-dashed border-line-strong/60 bg-page px-3.5 py-3 text-sm leading-relaxed text-fg-2">
      {children}
    </p>
  );
}

export function CardProgressionPath() {
  const { profile, onboardingDone } = useProfileStore();
  const assumptions = useValueAssumptions();

  const [bestReco, setBestReco] = useState<CardScore | null>(null);
  const [currentReco, setCurrentReco] = useState<CardScore | null>(null);
  const [loadingReco, setLoadingReco] = useState(false);

  const [futureIncome, setFutureIncome] = useState("");
  const [futureInvested, setFutureInvested] = useState("");

  const [simResult, setSimResult] = useState<{
    top: CardScore[];
    newUnlocked: CardScore[];
    futureSpend: number;
  } | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!profile) {
      setBestReco(null);
      setCurrentReco(null);
      return;
    }
    setLoadingReco(true);
    fetchRecommendations(profile, 12)
      .then(({ scores, currentCard }) => {
        const best = scores[0] ?? null;
        setBestReco(best);
        const id = profile.currentPrimaryCardId;
        if (!id) {
          setCurrentReco(null);
          return;
        }
        const fromList = scores.find((s) => s.card.card_stable_id === id) ?? null;
        if (fromList) {
          setCurrentReco(fromList);
          return;
        }
        setCurrentReco(
          currentCard
            ? {
                card: currentCard.score.card,
                totalScore: 0,
                breakdown: {
                  eligibilityMet: currentCard.score.eligible,
                  feeAffordability: 0,
                  rewardsMatch: 0,
                  travelBenefits: 0,
                  segmentFit: 0,
                },
                valueScore: currentCard.score,
              }
            : null
        );
      })
      .catch(() => {
        setBestReco(null);
        setCurrentReco(null);
      })
      .finally(() => setLoadingReco(false));
  }, [profile]);

  const futureIncomeNum = parseBrlInput(futureIncome);
  const futureInvestedNum = parseBrlInput(futureInvested);

  const scalesSpend = !!profile && futureIncomeNum > 0 && profile.monthlySalaryBrl > 0;
  const estimatedFutureSpend =
    profile && scalesSpend
      ? profile.avgMonthlySpendBrl * (futureIncomeNum / profile.monthlySalaryBrl)
      : 0;

  const canSimulate = futureIncomeNum > 0 || futureInvestedNum > 0;

  const simulate = useCallback(async () => {
    if (!profile || !canSimulate) return;
    setSimLoading(true);
    setSimResult(null);

    const futureSpend = scalesSpend ? estimatedFutureSpend : profile.avgMonthlySpendBrl;
    const futureProfile = {
      ...profile,
      monthlySalaryBrl: futureIncomeNum || profile.monthlySalaryBrl,
      avgInvestedBrl: futureInvestedNum || profile.avgInvestedBrl,
      avgMonthlySpendBrl: futureSpend,
    };

    try {
      const { scores: future } = await fetchRecommendations(futureProfile, 10);

      const newUnlocked = future.filter(
        (s) =>
          s.valueScore?.eligible !== false &&
          !scoreCardValue(s.card, profile, "profile", assumptions).eligible
      );

      setSimResult({
        top: future.slice(0, 3),
        newUnlocked: newUnlocked.slice(0, 2),
        futureSpend,
      });
    } catch {
      // silent
    } finally {
      setSimLoading(false);
    }
  }, [
    profile,
    canSimulate,
    futureIncomeNum,
    futureInvestedNum,
    scalesSpend,
    estimatedFutureSpend,
    assumptions,
  ]);

  if (!profile || !onboardingDone) return null;

  const sameAsBest =
    currentReco?.card.card_stable_id != null &&
    currentReco.card.card_stable_id === bestReco?.card.card_stable_id;

  let agoraContent: ReactNode;
  if (loadingReco) {
    agoraContent = (
      <div className="space-y-2.5" aria-busy="true">
        <div className="h-20 rounded-panel bg-surface-2" />
        <div className="h-20 rounded-panel bg-surface-2" />
      </div>
    );
  } else if (!bestReco) {
    agoraContent = <Notice>Nenhum cartão elegível encontrado.</Notice>;
  } else if (sameAsBest) {
    agoraContent = (
      <div>
        <RowLabel>Seu cartão · melhor recomendação</RowLabel>
        <CardRow scored={bestReco} caption="Seu cartão · melhor recomendação" />
      </div>
    );
  } else {
    agoraContent = (
      <div className="space-y-3">
        {currentReco ? (
          <div>
            <RowLabel>Seu cartão</RowLabel>
            <CardRow scored={currentReco} caption="Seu cartão" />
          </div>
        ) : profile.currentPrimaryCardId ? (
          <Notice>
            O cartão do cadastro não aparece como elegível com este perfil.{" "}
            <Link href="/perfil" className="font-medium text-fg underline underline-offset-4">
              Ajustar perfil
            </Link>
          </Notice>
        ) : (
          <Notice>
            Nenhum cartão principal no cadastro.{" "}
            <Link href="/perfil" className="font-medium text-fg underline underline-offset-4">
              Definir no perfil
            </Link>
          </Notice>
        )}
        <div>
          <RowLabel>Melhor recomendação</RowLabel>
          <CardRow scored={bestReco} caption="Melhor recomendação" />
        </div>
      </div>
    );
  }

  const newIds = new Set(simResult?.newUnlocked.map((s) => s.card.card_stable_id));
  const bestInScenario = simResult?.top[0];

  return (
    <section className="rounded-panel bg-surface p-5 sm:p-6">
      <div className="pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Sua jornada de cartões</h2>
        <p className="mt-0.5 text-sm text-fg-2">
          Compare seu cenário atual com uma projeção de renda ou patrimônio.
        </p>
      </div>

      <div className="grid gap-6 border-t border-line pt-5 md:grid-cols-2 md:gap-8">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Agora</h3>

          {agoraContent}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-fg-3">
            <span>
              Renda{" "}
              <span className="num font-medium text-fg">
                R${profile.monthlySalaryBrl.toLocaleString("pt-BR")}/mês
              </span>
            </span>
            <span>
              Gasto{" "}
              <span className="num font-medium text-fg">
                R${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês
              </span>
            </span>
            <span>
              Investido{" "}
              <span className="num font-medium text-fg">{shortMoney(profile.avgInvestedBrl)}</span>
            </span>
            <Link
              href="/perfil"
              className="ml-auto font-medium text-fg underline underline-offset-4 hover:text-brand-accent"
            >
              Editar
            </Link>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-fg">Em ~1 ano</h3>
          <p className="mt-0.5 text-xs text-fg-3">Deixe em branco para manter o valor atual.</p>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <label htmlFor="future-income" className="text-sm font-medium text-fg">
                  Renda / mês
                </label>
                <span className="text-xs text-fg-3">
                  Atual{" "}
                  <span className="num font-medium text-fg">
                    R${profile.monthlySalaryBrl.toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-field border border-line-strong bg-field px-3 transition-colors duration-100 focus-within:border-accent-line focus-within:ring-2 focus-within:ring-ring/20">
                <span className="shrink-0 text-sm text-fg-3">R$</span>
                <input
                  id="future-income"
                  type="text"
                  inputMode="numeric"
                  value={futureIncome}
                  onChange={(e) => {
                    setFutureIncome(formatBrlInput(e.target.value));
                    setSimResult(null);
                  }}
                  placeholder="—"
                  aria-label="Renda mensal esperada em cerca de um ano"
                  className="num min-w-0 flex-1 bg-transparent text-sm font-medium text-fg placeholder:text-fg-3 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <label htmlFor="future-invested" className="text-sm font-medium text-fg">
                  Investido
                </label>
                <span className="text-xs text-fg-3">
                  Atual{" "}
                  <span className="num font-medium text-fg">
                    {shortMoney(profile.avgInvestedBrl)}
                  </span>
                </span>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-field border border-line-strong bg-field px-3 transition-colors duration-100 focus-within:border-accent-line focus-within:ring-2 focus-within:ring-ring/20">
                <span className="shrink-0 text-sm text-fg-3">R$</span>
                <input
                  id="future-invested"
                  type="text"
                  inputMode="numeric"
                  value={futureInvested}
                  onChange={(e) => {
                    setFutureInvested(formatBrlInput(e.target.value));
                    setSimResult(null);
                  }}
                  placeholder="—"
                  aria-label="Total investido esperado em cerca de um ano"
                  className="num min-w-0 flex-1 bg-transparent text-sm font-medium text-fg placeholder:text-fg-3 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {estimatedFutureSpend > 0 && estimatedFutureSpend !== profile.avgMonthlySpendBrl && (
            <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-line pt-3 text-sm">
              <span className="text-fg-2">Gasto est.</span>
              <span className="num font-semibold text-fg">
                {formatBrlCurrency(estimatedFutureSpend)}/mês
              </span>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={simulate}
            disabled={!canSimulate || simLoading}
            className="mt-4 w-full"
          >
            <span>{simLoading ? "Calculando…" : "Simular cenário"}</span>
            {!simLoading && <ArrowRight aria-hidden className="h-4 w-4" />}
          </Button>
          {!canSimulate && (
            <p className="mt-2 text-center text-xs text-fg-3">
              Preencha renda ou patrimônio investido para simular.
            </p>
          )}
        </div>
      </div>

      {simResult && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="num mb-3 text-sm font-semibold text-fg">
            Simulado · gasto ≈ {formatBrlCurrency(simResult.futureSpend)}/mês
          </p>
          {simResult.newUnlocked.length > 0 ? (
            <div className="space-y-4">
              <div>
                <RowLabel>
                  {simResult.newUnlocked.length === 1
                    ? "Novo no radar"
                    : `${simResult.newUnlocked.length} novos no radar`}
                </RowLabel>
                <div className="grid gap-3 md:grid-cols-2">
                  {simResult.newUnlocked.map((s) => (
                    <CardRow
                      key={s.card.card_stable_id}
                      scored={s}
                      caption="Novo no radar"
                      tag="Novo"
                    />
                  ))}
                </div>
              </div>
              {bestInScenario && !newIds.has(bestInScenario.card.card_stable_id) && (
                <div>
                  <RowLabel>Melhor no cenário</RowLabel>
                  <CardRow scored={bestInScenario} caption="Melhor no cenário" />
                </div>
              )}
            </div>
          ) : (
            <div>
              <RowLabel>Ranking no cenário (sem novos desbloqueios)</RowLabel>
              <div className="grid gap-3 md:grid-cols-2">
                {simResult.top.slice(0, 2).map((s, i) => (
                  <div key={s.card.card_stable_id}>
                    <RowLabel>{i + 1}º no cenário</RowLabel>
                    <CardRow scored={s} caption={`${i + 1}º no cenário`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
