"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Check, CreditCard, Plane, Coins, ExternalLink } from "lucide-react";
import { CardArtPlaceholder } from "@/components/CardArtPlaceholder";
import { cardArtSrc } from "@/lib/card-display";
import { formatFee, formatNetMonthlyDisplay, loungeSummary, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { travelFrequencyForValueModeling } from "@/lib/card-value";
import { feeWaiverBadgeClassName, feeWaiverBadgesForCard } from "@/lib/fee-waiver-badges";
// lib/cards.ts re-exports same helpers but is server-only; formatting is shared
import type { CardFacet, CardValueScore } from "@/types/cards";
import { useCompareStore, useProfileStore } from "@/lib/store";
import { useCardDetailHref } from "@/lib/use-card-detail-href";

interface CardCardProps {
  card: CardFacet;
  compact?: boolean;
  valueScore?: CardValueScore;
  rank?: number;
}

const SEGMENT_COLORS = {
  ultra_premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  premium: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  upper_mass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  mass_or_general: "bg-muted text-muted-foreground",
} as const;

function classification(score: CardValueScore) {
  const hi = Math.max(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
  if (!score.eligible) return "Não elegível";
  if (hi >= 200) return "Excelente";
  if (hi >= 50) return "Bom";
  if (hi >= 0) return "Neutro";
  return "Não compensa";
}

export function CardCard({ card, compact = false, valueScore, rank }: CardCardProps) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const profile = useProfileStore((s) => s.profile);
  const isSelected = ids.includes(card.card_stable_id);
  const detailHref = useCardDetailHref(card.card_stable_id);

  function toggleCompare(e: React.MouseEvent) {
    e.preventDefault();
    if (isSelected) remove(card.card_stable_id);
    else if (canAdd()) add(card.card_stable_id);
  }

  const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  const artSrc = cardArtSrc(card.media.card_art_url);
  const hasReturn = card.reward_return.has_cashlike_return;
  const feeWaiverBadges = feeWaiverBadgesForCard(card, profile);

  return (
    <Link href={detailHref} className="group">
      <Card className="h-full cursor-pointer overflow-hidden transition-colors hover:border-border/80 hover:bg-card/80">
        <CardHeader className={compact ? "space-y-2 p-3 pb-2" : "space-y-3 pb-2"}>
          <div className={`relative flex items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 ${compact ? "h-20" : "h-28"}`}>
            {artSrc ? (
              <img
                src={artSrc}
                alt={card.media.alt_text}
                className={`object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105 ${compact ? "max-h-full max-w-[88%]" : "max-h-24 max-w-[82%]"}`}
                loading="lazy"
              />
            ) : (
              <CardArtPlaceholder
                issuerRaw={card.issuer_raw}
                network={card.network_primary}
                displayName={card.display_name}
                className={compact ? "max-h-16" : ""}
              />
            )}
            <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              #{rank ?? card.ranking_position}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-mono truncate">
                {card.issuer_raw}
              </p>
              <h3 className={`${compact ? "text-xs" : "text-sm"} mt-0.5 line-clamp-2 font-medium leading-tight`}>
                {card.display_name}
              </h3>
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-[10px] ${compact ? "hidden sm:inline-flex" : ""} ${SEGMENT_COLORS[card.market_segment_guess]}`}
            >
              {segmentLabel(card.market_segment_guess)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {card.network_primary}
            </span>
            {card.card_stable_id && (
              <span className="text-xs text-muted-foreground">·</span>
            )}
            <span className="text-xs font-semibold">
              {formatFee(fee)}
              {typeof fee === "number" && fee > 0 && (
                <span className="text-muted-foreground font-normal">/ano</span>
              )}
            </span>
          </div>
          {feeWaiverBadges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {feeWaiverBadges.map((badge) => (
                <span key={badge.key} className={feeWaiverBadgeClassName(badge.variant)}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
          {valueScore && (
            <div className="grid grid-cols-1 items-center gap-2 rounded-xl border bg-background/60 px-3 py-2 min-[400px]:grid-cols-[1fr_minmax(0,46%)]">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Para seu perfil
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {classification(valueScore)} · {valueScore.rankReason}
                </p>
              </div>
              <div className="min-w-0 text-left min-[400px]:text-right">
                <p className="font-mono text-xs font-semibold">
                  {valueScore.score0To100}/100
                </p>
                <p
                  className={`font-mono text-[10px] leading-snug min-[400px]:text-[11px] break-words ${
                    Math.max(valueScore.netMonthlyValueBrl, valueScore.netMonthlyValueRangeHighBrl) >= 0
                      ? "text-emerald-500"
                      : "text-rose-500"
                  }`}
                >
                  {formatNetMonthlyDisplay(
                    valueScore,
                    profile ? travelFrequencyForValueModeling(profile) : "none"
                  )}
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className={compact ? "space-y-2 p-3 pt-0" : "pt-0 space-y-3"}>
          <div className={`${compact ? "min-[390px]:grid-cols-2" : ""} grid gap-1.5 text-[11px]`}>
            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
              <Plane className="h-3 w-3" /> {loungeSummary(card.lounge_access)}
            </span>
            {card.facets_boolean.earn_points_or_miles && (
              <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <CreditCard className="h-3 w-3" /> Pontos
              </span>
            )}
            {hasReturn && (
              <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Coins className="h-3 w-3" /> {rewardReturnLabel(card.reward_return)}
              </span>
            )}
            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground/80">
              <ExternalLink className="h-3 w-3" /> {card.source_label}
            </span>
          </div>
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="w-full text-xs h-7"
            onClick={toggleCompare}
            disabled={!isSelected && !canAdd()}
          >
            {isSelected ? (
              <>
                <Check className="h-3 w-3 mr-1" /> Selecionado
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" /> Comparar
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
