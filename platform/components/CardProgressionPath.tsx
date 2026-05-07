"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/store";
import { formatFee } from "@/lib/formatting";
import { formatBrlCurrency, formatBrlInput, parseBrlInput } from "@/lib/brl";
import { fetchRecommendationsWithFallback } from "@/lib/recommend-fallback";
import {
  CreditCard,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import type { CardScore } from "@/types/cards";

/* ─── helpers ─── */
function money(v: number) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}R$${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function shortMoney(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return `R$${v.toLocaleString("pt-BR")}`;
}

function projectionIncomeBase(currentIncome: number, currentSpend: number, futureIncome: number) {
  if (currentIncome <= 0) return currentIncome;

  const ratio = futureIncome / currentIncome;
  const correctedIncome = currentIncome * 10;
  const correctedRatio = futureIncome / correctedIncome;
  const looksLikeLegacyMissingZero =
    currentIncome < 10_000 &&
    currentSpend > currentIncome * 2 &&
    ratio >= 8 &&
    correctedRatio >= 0.5 &&
    correctedRatio <= 3;

  return looksLikeLegacyMissingZero ? correctedIncome : currentIncome;
}

function projectionSpendBase(currentIncome: number, currentSpend: number) {
  if (currentIncome <= 0 || currentSpend <= 0) return currentSpend;

  const correctedSpend = currentSpend / 10;
  const looksLikeLegacyExtraZero =
    currentSpend > currentIncome * 2 &&
    correctedSpend > 0 &&
    correctedSpend <= currentIncome;

  return looksLikeLegacyExtraZero ? correctedSpend : currentSpend;
}

/* ─── small card row ─── */
function CardRow({
  scored,
  badge,
  highlight,
}: {
  scored: CardScore;
  badge?: string;
  highlight?: boolean;
}) {
  const { card, valueScore } = scored;
  const hasImage = card.media.card_art_url && card.media.card_art_url !== "unknown";
  const net = valueScore?.netMonthlyValueBrl;
  const positive = (net ?? 0) >= 0;
  const restricted = valueScore?.dataQualityNotes.some((note) =>
    /convite|restrit|private/i.test(note)
  );

  return (
    <Link
      href={`/cartoes/${card.card_stable_id}`}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-xs transition-colors hover:bg-muted/30 ${
        highlight
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "bg-background/40"
      }`}
    >
      <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border bg-zinc-950">
        {hasImage ? (
          <img
            src={card.media.card_art_url}
            alt={card.media.alt_text}
            className="max-h-6 max-w-[44px] object-contain"
            loading="lazy"
          />
        ) : (
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
              {badge}
            </span>
          )}
          {restricted && (
            <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-400">
              restrito
            </span>
          )}
          <p className="truncate font-medium leading-tight">{card.display_name}</p>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {formatFee(card.facets_numeric_or_special.annual_fee_brl_best_estimate)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {net !== undefined && (
          <p
            className={`font-mono text-xs font-semibold ${
              positive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {money(net)}/mês
          </p>
        )}
        <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/40" />
      </div>
    </Link>
  );
}

