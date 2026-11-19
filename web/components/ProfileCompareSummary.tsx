"use client";

import Link from "next/link";
import {
  compareCardValueScores,
  scoreCardValue,
  travelFrequencyForValueModeling,
} from "@/lib/card-value";
import { useProfileStore } from "@/lib/store";
import { useCardDetailHrefBuilder } from "@/lib/use-card-detail-href";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import { formatGrossRewardMonthlyDisplay } from "@/lib/formatting";
import { CardArt, LeadFact, StatRow, Tag } from "@/components/card";
import { cn } from "@/lib/utils";
import type { CardFacet } from "@/types/cards";

interface ProfileCompareSummaryProps {
  cards: CardFacet[];
}

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/mês`;
}

function annual(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/ano`;
}

function brl(value: number) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}R$ ${Math.abs(rounded).toLocaleString("pt-BR")}`;
}

export function ProfileCompareSummary({ cards }: ProfileCompareSummaryProps) {
  const profile = useProfileStore((state) => state.profile);
  const cardDetailHref = useCardDetailHrefBuilder();
  const assumptions = useValueAssumptions();
  if (!profile) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface px-5 py-4 text-sm text-fg-2">
        <span>
          Configure seu perfil para ver valor líquido, diferença mensal e recomendação de troca.
        </span>
        <Link
          href="/perfil"
          className="font-semibold text-fg underline underline-offset-4 hover:text-brand-accent"
        >
          Configurar perfil
        </Link>
      </div>
    );
  }

  const travelFrequency = travelFrequencyForValueModeling(profile);
  const scores = cards.map((card) => scoreCardValue(card, profile, "profile", assumptions));
  const best = [...scores].sort(compareCardValueScores)[0] ?? null;
  const delta =
    scores.length >= 2 ? scores[1].decisionMonthlyValueBrl - scores[0].decisionMonthlyValueBrl : 0;

  return (
    <section className="rounded-panel bg-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              Melhor para seu perfil: {best?.card.display_name ?? "—"}
            </h2>
            <Tag variant="brand">Recomendado</Tag>
          </div>
          <p className="num mt-1 text-sm text-fg-3">
            Base: R$ {profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês de gasto · R${" "}
            {profile.avgInvestedBrl.toLocaleString("pt-BR")} investidos
          </p>
        </div>
        {scores.length >= 2 && (
          <div className="rounded-panel bg-raised px-4 py-2.5 shadow-card sm:text-right">
            <p className="text-xs text-fg-3">Diferença 2º vs 1º</p>
            <p
              className={cn(
                "num text-base font-semibold",
                delta > 0 && "text-success-text",
                delta < 0 && "text-danger-text"
              )}
            >
              {money(delta)}
            </p>
            <p className="num text-xs text-fg-3">{annual(delta * 12)}</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {scores.map((score) => {
          const isBest = score === best;
          const low = Math.min(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
          const high = Math.max(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
          const fee = score.effectiveMonthlyFeeBrl;
          const prefix = score.decisionMonthlyValueBrl > 0 ? "+" : "";
          return (
            <Link
              key={score.card.card_stable_id}
              href={cardDetailHref(score.card.card_stable_id)}
              className={cn(
                "flex flex-col gap-3.5 rounded-panel border bg-raised p-4 transition-colors duration-100 hover:bg-page",
                isBest ? "border-brand-border shadow-card" : "border-line"
              )}
            >
              <div className="flex items-start gap-3">
                <CardArt
                  compact
                  artUrl={score.card.media.card_art_url}
                  issuerRaw={score.card.issuer_raw}
                  network={score.card.network_primary}
                  displayName={score.card.display_name}
                  className="h-10 w-16"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-fg">
                      {score.card.display_name}
                    </p>
                    {isBest && <Tag variant="brand">Melhor</Tag>}
                  </div>
                  <p className="truncate text-xs text-fg-3">{score.card.issuer_raw}</p>
                </div>
              </div>

              <div>
                <LeadFact
                  value={`${prefix}${brl(score.decisionMonthlyValueBrl)}/mês`}
                  label="valor líquido estimado por mês"
                  hint={high - low >= 1 ? `${brl(low)} a ${brl(high)}` : undefined}
                  tone={
                    score.decisionMonthlyValueBrl < 0
                      ? "negative"
                      : score.decisionMonthlyValueBrl > 0
                        ? "positive"
                        : "default"
                  }
                  marked={isBest && score.eligible && score.decisionMonthlyValueBrl >= 0}
                />
                <p className="mt-1 text-xs leading-relaxed text-fg-2">{score.verdict}</p>
              </div>

              <StatRow
                stats={[
                  score.feeKnown
                    ? {
                        label: "Anuidade",
                        value: fee > 0 ? `-${money(fee).replace("+", "")}` : "R$0/mês",
                        tone: fee > 0 ? "negative" : "positive",
                      }
                    : { label: "Anuidade", value: "Não informada", tone: "muted" },
                  {
                    label: "Retorno",
                    value: formatGrossRewardMonthlyDisplay(score, travelFrequency),
                  },
                  { label: "Benefícios", value: money(score.intangibleMonthlyValueBrl) },
                ]}
              />

              {score.eligibilityReasons.length > 0 && (
                <p className="text-xs font-medium text-danger-text">
                  {score.eligibilityReasons.join(" ")}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
