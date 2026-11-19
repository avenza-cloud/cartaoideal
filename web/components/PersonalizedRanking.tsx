"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/store";
import { feeNote, type FeeTier } from "@/lib/roi";
import { formatGrossRewardMonthlyDisplay } from "@/lib/formatting";
import { feeWaiverBadgesForCard } from "@/lib/fee-waiver-badges";
import { fetchRecommendations, type CurrentCardResult } from "@/lib/recommend-client";
import { DEFAULT_SCORING_PROFILE, travelFrequencyForValueModeling } from "@/lib/card-value";
import { useCardDetailHref } from "@/lib/use-card-detail-href";
import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { CardArt, LeadFact, Tag } from "@/components/card";
import { cn } from "@/lib/utils";
import type {
  CardFacet,
  CardScore,
  CardValueScore,
  TravelFrequency,
  UserProfile,
} from "@/types/cards";
import type { FeeWaiverBadge } from "@/lib/fee-waiver-badges";

/** Value score as serialized by /api/cards/top: no card object, no assumptions. */
type SlimValueScore = Omit<CardValueScore, "card" | "assumptions">;

type AnnualFee = CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"];

interface TopCard {
  id: string;
  nome: string;
  emissor: string;
  anuidade: AnnualFee;
  rankingPosition: number;
  bandeira?: string;
  lounge: boolean;
  retornoFinanceiro: { earning_summary?: string };
  pontos: boolean;
  cardArtUrl: string;
  altText: string;
  score: SlimValueScore;
  note: string;
  tier: FeeTier;
  badges: FeeWaiverBadge[];
}

const FEE_UNKNOWN = "Anuidade não informada";

function brl(value: number) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}R$ ${Math.abs(rounded).toLocaleString("pt-BR")}`;
}

function moneyPerMonth(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/mês`;
}

interface Lead {
  value: string;
  label: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}

