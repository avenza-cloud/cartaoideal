"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const RANKING_MODES = [
  { value: "profile", label: "Seu perfil", title: "Ordenar pelo seu perfil" },
  { value: "general", label: "Geral", title: "Ordenar pelo ranking geral" },
];

export function CardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamValue = searchParams.get("search") ?? "";
  const [searchValue, setSearchValue] = useState(searchParamValue);

  useEffect(() => {
    setSearchValue((current) =>
      current === searchParamValue ? current : searchParamValue
    );
  }, [searchParamValue]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const url = params.toString() ? `/cartoes?${params.toString()}` : "/cartoes";
      router.replace(url, { scroll: false });
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

  useEffect(() => {
    const nextSearch = searchValue.trim();
    if (nextSearch === searchParamValue) return;

    const handle = window.setTimeout(() => {
      setParam("search", nextSearch || null);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [searchParamValue, searchValue, setParam]);

  const content = (
    <>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Buscar
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Nome, emissor ou bandeira"
            className="pl-8 pr-8"
          />
          {searchValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1 top-1"
              onClick={() => {
                setSearchValue("");
                if (searchParamValue) {
                  setParam("search", null);
                }
              }}
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
          {RANKING_MODES.map((mode) => {
            const active = (searchParams.get("rank") ?? "profile") === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                title={mode.title}
                onClick={() => setParam("rank", mode.value === "profile" ? null : mode.value)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-center text-xs transition-colors",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Segmento
        </p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
          {SEGMENTS.map((s) => {
            const active = (searchParams.get("segment") ?? "") === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setParam("segment", s.value || null)}
                className={cn(
                  "rounded px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bandeira
        </p>
        <div className="grid grid-cols-2 gap-1 md:flex md:flex-col">
          {NETWORKS.map((n) => {
            const active = searchParams.get("network") === n;
            return (
              <button
                key={n}
                onClick={() => setParam("network", active ? null : n)}
                className={cn(
                  "rounded px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Benefícios
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BOOLEAN_FILTERS.map((f) => {
            const active = searchParams.get(f.key) === "true";
            return (
              <Badge
                key={f.key}
                variant={active ? "default" : "outline"}
                className="min-h-7 cursor-pointer whitespace-normal text-xs"
                onClick={() => toggle(f.key)}
              >
                {f.label}
              </Badge>
            );
          })}
        </div>
      </div>
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
