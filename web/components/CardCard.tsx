"use client";

import { Check, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { CardArt, LeadFact, type Stat, StatRow, Tag } from "@/components/card";
import { Button } from "@/components/ui/button";
import { feeWaiverBadgesForCard } from "@/lib/fee-waiver-badges";
import { formatFee, loungeSummary, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { useCompareStore, useProfileStore } from "@/lib/store";
import { useCardDetailHref } from "@/lib/use-card-detail-href";
import { cn } from "@/lib/utils";
import type { CardFacet, CardValueScore } from "@/types/cards";

interface CardCardProps {
  card: CardFacet;
  compact?: boolean;
  valueScore?: CardValueScore;
  rank?: number;
}

type Fee = CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"];

function classification(score: CardValueScore) {
  const value = score.decisionMonthlyValueBrl;
  if (!score.eligible) return "Não elegível";
  if (value >= 200) return "Excelente";
  if (value >= 50) return "Bom";
  if (value >= 0) return "Neutro";
  return "Não compensa";
}

function brl(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}R$ ${Math.abs(rounded).toLocaleString("pt-BR")}`;
}

function isFeeUnknown(fee: Fee): boolean {
  return (
    fee === null ||
    fee === "unknown" ||
    (typeof fee !== "number" && fee !== "variable_pricing_claim")
  );
}

function feeText(fee: Fee): string {
  if (typeof fee === "number" && fee > 0) return `${formatFee(fee)}/ano`;
  return formatFee(fee);
}

export function CardCard({ card, compact = false, valueScore, rank }: CardCardProps) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const profile = useProfileStore((s) => s.profile);
  const isSelected = ids.includes(card.card_stable_id);
  const detailHref = useCardDetailHref(card.card_stable_id);

  function toggleCompare(e: React.MouseEvent) {
    e.preventDefault();
    if (isSelected) remove(card.card_stable_id);
    else if (canAdd()) add({ id: card.card_stable_id, name: card.display_name });
  }

  const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  const feeUnknown = isFeeUnknown(fee) || valueScore?.feeKnown === false;
  const hasReturn = card.reward_return.has_cashlike_return;
  const earnsPoints = card.facets_boolean.earn_points_or_miles;
  const feeWaiverBadges = feeWaiverBadgesForCard(card, profile);
  const isBest = !!valueScore && valueScore.eligible && rank === 1;

  const returnStat: Stat = hasReturn
    ? { label: "Retorno", value: rewardReturnLabel(card.reward_return) }
    : earnsPoints
      ? { label: "Retorno", value: "Pontos" }
      : { label: "Retorno", value: "—", tone: "muted" };
  const loungeStat: Stat = {
    label: "Sala VIP",
    value: loungeSummary(card.lounge_access),
    tone: card.lounge_access.has_lounge_access ? "default" : "muted",
  };
  const feeStat: Stat = feeUnknown
    ? { label: "Anuidade", value: "Não informada", tone: "muted" }
    : { label: "Anuidade", value: feeText(fee), tone: fee === 0 ? "positive" : "default" };

  let lead: React.ReactNode;
  if (valueScore) {
    const low = Math.min(valueScore.netMonthlyValueBrl, valueScore.netMonthlyValueRangeHighBrl);
    const high = Math.max(valueScore.netMonthlyValueBrl, valueScore.netMonthlyValueRangeHighBrl);
    const prefix = valueScore.decisionMonthlyValueBrl > 0 ? "+" : "";
    lead = (
      <div className="flex items-start justify-between gap-2">
        <LeadFact
          value={`${prefix}${brl(valueScore.decisionMonthlyValueBrl)}/mês`}
          label="valor líquido estimado"
          hint={high - low >= 1 ? `${brl(low)} a ${brl(high)}` : undefined}
          marked={isBest}
          tone={
            valueScore.decisionMonthlyValueBrl < 0
              ? "negative"
              : valueScore.decisionMonthlyValueBrl > 0
                ? "positive"
                : "default"
          }
        />
        <span className="num shrink-0 pt-1 text-xs text-fg-3">{valueScore.score0To100}/100</span>
      </div>
    );
  } else if (feeUnknown) {
    lead = <LeadFact size="sm" value="Anuidade não informada" label="consulte o emissor" />;
  } else {
    lead = (
      <LeadFact value={feeText(fee)} label="anuidade" tone={fee === 0 ? "positive" : "default"} />
    );
  }

  return (
    <Link href={detailHref} className="block h-full">
      <article
        className={cn(
          "flex h-full flex-col gap-3.5 rounded-panel p-4.5 transition-colors duration-100",
          isBest
            ? "border border-brand-border bg-raised shadow-card hover:bg-surface/60"
            : "border border-transparent bg-surface hover:bg-surface-2/70"
        )}
      >
        <div className="flex items-start gap-3">
          <CardArt
            artUrl={card.media.card_art_url}
            issuerRaw={card.issuer_raw}
            network={card.network_primary}
            displayName={card.display_name}
            className={compact ? "h-11 w-[70px]" : "h-12 w-[76px]"}
            compact
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-fg">
              {card.display_name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-fg-3">{card.issuer_raw}</p>
          </div>
          {isBest ? (
            <Tag variant="brand" className="num">
              #{rank}
            </Tag>
          ) : (
            <span className="num shrink-0 text-xs font-medium text-fg-3">
              #{rank ?? card.ranking_position}
            </span>
          )}
        </div>

        {lead}

        {valueScore && (
          <p className="line-clamp-2 text-xs leading-relaxed text-fg-2">
            <span className="font-medium text-fg">Para seu perfil</span> ·{" "}
            <span
              className={
                valueScore.eligible ? "font-medium text-fg" : "font-medium text-danger-text"
              }
            >
              {classification(valueScore)}
            </span>{" "}
            · {valueScore.rankReason}
          </p>
        )}

        <StatRow
          stats={valueScore ? [feeStat, returnStat, loungeStat] : [returnStat, loungeStat]}
        />

        <div className="flex flex-wrap gap-1.5">
          <Tag variant="quiet">{segmentLabel(card.market_segment_guess)}</Tag>
          <Tag variant="quiet">{card.network_primary}</Tag>
          {earnsPoints && hasReturn && <Tag variant="quiet">Pontos</Tag>}
          {feeWaiverBadges.map((badge) => (
            <Tag
              key={badge.key}
              variant={badge.variant === "waiver_benefit" ? "positive" : "outline"}
            >
              {badge.label}
            </Tag>
          ))}
        </div>

        <div className="mt-auto space-y-2.5 pt-1">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{card.source_label}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full",
              isSelected && "border-brand-border bg-brand-wash text-fg hover:bg-brand-wash-strong"
            )}
            onClick={toggleCompare}
            disabled={!isSelected && !canAdd()}
          >
            {isSelected ? (
              <>
                <Check className="h-3.5 w-3.5 text-brand-accent" /> Selecionado para comparar
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Comparar
              </>
            )}
          </Button>
        </div>
      </article>
    </Link>
  );
}
