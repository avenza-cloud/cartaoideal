"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/lib/store";
import { AppHeader } from "@/components/AppHeader";
import { searchCardOptions, type ClientCardOption } from "@/lib/card-options";
import { Check, ArrowLeft, X } from "lucide-react";
import { CardArt } from "@/components/card";
import { Button } from "@/components/ui/button";
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

const INPUT_CLASS =
  "h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-ring md:text-sm";

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
      // Not edited on this page: keep whatever is already stored.
      monthlyInternationalSpendBrl: profile?.monthlyInternationalSpendBrl,
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

      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-8">
        {/* Back link — only when editing */}
        {!isNew && (
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        )}

        {/* Header */}
        <div className="mb-8">
          <p className="mb-1 text-xs text-muted-foreground">
            {isNew ? "Passo 1 de 1" : "Seu perfil"}
          </p>
          <h1 className="text-3xl font-medium">
            {isNew ? "Configure seu perfil" : "Editar perfil"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isNew
              ? "Preencha seus dados financeiros para ver o ranking personalizado e sua jornada de cartões."
              : "Atualize seus dados para recalcular o ranking e a simulação de progressão."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Financial inputs */}
          <Panel title="Financeiro">
            <div className="space-y-4">
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
          </Panel>

          {/* Current card */}
          <Panel title="Cartão atual">
            {selectedCard ? (
              <div className="flex items-center gap-3 rounded-md border border-foreground px-3 py-2">
                <CardArt
                  compact
                  artUrl={selectedCard.artUrl}
                  issuerRaw={selectedCard.issuer}
                  displayName={selectedCard.name}
                  className="h-10 w-16"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedCard.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedCard.issuer}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCardId(undefined);
                    setCardQuery("");
                    setCardFocused(true);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
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
                  className={INPUT_CLASS}
                />
                {cardFocused && cardMatches.length > 0 && (
                  <div className="mt-3">
                    {!cardQuery.trim() && (
                      <p className="mb-2 text-xs text-muted-foreground">Mais comuns</p>
                    )}
                    <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
                      {cardMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => {
                            setCardId(c.id);
                            setCardQuery(c.name);
                            setCardFocused(false);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-muted"
                        >
                          <CardArt
                            compact
                            artUrl={c.artUrl}
                            issuerRaw={c.issuer}
                            displayName={c.name}
                            className="h-10 w-16"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.description ?? c.issuer}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* Preferences */}
          <Panel title="Prefere receber">
            <div className="grid gap-2 min-[380px]:grid-cols-2">
              {REWARD_OPTIONS.map(({ value, label, desc }) => (
                <OptionButton
                  key={value}
                  active={rewards.has(value)}
                  onClick={() => toggleReward(value)}
                  label={label}
                  desc={desc}
                />
              ))}
            </div>
          </Panel>

          {/* Travel frequency */}
          <Panel title="Frequência de viagens">
            <div className="grid gap-2 min-[430px]:grid-cols-3">
              {TRAVEL_OPTIONS.map(({ value, label, desc }) => (
                <OptionButton
                  key={value}
                  active={travel === value}
                  onClick={() => setTravel(value)}
                  label={label}
                  desc={desc}
                />
              ))}
            </div>
          </Panel>

          {/* Submit: the page's one marked action */}
          {saved ? (
            <p
              role="status"
              className="flex min-h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-medium text-positive"
            >
              <Check className="h-4 w-4 shrink-0" />
              Salvo! Redirecionando…
            </p>
          ) : (
            <Button
              type="submit"
              variant="mark"
              size="lg"
              disabled={!salary}
              className="h-auto min-h-10 w-full whitespace-normal py-2"
            >
              {isNew ? "Ver meu ranking personalizado" : "Salvar alterações"}
            </Button>
          )}
        </form>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-2.5 text-left transition-colors duration-150",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-input bg-card text-foreground hover:bg-muted"
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span
        className={cn("mt-0.5 block text-xs", active ? "text-background" : "text-muted-foreground")}
      >
        {desc}
      </span>
    </button>
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
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatBrlInput(e.target.value))}
        placeholder={placeholder ?? "0"}
        className={cn(INPUT_CLASS, "num pl-10")}
      />
    </div>
  );
}
