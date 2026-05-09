export const DYNAMIC_FIELD_PATTERNS = [
  /fee|anuidade|waiver|isenc/i,
  /cashback|points|pontos|milhas|rewards|reward/i,
  /eligibility|renda|income|invest/i,
  /lounge|sala vip|benefit|beneficio/i,
  /iof|forex|spread|juros|interest/i,
];

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function htmlToText(html) {
  return normalizeWhitespace(
    String(html ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sourceTypeForUrl(url, fallback = "official_issuer") {
  const lower = String(url ?? "").toLowerCase();
  if (lower.endsWith(".pdf") || lower.includes(".pdf?")) return "tariff_pdf";
  return fallback;
}

export function excerptAround(text, pattern, radius = 180) {
  const source = normalizeWhitespace(text);
  const match = source.match(pattern);
  if (!match || match.index === undefined) return null;
  const start = Math.max(0, match.index - radius);
  const end = Math.min(source.length, match.index + match[0].length + radius);
  return source.slice(start, end).trim();
}

export function makeClaim({ fieldPath, valueText, sourceUrl, sourceType, capturedAt, confidence = 0.7, rawExcerpt }) {
  const dynamic = DYNAMIC_FIELD_PATTERNS.some((pattern) => pattern.test(fieldPath));
  return {
    field_path: fieldPath,
    value_text: normalizeWhitespace(valueText),
    source_url: sourceUrl,
    source_type: sourceType,
    captured_at: capturedAt,
    last_verified_at: capturedAt,
    confidence_0_to_1: confidence,
    dynamic,
    ...(rawExcerpt ? { raw_excerpt: normalizeWhitespace(rawExcerpt) } : {}),
  };
}

export function uniqueClaims(claims) {
  const seen = new Set();
  return claims.filter((claim) => {
    const key = `${claim.field_path}|${claim.value_text}|${claim.source_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
