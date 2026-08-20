export function parseBrlInput(value: string): number {
  return Number.parseFloat(value.replaceAll(".", "").replace(",", ".")) || 0;
}

/** Converte texto de valor (ex.: "1.234,56") para número. Retorna null se inválido. */
export function parseBrlNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
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

export function formatBrlCurrency(value: number): string {
  return `R$${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
