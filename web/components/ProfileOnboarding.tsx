"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/lib/store";
import { searchCardOptions, type ClientCardOption } from "@/lib/card-options";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { CardArt } from "@/components/card";
import { Button } from "@/components/ui/button";
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
const TOTAL_STEPS = 5;

export interface ProfileOnboardingProps {
  /** Slim card options built server-side (lib/card-options.server.ts). */
  cardOptions: ClientCardOption[];
  curatedOptions: ClientCardOption[];
}

export function ProfileOnboarding({ cardOptions, curatedOptions }: ProfileOnboardingProps) {
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

  const currentCardMatches = useMemo(
    () => searchCardOptions(cardOptions, curatedOptions, currentCardQuery, 7),
    [cardOptions, curatedOptions, currentCardQuery]
  );

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
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden bg-background">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        ) : (
          <BrandWordmark />
        )}

        <div className="flex items-center gap-4">
          {step > 0 && (
            <span className="num text-xs text-muted-foreground">
              {step} de {TOTAL_STEPS}
            </span>
          )}
          <button
            type="button"
            onClick={skipOnboarding}
            className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Pular
          </button>
        </div>
      </div>

      {/* Progress: a real sequence, so a thin bar */}
      <div
        className="h-0.5 w-full shrink-0 bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
      >
        <div
          className="h-full bg-foreground transition-[width] duration-150"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full min-w-0 max-w-sm">
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
function StepWelcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-medium sm:text-5xl">{HEADLINE}</h1>
        <p className="text-sm text-muted-foreground">5 perguntas para calcular seu ranking.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button type="button" size="lg" onClick={onStart} className="w-full justify-between">
          Começar
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onSkip}
          className="h-auto min-h-10 w-full whitespace-normal py-2"
        >
          Ver catálogo sem personalizar
        </Button>
      </div>
    </div>
  );
}

/* ─── Step heading ─── */
function StepHeading({ question, hint }: { question: string; hint: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-medium">{question}</h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ─── Step footer ─── */
function StepFooter({
  optional,
  onNext,
  nextDisabled,
}: {
  optional?: boolean;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {optional && <span className="text-xs text-muted-foreground">Opcional</span>}
      <Button type="button" size="lg" onClick={onNext} disabled={nextDisabled} className="ml-auto">
        Continuar
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
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
      <StepHeading question={question} hint={hint} />

      <div className="flex items-baseline gap-2 border-b border-input pb-2 transition-colors duration-150 focus-within:border-foreground">
        <span className="text-xl text-muted-foreground">R$</span>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(formatBrlInput(e.target.value))}
          placeholder="0"
          onKeyDown={(e) => e.key === "Enter" && !nextDisabled && onNext()}
          className="num w-full min-w-0 bg-transparent text-3xl font-medium outline-none placeholder:text-muted-foreground"
        />
      </div>

      <StepFooter optional={optional} onNext={onNext} nextDisabled={nextDisabled} />
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
  matches: ClientCardOption[];
  onChange: (value: string) => void;
  onSelect: (card: ClientCardOption) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeading
        question="Qual cartão você usa hoje?"
        hint="Isso ajuda a comparar troca real, não só ranking abstrato."
      />

      <div className="space-y-2">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ex: Nubank Ultravioleta"
          className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-ring md:text-sm"
        />
        {!value && <p className="pt-1 text-xs text-muted-foreground">Mais comuns</p>}
        {matches.length > 0 && (
          <div className="max-h-[min(22rem,42vh)] divide-y overflow-y-auto rounded-md border bg-card">
            {matches.map((card) => {
              const selected = selectedId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150",
                    selected ? "bg-foreground text-background" : "hover:bg-muted"
                  )}
                >
                  <CardArt
                    compact
                    artUrl={card.artUrl}
                    issuerRaw={card.issuer}
                    displayName={card.name}
                    className="h-10 w-16"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{card.name}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        selected ? "text-background" : "text-muted-foreground"
                      )}
                    >
                      {card.description ?? card.issuer}
                    </span>
                  </span>
                  {selected && (
                    <span className="shrink-0 rounded-sm border border-background px-1.5 py-0.5 text-2xs">
                      Atual
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <StepFooter optional onNext={onNext} />
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
    <div className="space-y-6">
      <StepHeading question="O que você quer?" hint="Pode selecionar mais de um." />

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {REWARD_OPTIONS.map(({ value, label }) => (
            <Chip key={value} active={rewards.has(value)} onClick={() => onToggleReward(value)}>
              {label}
            </Chip>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Viagens</p>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_OPTIONS.map(({ value, label }) => (
              <Chip key={value} active={travel === value} onClick={() => onSetTravel(value)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="mark"
        size="lg"
        onClick={onSubmit}
        className="w-full justify-between"
      >
        Ver meu ranking
        <ArrowRight className="h-4 w-4" />
      </Button>
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
      aria-pressed={active}
      className={cn(
        "h-9 rounded-md border px-3 text-sm font-medium transition-colors duration-150",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-input bg-card text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
