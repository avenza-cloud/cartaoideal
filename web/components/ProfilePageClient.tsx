"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/lib/store";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
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
  "h-10 w-full min-w-0 rounded-field border border-line-strong bg-field px-3.5 text-base text-fg transition-colors duration-100 placeholder:text-fg-3 hover:border-fg focus-visible:border-accent-line md:text-sm";

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
    <div className="min-h-screen bg-page">
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-7 sm:px-6 md:pt-10">
        {!isNew && (
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-fg-3 transition-colors duration-100 hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        )}

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {isNew ? "Configure seu perfil" : "Editar perfil"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-2 sm:text-[15px]">
            {isNew
              ? "Preencha seus dados financeiros para calcular o valor líquido real e sua jornada de cartões."
              : "Atualize seus dados para recalcular o ranking e a simulação de progressão."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Panel title="Financeiro">
            <div className="space-y-4">
              <Field id="profile-salary" label="Renda mensal">
                <CurrencyInput
                  id="profile-salary"
                  value={salary}
                  onChange={setSalary}
                  placeholder="Ex: 8.000"
                />
              </Field>
              <Field id="profile-spend" label="Gasto mensal no cartão">
                <CurrencyInput
                  id="profile-spend"
                  value={spend}
                  onChange={setSpend}
                  placeholder="Ex: 3.000"
                />
              </Field>
              <Field id="profile-invested" label="Total investido">
                <CurrencyInput
                  id="profile-invested"
                  value={invested}
                  onChange={setInvested}
                  placeholder="Ex: 50.000"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Cartão atual">
            {selectedCard ? (
              <div className="flex items-center gap-3 rounded-panel border border-brand-border bg-brand-wash px-3.5 py-2.5">
                <CardArt
                  compact
                  artUrl={selectedCard.artUrl}
                  issuerRaw={selectedCard.issuer}
                  displayName={selectedCard.name}
                  className="h-10 w-16"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{selectedCard.name}</p>
                  <p className="truncate text-xs text-fg-2">{selectedCard.issuer}</p>
                </div>
                <button
                  type="button"
                  aria-label="Remover cartão atual"
                  onClick={() => {
                    setCardId(undefined);
                    setCardQuery("");
                    setCardFocused(true);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-2 transition-colors duration-100 hover:bg-raised hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <label htmlFor="profile-current-card" className="sr-only">
                  Buscar cartão atual
                </label>
                <input
                  id="profile-current-card"
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
                      <p className="mb-2 text-xs font-medium text-fg-3">Mais comuns</p>
                    )}
                    <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-panel border border-line bg-raised">
                      {cardMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => {
                            setCardId(c.id);
                            setCardQuery(c.name);
                            setCardFocused(false);
                          }}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-100 hover:bg-surface"
                        >
                          <CardArt
                            compact
                            artUrl={c.artUrl}
                            issuerRaw={c.issuer}
                            displayName={c.name}
                            className="h-10 w-16"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-fg">
                              {c.name}
                            </span>
                            <span className="block truncate text-xs text-fg-3">
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

          <Panel title="Prefere receber">
            <div className="grid gap-2.5 min-[380px]:grid-cols-2">
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

          <Panel title="Frequência de viagens">
            <div className="grid gap-2.5 min-[430px]:grid-cols-3">
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

          {saved ? (
            <p
              role="status"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-success-tint px-5 py-2.5 text-sm font-semibold text-success-text"
            >
              <Check className="h-4 w-4 shrink-0" />
              Salvo! Redirecionando…
            </p>
          ) : (
            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={!salary}
              className="w-full whitespace-normal"
            >
              {isNew ? "Ver meu ranking personalizado" : "Salvar alterações"}
            </Button>
          )}
        </form>
      </main>

      <MobileBottomNav />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-panel bg-surface p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
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
        "rounded-panel border px-3.5 py-3 text-left transition-colors duration-100 active:scale-[0.98]",
        active
          ? "border-brand-border bg-brand-wash text-fg"
          : "border-line bg-raised text-fg hover:border-line-strong hover:bg-page"
      )}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-fg-2">{desc}</span>
    </button>
  );
}

function CurrencyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-fg-3">
        R$
      </span>
      <input
        id={id}
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
