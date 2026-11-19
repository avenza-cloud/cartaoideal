import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCardById, getAllCards } from "@/lib/cards";
import { formatFee, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { affiliateClickUrl } from "@/lib/affiliate";
import { cardArtSrc, displayValue } from "@/lib/card-display";
import {
  Block,
  CardArt,
  DataRow,
  EmptyRow,
  FullTextRow,
  type Stat,
  StatRow,
  Tag,
} from "@/components/card";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { CardDetailBackLink } from "@/components/CardDetailBackLink";
import { CardDetailActions } from "@/components/CardDetailActions";
import { CardProfileInsights } from "@/components/CardProfileInsights";
import { AdSlot } from "@/components/AdSlot";
import { Coins, CreditCard, ExternalLink, Plane, ReceiptText, WalletCards } from "lucide-react";
import type { CardCharacteristic, CardFacet, FeeWaiverRule } from "@/types/cards";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return getAllCards().map((c) => ({ id: c.card_stable_id }));
}

export const dynamicParams = false;

function cardReturnLabel(card: CardFacet): string | null {
  return card.reward_return.has_cashlike_return
    ? rewardReturnLabel(card.reward_return)
    : card.facets_boolean.earn_points_or_miles
      ? "Pontos/milhas"
      : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const card = getCardById(id);
  if (!card) return { title: "Cartão não encontrado" };

  const returnType = cardReturnLabel(card);
  const lounge = card.lounge_access.has_lounge_access ? "com sala VIP" : "sem sala VIP";
  const description = `${card.issuer_raw} ${card.display_name} — cartão ${segmentLabel(
    card.market_segment_guess
  ).toLowerCase()}, anuidade ${formatFee(
    card.facets_numeric_or_special.annual_fee_brl_best_estimate
  ).toLowerCase()}, ${returnType?.toLowerCase() ?? "sem retorno financeiro"}, ${lounge}. Confira condições e isenções na fonte oficial.`;

  return {
    title: card.display_name,
    description,
    openGraph: {
      title: `${card.display_name} — anuidade e benefícios`,
      description,
      type: "website",
      images: cardArtSrc(card.media.card_art_url)
        ? [{ url: card.media.card_art_url, alt: card.media.alt_text }]
        : undefined,
    },
  };
}

