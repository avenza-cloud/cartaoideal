"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/store";
import {
  CLIENT_CARD_FACETS,
  getClientCardById,
  resolveClientCardByName,
} from "@/lib/client-card-options";
import { feeTier, feeNote, FEE_TIER_COLOR, FEE_TIER_LABEL } from "@/lib/roi";
import { formatFee } from "@/lib/formatting";
import { feeWaiverBadgeClassName, feeWaiverBadgesForCard } from "@/lib/fee-waiver-badges";
import { fetchRecommendationsWithFallback } from "@/lib/recommend-fallback";
import { DEFAULT_SCORING_PROFILE, scoreCardValue, scoreCardValues } from "@/lib/card-value";
import { useCardDetailHref } from "@/lib/use-card-detail-href";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import { Button } from "@/components/ui/button";
import { CreditCard, ListFilter } from "lucide-react";
import type { CardFacet, CardScore, CardValueScore } from "@/types/cards";
import type { FeeWaiverBadge } from "@/lib/fee-waiver-badges";

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

function scoreTextColor(score: number): string {
  if (score >= 90) return "text-emerald-500";
  if (score >= 75) return "text-sky-500";
  if (score >= 50) return "text-amber-500";
  return "text-rose-500";
}

function scoreBarColor(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-sky-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
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
  badges = [],
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
  badges?: FeeWaiverBadge[];
}) {
  const hasImage = cardArtUrl && cardArtUrl !== "unknown";
  const detailHref = useCardDetailHref(id);

  return (
    <Link
      href={detailHref}
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
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {badges.map((badge) => (
              <span key={badge.key} className={feeWaiverBadgeClassName(badge.variant)}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        <span
          className={`text-[11px] font-semibold font-mono ${
            valueScore ? scoreTextColor(valueScore.score0To100) : tierColor
          }`}
        >
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
              className={`h-full rounded-full ${scoreBarColor(scoreBar)}`}
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

function CurrentCardSummary({
  card,
  score,
  rank,
  spend,
}: {
  card: CardFacet;
  score?: CardValueScore;
  rank?: number;
  spend: number;
}) {
  const tier = feeTier(card, spend, score?.effectiveAnnualFeeBrl);
  const note = feeNote(card, spend, score?.effectiveAnnualFeeBrl);
  const hasImage = card.media.card_art_url && card.media.card_art_url !== "unknown";
  const detailHref = useCardDetailHref(card.card_stable_id);

  return (
    <Link
      href={detailHref}
      className="mb-3 grid grid-cols-[28px_56px_minmax(0,1fr)] items-center gap-3 rounded-2xl border bg-background/45 p-3 transition-colors hover:bg-muted/35 sm:grid-cols-[28px_64px_minmax(0,1fr)_auto]"
    >
      <span className="font-mono text-[11px] text-muted-foreground">
        {rank ? `#${rank}` : "—"}
      </span>

      <div className="flex h-12 items-center justify-center rounded-xl border bg-zinc-950">
        {hasImage ? (
          <img
            src={card.media.card_art_url}
            alt={card.media.alt_text}
            className="max-h-9 max-w-[48px] object-contain"
            loading="lazy"
          />
        ) : (
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Seu cartão atual
        </p>
        <p className="truncate text-sm font-semibold">{card.display_name}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{note}</p>
        {score && (
          <p className="mt-1 text-[10px] text-muted-foreground/75">
            Retorno {moneyPerMonth(score.grossRewardMonthlyBrl)} · Benefícios{" "}
            {moneyPerMonth(score.intangibleMonthlyValueBrl)} · Anuidade{" "}
            {moneyPerMonth(-score.effectiveMonthlyFeeBrl)}
          </p>
        )}
      </div>

      <div className="col-span-3 flex items-end justify-between gap-3 sm:col-span-1 sm:flex-col sm:justify-center sm:text-right">
        <div className="flex flex-col items-end gap-1 text-right">
          <span
            className={`text-[11px] font-semibold font-mono ${
              score ? scoreTextColor(score.score0To100) : FEE_TIER_COLOR[tier]
            }`}
          >
            {score ? `${score.score0To100}/100` : FEE_TIER_LABEL[tier]}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatFee(card.facets_numeric_or_special.annual_fee_brl_best_estimate)}
          </span>
          {score && (
            <span
              className={`font-mono text-[10px] ${
                score.netMonthlyValueBrl >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {moneyPerMonth(score.netMonthlyValueBrl)}
            </span>
          )}
          {score && (
            <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${scoreBarColor(score.score0To100)}`}
                style={{ width: `${score.score0To100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function PersonalizedRanking() {
  const { profile, onboardingDone, resetOnboarding } = useProfileStore();
  const assumptions = useValueAssumptions();
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
    setResults(null);
    setLoading(true);
    fetchRecommendationsWithFallback(profile)
      .then((data) => setResults(Array.isArray(data) ? data : null))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [profile, onboardingDone]);

  const currentCard =
    profile?.currentPrimaryCardId
      ? getClientCardById(profile.currentPrimaryCardId)
      : profile?.currentPrimaryCardName
        ? resolveClientCardByName(profile.currentPrimaryCardName)
        : undefined;
  const currentCardRanking = useMemo(() => {
    if (!profile || !currentCard) return undefined;
    const scores = scoreCardValues(CLIENT_CARD_FACETS, profile, "profile", assumptions);
    const rankedScores = scores.filter((score) => score.eligible);
    const currentScore = scores.find(
      (score) => score.card.card_stable_id === currentCard.card_stable_id
    );
    const index = rankedScores.findIndex(
      (score) => score.card.card_stable_id === currentCard.card_stable_id
    );
    return {
      rank: index >= 0 ? index + 1 : undefined,
      score: currentScore ?? scoreCardValue(currentCard, profile, "profile", assumptions),
    };
  }, [profile, currentCard, assumptions]);
  const currentCardScore =
    profile && currentCard
      ? results?.find((score) => score.card.card_stable_id === currentCard.card_stable_id)
          ?.valueScore ?? currentCardRanking?.score
      : undefined;

  if (!onboardingDone) return null;

  return (
    <div className="rounded-3xl border bg-card/50 p-3">
      {profile && currentCard && (
        <CurrentCardSummary
          card={currentCard}
          score={currentCardScore}
          rank={currentCardRanking?.rank}
          spend={profile.avgMonthlySpendBrl}
        />
      )}

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
            const eff = scored.valueScore?.effectiveAnnualFeeBrl;
            const tier = feeTier(card, profile.avgMonthlySpendBrl, eff);
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
                note={feeNote(card, profile.avgMonthlySpendBrl, eff)}
                tierLabel={FEE_TIER_LABEL[tier]}
                tierColor={FEE_TIER_COLOR[tier]}
                earningsSummary={card.reward_return.earning_summary}
                valueScore={scored.valueScore}
                scoreBar={Math.round(scored.totalScore * 100)}
                badges={feeWaiverBadgesForCard(card, profile)}
              />
            );
          })}
        </div>
      )}

      {!loading && !profile && topCards && (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border">
          {topCards.map((c, idx) => {
            const cardFromScore = c.score.card;
            const defaultSpend = DEFAULT_SCORING_PROFILE.avgMonthlySpendBrl;
            const eff = c.score.effectiveAnnualFeeBrl;
            const tier = feeTier(cardFromScore, defaultSpend, eff);
            const note = feeNote(cardFromScore, defaultSpend, eff);
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
                badges={feeWaiverBadgesForCard(c.score.card)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
