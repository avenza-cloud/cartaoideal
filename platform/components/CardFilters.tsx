"use client";

import { useMemo } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const NETWORKS = ["Visa", "Mastercard", "American Express", "Elo", "Hipercard"];

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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Buscar
        </p>
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ordenação
        </p>
        <div className="grid grid-cols-2 rounded-lg border bg-background/40 p-1">
          {RANKING_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              title={mode.title}
              onClick={() => update({ rank: mode.value })}
              className={cn(
                "rounded-md px-2 py-1.5 text-center text-xs transition-colors",
                active.rank === mode.value
                  ? "bg-primary font-medium text-primary-foreground"
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Segmento
        </p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              onClick={() => update({ segment: s.value })}
              className={cn(
                "rounded px-2 py-1.5 text-left text-sm transition-colors",
                active.segment === s.value
                  ? "bg-primary font-medium text-primary-foreground"
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bandeira
        </p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
          {NETWORKS.map((n) => (
            <button
              key={n}
              onClick={() => update({ network: active.network === n ? "" : n })}
              className={cn(
                "rounded px-2 py-1.5 text-left text-sm transition-colors",
                active.network === n
                  ? "bg-primary font-medium text-primary-foreground"
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Benefícios
        </p>
        <div className="flex flex-wrap gap-1.5">
          {booleanFilters.map((f) => (
            <Badge
              key={f.key}
              variant={active[f.key] ? "default" : "outline"}
              className="min-h-7 cursor-pointer whitespace-normal text-xs"
              onClick={() => update({ [f.key]: !active[f.key] })}
            >
              {f.label}
            </Badge>
          ))}
        </div>
      </div>

      {totalFiltered < totalAll && (
        <p className="text-xs text-muted-foreground">
          {totalFiltered} de {totalAll} cartões
        </p>
      )}
    </>
  );

  return (
    <aside className="w-full shrink-0 md:sticky md:top-[73px] md:max-h-[calc(100vh-88px)] md:w-52 md:overflow-y-auto">
      <details className="rounded-xl border bg-card/50 p-3 md:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium">Filtros</summary>
        <div className="mt-3 space-y-4">{content}</div>
      </details>
      <div className="hidden space-y-4 rounded-xl border bg-card/50 p-3 md:block">{content}</div>
    </aside>
  );
}
