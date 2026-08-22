"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/lib/store";
import { AppHeader } from "@/components/AppHeader";
import { searchCardOptions, type ClientCardOption } from "@/lib/card-options";
import { Sparkles, CheckCircle2, ArrowLeft, CreditCard, X } from "lucide-react";
import { cardArtSrc } from "@/lib/card-display";
import { cn } from "@/lib/utils";
import { formatBrlInput, formatBrlNumber, parseBrlInput } from "@/lib/brl";
import type { UserProfile } from "@/types/cards";

type TravelFrequency = UserProfile["travelFrequency"];
type RewardPref = "cost_benefit" | "cashback" | "points" | "lounge";

const TRAVEL_OPTIONS: { value: TravelFrequency; label: string; desc: string }[] = [
  { value: "none", label: "Não viajo", desc: "0–3 viagens por ano" },
  { value: "occasional", label: "Às vezes", desc: "4–8 viagens por ano" },
  { value: "frequent", label: "Frequente", desc: "8+ viagens por ano" },
];

const REWARD_OPTIONS: { value: RewardPref; label: string; desc: string }[] = [
  {
    value: "cost_benefit",
    label: "Melhor custo-benefício",
    desc: "Maximize o retorno líquido total",
  },
  { value: "cashback", label: "Cashback", desc: "Dinheiro de volta nas compras" },
  { value: "points", label: "Pontos / milhas", desc: "Acumule para resgatar viagens" },
  { value: "lounge", label: "Lounge VIP", desc: "Acesso a salas em aeroportos" },
];

export interface ProfilePageClientProps {
  cardOptions: ClientCardOption[];
  curatedOptions: ClientCardOption[];
}

