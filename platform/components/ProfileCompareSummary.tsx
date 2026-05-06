"use client";

import Link from "next/link";
import { scoreCardValue } from "@/lib/card-value";
import { useProfileStore } from "@/lib/store";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import type { CardFacet, CardValueScore } from "@/types/cards";

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

export function ProfileCompareSummary({ cards }: ProfileCompareSummaryProps) {
  const profile = useProfileStore((state) => state.profile);
  const assumptions = useValueAssumptions();
  if (!profile) {
    return (
      <div className="rounded-2xl border bg-card/55 px-4 py-3 text-sm text-muted-foreground">
        Configure seu perfil para ver valor líquido, delta mensal e recomendação de troca.
      </div>
    );
  }

  const scores = cards.map((card) => scoreCardValue(card, profile, "profile", assumptions));
  const best = scores.reduce<CardValueScore | null>(
    (winner, score) =>
      !winner || score.netMonthlyValueBrl > winner.netMonthlyValueBrl ? score : winner,
    null
  );
  const delta =
    scores.length >= 2 ? scores[1].netMonthlyValueBrl - scores[0].netMonthlyValueBrl : 0;

  return (
    <section className="rounded-2xl border bg-card/65 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            Melhor para seu perfil: {best?.card.display_name ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Base: R${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês de gasto,
            R${profile.avgInvestedBrl.toLocaleString("pt-BR")} investidos.
          </p>
        </div>
        {scores.length >= 2 && (
          <div className="rounded-xl border bg-background/45 px-3 py-2 text-right">
            <p className="text-[10px] text-muted-foreground">Delta 2º vs 1º</p>
            <p className={delta >= 0 ? "font-mono text-sm text-emerald-500" : "font-mono text-sm text-rose-500"}>
              {money(delta)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">{annual(delta * 12)}</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {scores.map((score) => (
          <Link
            key={score.card.card_stable_id}
            href={`/cartoes/${score.card.card_stable_id}`}
            className="rounded-xl border bg-background/35 p-3 transition-colors hover:bg-background/55"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{score.card.display_name}</p>
                <p className="text-[11px] text-muted-foreground">{score.verdict}</p>
              </div>
              <p className={score.netMonthlyValueBrl >= 0 ? "font-mono text-sm text-emerald-500" : "font-mono text-sm text-rose-500"}>
                {money(score.netMonthlyValueBrl)}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
              <Metric label="Retorno" value={money(score.grossRewardMonthlyBrl)} />
              <Metric label="Benefícios" value={money(score.intangibleMonthlyValueBrl)} />
              <Metric label="Anuidade" value={`-${money(score.effectiveMonthlyFeeBrl).replace("+", "")}`} />
            </div>
            {score.eligibilityReasons.length > 0 && (
              <p className="mt-2 text-[11px] text-rose-400">{score.eligibilityReasons.join(" ")}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/35 px-2 py-1">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}
