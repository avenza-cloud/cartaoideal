export function parseBrlInput(value: string): number {
  return Number.parseFloat(value.replaceAll(".", "").replace(",", ".")) || 0;
}

export function formatBrlInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("pt-BR");
}

export function formatBrlNumber(value: number): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
