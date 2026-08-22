"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/store";
import { formatNetMonthlyDisplay } from "@/lib/formatting";
import { travelFrequencyForValueModeling } from "@/lib/card-value";
import { formatBrlCurrency, formatBrlInput, parseBrlInput } from "@/lib/brl";
import {
  fetchRecommendationsWithFallback,
  scoreSingleClientCard,
} from "@/lib/recommend-fallback";
import { useCardDetailHref } from "@/lib/use-card-detail-href";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { CardScore, TravelFrequency } from "@/types/cards";

function shortMoney(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return `R$${v.toLocaleString("pt-BR")}`;
}

function projectionIncomeBase(currentIncome: number, currentSpend: number, futureIncome: number) {
  if (currentIncome <= 0) return currentIncome;

  const ratio = futureIncome / currentIncome;
  const correctedIncome = currentIncome * 10;
  const correctedRatio = futureIncome / correctedIncome;
  const looksLikeLegacyMissingZero =
    currentIncome < 10_000 &&
    currentSpend > currentIncome * 2 &&
    ratio >= 8 &&
    correctedRatio >= 0.5 &&
    correctedRatio <= 3;

  return looksLikeLegacyMissingZero ? correctedIncome : currentIncome;
}

function projectionSpendBase(currentIncome: number, currentSpend: number) {
  if (currentIncome <= 0 || currentSpend <= 0) return currentSpend;

  const correctedSpend = currentSpend / 10;
  const looksLikeLegacyExtraZero =
    currentSpend > currentIncome * 2 &&
    correctedSpend > 0 &&
    correctedSpend <= currentIncome;

  return looksLikeLegacyExtraZero ? correctedSpend : currentSpend;
}

