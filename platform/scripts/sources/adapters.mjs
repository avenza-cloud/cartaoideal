import { excerptAround, makeClaim, normalizeWhitespace, sourceTypeForUrl, uniqueClaims } from "../lib/source-claims.mjs";

const KEYWORD_CLAIMS = [
  { fieldPath: "fees.annual.raw_text", pattern: /(?:anuidade|mensalidade)[^.]{0,120}/i, confidence: 0.72 },
  { fieldPath: "fees.waiver_and_discounts.policy_text", pattern: /(?:isen[cç][aã]o|anuidade gr[aá]tis|sem anuidade)[^.]{0,140}/i, confidence: 0.76 },
  { fieldPath: "rewards.earning_rules_text", pattern: /(?:pontos|milhas|cashback|investback)[^.]{0,160}/i, confidence: 0.7 },
  { fieldPath: "eligibility.requirements_text", pattern: /(?:renda m[ií]nima|sujeito [aà] an[aá]lise|elegibilidade|investimento)[^.]{0,160}/i, confidence: 0.68 },
  { fieldPath: "travel_and_protection.airport_lounge_programs_detected", pattern: /(?:sala vip|lounge|priority pass|dragonpass|visa airport companion|lounges?)[^.]{0,160}/i, confidence: 0.66 },
  { fieldPath: "travel_and_protection.forex_spread_or_iof_text", pattern: /(?:iof|spread|d[oó]lar|c[aâ]mbio)[^.]{0,160}/i, confidence: 0.64 },
  { fieldPath: "benefits.official_highlights", pattern: /(?:benef[ií]cios?|vantagens?|seguros?|assist[eê]ncia|descontos?)[^.]{0,180}/i, confidence: 0.62 },
];

const ISSUER_HINTS = {
  itau: [/itau/i],
  santander: [/santander/i],
  pagbank: [/pagbank|pagseguro/i],
  neon: [/neon/i],
  pan: [/bancopan|banco pan|pan\.com/i],
  carrefour: [/carrefour/i],
};

export const adapters = [
  issuerAdapter("itau", ISSUER_HINTS.itau),
  issuerAdapter("santander", ISSUER_HINTS.santander),
  issuerAdapter("pagbank", ISSUER_HINTS.pagbank),
  issuerAdapter("neon", ISSUER_HINTS.neon),
  issuerAdapter("pan", ISSUER_HINTS.pan),
  issuerAdapter("carrefour", ISSUER_HINTS.carrefour),
  genericAdapter(),
];

export function selectAdapter(target) {
  const explicit = target.adapter ? adapters.find((adapter) => adapter.id === target.adapter) : null;
  if (explicit) return explicit;
  return adapters.find((adapter) => adapter.matches(target.source_url, `${target.display_name} ${target.issuer}`)) ?? adapters.at(-1);
}

function issuerAdapter(id, hints) {
  return {
    id,
    matches(url, cardName) {
      return hints.some((pattern) => pattern.test(`${url} ${cardName}`));
    },
    extract(input) {
      return extractGenericClaims({ ...input, adapterId: id, issuerConfidenceBonus: 0.08 });
    },
  };
}

function genericAdapter() {
  return {
    id: "generic",
    matches() {
      return true;
    },
    extract(input) {
      return extractGenericClaims({ ...input, adapterId: "generic", issuerConfidenceBonus: 0 });
    },
  };
}

function extractGenericClaims({ sourceUrl, sourceType, htmlText, capturedAt, adapterId, issuerConfidenceBonus }) {
  const text = normalizeWhitespace(htmlText);
  const warnings = [];
  const claims = [];

  if (!text) {
    return {
      sourceClaims: [],
      proposedCatalogFields: {},
      proposedFacetFields: {},
      warnings: ["empty_source_text"],
    };
  }

  for (const spec of KEYWORD_CLAIMS) {
    const rawExcerpt = excerptAround(text, spec.pattern);
    if (!rawExcerpt) continue;
    const valueText = rawExcerpt.match(spec.pattern)?.[0] ?? rawExcerpt;
    claims.push(makeClaim({
      fieldPath: spec.fieldPath,
      valueText,
      sourceUrl,
      sourceType: sourceTypeForUrl(sourceUrl, sourceType),
      capturedAt,
      confidence: Math.min(0.95, spec.confidence + issuerConfidenceBonus),
      rawExcerpt,
    }));
  }

  if (claims.length === 0) warnings.push("no_keyword_claims_extracted");

  return {
    sourceClaims: uniqueClaims(claims),
    proposedCatalogFields: {},
    proposedFacetFields: {},
    warnings: warnings.concat(adapterId === "generic" ? ["generic_adapter_used"] : []),
  };
}
