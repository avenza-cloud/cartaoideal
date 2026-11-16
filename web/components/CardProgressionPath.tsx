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
      className="flex items-start gap-3 rounded-md border bg-card p-2.5 text-left transition-colors duration-150 hover:bg-muted"
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
        <p className="truncate text-sm font-medium">{card.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">{card.issuer_raw}</p>
        {valueScore ? (
          <LeadFact
            size="sm"
            className="mt-1.5"
            value={`${brl(valueScore.decisionMonthlyValueBrl)}/mês`}
            label="valor líquido estimado por mês"
            hint={high - low >= 1 ? `${brl(low)} a ${brl(high)}` : undefined}
            tone={valueScore.decisionMonthlyValueBrl < 0 ? "negative" : "default"}
          />
        ) : (
          <LeadFact
            size="sm"
            className="mt-1.5"
            value={feeValue}
            label={feeValue === FEE_UNKNOWN ? "consulte o emissor" : "anuidade"}
          />
        )}
        {valueScore && !valueScore.feeKnown && (
          <p className="mt-0.5 text-xs text-muted-foreground">{FEE_UNKNOWN}</p>
        )}
        {tag && (
          <div className="mt-1.5 flex">
            <Tag variant="solid">{tag}</Tag>
          </div>
        )}
      </div>
    </Link>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-xs text-muted-foreground">{children}</p>;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
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
        // Current card outside the top list: the API resolves and scores it.
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

  // Spend follows income proportionally. Profile values are used as given.
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

      // New on the radar: eligible in the projected scenario, not eligible today.
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
      <div className="space-y-2" aria-busy="true">
        <div className="h-16 rounded-md bg-muted" />
        <div className="h-16 rounded-md bg-muted" />
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
            <Link href="/perfil" className="text-foreground underline underline-offset-2">
              Ajustar perfil
            </Link>
          </Notice>
        ) : (
          <Notice>
            Nenhum cartão principal no cadastro.{" "}
            <Link href="/perfil" className="text-foreground underline underline-offset-2">
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
    <section className="rounded-md border bg-card">
      <div className="border-b px-3 py-3">
        <h2 className="text-base font-medium">Sua jornada de cartões</h2>
        <p className="text-xs text-muted-foreground">
          Cartão atual, melhor opção e simulação rápida.
        </p>
      </div>

      <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-3">
          <p className="mb-2 text-sm font-medium">Agora</p>

          {agoraContent}

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
            <span>
              Renda{" "}
              <span className="num text-foreground">
                R${profile.monthlySalaryBrl.toLocaleString("pt-BR")}/mês
              </span>
            </span>
            <span>
              Gasto{" "}
              <span className="num text-foreground">
                R${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês
              </span>
            </span>
            <span>
              Investido{" "}
              <span className="num text-foreground">{shortMoney(profile.avgInvestedBrl)}</span>
            </span>
            <Link href="/perfil" className="ml-auto text-foreground underline underline-offset-2">
              Editar
            </Link>
          </div>
        </div>

        <div className="p-3">
          <p className="text-sm font-medium">Em ~1 ano</p>
          <p className="text-xs text-muted-foreground">Vazio = cadastro.</p>

          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium">Renda / mês</span>
                <span className="text-xs text-muted-foreground">
                  Atual{" "}
                  <span className="num text-foreground">
                    R${profile.monthlySalaryBrl.toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 transition-colors duration-150 focus-within:border-foreground">
                <span className="shrink-0 text-sm text-muted-foreground">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={futureIncome}
                  onChange={(e) => {
                    setFutureIncome(formatBrlInput(e.target.value));
                    setSimResult(null);
                  }}
                  placeholder="—"
                  aria-label="Renda mensal esperada em cerca de um ano"
                  className="num min-w-0 flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium">Investido</span>
                <span className="text-xs text-muted-foreground">
                  Atual{" "}
                  <span className="num text-foreground">{shortMoney(profile.avgInvestedBrl)}</span>
                </span>
              </div>
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 transition-colors duration-150 focus-within:border-foreground">
                <span className="shrink-0 text-sm text-muted-foreground">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={futureInvested}
                  onChange={(e) => {
                    setFutureInvested(formatBrlInput(e.target.value));
                    setSimResult(null);
                  }}
                  placeholder="—"
                  aria-label="Total investido esperado em cerca de um ano"
                  className="num min-w-0 flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>

          {estimatedFutureSpend > 0 && estimatedFutureSpend !== profile.avgMonthlySpendBrl && (
            <div className="mt-3 flex items-baseline justify-between gap-2 border-t pt-2 text-xs">
              <span className="text-muted-foreground">Gasto est.</span>
              <span className="num font-medium">{formatBrlCurrency(estimatedFutureSpend)}/mês</span>
            </div>
          )}

          <Button
            type="button"
            onClick={simulate}
            disabled={!canSimulate || simLoading}
            className="mt-3 w-full"
          >
            <span>{simLoading ? "…" : "Simular"}</span>
            {!simLoading && <ArrowRight aria-hidden />}
          </Button>
          {!canSimulate && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Renda ou investido para simular.
            </p>
          )}
        </div>
      </div>

      {simResult && (
        <div className="border-t p-3">
          <p className="num mb-2 text-sm font-medium">
            Simulado · gasto ≈ {formatBrlCurrency(simResult.futureSpend)}/mês
          </p>
          {simResult.newUnlocked.length > 0 ? (
            <div className="space-y-3">
              <div>
                <RowLabel>
                  {simResult.newUnlocked.length === 1
                    ? "Novo no radar"
                    : `${simResult.newUnlocked.length} novos no radar`}
                </RowLabel>
                <div className="grid gap-2 md:grid-cols-2">
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
              <RowLabel>Ranking (sem novos)</RowLabel>
              <div className="grid gap-2 md:grid-cols-2">
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
