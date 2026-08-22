/** Shared validation for USD/BRL payloads (client hook and server lib). */
export function parseUsdBrl(data: unknown): number | null {
  const usdBrl = Number((data as { usdBrl?: unknown } | null)?.usdBrl);
  if (!Number.isFinite(usdBrl) || usdBrl <= 0) return null;
  return usdBrl;
}
