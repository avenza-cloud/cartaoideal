"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/store";
import { feeTier, feeNote, FEE_TIER_COLOR, FEE_TIER_LABEL } from "@/lib/roi";
import { formatFee } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { CreditCard, ListFilter } from "lucide-react";
import type { CardScore, CardValueScore } from "@/types/cards";

interface TopCard {
  id: string;
  nome: string;
  emissor: string;
  anuidade: number | string;
  rankingPosition: number;
  lounge: boolean;
  retornoFinanceiro: { earning_summary?: string };
  pontos: boolean;
  cardArtUrl: string;
  altText: string;
  score: CardValueScore;
}

function moneyPerMonth(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/mês`;
}

function CardRow({
  rank,
  id,
  nome,
  emissor,
  anuidade,
  cardArtUrl,
  altText,
  note,
  tierLabel,
  tierColor,
  earningsSummary,
  scoreBar,
  valueScore,
}: {
  rank: number;
  id: string;
  nome: string;
  emissor: string;
  anuidade: number | string;
  cardArtUrl: string;
  altText: string;
  note: string;
  tierLabel: string;
  tierColor: string;
  earningsSummary?: string;
  scoreBar?: number;
  valueScore?: CardValueScore;
}) {
  const hasImage = cardArtUrl && cardArtUrl !== "unknown";
  return (
    <Link
      href={`/cartoes/${id}`}
      className="grid grid-cols-[28px_64px_minmax(0,1fr)_auto] items-center gap-3 bg-background/40 px-3 py-2.5 text-xs transition-colors hover:bg-muted/40"
    >
      <span className="font-mono text-[11px] text-muted-foreground">#{rank}</span>

      <div className="flex h-10 items-center justify-center rounded-lg border bg-zinc-950">
        {hasImage ? (
          <img
            src={cardArtUrl}
            alt={altText}
            className="max-h-8 max-w-[52px] object-contain"
            loading="lazy"
          />
        ) : (
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-medium">{nome}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">{note}</p>
        <p className="truncate text-[10px] text-muted-foreground/70">
          {valueScore
            ? `Retorno ${moneyPerMonth(valueScore.grossRewardMonthlyBrl)} · Benefícios ${moneyPerMonth(valueScore.intangibleMonthlyValueBrl)}`
            : earningsSummary}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        <span className={`text-[11px] font-semibold font-mono ${tierColor}`}>
          {valueScore ? `${valueScore.score0To100}/100` : tierLabel}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{formatFee(anuidade)}</span>
        {valueScore && (
          <span
            className={`font-mono text-[10px] ${
              valueScore.netMonthlyValueBrl >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {moneyPerMonth(valueScore.netMonthlyValueBrl)}
          </span>
        )}
        {scoreBar !== undefined && (
          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/60"
              style={{ width: `${scoreBar}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonRows({ n = 6 }: { n?: number }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 bg-background/40 px-3 py-3">
          <div className="h-4 w-6 animate-pulse rounded bg-muted" />
          <div className="h-10 w-16 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-56 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PersonalizedRanking() {
  const { profile, onboardingDone, resetOnboarding } = useProfileStore();
  const [results, setResults] = useState<CardScore[] | null>(null);
  const [topCards, setTopCards] = useState<TopCard[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) {
      setResults(null);
      if (onboardingDone) {
        setLoading(true);
        fetch("/api/cards/top?limit=10")
          .then((r) => r.json())
          .then((data) => setTopCards(Array.isArray(data) ? data : null))
          .catch(() => setTopCards(null))
          .finally(() => setLoading(false));
      }
      return;
    }
    setTopCards(null);
    setLoading(true);
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    })
      .then((r) => r.json())
      .then((data) => setResults(Array.isArray(data) ? data : null))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [profile, onboardingDone]);

  if (!onboardingDone) return null;

  return (
    <div className="rounded-3xl border bg-card/50 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold">
            {profile ? "Ranking personalizado" : "Melhores cartões"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {profile
              ? `R$${profile.monthlySalaryBrl.toLocaleString("pt-BR")} renda · R$${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")} gasto/mês`
              : "Por pontuação geral · Configure seu perfil para personalizar"}
          </p>
        </div>
        {profile ? (
          <Link href="/cartoes?profileRank=true">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
              <ListFilter className="h-3 w-3" />
              Ver lista completa
            </Button>
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={resetOnboarding}
          >
            Personalizar
          </Button>
        )}
      </div>

      {loading && <SkeletonRows />}

      {!loading && profile && results && (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border">
          {results.map((scored, idx) => {
            const card = scored.card;
            const tier = feeTier(card, profile.avgMonthlySpendBrl);
            const net = scored.valueScore?.netMonthlyValueBrl ?? 0;
            return (
              <CardRow
                key={card.card_stable_id}
                rank={idx + 1}
                id={card.card_stable_id}
                nome={card.display_name}
                emissor={card.issuer_raw}
                anuidade={card.facets_numeric_or_special.annual_fee_brl_best_estimate}
                cardArtUrl={card.media.card_art_url}
                altText={card.media.alt_text}
                note={feeNote(card, profile.avgMonthlySpendBrl)}
                tierLabel={FEE_TIER_LABEL[tier]}
                tierColor={net >= 0 ? "text-emerald-500" : "text-rose-500"}
                earningsSummary={card.reward_return.earning_summary}
                valueScore={scored.valueScore}
                scoreBar={Math.round(scored.totalScore * 100)}
              />
            );
          })}
        </div>
      )}

      {!loading && !profile && topCards && (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border">
          {topCards.map((c, idx) => {
            const feeNum = typeof c.anuidade === "number" ? c.anuidade : 0;
            const tier: "free" | "optimal" | "good" | "consider" | "heavy" | "unknown" =
              feeNum === 0 ? "free" : "unknown";
            const note =
              feeNum === 0
                ? "Sem anuidade"
                : `R$${feeNum.toLocaleString("pt-BR")}/ano`;
            return (
              <CardRow
                key={c.id}
                rank={idx + 1}
                id={c.id}
                nome={c.nome}
                emissor={c.emissor}
                anuidade={c.anuidade}
                cardArtUrl={c.cardArtUrl}
                altText={c.altText}
                note={note}
                tierLabel={FEE_TIER_LABEL[tier]}
                tierColor={FEE_TIER_COLOR[tier]}
                earningsSummary={c.retornoFinanceiro?.earning_summary}
                valueScore={c.score}
                scoreBar={c.score.score0To100}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