export function ProfilePageClient({ cardOptions, curatedOptions }: ProfilePageClientProps) {
  const router = useRouter();
  const { profile, setProfile } = useProfileStore();

  const [salary, setSalary] = useState("");
  const [spend, setSpend] = useState("");
  const [invested, setInvested] = useState("");
  const [travel, setTravel] = useState<TravelFrequency>("none");
  const [rewards, setRewards] = useState<Set<RewardPref>>(new Set());
  const [saved, setSaved] = useState(false);

  // card search
  const [cardQuery, setCardQuery] = useState("");
  const [cardId, setCardId] = useState<string | undefined>();
  const [cardFocused, setCardFocused] = useState(false);

  const cardMatches = useMemo(
    () => searchCardOptions(cardOptions, curatedOptions, cardQuery, 6),
    [cardOptions, curatedOptions, cardQuery]
  );

  const selectedCard = useMemo(
    () => cardOptions.find((c) => c.id === cardId),
    [cardOptions, cardId]
  );

  // pre-fill from existing profile
  useEffect(() => {
    if (!profile) return;
    setSalary(formatBrlNumber(profile.monthlySalaryBrl));
    setSpend(formatBrlNumber(profile.avgMonthlySpendBrl));
    setInvested(formatBrlNumber(profile.avgInvestedBrl));
    setTravel(profile.travelFrequency);
    if (profile.currentPrimaryCardId) {
      setCardId(profile.currentPrimaryCardId);
      setCardQuery(profile.currentPrimaryCardName ?? "");
    }
    const prefs = new Set<RewardPref>();
    if (profile.preferences.prefersCashback || profile.preferences.prefersInvestback) {
      prefs.add("cashback");
    }
    if (profile.preferences.prefersPoints) prefs.add("points");
    if (profile.preferences.wantsLounge) prefs.add("lounge");
    if (prefs.size === 0) prefs.add("cost_benefit");
    setRewards(prefs);
  }, [profile]);

  function toggleReward(r: RewardPref) {
    setRewards((prev) => {
      const next = new Set(prev);
      if (r === "cost_benefit") {
        return next.has(r) ? new Set<RewardPref>() : new Set<RewardPref>(["cost_benefit"]);
      }
      next.delete("cost_benefit");
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isCostBenefit = rewards.has("cost_benefit") || rewards.size === 0;
    setProfile({
      monthlySalaryBrl: parseBrlInput(salary),
      avgMonthlySpendBrl: parseBrlInput(spend),
      avgInvestedBrl: parseBrlInput(invested),
      travelFrequency: travel,
      spendingCategories: profile?.spendingCategories ?? [],
      currentPrimaryCardId: cardId,
      currentPrimaryCardName: cardId ? cardQuery.trim() || undefined : undefined,
      preferences: {
        prefersCashback: !isCostBenefit && rewards.has("cashback"),
        prefersPoints: !isCostBenefit && rewards.has("points"),
        prefersInvestback: false,
        wantsLounge: !isCostBenefit && rewards.has("lounge"),
      },
    });
    setSaved(true);
    setTimeout(() => {
      router.push("/");
    }, 1200);
  }

  const isNew = !profile;

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-xl px-4 pb-24 pt-10">
        {/* Back link — only when editing */}
        {!isNew && (
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        )}

        {/* Header */}
        <div className="mb-8">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
            {isNew ? "Passo 1 de 1" : "Seu perfil"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? "Configure seu perfil" : "Editar perfil"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isNew
              ? "Preencha seus dados financeiros para ver o ranking personalizado e sua jornada de cartões."
              : "Atualize seus dados para recalcular o ranking e a simulação de progressão."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Financial inputs */}
          <div className="rounded-2xl border bg-card/50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Financeiro
            </p>
            <div className="space-y-3">
              <Field label="Renda mensal">
                <CurrencyInput value={salary} onChange={setSalary} placeholder="Ex: 8.000" />
              </Field>
              <Field label="Gasto mensal no cartão">
                <CurrencyInput value={spend} onChange={setSpend} placeholder="Ex: 3.000" />
              </Field>
              <Field label="Total investido">
                <CurrencyInput value={invested} onChange={setInvested} placeholder="Ex: 50.000" />
              </Field>
            </div>
          </div>

          {/* Current card */}
          <div className="rounded-2xl border bg-card/50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Cartão atual
            </p>

            {selectedCard ? (
              <div className="flex items-center gap-3 rounded-xl border border-foreground/20 bg-foreground/5 px-3 py-2.5">
                <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-zinc-950">
                  {cardArtSrc(selectedCard.artUrl) ? (
                    <img
                      src={selectedCard.artUrl}
                      alt={selectedCard.altText || selectedCard.name}
                      className="max-h-8 max-w-[52px] object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedCard.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {selectedCard.issuer}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCardId(undefined);
                    setCardQuery("");
                    setCardFocused(true);
                  }}
                  className="shrink-0 rounded-full p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  autoFocus={cardFocused}
                  type="text"
                  value={cardQuery}
                  onChange={(e) => {
                    setCardQuery(e.target.value);
                    setCardId(undefined);
                  }}
                  onFocus={() => setCardFocused(true)}
                  onBlur={() => setTimeout(() => setCardFocused(false), 150)}
                  placeholder="Buscar cartão… (opcional)"
                  className="w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {cardFocused && cardMatches.length > 0 && (
                  <div className="mt-1.5 max-h-72 space-y-1 overflow-y-auto">
                    {!cardQuery.trim() && (
                      <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
                        Mais comuns
                      </p>
                    )}
                    {cardMatches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          setCardId(c.id);
                          setCardQuery(c.name);
                          setCardFocused(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-card"
                      >
                        <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-zinc-950">
                          {cardArtSrc(c.artUrl) ? (
                            <img
                              src={c.artUrl}
                              alt={c.altText || c.name}
                              className="max-h-7 max-w-[48px] object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{c.name}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {c.description ?? c.issuer}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="rounded-2xl border bg-card/50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Prefere receber
            </p>
            <div className="grid gap-2 min-[380px]:grid-cols-2">
              {REWARD_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleReward(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    rewards.has(value)
                      ? "border-foreground/60 bg-foreground/5"
                      : "border-border bg-background/30 hover:border-border/80"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-medium",
                      rewards.has(value) ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Travel frequency */}
          <div className="rounded-2xl border bg-card/50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Frequência de viagens
            </p>
            <div className="grid gap-2 min-[430px]:grid-cols-3">
              {TRAVEL_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTravel(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    travel === value
                      ? "border-foreground/60 bg-foreground/5"
                      : "border-border bg-background/30 hover:border-border/80"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-medium",
                      travel === value ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!salary || saved}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all",
              saved
                ? "bg-emerald-500/15 text-emerald-400"
                : salary
                  ? "bg-foreground text-background hover:opacity-90"
                  : "cursor-not-allowed bg-muted/30 text-muted-foreground/40"
            )}
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Salvo! Redirecionando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {isNew ? "Ver meu ranking personalizado" : "Salvar alterações"}
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] text-muted-foreground/70">{label}</span>
      {children}
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatBrlInput(e.target.value))}
        placeholder={placeholder ?? "0"}
        className="w-full rounded-xl border border-input bg-background/60 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
