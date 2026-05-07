/**
 * Extracts the investment-specific threshold (in BRL) from a fee waiver text.
 *
 * Uses three patterns to handle the different sentence structures found in real data:
 *   A) "R$ X mil em investimento(s)" — amount before keyword (most common)
 *   B) "investimento(s) … R$ X mil"  — amount after keyword (Safra, BTG, XP, etc.)
 *   C) "R$ X mil investidos"          — BTG Pactual-style
 *
 * Returns null if no investment clause is found (e.g. gasto-only waiver text).
 */
export function extractInvestmentThreshold(texto: string): number | null {
  const parse = (numStr: string, suffix?: string): number => {
    const raw = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
    if (isNaN(raw)) return NaN;
    const s = (suffix ?? "").toLowerCase();
    if (s.startsWith("milh")) return raw * 1_000_000;
    if (s === "mil") return raw * 1_000;
    return raw;
  };

  let m: RegExpMatchArray | null;

  // Pattern A: "R$ X [mil/milhões] em/de [fundos de] investimento(s)"
  // e.g. "R$ 20 mil em investimentos", "R$ 100 mil em fundos de investimento"
  m = texto.match(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+(?:em|de|dos?|nos?)\s+(?:fundos?\s+(?:de|dos?)\s+)?investimento/i);
  if (m) {
    const v = parse(m[1], m[2]);
    if (!isNaN(v)) return v;
  }

  // Pattern B: "investimento(s) [up to ~60 chars] R$ X [mil/milhões]"
  // e.g. "investimentos acima de R$ 5 milhões", "investimentos superiores a R$ 100 mil"
  m = texto.match(/investimento[^.\n]{0,60}?R\$\s*([\d.,]+)\s*(mil(?:hões?)?)/i);
  if (m) {
    const v = parse(m[1], m[2]);
    if (!isNaN(v)) return v;
  }

  // Pattern C: "R$ X [mil] investidos" — BTG Pactual style
  // e.g. "R$ 10.000 investidos no BTG"
  m = texto.match(/R\$\s*([\d.,]+)\s*(mil(?:hões?)?)?\s+investidos?/i);
  if (m) {
    const v = parse(m[1], m[2]);
    if (!isNaN(v)) return v;
  }

  return null;
}