function valueLead(score: SlimValueScore): Lead {
  const low = Math.min(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
  const high = Math.max(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
  const prefix = score.decisionMonthlyValueBrl > 0 ? "+" : "";
  return {
    value: `${prefix}${brl(score.decisionMonthlyValueBrl)}/mês`,
    label: "valor líquido estimado",
    hint: high - low >= 1 ? `${brl(low)} a ${brl(high)}` : undefined,
    tone:
      score.decisionMonthlyValueBrl < 0
        ? "negative"
        : score.decisionMonthlyValueBrl > 0
          ? "positive"
          : "default",
  };
}

function feeLead(fee: AnnualFee): Lead {
  if (fee === 0) return { value: "Sem anuidade", label: "anuidade", tone: "positive" };
  if (typeof fee === "number") return { value: `${brl(fee)}/ano`, label: "anuidade" };
  if (fee === "variable_pricing_claim") return { value: "Variável", label: "anuidade" };
  return { value: FEE_UNKNOWN, label: "consulte o emissor" };
}

const TRAVEL_LABEL: Record<TravelFrequency, string> = {
  none: "não viaja",
  occasional: "viaja às vezes",
  frequent: "viaja com frequência",
};

function describeProfile(profile: UserProfile) {
  const parts = [
    `renda ${brl(profile.monthlySalaryBrl)}`,
    `gasto ${brl(profile.avgMonthlySpendBrl)}/mês`,
    TRAVEL_LABEL[profile.travelFrequency],
  ];
  const { prefersPoints, prefersCashback, prefersInvestback, wantsLounge } = profile.preferences;
  if (prefersPoints) parts.push("prefere pontos");
  if (prefersCashback) parts.push("prefere cashback");
  if (prefersInvestback) parts.push("prefere investback");
  if (wantsLounge) parts.push("quer sala VIP");
  return parts.join(", ");
}

function RankRow({
  rank,
  currentBadge,
  id,
  nome,
  emissor,
  bandeira,
  anuidade,
  cardArtUrl,
  note,
  earningsSummary,
  valueScore,
  badges = [],
  travelFrequency,
  marked = false,
  showFeeInDetail = false,
}: {
  rank?: number;
  currentBadge?: string;
  id: string;
  nome: string;
  emissor: string;
  bandeira?: string;
  anuidade: AnnualFee;
  cardArtUrl: string;
  note: string;
  earningsSummary?: string;
  valueScore?: SlimValueScore;
  badges?: FeeWaiverBadge[];
  travelFrequency: TravelFrequency;
  marked?: boolean;
  showFeeInDetail?: boolean;
}) {
  const detailHref = useCardDetailHref(id);
  const feeKnown = valueScore ? valueScore.feeKnown : anuidade !== "unknown" && anuidade !== null;
  const fact = feeKnown ? note : FEE_UNKNOWN;
  const lead = valueScore ? valueLead(valueScore) : feeLead(anuidade);
  const shownBadges = feeKnown ? badges : badges.filter((badge) => badge.key !== "general");

  let detail: string | undefined;
  if (valueScore) {
    detail = `Retorno ${formatGrossRewardMonthlyDisplay(valueScore, travelFrequency)} · Benefícios ${moneyPerMonth(valueScore.intangibleMonthlyValueBrl)}`;
    if (showFeeInDetail && feeKnown) {
      detail += ` · Anuidade ${moneyPerMonth(-valueScore.effectiveMonthlyFeeBrl)}`;
    }
  } else if (earningsSummary && earningsSummary !== "unknown") {
    detail = earningsSummary;
  }

  return (
    <Link
      href={detailHref}
      className={cn(
        "grid grid-cols-[1.75rem_3.75rem_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 px-3.5 py-4 transition-colors duration-100 sm:grid-cols-[2rem_4rem_minmax(0,1fr)_auto]",
        marked
          ? "my-1.5 rounded-panel bg-brand-wash hover:bg-brand-wash-strong/70"
          : currentBadge
            ? "my-1.5 rounded-panel bg-surface hover:bg-surface-2"
            : "border-b border-line last:border-b-0 hover:bg-surface"
      )}
    >
      <span
        className={cn(
          "num text-xs font-medium",
          marked ? "font-semibold text-brand-accent" : "text-fg-3"
        )}
      >
        {rank ? `#${rank}` : "—"}
      </span>

      <CardArt
        compact
        artUrl={cardArtUrl}
        issuerRaw={emissor}
        network={bandeira}
        displayName={nome}
        className="h-[38px] w-[60px] sm:h-10 sm:w-16"
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[15px] font-semibold leading-snug text-fg">{nome}</p>
          {marked && (
            <Tag variant="brand" className="bg-raised">
              Melhor escolha
            </Tag>
          )}
          {currentBadge && <Tag variant="info">{currentBadge}</Tag>}
        </div>
        <p className="mt-0.5 truncate text-xs text-fg-2" title={fact}>
          {emissor} · {fact}
        </p>
        {detail && (
          <p className="num mt-0.5 hidden truncate text-xs text-fg-3 sm:block">{detail}</p>
        )}
        {shownBadges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shownBadges.map((badge) => (
              <Tag
                key={badge.key}
                variant={badge.variant === "waiver_benefit" ? "positive" : "outline"}
              >
                {badge.label}
              </Tag>
            ))}
          </div>
        )}
      </div>

      <div className="col-start-3 min-w-0 sm:col-start-4 sm:max-w-64 sm:text-right">
        <LeadFact
          size="sm"
          value={lead.value}
          label={lead.label}
          hint={lead.hint}
          tone={lead.tone}
          marked={marked}
        />
        {valueScore && (
          <p className="num mt-0.5 text-xs text-fg-3" title="Percentil entre os cartões elegíveis">
            {valueScore.score0To100}/100
          </p>
        )}
      </div>
    </Link>
  );
}