function CardRow({
  scored,
  caption,
  travelFrequency,
  size = "compact",
}: Readonly<{
  scored: CardScore;
  caption?: string;
  travelFrequency: TravelFrequency;
  size?: "compact" | "comfortable";
}>) {
  const { card, valueScore } = scored;
  const detailHref = useCardDetailHref(card.card_stable_id);
  const netLow = valueScore?.netMonthlyValueBrl;
  const netHigh = valueScore?.netMonthlyValueRangeHighBrl;
  const positive =
    netLow !== undefined && netHigh !== undefined
      ? Math.max(netLow, netHigh) >= 0
      : (netLow ?? 0) >= 0;

  const labelForA11y = caption ? `${caption}: ${card.display_name}` : card.display_name;

  const comfortable = size === "comfortable";

  return (
    <Link
      href={detailHref}
      aria-label={labelForA11y}
      className={cn(
        "block border border-border/70 bg-background/40 text-left transition-colors hover:bg-muted/30",
        comfortable
          ? "rounded-xl px-2.5 py-2"
          : "rounded-lg px-2 py-1.5"
      )}
    >
      <p
        className={cn(
          "truncate font-medium leading-snug",
          comfortable ? "text-xs" : "text-[11px] leading-tight"
        )}
      >
        {card.display_name}
      </p>
      {valueScore ? (
        <p
          className={cn(
            "font-mono font-semibold leading-snug",
            comfortable ? "mt-0.5 text-[10px]" : "mt-px text-[9px] leading-tight",
            positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}
        >
          {formatNetMonthlyDisplay(valueScore, travelFrequency)}
        </p>
      ) : null}
    </Link>
  );
}

export function CardProgressionPath() {
  const { profile, onboardingDone } = useProfileStore();

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
    fetchRecommendationsWithFallback(profile, 12)
      .then((list: CardScore[]) => {
        if (!Array.isArray(list) || list.length === 0) {
          setBestReco(null);
          setCurrentReco(null);
          return;
        }
        const best = list[0] ?? null;
        setBestReco(best);
        const id = profile.currentPrimaryCardId;
        if (!id) {
          setCurrentReco(null);
          return;
        }
        const fromList = list.find((s) => s.card.card_stable_id === id) ?? null;
        if (fromList) {
          setCurrentReco(fromList);
          return;
        }
        scoreSingleClientCard(profile, id).then((scored) => setCurrentReco(scored));
      })
      .catch(() => {
        setBestReco(null);
        setCurrentReco(null);
      })
      .finally(() => setLoadingReco(false));
  }, [profile]);

  const futureIncomeNum = parseBrlInput(futureIncome);
  const futureInvestedNum = parseBrlInput(futureInvested);
  const currentIncomeForProjection = profile
    ? projectionIncomeBase(profile.monthlySalaryBrl, profile.avgMonthlySpendBrl, futureIncomeNum)
    : 0;
  const currentSpendForProjection = profile
    ? projectionSpendBase(currentIncomeForProjection, profile.avgMonthlySpendBrl)
    : 0;

  const estimatedFutureSpend =
    profile && futureIncomeNum > 0 && currentIncomeForProjection > 0
      ? currentSpendForProjection * (futureIncomeNum / currentIncomeForProjection)
      : 0;

  const canSimulate = futureIncomeNum > 0 || futureInvestedNum > 0;

  const simulate = useCallback(async () => {
    if (!profile || !canSimulate) return;
    setSimLoading(true);
    setSimResult(null);

    const futureProfile = {
      ...profile,
      monthlySalaryBrl: futureIncomeNum || profile.monthlySalaryBrl,
      avgInvestedBrl: futureInvestedNum || profile.avgInvestedBrl,
      avgMonthlySpendBrl:
        futureIncomeNum > 0 && currentIncomeForProjection > 0
          ? estimatedFutureSpend
          : profile.avgMonthlySpendBrl,
    };

    try {
      const future = await fetchRecommendationsWithFallback(futureProfile, 10);
      if (!Array.isArray(future)) return;

      const baselineIds = new Set<string>();
      if (bestReco) baselineIds.add(bestReco.card.card_stable_id);
      if (currentReco) baselineIds.add(currentReco.card.card_stable_id);
      const newUnlocked = future.filter((s) => !baselineIds.has(s.card.card_stable_id));

      setSimResult({
        top: future.slice(0, 3),
        newUnlocked: newUnlocked.slice(0, 2),
        futureSpend:
          futureIncomeNum > 0 && currentIncomeForProjection > 0
            ? estimatedFutureSpend
            : profile.avgMonthlySpendBrl,
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
    currentIncomeForProjection,
    estimatedFutureSpend,
    bestReco,
    currentReco,
  ]);

  if (!profile || !onboardingDone) return null;

  const travelFrequency = travelFrequencyForValueModeling(profile);
  const sameAsBest =
    currentReco?.card.card_stable_id != null &&
    currentReco.card.card_stable_id === bestReco?.card.card_stable_id;

  let agoraContent: ReactNode;
  if (loadingReco) {
    agoraContent = (
      <div className="space-y-2">
        <div className="h-[52px] animate-pulse rounded-xl border bg-muted/30" />
        <div className="h-[52px] animate-pulse rounded-xl border bg-muted/30" />
      </div>
    );
  } else if (!bestReco) {
    agoraContent = (
      <p className="rounded-md border bg-muted/20 px-2 py-1 text-[9px] leading-snug text-muted-foreground">
        Nenhum cartão elegível encontrado.
      </p>
    );
  } else if (sameAsBest) {
    agoraContent = (
      <div>
        <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
          Seu cartão · melhor recomendação
        </p>
        <CardRow
          scored={bestReco}
          caption="Seu cartão · melhor recomendação"
          travelFrequency={travelFrequency}
          size="comfortable"
        />
      </div>
    );
  } else {
    agoraContent = (
      <div className="space-y-2">
        {currentReco ? (
          <div>
            <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">Seu cartão</p>
            <CardRow
              scored={currentReco}
              caption="Seu cartão"
              travelFrequency={travelFrequency}
              size="comfortable"
            />
          </div>
        ) : profile.currentPrimaryCardId ? (
          <p className="rounded-md border border-dashed bg-muted/10 px-2 py-1 text-[9px] leading-snug text-muted-foreground">
            O cartão do cadastro não aparece como elegível com este perfil.{" "}
            <Link href="/perfil" className="underline underline-offset-2 hover:text-foreground">
              Ajustar perfil
            </Link>
          </p>
        ) : (
          <p className="rounded-md border border-dashed bg-muted/10 px-2 py-1 text-[9px] leading-snug text-muted-foreground">
            Nenhum cartão principal no cadastro.{" "}
            <Link href="/perfil" className="underline underline-offset-2 hover:text-foreground">
              Definir no perfil
            </Link>
          </p>
        )}
        <div>
          <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">Melhor recomendação</p>
          <CardRow
            scored={bestReco}
            caption="Melhor recomendação"
            travelFrequency={travelFrequency}
            size="comfortable"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card/50 p-2">
      <div className="mb-2 px-0.5">
        <h2 className="text-[11px] font-semibold leading-tight">Sua jornada de cartões</h2>
        <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
          Cartão atual, melhor opção e simulação rápida.
        </p>
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        <div className="rounded-lg border bg-background/30 p-2.5">
          <p className="mb-2 text-[9px] uppercase tracking-widest text-muted-foreground">Agora</p>

          {agoraContent}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border/50 pt-2 text-[10px] leading-snug text-muted-foreground">
            <span>
              Renda <span className="font-mono text-foreground/80">R${profile.monthlySalaryBrl.toLocaleString("pt-BR")}/mês</span>
            </span>
            <span>
              Gasto <span className="font-mono text-foreground/80">R${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês</span>
            </span>
            <span>
              Investido <span className="font-mono text-foreground/80">{shortMoney(profile.avgInvestedBrl)}</span>
            </span>
            <Link href="/perfil" className="ml-auto text-foreground/70 underline-offset-2 hover:underline">
              Editar
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-background/30 p-2.5">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground">Em ~1 ano</p>
          <p className="mt-px text-[9px] leading-tight text-muted-foreground">Vazio = cadastro.</p>

          <div className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-medium leading-tight text-foreground">Renda / mês</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  Atual{" "}
                  <span className="font-mono text-foreground/85">
                    R${profile.monthlySalaryBrl.toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1.5 transition-colors focus-within:border-foreground/35 focus-within:ring-1 focus-within:ring-foreground/15">
                <span className="w-5 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">R$</span>
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
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-medium leading-none tabular-nums placeholder:text-muted-foreground/35 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-medium leading-tight text-foreground">Investido</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  Atual <span className="font-mono text-foreground/85">{shortMoney(profile.avgInvestedBrl)}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1.5 transition-colors focus-within:border-foreground/35 focus-within:ring-1 focus-within:ring-foreground/15">
                <span className="w-5 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">R$</span>
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
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-medium leading-none tabular-nums placeholder:text-muted-foreground/35 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {estimatedFutureSpend > 0 && estimatedFutureSpend !== profile.avgMonthlySpendBrl && (
            <div className="mt-1.5 flex items-center justify-between gap-1.5 rounded border border-dashed border-border/60 bg-muted/5 px-1.5 py-1">
              <span className="text-[9px] text-muted-foreground">Gasto est.</span>
              <span className="font-mono text-[9px] tabular-nums text-foreground/90">
                {formatBrlCurrency(estimatedFutureSpend)}/mês
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={simulate}
            disabled={!canSimulate || simLoading}
            className={cn(
              "mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
              canSimulate && !simLoading
                ? "bg-foreground text-background hover:opacity-90"
                : "cursor-not-allowed border bg-muted/20 text-muted-foreground/40"
            )}
          >
            <span>{simLoading ? "…" : "Simular"}</span>
            {!simLoading && <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          </button>
          {!canSimulate && (
            <p className="mt-1 text-center text-[8px] text-muted-foreground">Renda ou investido para simular.</p>
          )}
        </div>
      </div>

      {simResult && (
        <div className="mt-1.5 rounded-lg border bg-muted/10 p-2">
          <p className="mb-1 text-[9px] font-medium leading-tight text-muted-foreground">
            Simulado · gasto ≈ {formatBrlCurrency(simResult.futureSpend)}/mês
          </p>
          {simResult.newUnlocked.length > 0 ? (
            <>
              <p className="mb-1 text-[9px] leading-tight text-muted-foreground">
                {simResult.newUnlocked.length === 1
                  ? "Novo no radar"
                  : `${simResult.newUnlocked.length} novos no radar`}
              </p>
              <div className="space-y-1.5">
                {simResult.newUnlocked.map((s) => (
                  <div key={s.card.card_stable_id}>
                    <p className="mb-px text-[8px] uppercase tracking-wide text-muted-foreground">Novo</p>
                    <CardRow scored={s} caption="Novo no radar" travelFrequency={travelFrequency} />
                  </div>
                ))}
              </div>
              {simResult.top[0] && (
                <div className="mt-1.5 border-t border-border/50 pt-1.5">
                  <p className="mb-px text-[8px] uppercase tracking-wide text-muted-foreground">Melhor no cenário</p>
                  <CardRow scored={simResult.top[0]} caption="Melhor no cenário" travelFrequency={travelFrequency} />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[9px] leading-tight text-muted-foreground">Ranking (sem novos)</p>
              {simResult.top.slice(0, 2).map((s, i) => (
                <div key={s.card.card_stable_id}>
                  <p className="mb-px text-[8px] uppercase tracking-wide text-muted-foreground">{i + 1}º no cenário</p>
                  <CardRow
                    scored={s}
                    caption={`${i + 1}º no cenário`}
                    travelFrequency={travelFrequency}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
