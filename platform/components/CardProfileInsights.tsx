"use client";

import React, { useMemo, useState } from "react";
import { scoreCardValue } from "@/lib/card-value";
import { formatGrossRewardMonthlyDisplay, formatNetMonthlyDisplay } from "@/lib/formatting";
import { useProfileStore } from "@/lib/store";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import type { CardFacet, CardValueAssumptions, CardValueComponent } from "@/types/cards";

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function RetornoTooltip({
  component,
  monthlySpend,
  assumptions,
}: {
  component: CardValueComponent;
  monthlySpend: number;
  assumptions: CardValueAssumptions;
}) {
  return (
    <div className="space-y-1.5 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">{component.label}</p>
      <p>{component.explanation}</p>
      <p className="font-mono text-[10px] text-muted-foreground/70">
        Gasto mensal: R${monthlySpend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ·
        Livelo R${assumptions.liveloPointSaleValuePerThousandBrl}/1k venda · Livelo R$
        {assumptions.liveloPointTravelValuePerThousandBrl}/1k uso · MR R$
        {assumptions.membershipRewardsPointSaleValuePerThousandBrl}/1k venda · MR R$
        {assumptions.membershipRewardsPointTravelValuePerThousandBrl}/1k uso · PTAX R${assumptions.ptaxBrlPerUsd}
      </p>
      {component.dataQualityNote && (
        <p className="text-amber-300/70">{component.dataQualityNote}</p>
      )}
    </div>
  );
}

export function CardProfileInsights({ card }: { card: CardFacet }) {
  const profile = useProfileStore((s) => s.profile);
  const assumptions = useValueAssumptions();
  const score = useMemo(
    () => (profile ? scoreCardValue(card, profile, "profile", assumptions) : null),
    [card, profile, assumptions]
  );
  const [showCalc, setShowCalc] = useState(false);

  if (!profile || !score) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Configure seu perfil para ver valor líquido e ponto de equilíbrio.
        </p>
        <span className="shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          Para você
        </span>
      </div>
    );
  }

  const positive =
    Math.max(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl) >= 0;
  const accent = positive ? "text-emerald-400" : "text-rose-400";
  const accentBg = positive ? "bg-emerald-500/10" : "bg-rose-500/10";

  const reward = score.components.find((c) => c.key === "rewards");
  const intangibles = score.components.find((c) => c.key === "intangibles");
  const fee = score.components.find((c) => c.key === "fee");
  const international = score.components.find((c) => c.key === "international");

  const a = score.assumptions;
  const assumptionsLine = [
    `Livelo venda R$${a.liveloPointSaleValuePerThousandBrl}/1k pts`,
    `Livelo uso R$${a.liveloPointTravelValuePerThousandBrl}/1k pts`,
    `MR venda R$${a.membershipRewardsPointSaleValuePerThousandBrl}/1k pts`,
    `MR uso R$${a.membershipRewardsPointTravelValuePerThousandBrl}/1k pts`,
    `PTAX R$${a.ptaxBrlPerUsd}`,
    `lounge R$${a.loungeVisitValueBrl}/visita`,
  ].join(" · ");

  const netMonthlyLabel = formatNetMonthlyDisplay(
    score,
    profile.travelFrequency ?? "none"
  ).replace(/\/mês$/, "");

  return (
    <section className="overflow-hidden rounded-2xl border bg-card/60">
      {/* Main row: verdict + net value */}
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(12.5rem,42%)]">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-1.5">
           
            {score.feeBurdenPctOfAnnualSpend !== null && score.feeBurdenPctOfAnnualSpend > 0 && (
              <span className="rounded-full border px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                anuidade {score.feeBurdenPctOfAnnualSpend}% do gasto
              </span>
            )}
          </div>
          <p className="mt-2 text-base font-semibold leading-snug tracking-tight">
            {score.verdict}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {score.rankReason}
          </p>
          {score.scoreDrivers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {score.scoreDrivers.slice(0, 3).map((d) => (
                <span
                  key={d}
                  className="rounded-lg border bg-background/40 px-2 py-1 text-[10px] text-muted-foreground"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Net value — shown once */}
        <div className="flex min-w-0 flex-col items-stretch justify-center border-t bg-background/30 px-4 py-3 sm:border-l sm:border-t-0 sm:items-end">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:text-right">
            Valor líquido
          </p>
          <p
            className={`mt-0.5 w-full font-mono text-xl font-semibold leading-snug tracking-tight break-words sm:text-right sm:text-2xl md:text-3xl ${accent}`}
          >
            {netMonthlyLabel}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground sm:text-right">por mês</p>
          {score.feeAppliedReason && (
            <p className="mt-1 w-full max-w-none text-right text-[10px] leading-snug text-muted-foreground/60 sm:max-w-[min(22rem,100%)]">
              {score.feeAppliedReason}
            </p>
          )}
        </div>
      </div>

      {/* 4-metric strip */}
      <div className="grid grid-cols-2 border-t sm:grid-cols-4">
        <Strip
          label="Retorno"
          value={formatGrossRewardMonthlyDisplay(score, profile.travelFrequency ?? "none")}
          color="text-emerald-400"
          tooltip={
            reward ? (
              <RetornoTooltip
                component={reward}
                monthlySpend={profile.avgMonthlySpendBrl}
                assumptions={a}
              />
            ) : undefined
          }
        />
        <Strip
          label="Benefícios"
          value={`${money(score.intangibleMonthlyValueBrl)}/mês`}
          color={score.intangibleMonthlyValueBrl > 0 ? "text-emerald-400" : undefined}
        />
        <Strip
          label="Anuidade"
          value={`${money(-score.effectiveMonthlyFeeBrl)}/mês`}
          color="text-rose-400"
        />
        <Strip
          label="Equilíbrio"
          value={
            score.breakEvenMonthlySpendBrl === null
              ? "—"
              : `R$${score.breakEvenMonthlySpendBrl.toLocaleString("pt-BR")}/mês`
          }
        />
      </div>

      {/* Collapsible formula */}
      <div className="border-t">
        <button
          onClick={() => setShowCalc((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          <span>Como calculamos</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showCalc ? "rotate-180" : ""}`}
          />
        </button>

        {showCalc && (
          <div className="border-t bg-background/20 px-4 pb-3 pt-3 space-y-1.5">
            {reward && <FormulaLine sign="+" component={reward} accent="text-emerald-400" />}
            {intangibles && (
              <FormulaLine sign="+" component={intangibles} accent="text-emerald-400" />
            )}
            {fee && <FormulaLine sign="−" component={fee} accent="text-rose-400" />}
            {international && (
              <FormulaLine sign="−" component={international} accent="text-rose-400" />
            )}
            <div className="flex items-center justify-between gap-2 border-t pt-1.5">
              <span className="text-xs font-medium">Líquido</span>
              <span className={`min-w-0 max-w-[65%] text-right font-mono text-xs font-semibold leading-snug break-words ${accent}`}>
                {formatNetMonthlyDisplay(score, profile.travelFrequency ?? "none")}
              </span>
            </div>

            {/* Assumptions + data quality — compact */}
            <p className="pt-0.5 text-[10px] text-muted-foreground/50">{assumptionsLine}</p>
            {score.dataQualityNotes.length > 0 && (
              <p className="text-[10px] leading-relaxed text-amber-300/60">
                {score.dataQualityNotes.join(" ")}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Strip({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: React.ReactNode;
}) {
  return (
    <div className="relative border-b border-r px-3 py-2.5 last:border-r-0 even:border-r-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/30 font-mono text-[9px] text-muted-foreground/50 transition-colors hover:border-muted-foreground/60 hover:text-muted-foreground">
                ?
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              sideOffset={6}
              className="z-[100] block w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border/60 bg-[#111] p-0 text-left text-foreground shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            >
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </p>
      <p className={`mt-0.5 font-mono text-xs font-semibold ${color ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function FormulaLine({
  component,
  sign,
  accent,
}: {
  component: { label: string; valueBrl: number; explanation: string; dataQualityNote?: string };
  sign: "+" | "−";
  accent: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{component.label}</span>
        {component.explanation && (
          <span className="ml-1.5 text-[10px] text-muted-foreground/50">
            — {component.explanation}
          </span>
        )}
      </div>
      <span className={`shrink-0 font-mono text-xs ${accent}`}>
        {sign}R${Math.abs(component.valueBrl).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
