import "server-only";
import type { CardValueAssumptions } from "@/types/cards";
import { DEFAULT_VALUE_ASSUMPTIONS } from "@/lib/card-value";

const FALLBACK_USD_BRL = DEFAULT_VALUE_ASSUMPTIONS.ptaxBrlPerUsd;
const ONE_HOUR_SECONDS = 60 * 60;
const ONE_HOUR_MS = ONE_HOUR_SECONDS * 1000;

export type ExchangeRateSource =
  | "awesomeapi"
  | "open-er-api"
  | "frankfurter"
  | "currency-api"
  | "fallback";

export interface ExchangeRateResult {
  usdBrl: number;
  source: ExchangeRateSource;
  fetchedAt: string;
}

interface ProviderSpec {
  source: Exclude<ExchangeRateSource, "fallback">;
  url: string;
  extract: (data: unknown) => number;
}

const PROVIDERS: ProviderSpec[] = [
  {
    source: "awesomeapi",
    url: "https://economia.awesomeapi.com.br/json/last/USD-BRL",
    extract: (data) => Number((data as { USDBRL?: { bid?: unknown } })?.USDBRL?.bid),
  },
  {
    source: "open-er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    extract: (data) => Number((data as { rates?: { BRL?: unknown } })?.rates?.BRL),
  },
  {
    source: "frankfurter",
    url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL",
    extract: (data) => Number((data as { rates?: { BRL?: unknown } })?.rates?.BRL),
  },
  {
    source: "currency-api",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    extract: (data) => Number((data as { usd?: { brl?: unknown } })?.usd?.brl),
  },
];

let memoryCache: { result: ExchangeRateResult; expiresAt: number } | null = null;

export async function getUsdBrlExchangeRate(): Promise<ExchangeRateResult> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.result;
  }

  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(provider.url, {
        next: { revalidate: ONE_HOUR_SECONDS },
        headers: {
          Accept: "application/json",
          "User-Agent": "cartaoideal/1.0 (+https://card.avenza.cloud)",
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const rawRate = provider.extract(data);
      if (!Number.isFinite(rawRate) || rawRate <= 2 || rawRate >= 15) continue;

      const result: ExchangeRateResult = {
        usdBrl: Math.round(rawRate * 10000) / 10000,
        source: provider.source,
        fetchedAt: new Date().toISOString(),
      };
      memoryCache = { result, expiresAt: now + ONE_HOUR_MS };
      return result;
    } catch {
      // Try next provider in chain
    }
  }

  return {
    usdBrl: FALLBACK_USD_BRL,
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  };
}

export async function getValueAssumptionsWithLiveUsd(): Promise<CardValueAssumptions> {
  const rate = await getUsdBrlExchangeRate();
  return {
    ...DEFAULT_VALUE_ASSUMPTIONS,
    ptaxBrlPerUsd: rate.usdBrl,
  };
}