/* ─── main ─── */
export function CardProgressionPath() {
  const { profile, onboardingDone } = useProfileStore();

  // current top cards
  const [current, setCurrent] = useState<CardScore[] | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  // future inputs
  const [futureIncome, setFutureIncome] = useState("");
  const [futureInvested, setFutureInvested] = useState("");

  // simulation result
  const [simResult, setSimResult] = useState<{
    top: CardScore[];
    newUnlocked: CardScore[];
    futureSpend: number;
  } | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // fetch current top cards
  useEffect(() => {
    if (!profile) { setCurrent(null); return; }
    setLoadingCurrent(true);
    fetchRecommendationsWithFallback(profile, 3)
      .then((d: CardScore[]) => setCurrent(Array.isArray(d) ? d : null))
      .catch(() => setCurrent(null))
      .finally(() => setLoadingCurrent(false));
  }, [profile]);

  const futureIncomeNum = parseBrlInput(futureIncome);
  const futureInvestedNum = parseBrlInput(futureInvested);
  const currentIncomeForProjection = profile
    ? projectionIncomeBase(profile.monthlySalaryBrl, profile.avgMonthlySpendBrl, futureIncomeNum)
    : 0;
  const currentSpendForProjection = profile
    ? projectionSpendBase(currentIncomeForProjection, profile.avgMonthlySpendBrl)
    : 0;

  // proportional spend estimate
  const estimatedFutureSpend =
    profile && futureIncomeNum > 0 && currentIncomeForProjection > 0
      ? currentSpendForProjection * (futureIncomeNum / currentIncomeForProjection)
      : 0;

  const canSimulate = futureIncomeNum > 0 || futureInvestedNum > 0;

  const simulate = useCallback(async () => {
    if (!profile || !canSimulate) return;
    setSimLoading(true);
    setSimResult(null);

    const futureProfile = {
      ...profile,
      monthlySalaryBrl: futureIncomeNum || profile.monthlySalaryBrl,
      avgInvestedBrl: futureInvestedNum || profile.avgInvestedBrl,
      avgMonthlySpendBrl:
        futureIncomeNum > 0 && currentIncomeForProjection > 0
          ? estimatedFutureSpend
          : profile.avgMonthlySpendBrl,
    };

    try {
      const future = await fetchRecommendationsWithFallback(futureProfile, 10);
      if (!Array.isArray(future)) return;

      const currentIds = new Set((current ?? []).map((s) => s.card.card_stable_id));
      const newUnlocked = future.filter((s) => !currentIds.has(s.card.card_stable_id));

      setSimResult({
        top: future.slice(0, 3),
        newUnlocked: newUnlocked.slice(0, 2),
        futureSpend:
          futureIncomeNum > 0 && currentIncomeForProjection > 0
            ? estimatedFutureSpend
            : profile.avgMonthlySpendBrl,
      });
    } catch {
      // silent
    } finally {
      setSimLoading(false);
    }
  }, [profile, canSimulate, futureIncomeNum, futureInvestedNum, currentIncomeForProjection, estimatedFutureSpend, current]);

  if (!profile || !onboardingDone) return null;

  return (
    <div className="rounded-3xl border bg-card/50 p-4">
      <div className="mb-4 flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold">Sua jornada de cartões</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Veja onde você está agora e simule o próximo passo.
          </p>
        </div>
        <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground/40 mt-0.5" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* ── Left: now ── */}
        <div className="rounded-2xl border bg-background/30 p-3">
          <p className="mb-2.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Agora
          </p>

          {loadingCurrent ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[52px] animate-pulse rounded-2xl border bg-muted/30"
                />
              ))}
            </div>
          ) : current && current.length > 0 ? (
            <div className="space-y-1.5">
              {current.map((s, i) => (
                <CardRow
                  key={s.card.card_stable_id}
                  scored={s}
                  badge={i === 0 ? "melhor" : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground/60">
              Nenhum cartão elegível encontrado.
            </p>
          )}

          {/* Current profile summary */}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t pt-2.5">
            <Stat label="Renda" value={`R$${profile.monthlySalaryBrl.toLocaleString("pt-BR")}/mês`} />
            <Stat label="Gasto" value={`R$${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}/mês`} />
            <Stat label="Investido" value={shortMoney(profile.avgInvestedBrl)} />
          </div>
        </div>

        {/* ── Right: future simulation ── */}
        <div className="rounded-2xl border bg-background/30 p-3">
          <p className="mb-2.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Em 1 ano
          </p>

          <div className="space-y-2">
            <FutureInput
              label="Renda esperada / mês"
              value={futureIncome}
              onChange={(v) => {
                setFutureIncome(formatBrlInput(v));
                setSimResult(null);
              }}
              placeholder={`Atual: R$${profile.monthlySalaryBrl.toLocaleString("pt-BR")}`}
            />
            <FutureInput
              label="Total investido"
              value={futureInvested}
              onChange={(v) => {
                setFutureInvested(formatBrlInput(v));
                setSimResult(null);
              }}
              placeholder={`Atual: ${shortMoney(profile.avgInvestedBrl)}`}
            />
          </div>

          {/* Estimated spend */}
          {estimatedFutureSpend > 0 && estimatedFutureSpend !== profile.avgMonthlySpendBrl && (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-dashed bg-background/20 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Gasto estimado</span>
              <span className="font-mono text-[11px] text-foreground">
                {formatBrlCurrency(estimatedFutureSpend)}/mês
              </span>
            </div>
          )}

          <button
            onClick={simulate}
            disabled={!canSimulate || simLoading}
            className={`mt-3 flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              canSimulate && !simLoading
                ? "bg-foreground text-background hover:opacity-90"
                : "cursor-not-allowed border bg-muted/20 text-muted-foreground/40"
            }`}
          >
            <span>{simLoading ? "Simulando..." : "Simular próximo passo"}</span>
            {!simLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Simulation result ── */}
      {simResult && (
        <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">
              Com esse perfil em 1 ano
            </p>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              gasto ≈ {formatBrlCurrency(simResult.futureSpend)}/mês
            </span>
          </div>

          {simResult.newUnlocked.length > 0 ? (
            <>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {simResult.newUnlocked.length === 1
                  ? "1 cartão novo entra no radar:"
                  : `${simResult.newUnlocked.length} cartões novos entram no radar:`}
              </p>
              <div className="space-y-1.5">
                {simResult.newUnlocked.map((s) => (
                  <CardRow
                    key={s.card.card_stable_id}
                    scored={s}
                    badge="novo"
                    highlight
                  />
                ))}
              </div>
              {simResult.top.length > 0 && (
                <div className="mt-3 border-t border-emerald-500/20 pt-3">
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Melhor cartão no novo perfil:
                  </p>
                  <CardRow scored={simResult.top[0]} />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <p className="mb-2 text-[11px] text-muted-foreground">
                Sem novos cartões no radar — mas o ranking muda:
              </p>
              {simResult.top.slice(0, 2).map((s) => (
                <CardRow key={s.card.card_stable_id} scored={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50">{label}</p>
      <p className="font-mono text-[10px] text-muted-foreground">{value}</p>
    </div>
  );
}

function FutureInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-xl border bg-background/40 px-3 py-2">
      <p className="text-[10px] text-muted-foreground/60">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-xs text-muted-foreground">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
        />
      </div>
    </div>
  );
}
