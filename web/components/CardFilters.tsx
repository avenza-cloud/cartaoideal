"use client";

import { useMemo } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useProfileStore } from "@/lib/store";

const SEGMENTS = [
  { value: "", label: "Todos" },
  { value: "mass_or_general", label: "Geral" },
  { value: "upper_mass", label: "Intermediário" },
  { value: "premium", label: "Premium" },
  { value: "ultra_premium", label: "Ultra Premium" },
];

// Keep in sync with CardNetworkSchema in lib/card-schema.ts (not imported to
// avoid pulling zod into this client chunk).
const NETWORKS = ["Visa", "Mastercard", "American Express", "Elo"];

const RANKING_MODES = [
  { value: "profile" as const, label: "Seu perfil", title: "Ordenar pelo seu perfil" },
  { value: "general" as const, label: "Geral", title: "Ordenar pelo ranking geral" },
];

interface ActiveFilters {
  segment: string;
  network: string;
  lounge: boolean;
  rewardReturn: boolean;
  points: boolean;
  zeroFee: boolean;
  search: string;
  rank: "profile" | "general";
}

interface CardFiltersProps {
  active: ActiveFilters;
  update: (patch: Partial<ActiveFilters>, isSearch?: boolean) => void;
  totalFiltered: number;
  totalAll: number;
}

export function CardFilters({ active, update, totalFiltered, totalAll }: CardFiltersProps) {
  const profile = useProfileStore((s) => s.profile);

  const booleanFilters = useMemo(() => {
    const prefersCashbackLens =
      !!profile &&
      (profile.preferences.prefersCashback || profile.preferences.prefersInvestback) &&
      !profile.preferences.prefersPoints;
    return [
      { key: "lounge" as const, label: "Lounge" },
      {
        key: "rewardReturn" as const,
        label: prefersCashbackLens ? "Cashback" : "Retorno financeiro",
      },
      { key: "points" as const, label: "Pontos/Milhas" },
      { key: "zeroFee" as const, label: "Sem anuidade" },
    ];
  }, [profile]);

  const content = (
    <>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Buscar</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={active.search}
            onChange={(e) => update({ search: e.target.value }, true)}
            placeholder="Nome, emissor ou bandeira"
            className="pl-8 pr-8"
          />
          {active.search && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1 top-1"
              onClick={() => update({ search: "" })}
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Ordenação</p>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border bg-card">
          {RANKING_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              title={mode.title}
              onClick={() => update({ rank: mode.value })}
              className={cn(
                "px-2 py-1.5 text-center text-xs transition-colors duration-150",
                active.rank === mode.value
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Segmento</p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
          {SEGMENTS.map((s) => (
            <button
              type="button"
              key={s.value}
              onClick={() => update({ segment: s.value })}
              className={cn(
                "rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150",
                active.segment === s.value
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Bandeira</p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
          {NETWORKS.map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => update({ network: active.network === n ? "" : n })}
              className={cn(
                "rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150",
                active.network === n
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Benefícios</p>
        <div className="flex flex-wrap gap-1.5">
          {booleanFilters.map((f) => (
            <button
              type="button"
              key={f.key}
              aria-pressed={active[f.key]}
              onClick={() => update({ [f.key]: !active[f.key] })}
              className={cn(
                "min-h-7 rounded-sm border px-2 py-1 text-left text-xs transition-colors duration-150",
                active[f.key]
                  ? "border-foreground bg-foreground font-medium text-background"
                  : "bg-card text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {totalFiltered < totalAll && (
        <p className="num text-xs text-muted-foreground">
          {totalFiltered} de {totalAll} cartões
        </p>
      )}
    </>
  );

  return (
    <aside className="w-full shrink-0 md:sticky md:top-[72px] md:max-h-[calc(100vh-88px)] md:w-52 md:overflow-y-auto">
      <details className="rounded-md border bg-card p-3 md:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium">Filtros</summary>
        <div className="mt-3 space-y-4">{content}</div>
      </details>
      <div className="hidden space-y-4 rounded-md border bg-card p-3 md:block">{content}</div>
    </aside>
  );
}
