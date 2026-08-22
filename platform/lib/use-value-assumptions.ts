"use client";

import { useEffect, useState } from "react";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";
import type { CardValueAssumptions } from "@/types/cards";

export function useValueAssumptions(): CardValueAssumptions {
  const [assumptions, setAssumptions] = useState<CardValueAssumptions>(
    DEFAULT_VALUE_ASSUMPTIONS
  );

  useEffect(() => {
    let cancelled = false;
    async function loadRate() {
      try {
        const response = await fetch("/api/exchange-rate", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const usdBrl = Number(data?.usdBrl);
        if (!Number.isFinite(usdBrl) || usdBrl <= 0 || cancelled) return;
        setAssumptions((current) => ({ ...current, ptaxBrlPerUsd: usdBrl }));
      } catch {
        // Keep deterministic fallback from DEFAULT_VALUE_ASSUMPTIONS.
      }
    }
    loadRate();
    return () => {
      cancelled = true;
    };
  }, []);

  return assumptions;
}
