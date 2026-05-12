"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/lib/store";
import { CLIENT_CARD_OPTIONS, CURATED_CARDS, normalizeCardSearchText } from "@/lib/client-card-options";
import { ArrowRight, ArrowLeft, CreditCard } from "lucide-react";
import type { UserProfile } from "@/types/cards";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cn } from "@/lib/utils";
import { formatBrlInput, parseBrlInput } from "@/lib/brl";

type TravelFrequency = UserProfile["travelFrequency"];
type RewardPref = "cost_benefit" | "cashback" | "points" | "lounge" | "travel";

const REWARD_OPTIONS: { value: RewardPref; label: string }[] = [
  { value: "cost_benefit", label: "Melhor custo-benefício" },
  { value: "cashback", label: "Cashback" },
  { value: "points", label: "Pontos e milhas" },
  { value: "lounge", label: "Lounge" },
  { value: "travel", label: "Viagens" },
];

const TRAVEL_OPTIONS: { value: TravelFrequency; label: string }[] = [
  { value: "none", label: "Não viajo" },
  { value: "occasional", label: "Às vezes" },
  { value: "frequent", label: "Frequente" },
];

const HEADLINE = "O cartão certo para você.";

function cardMatchScore(card: (typeof CLIENT_CARD_OPTIONS)[number], query: string): number {
  if (!query) return 100 - card.popularityRank;
  const issuer = normalizeCardSearchText(card.issuer);
  const name = normalizeCardSearchText(card.name);
  if (issuer === query || name === query) return 1000;
  if (issuer.startsWith(query)) return 900;
  if (name.startsWith(query)) return 850;
  if (card.searchText.split(/\s+/).some((token) => token === query)) return 800;
  if (card.searchText.split(/\s+/).some((token) => token.startsWith(query))) return 700;
  if (card.searchText.includes(query)) return 500;
  return -1;
}

export function ProfileOnboarding() {
  const { onboardingDone, setProfile, skipOnboarding } = useProfileStore();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [salary, setSalary] = useState("");
  const [spend, setSpend] = useState("");
  const [invested, setInvested] = useState("");
  const [currentCardQuery, setCurrentCardQuery] = useState("");
  const [currentCardId, setCurrentCardId] = useState<string | undefined>();
  const [travel, setTravel] = useState<TravelFrequency>("none");
  const [rewards, setRewards] = useState<Set<RewardPref>>(new Set(["cost_benefit"]));

  useEffect(() => setMounted(true), []);

  const currentCardMatches = useMemo(() => {
    const query = normalizeCardSearchText(currentCardQuery.trim());
    if (!query) return CURATED_CARDS;
    return CLIENT_CARD_OPTIONS.map((card) => ({
      card,
      score: cardMatchScore(card, query),
    }))
      .filter((item) => item.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.card.popularityRank - b.card.popularityRank ||
          a.card.name.localeCompare(b.card.name, "pt-BR")
      )
      .map((item) => item.card)
      .slice(0, 7);
  }, [currentCardQuery]);

  if (!mounted) return <div className="fixed inset-0 z-50 bg-background" />;
  if (onboardingDone) return null;

  function goNext(n = 1) {
    setDir(n);
    setStep((s) => s + n);
  }
  function goBack() {
    setDir(-1);
    setStep((s) => s - 1);
  }

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

  function submit() {
    const salaryNum = parseBrlInput(salary);
    const isCostBenefit = rewards.has("cost_benefit") || rewards.size === 0;
    setProfile({
      monthlySalaryBrl: salaryNum,
      avgMonthlySpendBrl: parseBrlInput(spend) || salaryNum * 0.4,
      avgInvestedBrl: parseBrlInput(invested),
      currentPrimaryCardId: currentCardId,
      currentPrimaryCardName: currentCardQuery.trim() || undefined,
      travelFrequency: travel,
      spendingCategories: [],
      preferences: {
        prefersCashback: !isCostBenefit && rewards.has("cashback"),
        prefersPoints: !isCostBenefit && rewards.has("points"),
        prefersInvestback: false,
        wantsLounge: !isCostBenefit && rewards.has("lounge"),
      },
    });
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        ) : (
          <BrandWordmark />
        )}

        <div className="flex items-center gap-4">
          {step > 0 && (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-[3px] rounded-full transition-all duration-300",
                    i <= step ? "w-5 bg-foreground" : "w-2 bg-muted-foreground/20"
                  )}
                />
              ))}
            </div>
          )}
          <button
            onClick={skipOnboarding}
            className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            Pular
          </button>
        </div>
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-center justify-center px-4 py-4 sm:px-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {step === 0 && <StepWelcome onStart={() => goNext(1)} onSkip={skipOnboarding} />}
              {step === 1 && (
                <StepInput
                  question="Renda mensal?"
                  hint="Para identificar cartões elegíveis."
                  value={salary}
                  onChange={setSalary}
                  onNext={() => goNext(1)}
                  nextDisabled={!salary}
                />
              )}
              {step === 2 && (
                <StepInput
                  question="Gasto mensal no cartão?"
                  hint="Calculamos se a anuidade se paga."
                  value={spend}
                  onChange={setSpend}
                  onNext={() => goNext(1)}
                  optional
                />
              )}
              {step === 3 && (
                <StepInput
                  question="Patrimônio investido?"
                  hint="Alguns cartões exigem investimento mínimo."
                  value={invested}
                  onChange={setInvested}
                  onNext={() => goNext(1)}
                  optional
                />
              )}
              {step === 4 && (
                <StepCurrentCard
                  value={currentCardQuery}
                  selectedId={currentCardId}
                  matches={currentCardMatches}
                  onChange={(value) => {
                    setCurrentCardQuery(value);
                    setCurrentCardId(undefined);
                  }}
                  onSelect={(card) => {
                    setCurrentCardQuery(card.name);
                    setCurrentCardId(card.id);
                  }}
                  onNext={() => goNext(1)}
                />
              )}
              {step === 5 && (
                <StepPreferences
                  rewards={rewards}
                  travel={travel}
                  onToggleReward={toggleReward}
                  onSetTravel={setTravel}
                  onSubmit={submit}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Welcome ─── */
function StepWelcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-semibold leading-none sm:text-[2.75rem]">
        <motion.span
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="block"
        >
          {HEADLINE}
        </motion.span>
      </h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          5 perguntas para calcular seu ranking.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onStart}
            className="flex items-center justify-between rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Começar
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onSkip}
            className="rounded-xl border border-border/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            Ver catálogo sem personalizar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Input step ─── */
