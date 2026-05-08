"use client";

import { useState } from "react";
import { useProfileStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { UserProfile } from "@/types/cards";
import { cn } from "@/lib/utils";
import { formatBrlInput, parseBrlInput } from "@/lib/brl";

type TravelFrequency = UserProfile["travelFrequency"];
type RewardPref = "cashback" | "points" | "lounge";

const TRAVEL_OPTIONS: { value: TravelFrequency; label: string }[] = [
  { value: "none", label: "Não viajo" },
  { value: "occasional", label: "Às vezes" },
  { value: "frequent", label: "Frequente" },
];

const REWARD_OPTIONS: { value: RewardPref; label: string }[] = [
  { value: "cashback", label: "Cashback" },
  { value: "points", label: "Pontos/milhas" },
  { value: "lounge", label: "Lounge" },
];

export function ProfileQuickSetup() {
  const setProfile = useProfileStore((s) => s.setProfile);

  const [salary, setSalary] = useState("");
  const [spend, setSpend] = useState("");
  const [invested, setInvested] = useState("");
  const [travel, setTravel] = useState<TravelFrequency>("none");
  const [rewards, setRewards] = useState<Set<RewardPref>>(new Set());

  function toggleReward(r: RewardPref) {
    setRewards((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salaryNum = parseBrlInput(salary);
    const spendNum = parseBrlInput(spend);
    const investedNum = parseBrlInput(invested);

    setProfile({
      monthlySalaryBrl: salaryNum,
      avgMonthlySpendBrl: spendNum,
      avgInvestedBrl: investedNum,
      travelFrequency: travel,
      spendingCategories: [],
      preferences: {
        prefersCashback: rewards.has("cashback"),
        prefersPoints: rewards.has("points"),
        prefersInvestback: false,
        wantsLounge: rewards.has("lounge"),
      },
    });
  }

  return (
    <div className="rounded-3xl border bg-card/60 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Configure seu perfil</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Preencha abaixo para ver o ranking personalizado e sua jornada de cartões.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Renda mensal" placeholder="Ex: 5000">
            <CurrencyInput value={salary} onChange={setSalary} />
          </Field>
          <Field label="Gasto mensal no cartão" placeholder="Ex: 2000">
            <CurrencyInput value={spend} onChange={setSpend} />
          </Field>
          <Field label="Total investido" placeholder="Ex: 50000">
            <CurrencyInput value={invested} onChange={setInvested} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Prefere</p>
          <div className="flex flex-wrap gap-2">
            {REWARD_OPTIONS.map(({ value, label }) => (
              <ToggleChip
                key={value}
                active={rewards.has(value)}
                onClick={() => toggleReward(value)}
              >
                {label}
              </ToggleChip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Viagens</p>
          <div className="flex gap-2">
            {TRAVEL_OPTIONS.map(({ value, label }) => (
              <ToggleChip
                key={value}
                active={travel === value}
                onClick={() => setTravel(value)}
              >
                {label}
              </ToggleChip>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          disabled={!salary}
          className="gap-2"
          size="sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ver meu ranking personalizado
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  placeholder,
  children,
}: {
  label: string;
  placeholder?: string;
  children: React.ReactNode;
}) {
  void placeholder;
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatBrlInput(e.target.value))}
        className="w-full rounded-lg border border-input bg-background py-2 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="0"
      />
    </div>
  );
}

function ToggleChip({
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
        "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
