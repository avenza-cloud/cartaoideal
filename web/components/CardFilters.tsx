"use client";

import { useMemo } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      { key: "lounge" as const, label: "Sala VIP" },
      {
        key: "rewardReturn" as const,
        label: prefersCashbackLens ? "Cashback" : "Retorno financeiro",
      },
      { key: "points" as const, label: "Pontos/Milhas" },
      { key: "zeroFee" as const, label: "Sem anuidade" },
    ];
  }, [profile]);

  const activeCount = [
    active.segment,
    active.network,
    active.lounge,
    active.rewardReturn,
    active.points,
    active.zeroFee,
    active.search,
  ].filter(Boolean).length;

  const content = (
    <>
      <div>
        <label htmlFor="catalog-search" className="mb-2 block text-xs font-semibold text-fg">
          Buscar
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          <Input
            id="catalog-search"
            value={active.search}
            onChange={(e) => update({ search: e.target.value }, true)}
            placeholder="Nome, emissor ou bandeira"
            className="pl-9 pr-9"
          />
          {active.search && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={() => update({ search: "" })}
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-fg">Ordenação</p>
        <div className="grid grid-cols-2 gap-0.5 rounded-full bg-surface-2 p-1">
          {RANKING_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              title={mode.title}
              aria-pressed={active.rank === mode.value}
              onClick={() => update({ rank: mode.value })}
              className={cn(
                "h-8 rounded-full px-2.5 text-center text-xs font-medium transition-colors duration-100",
                active.rank === mode.value
                  ? "bg-raised font-semibold text-fg shadow-card"
                  : "text-fg-2 hover:text-fg"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-fg">Segmento</p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col md:gap-0.5">
          {SEGMENTS.map((s) => (
            <button
              type="button"
              key={s.value}
              aria-pressed={active.segment === s.value}
              onClick={() => update({ segment: s.value })}
              className={cn(
                "flex min-h-9 items-center justify-between rounded-lg px-2.5 text-left text-sm transition-colors duration-100",
                active.segment === s.value
                  ? "bg-brand-wash font-semibold text-fg"
                  : "text-fg-2 hover:bg-surface-2 hover:text-fg"
              )}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-fg">Bandeira</p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col md:gap-0.5">
          {NETWORKS.map((n) => (
            <button
              type="button"
              key={n}
              aria-pressed={active.network === n}
              onClick={() => update({ network: active.network === n ? "" : n })}
              className={cn(
                "flex min-h-9 items-center justify-between rounded-lg px-2.5 text-left text-sm transition-colors duration-100",
                active.network === n
                  ? "bg-brand-wash font-semibold text-fg"
                  : "text-fg-2 hover:bg-surface-2 hover:text-fg"
              )}
            >
              <span>{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-fg">Benefícios</p>
        <div className="flex flex-wrap gap-1.5">
          {booleanFilters.map((f) => (
            <button
              type="button"
              key={f.key}
              aria-pressed={active[f.key]}
              onClick={() => update({ [f.key]: !active[f.key] })}
              className={cn(
                "min-h-8 rounded-full border px-3 py-1 text-left text-xs font-medium transition-colors duration-100 active:scale-[0.98]",
                active[f.key]
                  ? "border-primary bg-primary text-on-accent"
                  : "border-line-strong bg-page text-fg hover:bg-surface-2"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-fg-3">
        <span className="num">
          {totalFiltered} de {totalAll} cartões
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              update({
                segment: "",
                network: "",
                lounge: false,
                rewardReturn: false,
                points: false,
                zeroFee: false,
                search: "",
              })
            }
            className="font-medium text-brand-accent hover:underline"
          >
            Limpar
          </button>
        )}
      </div>
    </>
  );

  return (
    <aside className="w-full shrink-0 px-4 pt-4 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:w-[264px] md:overflow-y-auto md:border-r md:border-line md:bg-surface md:px-4 md:py-5">
      <details className="group rounded-panel bg-surface p-3.5 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-fg">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-fg-2" />
            Filtros
            {activeCount > 0 && (
              <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-wash px-1.5 text-xs font-semibold text-brand-accent">
                {activeCount}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-fg-3 transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-5 border-t border-line pt-4">{content}</div>
      </details>

      <div className="hidden space-y-5 md:block">{content}</div>
    </aside>
  );
}