export default async function CartaoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const card = getCardById(id);
  if (!card) notFound();

  const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  const artSrc = cardArtSrc(card.media.card_art_url);
  const hasLounge = card.lounge_access.has_lounge_access;

  const returnType = cardReturnLabel(card);

  const earningSummary =
    card.reward_return.earning_summary !== "unknown" ? card.reward_return.earning_summary : null;

  const minimumInvestment = card.facets_numeric_or_special.minimum_investment_brl_best_estimate;
  const minimumIncome = card.eligibility?.minimum_income_brl_best_estimate;

  const forexNote =
    card.facets_numeric_or_special.official_forex_or_iof_note &&
    card.facets_numeric_or_special.official_forex_or_iof_note !== "unknown"
      ? card.facets_numeric_or_special.official_forex_or_iof_note
      : null;

  const loungePerProgram: { name: string; detail: string }[] = card.lounge_access.summary
    ? card.lounge_access.summary
        .split(" | ")
        .map((entry) => {
          const dash = entry.indexOf(" - ");
          if (dash === -1) return null;
          return { name: entry.slice(0, dash), detail: entry.slice(dash + 3) };
        })
        .filter((x): x is { name: string; detail: string } => x !== null)
    : [];

  const rewardChars = filterChars(card, ["rewards"]).filter(
    (i) =>
      String(i.value) !== "(Não há)" &&
      String(i.value) !== "Não há" &&
      String(i.value).toLowerCase() !== "cashback" &&
      String(i.value).toLowerCase() !== "investback" &&
      String(i.value).toLowerCase() !== "pontos" &&
      String(i.value) !== earningSummary
  );

  const feeChars = filterChars(card, ["fees"]).filter(
    (i) =>
      i.key !== "annual_fee" &&
      i.key !== "annual_fee_detail" &&
      i.key !== "fee_waiver" &&
      String(i.value) !== "(Não há)" &&
      String(i.value) !== "Não ()"
  );
  const feeWaiverText = card.characteristics?.find((i) => i.key === "fee_waiver")?.value;
  const feeWaiverRules = card.fee_waiver_rules ?? [];

  const eligibilityChars = filterChars(card, ["eligibility"]).filter(
    (i) => String(i.value) !== "(Não há)" && String(i.value) !== "Não há"
  );

  const extrasChars = filterChars(card, ["insurance", "lifestyle", "issuer_specific"]).filter(
    (i) => String(i.value) !== "(Não há)" && String(i.value) !== "Não há"
  );

  const loungeSummaryLine = hasLounge
    ? typeof card.lounge_access.annual_visits === "number"
      ? card.lounge_access.unlimited
        ? `${card.lounge_access.annual_visits}×/ano + GRU`
        : `${card.lounge_access.annual_visits}×/ano${loungeCondition(card.lounge_access.summary) ? " cond." : ""}`
      : card.lounge_access.unlimited
        ? "Ilimitado"
        : "Acesso VIP"
    : "Sem lounge";

  const heroStats: Stat[] = [
    {
      label: "Anuidade",
      value: feeLabel(fee),
      tone: fee === 0 ? "positive" : feeIsKnown(fee) ? "default" : "muted",
    },
    { label: "Retorno", value: returnType ?? "—" },
    { label: "Sala VIP", value: loungeSummaryLine, tone: hasLounge ? "default" : "muted" },
  ];

  const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL ?? "";

  const numericFee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: card.display_name,
    image: artSrc ?? undefined,
    description: card.reward_return.earning_summary ?? "",
    brand: { "@type": "Brand", name: card.issuer_raw },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: typeof numericFee === "number" ? numericFee : undefined,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      {/* JSON-LD from our own catalog; JSON.stringify-escaped (see biome.json override) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AppHeader />
      <div className="mx-auto flex w-full max-w-7xl items-start justify-center gap-6 px-4 sm:px-6">
        <div className="hidden w-40 shrink-0 sticky top-16 pt-6 xl:block">
          <AdSlot slot={adSlot} format="vertical" />
        </div>

        <main className="min-w-0 flex-1 max-w-[920px] pb-32 pt-5 sm:pt-7">
          <Suspense>
            <CardDetailBackLink />
          </Suspense>

          {/* ─── Editorial Hero ─── */}
          <section className="border-b border-line pb-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <CardArt
                artUrl={card.media.card_art_url}
                issuerRaw={card.issuer_raw}
                network={card.network_primary}
                displayName={card.display_name}
                loading="eager"
                className="h-[118px] w-[188px] sm:h-[138px] sm:w-[220px]"
              />
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-2xl font-semibold tracking-tight text-fg sm:text-[26px]">
                  {card.display_name}
                </h1>
                <p className="mt-1 text-[15px] text-fg-2">
                  {card.issuer_raw} · {card.network_primary}
                </p>
                {earningSummary && (
                  <p className="mt-2.5 max-w-[58ch] text-sm leading-relaxed text-fg-2">
                    {earningSummary}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Tag variant="quiet">{segmentLabel(card.market_segment_guess)}</Tag>
                  <Tag variant="quiet">{card.network_primary}</Tag>
                  {card.ranking_position !== "unknown" && (
                    <Tag variant="brand" className="num">
                      #{card.ranking_position} geral
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            <StatRow stats={heroStats} className="mt-6 max-[379px]:grid-cols-1!" />
          </section>

          {/* ─── Personalized Financial Verdict ─── */}
          <div className="mt-6">
            <CardProfileInsights card={card} />
          </div>

          {/* ─── Clean Two-Column Ledger Specs ─── */}
          <div className="mt-8 space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
              <Block title="Retorno">
                {returnType ? (
                  <DataRow label="Tipo" value={returnType} />
                ) : (
                  <EmptyRow>Sem retorno financeiro neste cartão.</EmptyRow>
                )}
                {rewardChars.length > 0 && <CharList items={rewardChars} />}
              </Block>

              <Block title="Sala VIP e lounge">
                {hasLounge ? (
                  loungePerProgram.length > 0 ? (
                    <div>
                      {loungePerProgram.map((prog) => (
                        <div
                          key={prog.name}
                          className="border-b border-line py-2.5 last:border-b-0"
                        >
                          <p className="text-sm font-semibold text-fg">{prog.name}</p>
                          <p className="mt-0.5 text-sm leading-relaxed text-fg-2">{prog.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {typeof card.lounge_access.annual_visits === "number" && (
                        <DataRow
                          label="Acessos"
                          value={`${card.lounge_access.annual_visits}×/ano`}
                        />
                      )}
                      {card.lounge_access.unlimited && <DataRow label="Limite" value="Ilimitado" />}
                      {displayValue(card.lounge_access.guest_policy) && (
                        <DataRow
                          label="Acompanhantes"
                          value={displayValue(card.lounge_access.guest_policy)!}
                        />
                      )}
                      {loungeCondition(card.lounge_access.summary) && (
                        <FullTextRow
                          label="Condição"
                          value={loungeCondition(card.lounge_access.summary)!}
                        />
                      )}
                    </>
                  )
                ) : (
                  <EmptyRow>Sem acesso a sala VIP.</EmptyRow>
                )}
              </Block>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Block title="Custo e isenção">
                <DataRow label="Anuidade" value={feeLabel(fee)} />
                {feeWaiverRules.length > 0 ? (
                  <FeeWaiverRules rules={feeWaiverRules} />
                ) : (
                  feeWaiverText &&
                  feeWaiverText !== "unknown" &&
                  !String(feeWaiverText).startsWith("Não há") && (
                    <FullTextRow label="Isenção da anuidade" value={String(feeWaiverText)} />
                  )
                )}
                {forexNote && <DataRow label="Câmbio / IOF" value={forexNote} />}
                {feeChars.length > 0 && <CharList items={feeChars} />}
                {!forexNote && feeChars.length === 0 && (
                  <EmptyRow>Câmbio e IOF: verifique na fonte oficial.</EmptyRow>
                )}
              </Block>

              <Block title="Elegibilidade">
                <DataRow label="Segmento" value={segmentLabel(card.market_segment_guess)} />
                <DataRow label="Bandeira" value={card.network_primary} />
                {minimumInvestment !== "unknown" && (
                  <DataRow
                    label="Investimento mín."
                    value={`R$ ${(minimumInvestment as number).toLocaleString("pt-BR")}`}
                  />
                )}
                {minimumIncome && minimumIncome !== "unknown" && (
                  <DataRow
                    label="Renda mín."
                    value={`R$ ${(minimumIncome as number).toLocaleString("pt-BR")}/mês`}
                  />
                )}
                {eligibilityChars.length > 0 && <CharList items={eligibilityChars} />}
              </Block>
            </div>

            {extrasChars.length > 0 && (
              <Block title="Benefícios extras">
                <CharList items={extrasChars} />
              </Block>
            )}

            {/* Official Source Strip */}
            <div className="flex flex-col gap-3 rounded-panel bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{card.source_label}</p>
                <p className="text-xs text-fg-3">
                  Confirme anuidade, taxas e critérios diretamente com o emissor.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a
                  href={affiliateClickUrl(card.card_stable_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir fonte oficial
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </main>

        <div className="hidden w-40 shrink-0 sticky top-16 pt-6 xl:block">
          <AdSlot slot={adSlot} format="vertical" />
        </div>
      </div>

      <CardDetailActions
        cardId={card.card_stable_id}
        cardName={card.display_name}
        issuer={card.issuer_raw}
        sourceUrl={card.source_url}
      />
    </>
  );
}

/* ─── Helpers ─── */

function feeIsKnown(fee: CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"]) {
  return typeof fee === "number" || fee === "variable_pricing_claim";
}

function feeLabel(fee: CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"]) {
  return feeIsKnown(fee) ? formatFee(fee) : "Não informada";
}

function loungeCondition(summary?: string): string | null {
  if (!summary) return null;
  const match = summary.match(
    /\(([^)]*(?:mediante|gasto|fatura|compras|invest|necessário|necessario|acima|partir)[^)]*)\)|(?:mediante|com|para ter direito)[^.]+/i
  );
  return match?.[1] ?? match?.[0] ?? null;
}

function formatRuleAmount(rule: FeeWaiverRule) {
  if (rule.category === "general" && rule.full_waiver) return null;
  if (typeof rule.threshold_brl !== "number") return "Sem limite informado";
  const suffix = rule.period === "monthly" ? "/mês" : rule.period === "annual" ? "/ano" : "";
  return `R$ ${rule.threshold_brl.toLocaleString("pt-BR")}${suffix}`;
}

function FeeWaiverRules({ rules }: { rules: FeeWaiverRule[] }) {
  const ordered = [...rules].sort((a, b) => {
    const order: Record<FeeWaiverRule["category"], number> = {
      monthly_spend: 0,
      investment: 1,
      subscription: 2,
      cashback: 3,
      miles: 4,
      general: 5,
      pix_key: 6,
      promotional_period: 7,
    };
    return order[a.category] - order[b.category];
  });
  const hasOnlyGeneralFullWaiver =
    ordered.length === 1 && ordered[0].category === "general" && ordered[0].full_waiver;
  const hasAlternativeRules = ordered.length > 1;

  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-sm text-fg-2">Isenção da anuidade</span>
        <Tag variant="positive">
          {hasOnlyGeneralFullWaiver
            ? "Sem anuidade"
            : ordered.every((rule) => rule.full_waiver)
              ? "Isenção total"
              : "Condições"}
        </Tag>
      </div>
      {hasOnlyGeneralFullWaiver && (
        <p className="text-sm leading-relaxed text-fg">{ordered[0].description}</p>
      )}
      {!hasOnlyGeneralFullWaiver && (
        <>
          {hasAlternativeRules && (
            <p className="mb-3 text-xs leading-relaxed text-fg-3">
              Basta cumprir uma das condições abaixo. As regras são alternativas: uma{" "}
              <span className="font-semibold text-fg">ou</span> outra.
            </p>
          )}
          <div className="grid gap-2.5 min-[420px]:grid-cols-2">
            {ordered.map((rule, index) => {
              const isSpend = rule.category === "monthly_spend";
              const isInvestment = rule.category === "investment";
              const isSubscription = rule.category === "subscription";
              const amount = formatRuleAmount(rule);
              const Icon = isSpend
                ? ReceiptText
                : isInvestment
                  ? WalletCards
                  : isSubscription
                    ? CreditCard
                    : rule.category === "cashback"
                      ? Coins
                      : rule.category === "miles"
                        ? Plane
                        : rule.category === "pix_key"
                          ? ReceiptText
                          : CreditCard;
              const label = isSpend
                ? "Gasto mensal"
                : isInvestment
                  ? "Investimento"
                  : isSubscription
                    ? "Assinatura"
                    : rule.category === "cashback"
                      ? "Cashback"
                      : rule.category === "miles"
                        ? "Milhas"
                        : rule.category === "pix_key"
                          ? "Pix"
                          : rule.category === "promotional_period"
                            ? "Promoção"
                            : "Geral";
              return (
                <div
                  key={`${rule.category}-${rule.threshold_brl ?? "general"}-${index}`}
                  className="rounded-panel bg-surface p-3"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-fg-3">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  {amount && <p className="num mt-1 text-[15px] font-semibold text-fg">{amount}</p>}
                  <p className="mt-1 text-xs leading-relaxed text-fg-2">{rule.description}</p>
                  {hasAlternativeRules && index < ordered.length - 1 && (
                    <span className="mt-2 inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-3">
                      ou
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function filterChars(
  card: CardFacet,
  groups: CardCharacteristic["category"][]
): CardCharacteristic[] {
  const seen = new Set<string>();
  return (card.characteristics ?? []).filter((item) => {
    if (!groups.includes(item.category)) return false;
    const key = `${item.key}|${String(item.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function charValue(item: CardCharacteristic): string {
  const v = String(item.value);
  if (v === "unknown") return "Consultar";
  return v;
}

function CharList({ items }: { items: CardCharacteristic[] }) {
  return (
    <>
      {items.slice(0, 8).map((item) => {
        const value = charValue(item);
        const detail =
          item.details && item.details !== "unknown" && item.details !== value
            ? item.details
            : null;
        return (
          <DataRow
            key={`${item.category}-${item.key}-${value}`}
            label={item.label}
            value={value}
            detail={detail}
          />
        );
      })}
    </>
  );
}
