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

// The catalog is closed-world (every valid id is prerendered above), so an
// unknown id must be a real 404 — without this, Next renders the not-found UI
// on demand and caches it with a 200 (soft-404).
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

  // Per-program lounge breakdown from summary field
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

  // Reward characteristics: skip travel dups, skip "(Não há)" values, skip cashback/return type echo
  const rewardChars = filterChars(card, ["rewards"]).filter(
    (i) =>
      String(i.value) !== "(Não há)" &&
      String(i.value) !== "Não há" &&
      String(i.value).toLowerCase() !== "cashback" &&
      String(i.value).toLowerCase() !== "investback" &&
      String(i.value).toLowerCase() !== "pontos" &&
      String(i.value) !== earningSummary
  );

  // Fee characteristics: skip annual_fee duplicates
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

  // Lounge summary line for hero
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
    { label: "Anuidade", value: feeLabel(fee), tone: feeIsKnown(fee) ? "default" : "muted" },
    { label: "Retorno", value: returnType ?? "—" },
    { label: "Lounge", value: loungeSummaryLine },
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
      <div className="mx-auto flex w-full max-w-7xl items-start gap-4 px-3 sm:px-4">
        {/* Left sidebar ad — desktop only */}
        <div className="hidden xl:block w-40 shrink-0 sticky top-4 pt-6">
          <AdSlot slot={adSlot} format="vertical" />
        </div>

        <main className="min-w-0 flex-1 max-w-4xl pb-28 pt-4 sm:pt-6">
          <Suspense>
            <CardDetailBackLink />
          </Suspense>

          {/* ─── Hero ─── */}
          <div className="rounded-md border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <CardArt
                artUrl={card.media.card_art_url}
                issuerRaw={card.issuer_raw}
                network={card.network_primary}
                displayName={card.display_name}
                loading="eager"
                className="h-28 w-44 sm:h-32 sm:w-52"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-medium tracking-tight break-words">
                  {card.display_name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{card.issuer_raw}</p>
                {earningSummary && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {earningSummary}
                  </p>
                )}
              </div>
            </div>

            <StatRow
              stats={heroStats}
              className="mt-4 bg-background max-[379px]:grid-cols-1! max-[379px]:divide-x-0 max-[379px]:divide-y"
            />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag>{segmentLabel(card.market_segment_guess)}</Tag>
              <Tag>{card.network_primary}</Tag>
              {card.ranking_position !== "unknown" && (
                <Tag variant="quiet" className="num">
                  #{card.ranking_position}
                </Tag>
              )}
            </div>
          </div>

          <div className="mt-3">
            <CardProfileInsights card={card} />
          </div>

          {/* ─── Content ─── */}
          <div className="mt-3 space-y-2">
            {/* Row 1: Retorno + Lounge side by side */}
            <div className="grid gap-2 md:grid-cols-2">
              {/* Retorno */}
              <Block title="Retorno">
                {returnType ? (
                  <DataRow label="Tipo" value={returnType} />
                ) : (
                  <EmptyRow>Sem retorno financeiro neste cartão.</EmptyRow>
                )}
                {rewardChars.length > 0 && <CharList items={rewardChars} />}
                {!returnType && rewardChars.length === 0 && null}
              </Block>

              {/* Lounge */}
              <Block title="Lounge">
                {hasLounge ? (
                  loungePerProgram.length > 0 ? (
                    <div>
                      {loungePerProgram.map((prog) => (
                        <div key={prog.name} className="border-b py-2 last:border-b-0">
                          <p className="text-sm font-medium">{prog.name}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {prog.detail}
                          </p>
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

            {/* Row 2: Custo + Elegibilidade */}
            <div className="grid gap-2 md:grid-cols-2">
              {/* Custo */}
              <Block title="Custo">
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
                  <EmptyRow>Câmbio e IOF: verifique na fonte.</EmptyRow>
                )}
              </Block>

              {/* Elegibilidade */}
              <Block title="Elegibilidade">
                <DataRow label="Segmento" value={segmentLabel(card.market_segment_guess)} />
                <DataRow label="Bandeira" value={card.network_primary} />
                {minimumInvestment !== "unknown" && (
                  <DataRow
                    label="Investimento mín."
                    value={`R$${(minimumInvestment as number).toLocaleString("pt-BR")}`}
                  />
                )}
                {minimumIncome && minimumIncome !== "unknown" && (
                  <DataRow
                    label="Renda mín."
                    value={`R$${(minimumIncome as number).toLocaleString("pt-BR")}/mês`}
                  />
                )}
                {eligibilityChars.length > 0 && <CharList items={eligibilityChars} />}
              </Block>
            </div>

            {/* Row 3: Extras — only if content */}
            {extrasChars.length > 0 && (
              <Block title="Benefícios extras">
                <CharList items={extrasChars} />
              </Block>
            )}

            {/* Fonte */}
            <div className="mb-8 flex flex-col gap-3 rounded-md border bg-card px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium">{card.source_label}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  · confirme condições com o emissor
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={affiliateClickUrl(card.card_stable_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar ad — desktop only */}
        <div className="hidden xl:block w-40 shrink-0 sticky top-4 pt-6">
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

/* ─── Layout primitives ─── */

function feeIsKnown(fee: CardFacet["facets_numeric_or_special"]["annual_fee_brl_best_estimate"]) {
  return typeof fee === "number" || fee === "variable_pricing_claim";
}

/** Unknown fees are never shown as free. */
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
  return `R$${rule.threshold_brl.toLocaleString("pt-BR")}${suffix}`;
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
    <div className="border-b py-2 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Isenção da anuidade</span>
        <Tag variant="positive">
          {hasOnlyGeneralFullWaiver
            ? "Sem anuidade"
            : ordered.every((rule) => rule.full_waiver)
              ? "Isenção total"
              : "Condições"}
        </Tag>
      </div>
      {hasOnlyGeneralFullWaiver && (
        <p className="text-sm leading-relaxed">{ordered[0].description}</p>
      )}
      {!hasOnlyGeneralFullWaiver && (
        <>
          {hasAlternativeRules && (
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              Basta cumprir uma das condições abaixo. As regras são alternativas: uma{" "}
              <span className="font-medium text-foreground">OU</span> outra.
            </p>
          )}
          <div className="grid gap-2 min-[420px]:grid-cols-2">
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
                  className="rounded-md border bg-background px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  {amount && <p className="num mt-1 text-sm font-medium">{amount}</p>}
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {rule.description}
                  </p>
                  {hasAlternativeRules && index < ordered.length - 1 && (
                    <p className="mt-2 text-2xs font-medium text-muted-foreground">OU</p>
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

function charLabel(item: CardCharacteristic): string {
  return item.label;
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
        const label = charLabel(item);
        const value = charValue(item);
        const detail =
          item.details && item.details !== "unknown" && item.details !== value
            ? item.details
            : null;
        return (
          <DataRow
            key={`${item.category}-${item.key}-${value}`}
            label={label}
            value={value}
            detail={detail}
          />
        );
      })}
    </>
  );
}