function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="divide-y divide-line border-y border-line" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-3.5 py-4">
          <div className="h-4 w-6 rounded-sm bg-surface-2" />
          <div className="h-10 w-16 rounded-[6px] bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-44 max-w-full rounded-sm bg-surface-2" />
            <div className="h-3 w-64 max-w-full rounded-sm bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PersonalizedRanking() {
  const { profile, onboardingDone, resetOnboarding } = useProfileStore();
  const [results, setResults] = useState<CardScore[] | null>(null);
  const [currentCard, setCurrentCard] = useState<CurrentCardResult | null>(null);
  const [topCards, setTopCards] = useState<TopCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    void retryToken;
    let cancelled = false;
    setError(false);

    if (!profile) {
      setResults(null);
      setCurrentCard(null);
      if (onboardingDone) {
        setLoading(true);
        fetch("/api/cards/top?limit=10")
          .then((r) => r.json())
          .then((data) => {
            if (!cancelled) setTopCards(Array.isArray(data) ? data : null);
          })
          .catch(() => {
            if (!cancelled) setError(true);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      }
      return () => {
        cancelled = true;
      };
    }

    setTopCards(null);
    setResults(null);
    setLoading(true);
    fetchRecommendations(profile)
      .then((data) => {
        if (cancelled) return;
        setResults(data.scores);
        setCurrentCard(data.currentCard);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, onboardingDone, retryToken]);

  if (!onboardingDone) return null;

  const referenceTravel = travelFrequencyForValueModeling(DEFAULT_SCORING_PROFILE);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            {profile ? "Ranking personalizado" : "Melhores cartões"}
          </h2>
          <p className="num mt-0.5 text-sm text-fg-3">
            {profile
              ? `Renda R$ ${profile.monthlySalaryBrl.toLocaleString("pt-BR")}/mês · Gasto R$ ${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês`
              : "Por pontuação geral · Configure seu perfil para personalizar"}
          </p>
          {!profile && (
            <p className="num mt-0.5 text-xs text-fg-3">
              Perfil de referência: {describeProfile(DEFAULT_SCORING_PROFILE)}.
            </p>
          )}
        </div>
        {profile ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/cartoes?profileRank=true">
              <ListFilter className="h-3.5 w-3.5" />
              Ver lista completa
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={resetOnboarding}>
            Personalizar
          </Button>
        )}
      </div>

      {profile && currentCard && (
        <div>
          <RankRow
            rank={currentCard.rank ?? undefined}
            currentBadge="Seu cartão atual"
            id={currentCard.score.card.card_stable_id}
            nome={currentCard.score.card.display_name}
            emissor={currentCard.score.card.issuer_raw}
            bandeira={currentCard.score.card.network_primary}
            anuidade={currentCard.score.card.facets_numeric_or_special.annual_fee_brl_best_estimate}
            cardArtUrl={currentCard.score.card.media.card_art_url}
            note={feeNote(
              currentCard.score.card,
              profile.avgMonthlySpendBrl,
              currentCard.score.effectiveAnnualFeeBrl
            )}
            valueScore={currentCard.score}
            travelFrequency={travelFrequencyForValueModeling(profile)}
            showFeeInDetail
          />
        </div>
      )}

      {loading && <SkeletonRows />}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-panel bg-surface px-4 py-8 text-center">
          <p className="text-sm text-fg-2">Não foi possível carregar o ranking agora.</p>
          <Button variant="outline" size="sm" onClick={() => setRetryToken((t) => t + 1)}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!loading && !error && profile && results && (
        <div className="border-y border-line">
          {results.map((scored, idx) => {
            const card = scored.card;
            const eff = scored.valueScore?.effectiveAnnualFeeBrl;
            return (
              <RankRow
                key={card.card_stable_id}
                rank={idx + 1}
                id={card.card_stable_id}
                nome={card.display_name}
                emissor={card.issuer_raw}
                bandeira={card.network_primary}
                anuidade={card.facets_numeric_or_special.annual_fee_brl_best_estimate}
                cardArtUrl={card.media.card_art_url}
                note={feeNote(card, profile.avgMonthlySpendBrl, eff)}
                earningsSummary={card.reward_return.earning_summary}
                valueScore={scored.valueScore}
                badges={feeWaiverBadgesForCard(card, profile)}
                travelFrequency={travelFrequencyForValueModeling(profile)}
                marked={idx === 0 && scored.valueScore?.eligible !== false}
              />
            );
          })}
        </div>
      )}

      {!loading && !error && !profile && topCards && (
        <div className="border-y border-line">
          {topCards.map((c, idx) => (
            <RankRow
              key={c.id}
              rank={idx + 1}
              id={c.id}
              nome={c.nome}
              emissor={c.emissor}
              bandeira={c.bandeira}
              anuidade={c.anuidade}
              cardArtUrl={c.cardArtUrl}
              note={c.note}
              earningsSummary={c.retornoFinanceiro?.earning_summary}
              valueScore={c.score}
              badges={c.badges}
              travelFrequency={referenceTravel}
              marked={idx === 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