function StepInput({
  question,
  hint,
  value,
  onChange,
  onNext,
  nextDisabled,
  optional,
}: {
  question: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  nextDisabled?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold sm:text-3xl">{question}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>

      <div className="flex items-baseline gap-2 border-b border-border pb-2">
        <span className="text-lg text-muted-foreground">R$</span>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(formatBrlInput(e.target.value))}
          placeholder="0"
          onKeyDown={(e) => e.key === "Enter" && !nextDisabled && onNext()}
          className="w-full min-w-0 bg-transparent text-2xl font-semibold placeholder:text-muted-foreground/20 focus:outline-none sm:text-3xl"
        />
      </div>

      <div className="flex items-center justify-between">
        {optional && (
          <span className="text-xs text-muted-foreground/50">Opcional</span>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
            nextDisabled
              ? "text-muted-foreground/30"
              : "bg-foreground text-background hover:opacity-90"
          )}
        >
          Continuar
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Current card step ─── */
function StepCurrentCard({
  value,
  selectedId,
  matches,
  onChange,
  onSelect,
  onNext,
}: {
  value: string;
  selectedId?: string;
  matches: typeof CLIENT_CARD_OPTIONS;
  onChange: (value: string) => void;
  onSelect: (card: (typeof CLIENT_CARD_OPTIONS)[number]) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Qual cartão você usa hoje?
        </h2>
        <p className="text-sm text-muted-foreground">
          Isso ajuda a comparar troca real, não só ranking abstrato.
        </p>
      </div>

      <div className="space-y-3">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ex: Nubank Ultravioleta"
          className="w-full rounded-2xl border bg-card/70 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/60"
        />
        {!value && (
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            Mais comuns
          </p>
        )}
        <div className="max-h-[min(22rem,42vh)] space-y-1.5 overflow-y-auto pr-1">
          {matches.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2 text-left text-xs transition-all hover:translate-x-0.5",
                selectedId === card.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/50 bg-card/45 text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground"
              )}
            >
              <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-zinc-950">
                {card.artUrl && card.artUrl !== "unknown" ? (
                  <img
                    src={card.artUrl}
                    alt={card.altText || card.name}
                    className="max-h-8 max-w-[56px] object-contain drop-shadow-xl transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{card.name}</span>
                <span className="block truncate text-[10px] opacity-70">
                  {card.description ?? card.issuer}
                </span>
              </span>
              {selectedId === card.id && (
                <span className="rounded-full border border-current px-2 py-0.5 font-mono text-[9px]">
                  Atual
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground/50">Opcional</span>
        <button
          onClick={onNext}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Continuar
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Preferences step ─── */
function StepPreferences({
  rewards,
  travel,
  onToggleReward,
  onSetTravel,
  onSubmit,
}: {
  rewards: Set<RewardPref>;
  travel: TravelFrequency;
  onToggleReward: (r: RewardPref) => void;
  onSetTravel: (t: TravelFrequency) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold sm:text-3xl">O que você quer?</h2>
        <p className="text-sm text-muted-foreground">Pode selecionar mais de um.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {REWARD_OPTIONS.map(({ value, label }) => (
            <Chip
              key={value}
              active={rewards.has(value)}
              onClick={() => onToggleReward(value)}
            >
              {label}
            </Chip>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Viagens</p>
          <div className="flex flex-wrap gap-1.5">
            {TRAVEL_OPTIONS.map(({ value, label }) => (
              <Chip
                key={value}
                active={travel === value}
                onClick={() => onSetTravel(value)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onSubmit}
        className="flex w-full items-center justify-between rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Ver meu ranking
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Chip ─── */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
