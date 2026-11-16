import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCardsByIds } from "@/lib/cards";
import { formatFee, loungeSummary, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { AppHeader } from "@/components/AppHeader";
import { ProfileCompareSummary } from "@/components/ProfileCompareSummary";
import { CardArt, Tag } from "@/components/card";
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
      <div className="flex items-center gap-3 border-b px-4 py-4 sm:gap-4 sm:px-6">
        <Link
          href="/cartoes"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Cartões
        </Link>
        <h1 className="min-w-0 truncate text-xl font-medium">Comparar Cartões</h1>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        <Suspense>
          <ProfileCompareSummary cards={cards} />
        </Suspense>

        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-xl border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="sticky left-0 z-10 w-28 border-r bg-muted px-3 py-3 text-left align-bottom text-xs font-normal text-muted-foreground sm:w-44">
                  Atributo
                </th>
                {cards.map((card) => (
                  <th
                    key={card.card_stable_id}
                    className="min-w-48 px-3 py-3 text-left align-bottom font-normal"
                  >
                    <div className="flex items-center gap-2.5">
                      <CardArt
                        compact
                        artUrl={card.media.card_art_url}
                        issuerRaw={card.issuer_raw}
                        network={card.network_primary}
                        displayName={card.display_name}
                        className="h-9 w-14 bg-card"
                      />
                      <div className="min-w-0">
                        <Link
                          href={cardDetailHref(card.card_stable_id)}
                          className="block text-sm font-medium leading-tight underline-offset-2 hover:underline"
                        >
                          {card.display_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{card.issuer_raw}</p>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <CompareRow
                label="Segmento"
                values={cards.map((c) => segmentLabel(c.market_segment_guess))}
                render={(v) => <Tag>{v}</Tag>}
              />
              <CompareRow label="Bandeira" values={cards.map((c) => c.network_primary)} />
              <CompareRow
                label="Anuidade"
                values={cards.map((c) => feeCell(c))}
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

/** An unknown fee is said plainly, never shown as free. */
function feeCell(card: CardFacet): string {
  const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  if (fee === null || fee === "unknown") return "Anuidade não informada";
  return formatFee(fee);
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

const LABEL_CELL =
  "sticky left-0 z-10 border-r bg-card px-3 py-2.5 text-xs text-muted-foreground transition-colors duration-150 group-hover:bg-muted";

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
    <tr className="group transition-colors duration-150 hover:bg-muted">
      <td className={LABEL_CELL}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="num px-3 py-2.5">
          {render ? (
            render(v)
          ) : bestIndex === i ? (
            <span className="bg-mark px-1 font-medium text-mark-foreground">{v}</span>
          ) : (
            v
          )}
        </td>
      ))}
    </tr>
  );
}

function BoolRow({ label, values }: { label: string; values: boolean[] }) {
  return (
    <tr className="group transition-colors duration-150 hover:bg-muted">
      <td className={LABEL_CELL}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2.5">
          {v ? (
            <Check className="h-4 w-4 text-foreground" aria-label="Sim" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" aria-label="Não" />
          )}
        </td>
      ))}
    </tr>
  );
}
