import { notFound } from "next/navigation";
import Link from "next/link";
import { getCardById, getAllCards } from "@/lib/cards";
import { formatFee, rewardReturnLabel, segmentLabel } from "@/lib/formatting";
import { affiliateClickUrl } from "@/lib/affiliate";
import { AppHeader } from "@/components/AppHeader";
import { CardDetailActions } from "@/components/CardDetailActions";
import { CardProfileInsights } from "@/components/CardProfileInsights";
import { AdSlot } from "@/components/AdSlot";
import { ArrowLeft, Coins, CreditCard, ExternalLink, Plane, ReceiptText, WalletCards } from "lucide-react";
import type { BenefitGroupKey, CardCharacteristic, CardFacet, FeeWaiverRule } from "@/types/cards";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return getAllCards().map((c) => ({ id: c.card_stable_id }));
}

export default async function CartaoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const card = getCardById(id);
  if (!card) notFound();

  const fee = card.facets_numeric_or_special.annual_fee_brl_best_estimate;
  const hasImage = card.media.card_art_url && card.media.card_art_url !== "unknown";
  const hasLounge = card.lounge_access.has_lounge_access;

  const returnType = card.reward_return.has_cashlike_return
    ? rewardReturnLabel(card.reward_return)
    : card.facets_boolean.earn_points_or_miles
      ? "Pontos/milhas"
      : null;

  const earningSummary =
    card.reward_return.earning_summary !== "unknown"
      ? card.reward_return.earning_summary
      : null;

  const minimumInvestment = card.facets_numeric_or_special.minimum_investment_brl_best_estimate;
  const minimumIncome = card.eligibility?.minimum_income_brl_best_estimate;

  const forexNote =
    card.facets_numeric_or_special.official_forex_or_iof_note &&
    card.facets_numeric_or_special.official_forex_or_iof_note !== "unknown"
      ? card.facets_numeric_or_special.official_forex_or_iof_note
      : null;

  // Per-program lounge breakdown from summary field
  const loungePerProgram: { name: string; detail: string }[] =
    card.lounge_access.summary
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

  const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL ?? "";

  return (
    <>
      <AppHeader totalCards={getAllCards().length} />
      <div className="mx-auto flex w-full max-w-7xl items-start gap-4 px-3 sm:px-4">
        {/* Left sidebar ad — desktop only */}
        <div className="hidden xl:block w-[160px] shrink-0 sticky top-4 pt-6">
          <AdSlot slot={adSlot} format="vertical" />
        </div>

      <main className="min-w-0 flex-1 max-w-4xl pb-28 pt-4 sm:pt-6 md:pb-12">
        <Link
          href="/cartoes"
          className="mb-4 hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todos os cartões
        </Link>

        {/* ─── Hero ─── */}
        <div className="overflow-hidden rounded-2xl border bg-card/70 shadow-[0_28px_100px_rgba(0,0,0,0.26)] sm:rounded-[2rem]">
          <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Card art */}
            <div className="relative flex min-h-44 items-center justify-center border-b bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.12),transparent_36%),linear-gradient(145deg,#09090b,#18181b_55%,#050505)] p-6 lg:border-b-0 lg:border-r">
              {hasImage ? (
                <img
                  src={card.media.card_art_url}
                  alt={card.media.alt_text}
                  className="max-h-32 max-w-[78%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:max-h-40"
                />
              ) : (
                <CreditCard className="h-12 w-12 text-muted-foreground/30" />
              )}
              {card.ranking_position !== "unknown" && (
                <span className="absolute left-4 top-4 rounded-full border bg-background/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
                  #{card.ranking_position}
                </span>
              )}
            </div>

            {/* Identity + key metrics */}
            <div className="flex flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-center gap-1">
                  <Pill>{segmentLabel(card.market_segment_guess)}</Pill>
                  <Pill>{card.network_primary}</Pill>
                  <Pill dim>{card.issuer_raw}</Pill>
                </div>
                <h1 className="mt-2.5 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-[1.75rem]">
                  {card.display_name}
                </h1>
                {earningSummary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {earningSummary}
                  </p>
                )}
              </div>

              {/* 3 metrics — each datum appears ONLY here */}
              <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border min-[380px]:grid-cols-3">
                <Metric label="Anuidade" value={formatFee(fee)} />
                <Metric label="Retorno" value={returnType ?? "—"} />
                <Metric label="Lounge" value={loungeSummaryLine} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Profile insights ─── */}
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
                <Empty>Sem retorno financeiro neste cartão.</Empty>
              )}
              {rewardChars.length > 0 && <CharList items={rewardChars} />}
              {!returnType && rewardChars.length === 0 && null}
            </Block>

            {/* Lounge */}
            <Block title="Lounge">
              {hasLounge ? (
                loungePerProgram.length > 0 ? (
                  <div className="space-y-1.5">
                    {loungePerProgram.map((prog) => (
                      <div key={prog.name} className="rounded-xl border bg-background/35 px-3 py-2">
                        <p className="text-xs font-medium leading-snug">{prog.name}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
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
                    {card.lounge_access.unlimited && (
                      <DataRow label="Limite" value="Ilimitado" />
                    )}
                    {card.lounge_access.guest_policy !== "unknown" && (
                      <DataRow label="Acompanhantes" value={card.lounge_access.guest_policy} />
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
                <Empty>Sem acesso a sala VIP.</Empty>
              )}
            </Block>
          </div>

          {/* Row 2: Custo + Elegibilidade */}
          <div className="grid gap-2 md:grid-cols-2">

            {/* Custo */}
            <Block title="Custo">
              <DataRow label="Anuidade" value={formatFee(fee)} />
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
                <Empty>Câmbio e IOF: verifique na fonte.</Empty>
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
          <div className="mb-8 flex flex-col gap-3 rounded-2xl border bg-card/30 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium">{card.source_label}</span>
              <span className="ml-2 text-[11px] text-muted-foreground/60">
                · confirme condições com o emissor
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={affiliateClickUrl(card.card_stable_id, card.source_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border bg-background/40 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir
              </a>
            </div>
          </div>
        </div>
      </main>

        {/* Right sidebar ad — desktop only */}
        <div className="hidden xl:block w-[160px] shrink-0 sticky top-4 pt-6">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/45 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold" title={value}>{value}</p>
    </div>
  );
}

function Pill({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
        dim ? "text-muted-foreground" : "text-foreground/80"
      }`}
    >
      {children}
    </span>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card/50 p-3.5">
      <p className="mb-2 text-xs font-semibold">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border bg-background/35 px-3 py-2">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-xs font-medium" title={value}>
        {value}
      </span>
    </div>
  );
}

function FullTextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/35 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <p className="mt-1 text-xs font-medium leading-relaxed">{value}</p>
    </div>
  );
}

function loungeCondition(summary?: string): string | null {
  if (!summary) return null;
  const match = summary.match(/\(([^)]*(?:mediante|gasto|fatura|compras|invest|necessário|necessario|acima|partir)[^)]*)\)|(?:mediante|com|para ter direito)[^.]+/i);
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
    const order = { monthly_spend: 0, investment: 1, subscription: 2, cashback: 3, miles: 4, general: 5 };
    return order[a.category] - order[b.category];
  });
  const hasOnlyGeneralFullWaiver =
    ordered.length === 1 && ordered[0].category === "general" && ordered[0].full_waiver;
  const hasAlternativeRules = ordered.length > 1;

  return (
    <div className="rounded-xl border bg-emerald-500/5 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-emerald-500">Isenção da anuidade</span>
        <span className="rounded-full border border-emerald-500/25 px-2 py-0.5 text-[10px] text-emerald-500">
          {hasOnlyGeneralFullWaiver
            ? "Sem anuidade"
            : ordered.every((rule) => rule.full_waiver)
              ? "Isenção total"
              : "Condições"}
        </span>
      </div>
      {hasOnlyGeneralFullWaiver && (
        <p className="rounded-lg border bg-background/50 px-2.5 py-2 text-xs font-medium leading-relaxed">
          {ordered[0].description}
        </p>
      )}
      {!hasOnlyGeneralFullWaiver && (
        <>
          {hasAlternativeRules && (
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              Basta cumprir uma das condições abaixo. As regras são alternativas: uma <strong>OU</strong> outra.
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
                    : "Geral";
            return (
              <div
                key={`${rule.category}-${rule.threshold_brl ?? "general"}-${index}`}
                className="rounded-lg border bg-background/50 px-2.5 py-2"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                {amount && <p className="mt-1 font-mono text-sm font-semibold">{amount}</p>}
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {rule.description}
                </p>
                {hasAlternativeRules && index < ordered.length - 1 && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-500/80">
                    OU
                  </p>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border bg-background/20 px-3 py-2 text-[11px] text-muted-foreground/60">
      {children}
    </p>
  );
}

/* ─── Characteristics ─── */

function filterChars(card: CardFacet, groups: BenefitGroupKey[]): CardCharacteristic[] {
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
          <div
            key={`${item.category}-${item.key}-${value}`}
            className="rounded-xl border bg-background/35 px-3 py-2"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
              <span className="min-w-0 truncate text-right text-xs font-medium" title={value}>
                {value}
              </span>
            </div>
            {detail && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
                {detail}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
