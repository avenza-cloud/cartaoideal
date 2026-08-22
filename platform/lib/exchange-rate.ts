import "server-only";
import type { CardValueAssumptions } from "@/types/cards";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";

const FALLBACK_USD_BRL = DEFAULT_VALUE_ASSUMPTIONS.ptaxBrlPerUsd;
const AWESOME_API_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

export interface ExchangeRateResult {
  usdBrl: number;
  source: "awesomeapi" | "fallback";
  fetchedAt: string;
}

export async function getUsdBrlExchangeRate(): Promise<ExchangeRateResult> {
  try {
    const response = await fetch(AWESOME_API_URL, {
      next: { revalidate: 60 * 30 },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`exchange api status ${response.status}`);
    const data = await response.json();
    const bid = Number(data?.USDBRL?.bid);
    if (!Number.isFinite(bid) || bid <= 0) throw new Error("invalid USD-BRL bid");
    return {
      usdBrl: Math.round(bid * 10000) / 10000,
      source: "awesomeapi",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      usdBrl: FALLBACK_USD_BRL,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
    };
  }
}

export async function getValueAssumptionsWithLiveUsd(): Promise<CardValueAssumptions> {
  const rate = await getUsdBrlExchangeRate();
  return {
    ...DEFAULT_VALUE_ASSUMPTIONS,
    ptaxBrlPerUsd: rate.usdBrl,
  };
}
