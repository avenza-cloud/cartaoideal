"use client";

import { useEffect, useState } from "react";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";
import { parseUsdBrl } from "@/lib/usd-brl";
import type { CardValueAssumptions } from "@/types/cards";

const ONE_HOUR_MS = 60 * 60 * 1000;

let clientRateCache: { usdBrl: number; expiresAt: number } | null = null;
let inflightPromise: Promise<number | null> | null = null;

async function fetchHourlyUsdBrl(): Promise<number | null> {
  const now = Date.now();
  if (clientRateCache && clientRateCache.expiresAt > now) {
    return clientRateCache.usdBrl;
  }
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const response = await fetch("/api/exchange-rate");
      if (!response.ok) return null;
      const payload = (await response.json()) as { usdBrl?: unknown; source?: string };
      const usdBrl = parseUsdBrl(payload);
      if (usdBrl === null) return null;
      if (payload.source !== "fallback") {
        clientRateCache = { usdBrl, expiresAt: Date.now() + ONE_HOUR_MS };
      }
      return usdBrl;
    } catch {
      return null;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

export function useValueAssumptions(): CardValueAssumptions {
  const [assumptions, setAssumptions] = useState<CardValueAssumptions>(() =>
    clientRateCache && clientRateCache.expiresAt > Date.now()
      ? { ...DEFAULT_VALUE_ASSUMPTIONS, ptaxBrlPerUsd: clientRateCache.usdBrl }
      : DEFAULT_VALUE_ASSUMPTIONS
  );

  useEffect(() => {
    let cancelled = false;
    async function loadRate() {
      const usdBrl = await fetchHourlyUsdBrl();
      if (usdBrl === null || cancelled) return;
      setAssumptions((current) =>
        current.ptaxBrlPerUsd === usdBrl ? current : { ...current, ptaxBrlPerUsd: usdBrl }
      );
    }
    loadRate();
    const interval = setInterval(loadRate, ONE_HOUR_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return assumptions;
}
