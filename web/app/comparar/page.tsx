import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCardsByIds } from "@/lib/cards";
import { formatFee, loungeSummary, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ProfileCompareSummary } from "@/components/ProfileCompareSummary";
import { CardArt, Tag } from "@/components/card";
import { ArrowLeft, Check, Minus } from "lucide-react";
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
    <div className="min-h-screen bg-page">
      <AppHeader alwaysBorder />

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/cartoes"
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-fg-3 transition-colors duration-100 hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
              Cartões
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Comparar Cartões</h1>
          </div>
          <Tag variant="quiet" className="num">
            {cards.length} cartões lado a lado
          </Tag>
        </div>

        <Suspense>
          <ProfileCompareSummary cards={cards} />
        </Suspense>

        <div className="overflow-x-auto rounded-panel border border-line bg-raised">
          <table className="w-full min-w-xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                <th className="sticky left-0 z-10 w-32 border-r border-line bg-surface px-4 py-3.5 text-left align-bottom text-xs font-medium text-fg-3 sm:w-48">
                  Critério
                </th>
                {cards.map((card) => (
                  <th
                    key={card.card_stable_id}
                    className="min-w-48 px-4 py-3.5 text-left align-bottom font-normal"
                  >
                    <div className="flex items-center gap-3">
                      <CardArt
                        compact
                        artUrl={card.media.card_art_url}
                        issuerRaw={card.issuer_raw}
                        network={card.network_primary}
                        displayName={card.display_name}
                        className="h-9 w-14"
                      />
                      <div className="min-w-0">
                        <Link
                          href={cardDetailHref(card.card_stable_id)}
                          className="block text-sm font-semibold leading-tight text-fg underline-offset-4 hover:underline"
                        >
                          {card.display_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-fg-3">{card.issuer_raw}</p>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <CompareRow
                label="Segmento"
                values={cards.map((c) => segmentLabel(c.market_segment_guess))}
                render={(v) => <Tag variant="quiet">{v}</Tag>}
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
      </main>

      <MobileBottomNav />
    </div>
  );
}

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
  "sticky left-0 z-10 border-r border-line bg-raised px-4 py-3 text-sm text-fg-2 transition-colors duration-100 group-hover:bg-surface";

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
    <tr className="group transition-colors duration-100 hover:bg-surface">
      <td className={LABEL_CELL}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="ledger-col px-4 py-3 text-fg">
          {render ? render(v) : bestIndex === i ? <Tag variant="positive">{v}</Tag> : v}
        </td>
      ))}
    </tr>
  );
}

function BoolRow({ label, values }: { label: string; values: boolean[] }) {
  return (
    <tr className="group transition-colors duration-100 hover:bg-surface">
      <td className={LABEL_CELL}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-4 py-3">
          {v ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success-tint text-success-text">
              <Check className="h-3.5 w-3.5" aria-label="Sim" />
            </span>
          ) : (
            <Minus className="h-4 w-4 text-fg-disabled" aria-label="Não" />
          )}
        </td>
      ))}
    </tr>
  );
}
