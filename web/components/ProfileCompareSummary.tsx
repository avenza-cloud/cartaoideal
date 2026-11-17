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
import { CardArt, LeadFact, StatRow } from "@/components/card";
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
      <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">
        Configure seu perfil para ver valor líquido, delta mensal e recomendação de troca.
      </div>
    );
  }

  const travelFrequency = travelFrequencyForValueModeling(profile);
  const scores = cards.map((card) => scoreCardValue(card, profile, "profile", assumptions));
  // Winner and deltas come from the decision value, the same number shown on each card.
  const best = [...scores].sort(compareCardValueScores)[0] ?? null;
  const delta =
    scores.length >= 2 ? scores[1].decisionMonthlyValueBrl - scores[0].decisionMonthlyValueBrl : 0;

  return (
    <section className="rounded-md border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-medium">
            Melhor para seu perfil: {best?.card.display_name ?? "—"}
          </p>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            Base: R${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês de gasto, R$
            {profile.avgInvestedBrl.toLocaleString("pt-BR")} investidos.
          </p>
        </div>
        {scores.length >= 2 && (
          <div className="rounded-md border px-3 py-2 sm:text-right">
            <p className="text-xs text-muted-foreground">Delta 2º vs 1º</p>
            <p
              className={cn(
                "num text-base font-medium",
                delta > 0 && "text-positive",
                delta < 0 && "text-negative"
              )}
            >
              {money(delta)}
            </p>
            <p className="num text-xs text-muted-foreground">{annual(delta * 12)}</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {scores.map((score) => {
          const isBest = score === best;
          const low = Math.min(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
          const high = Math.max(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
          const fee = score.effectiveMonthlyFeeBrl;
          return (
            <Link
              key={score.card.card_stable_id}
              href={cardDetailHref(score.card.card_stable_id)}
              className={cn(
                "flex flex-col gap-3 rounded-md border bg-card p-3 transition-colors duration-150 hover:bg-muted",
                isBest && "border-foreground"
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{score.card.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{score.card.issuer_raw}</p>
                </div>
              </div>

              <div>
                <LeadFact
                  value={`${brl(score.decisionMonthlyValueBrl)}/mês`}
                  label="valor líquido estimado por mês"
                  hint={high - low >= 1 ? `${brl(low)} a ${brl(high)}` : undefined}
                  tone={score.decisionMonthlyValueBrl < 0 ? "negative" : "default"}
                  marked={isBest && score.eligible && score.decisionMonthlyValueBrl >= 0}
                />
                <p className="mt-1 text-xs text-muted-foreground">{score.verdict}</p>
              </div>

              <StatRow
                stats={[
                  score.feeKnown
                    ? {
                        label: "Anuidade",
                        value: fee > 0 ? `-${money(fee).replace("+", "")}` : "R$0/mês",
                        tone: fee > 0 ? "negative" : "default",
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
                <p className="text-xs text-negative">{score.eligibilityReasons.join(" ")}</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
