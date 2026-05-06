"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { value: "", label: "Todos" },
  { value: "mass_or_general", label: "Geral" },
  { value: "upper_mass", label: "Intermediário" },
  { value: "premium", label: "Premium" },
  { value: "ultra_premium", label: "Ultra Premium" },
];

const NETWORKS = ["Visa", "Mastercard", "American Express", "Elo", "Hipercard"];

const BOOLEAN_FILTERS = [
  { key: "lounge", label: "Lounge" },
  { key: "rewardReturn", label: "Retorno financeiro" },
  { key: "points", label: "Pontos/Milhas" },
  { key: "zeroFee", label: "Sem anuidade" },
];

export function CardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/cartoes?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const toggle = useCallback(
    (key: string) => {
      const current = searchParams.get(key);
      setParam(key, current === "true" ? null : "true");
    },
    [searchParams, setParam]
  );

  return (
    <aside className="w-full shrink-0 space-y-4 rounded-2xl border bg-card/50 p-3 md:sticky md:top-[73px] md:max-h-[calc(100vh-88px)] md:w-52 md:overflow-y-auto">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Segmento
        </p>
        <div className="flex flex-col gap-1">
          {SEGMENTS.map((s) => {
            const active = (searchParams.get("segment") ?? "") === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setParam("segment", s.value || null)}
                className={cn(
                  "text-left text-sm px-2 py-1 rounded transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Bandeira
        </p>
        <div className="flex flex-col gap-1">
          {NETWORKS.map((n) => {
            const active = searchParams.get("network") === n;
            return (
              <button
                key={n}
                onClick={() => setParam("network", active ? null : n)}
                className={cn(
                  "text-left text-sm px-2 py-1 rounded transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Benefícios
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BOOLEAN_FILTERS.map((f) => {
            const active = searchParams.get(f.key) === "true";
            return (
              <Badge
                key={f.key}
                variant={active ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggle(f.key)}
              >
                {f.label}
              </Badge>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
