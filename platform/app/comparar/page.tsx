import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCardsByIds } from "@/lib/cards";
import { formatFee, loungeSummary, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { AppHeader } from "@/components/AppHeader";
import { ProfileCompareSummary } from "@/components/ProfileCompareSummary";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X } from "lucide-react";
import type { CardFacet } from "@/types/cards";

export const metadata: Metadata = {
  title: "Comparar cartões de crédito",
  description:
    "Compare lado a lado anuidade, retorno, salas VIP e benefícios de até 4 cartões de crédito brasileiros.",
};

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function CompararPage({ searchParams }: PageProps) {
  const { ids } = await searchParams;
  if (!ids) notFound();

  const cardIds = ids.split(",").slice(0, 4);
  const cards = getCardsByIds(cardIds);

  if (cards.length < 2) notFound();
  const comparePath = `/comparar?ids=${encodeURIComponent(ids)}`;
  const cardDetailHref = (cardId: string) => {
    const params = new URLSearchParams({ from: comparePath });
    return `/cartoes/${cardId}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
        <Link
          href="/cartoes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Cartões
        </Link>
        <h1 className="min-w-0 truncate text-xl font-semibold">Comparar Cartões</h1>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        <Suspense>
          <ProfileCompareSummary cards={cards} />
        </Suspense>

        <div className="overflow-x-auto rounded-xl border bg-card/35">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-44 bg-card px-3 py-3 text-left font-normal text-muted-foreground">
                  Atributo
                </th>
                {cards.map((card) => (
                  <th key={card.card_stable_id} className="min-w-[210px] px-3 py-3 text-left">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono font-normal">
                        {card.issuer_raw}
                      </p>
                      <Link
                        href={cardDetailHref(card.card_stable_id)}
                        className="font-semibold hover:underline underline-offset-2 text-sm leading-tight"
                      >
                        {card.display_name}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <CompareRow
                label="Segmento"
                values={cards.map((c) => segmentLabel(c.market_segment_guess))}
                render={(v) => (
                  <Badge variant="outline" className="text-xs">
                    {v}
                  </Badge>
                )}
              />
              <CompareRow label="Bandeira" values={cards.map((c) => c.network_primary)} />
              <CompareRow
                label="Anuidade"
                values={cards.map((c) =>
                  formatFee(c.facets_numeric_or_special.annual_fee_brl_best_estimate)
                )}
                bestIndex={bestFeeIndex(cards)}
              />
              <CompareRow
                label="Investimento mín."
                values={cards.map((c) => {
                  const v = c.facets_numeric_or_special.minimum_investment_brl_best_estimate;
                  return v === "unknown" ? "—" : `R$ ${(v as number).toLocaleString("pt-BR")}`;
                })}
              />
              <BoolRow
                label="Sala VIP"
                values={cards.map((c) => c.lounge_access.has_lounge_access)}
              />
              <CompareRow
                label="Detalhe lounge"
                values={cards.map((c) => loungeSummary(c.lounge_access))}
              />
              <BoolRow
                label="Pontos / Milhas"
                values={cards.map((c) => c.facets_boolean.earn_points_or_miles)}
              />
              <BoolRow
                label="Retorno financeiro"
                values={cards.map((c) => c.reward_return.has_cashlike_return)}
              />
              <CompareRow
                label="Tipo de retorno"
                values={cards.map((c) =>
                  c.reward_return.has_cashlike_return ? rewardReturnLabel(c.reward_return) : "—"
                )}
              />
              <BoolRow
                label="Seguro Viagem"
                values={cards.map((c) => c.facets_boolean.mentions_travel_insurance)}
              />
              <BoolRow
                label="Concierge"
                values={cards.map((c) => c.facets_boolean.mentions_concierge)}
              />
              <CompareRow label="Fonte" values={cards.map((c) => c.source_label)} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function bestFeeIndex(cards: CardFacet[]): number {
  let best = -1;
  let bestFee = Infinity;
  cards.forEach((c, i) => {
    const fee = c.facets_numeric_or_special.annual_fee_brl_best_estimate;
    if (typeof fee === "number" && fee < bestFee) {
      bestFee = fee;
      best = i;
    }
  });
  return best;
}

function CompareRow({
  label,
  values,
  bestIndex,
  render,
}: {
  label: string;
  values: string[];
  bestIndex?: number;
  render?: (v: string) => React.ReactNode;
}) {
  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="sticky left-0 z-10 bg-card px-3 py-2.5 text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-3 py-2.5 font-mono ${bestIndex === i ? "text-green-400 font-semibold" : ""}`}
        >
          {render ? render(v) : v}
        </td>
      ))}
    </tr>
  );
}

function BoolRow({ label, values }: { label: string; values: boolean[] }) {
  const hasAny = values.some(Boolean);
  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="sticky left-0 z-10 bg-card px-3 py-2.5 text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2.5">
          {v ? (
            <Check className={`h-4 w-4 ${hasAny ? "text-green-400" : "text-muted-foreground"}`} />
          ) : (
            <X className="h-4 w-4 text-muted-foreground/30" />
          )}
        </td>
      ))}
    </tr>
  );
}
