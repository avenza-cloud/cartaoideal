"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/lib/store";
import { searchCardOptions, type ClientCardOption } from "@/lib/card-options";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { CardArt, Tag } from "@/components/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { BrandWordmark } from "@/components/BrandWordmark";
import type { UserProfile } from "@/types/cards";
import { cn } from "@/lib/utils";
import { formatBrlInput, parseBrlInput } from "@/lib/brl";

type TravelFrequency = UserProfile["travelFrequency"];
type RewardPref = "cost_benefit" | "cashback" | "points" | "lounge" | "travel";

const REWARD_OPTIONS: { value: RewardPref; label: string }[] = [
  { value: "cost_benefit", label: "Melhor custo-benefício" },
  { value: "cashback", label: "Cashback" },
  { value: "points", label: "Pontos e milhas" },
  { value: "lounge", label: "Sala VIP" },
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

  if (!mounted) return <div className="fixed inset-0 z-50 bg-page" />;
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
    enter: (d: number) => ({ x: d > 0 ? 24 : -24, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -24 : 24, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden bg-page">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 px-4 sm:px-7">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-fg-2 transition-colors duration-100 hover:bg-surface hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        ) : (
          <div className="inline-flex items-center gap-2.5">
            <BrandMark className="h-5 w-6" />
            <BrandWordmark />
          </div>
        )}

        <div className="flex items-center gap-4">
          {step > 0 && (
            <span className="num text-xs font-medium text-fg-3">
              {step} de {TOTAL_STEPS}
            </span>
          )}
          <button
            type="button"
            onClick={skipOnboarding}
            className="h-9 rounded-full px-3 text-sm font-medium text-fg-2 transition-colors duration-100 hover:bg-surface hover:text-fg"
          >
            Pular
          </button>
        </div>
      </div>

      {/* Progress bar in Vermelho Avenza */}
      <div
        className="h-0.5 w-full shrink-0 bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
      >
        <div
          className="h-full bg-brand transition-[width] duration-200 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full min-w-0 max-w-md">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && <StepWelcome onStart={() => goNext(1)} onSkip={skipOnboarding} />}
              {step === 1 && (
                <StepInput
                  question="Renda mensal?"
                  hint="Usamos para identificar cartões elegíveis ao seu perfil."
                  value={salary}
                  onChange={setSalary}
                  onNext={() => goNext(1)}
                  nextDisabled={!salary}
                />
              )}
              {step === 2 && (
                <StepInput
                  question="Gasto mensal no cartão?"
                  hint="Calculamos retorno líquido e se a anuidade se paga."
                  value={spend}
                  onChange={setSpend}
                  onNext={() => goNext(1)}
                  optional
                />
              )}
              {step === 3 && (
                <StepInput
                  question="Patrimônio investido?"
                  hint="Alguns cartões liberam elegibilidade ou isenção por custódia."
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
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-5xl">{HEADLINE}</h1>
        <p className="text-base leading-relaxed text-fg-2">
          5 perguntas rápidas para calcular o valor líquido real dos cartões brasileiros para o seu
          perfil.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <Button type="button" size="lg" onClick={onStart} className="w-full justify-between">
          Começar
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onSkip}
          className="w-full whitespace-normal"
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
      <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{question}</h2>
      <p className="text-sm leading-relaxed text-fg-2">{hint}</p>
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
      {optional && <span className="text-xs font-medium text-fg-3">Opcional</span>}
      <Button type="button" size="lg" onClick={onNext} disabled={nextDisabled} className="ml-auto">
        Continuar
        <ArrowRight className="h-4 w-4" />
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

      <div className="flex items-baseline gap-2.5 border-b-2 border-line-strong pb-2.5 transition-colors duration-100 focus-within:border-fg">
        <span className="text-xl font-medium text-fg-3">R$</span>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(formatBrlInput(e.target.value))}
          placeholder="0"
          aria-label={question}
          onKeyDown={(e) => e.key === "Enter" && !nextDisabled && onNext()}
          className="num w-full min-w-0 bg-transparent text-3xl font-semibold text-fg outline-none placeholder:text-fg-disabled"
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

      <div className="space-y-2.5">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ex: Nubank Ultravioleta"
          aria-label="Buscar seu cartão atual"
          className="h-10 w-full min-w-0 rounded-field border border-line-strong bg-field px-3.5 text-base text-fg transition-colors duration-100 placeholder:text-fg-3 focus-visible:border-accent-line md:text-sm"
        />
        {!value && <p className="pt-1 text-xs font-medium text-fg-3">Mais comuns</p>}
        {matches.length > 0 && (
          <div className="max-h-[min(22rem,42vh)] divide-y divide-line overflow-y-auto rounded-panel border border-line bg-raised">
            {matches.map((card) => {
              const selected = selectedId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-100",
                    selected ? "bg-brand-wash" : "hover:bg-surface"
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
                    <span className="block truncate text-sm font-semibold text-fg">
                      {card.name}
                    </span>
                    <span className="block truncate text-xs text-fg-3">
                      {card.description ?? card.issuer}
                    </span>
                  </span>
                  {selected && <Tag variant="brand">Atual</Tag>}
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
    <div className="space-y-7">
      <StepHeading question="O que você prioriza?" hint="Pode selecionar mais de uma opção." />

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {REWARD_OPTIONS.map(({ value, label }) => (
            <Chip key={value} active={rewards.has(value)} onClick={() => onToggleReward(value)}>
              {label}
            </Chip>
          ))}
        </div>

        <div>
          <p className="mb-2.5 text-sm font-medium text-fg">Frequência de viagens</p>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_OPTIONS.map(({ value, label }) => (
              <Chip key={value} active={travel === value} onClick={() => onSetTravel(value)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <Button type="button" size="lg" onClick={onSubmit} className="w-full justify-between">
        Ver meu ranking
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Pill Toggle Chip ─── */
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
        "h-10 rounded-full border px-4 text-sm font-medium transition-colors duration-100 active:scale-[0.98]",
        active
          ? "border-primary bg-primary text-on-accent"
          : "border-line-strong bg-page text-fg hover:bg-surface"
      )}
    >
      {children}
    </button>
  );
}
