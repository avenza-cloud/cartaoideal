#!/usr/bin/env python3
"""
Transform flat scraped cards into a structured catalog (schema v2).
Removes all JSON nulls from output.

Verification model (every card):
- evidence URL domain classification + optional embedded issuer snippets (XP/Rico/Nubank etc.).
- Full per-card live cross-check against each issuer's tariff PDF is NOT done here; see verification.cross_check_status.

AI consumption:
- cards_brazil_catalog_v2.json — nested, audit-friendly (evidence snapshots, notes).
- cards_brazil_ai_comparison_facets.json — flat facets + text_for_embedding_compare for ranking/RAG/tool calls.
"""

from __future__ import annotations

import hashlib
import html as html_lib
import json
import re
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cards_brazil_master_complete_best_effort.json"
OUT = ROOT / "cards_brazil_catalog_v2.json"
FACETS_OUT = ROOT / "cards_brazil_ai_comparison_facets.json"
RAW_OUT = ROOT / "cards_brazil_raw_sources.json"
MANUAL_REVIEW_OVERRIDES = ROOT / "tools" / "manual_card_review_overrides.json"
PLATFORM_OUT = ROOT / "platform" / "data" / OUT.name
PLATFORM_FACETS_OUT = ROOT / "platform" / "data" / FACETS_OUT.name
PLATFORM_RAW_OUT = ROOT / "platform" / "data" / RAW_OUT.name
REFERENCE_AS_OF_DATE = date(2026, 5, 5)
UNKNOWN = "unknown"
PP_RANKING_URL = "https://passageirodeprimeira.com/ranking-cartao-de-credito/"
NUBANK_CARD_URL = "https://nubank.com.br/nu/cartao"
NUBANK_CARD_IMAGE_URL = (
    "https://s2-techtudo.glbimg.com/nLo2y4dk-xrUwLW26kXu69TQfEI=/0x0:960x611/"
    "984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_08fbf48bc0524877943fe86e43087e7a/"
    "internal_photos/bs/2019/D/0/2eNl0kQFSRGlRT8GB6Ow/nu-card-large.png"
)
PP_CASHBACK_CATEGORY_URL = (
    "https://passageirodeprimeira.com/categoria-cartao-de-credito/cartoes-de-cashback/"
)
PP_AJAX_URL = (
    "https://passageirodeprimeira.com/wp-content/themes/pp2025.iwwa/ajax/"
    "cartao-credito.php"
)
PP_SOURCE_PAGES = [
    {
        "label": "ranking_cartao_de_credito",
        "url": PP_RANKING_URL,
        "ajax_category": 3430,
        "source_kind": "ranking",
    },
    {
        "label": "cartoes_de_cashback",
        "url": PP_CASHBACK_CATEGORY_URL,
        "ajax_category": 3431,
        "source_kind": "category",
    },
]


def load_manual_review_overrides() -> dict[str, Any]:
    if not MANUAL_REVIEW_OVERRIDES.exists():
        return {}
    data = json.loads(MANUAL_REVIEW_OVERRIDES.read_text(encoding="utf-8"))
    return data.get("overrides") or {}


def fold(s: str) -> str:
    s = "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
    return s.lower()


def strip_nulls(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if v is None:
                continue
            vv = strip_nulls(v)
            if vv is None:
                continue
            if isinstance(vv, dict) and len(vv) == 0:
                continue
            if isinstance(vv, list) and len(vv) == 0:
                continue
            if isinstance(vv, str) and vv.strip() == "":
                continue
            out[k] = vv
        return out
    if isinstance(obj, list):
        out = []
        for x in obj:
            if x is None:
                continue
            xx = strip_nulls(x)
            if xx is None:
                continue
            if isinstance(xx, str) and xx.strip() == "":
                continue
            out.append(xx)
        return out
    return obj


def slug_id(name: str, issuer: str) -> str:
    raw = fold(f"{issuer}|{name}")
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    h = hashlib.sha256(f"{issuer}|{name}".encode()).hexdigest()[:10]
    return f"{raw[:80]}-{h}"


def parse_money_brl(text: str | None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "has_explicit_amount": False,
        "raw_text": "",
    }
    if not text or not str(text).strip():
        return out
    t = str(text).strip()
    out["raw_text"] = t
    low = fold(t)
    if any(w in low for w in ("variavel", "variável", "variando")):
        out["variable_pricing_claim"] = True
        return out
    # R$ 1.200 / R$ 1.200,50 / R$1200
    m = re.search(
        r"r\$\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?|[\d]{2,7})(?:\b|$)",
        t.replace(" ", ""),
        re.I,
    )
    num_str = None
    if m:
        num_str = m.group(1)
    else:
        digits_only = re.fullmatch(r"[\d\.\,]+", re.sub(r"\s+", "", t))
        if digits_only:
            num_str = re.sub(r"[^\d]", "", t)
            if len(num_str) > 7:
                num_str = None
    if not num_str:
        return out
    normalized = num_str.replace(".", "").replace(",", ".")
    try:
        val = float(normalized)
        out["amount_brl_numeric"] = int(val) if val.is_integer() else round(val, 2)
        out["has_explicit_amount"] = True
    except ValueError:
        pass
    return out


def extract_percent(text: str | None) -> str:
    if not text:
        return ""
    m = re.search(r"(\d+[,.]?\d*)\s*%", text)
    return m.group(0).replace(",", ".") if m else text.strip()


def atomize_benefits(*chunks: str | None) -> list[str]:
    skip_tokens = {"", "n/a", "na", "-", "—"}
    seen: set[str] = set()
    out: list[str] = []
    pieces: list[str] = []
    for c in chunks:
        if not c:
            continue
        s = str(c).strip()
        if fold(s) in skip_tokens:
            continue
        pieces.append(s)
    blob = ". ".join(pieces)
    parts = re.split(r"[;•\n]+|\.\s+(?=[A-ZÀ-Ú0-9])", blob)
    for p in parts:
        p = re.sub(r"\s+", " ", p).strip(" -\t.")
        if len(p) < 4:
            continue
        if fold(p) in skip_tokens:
            continue
        key = fold(p)
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def infer_travel_flags(text: str) -> dict[str, Any]:
    f = fold(text)
    lounge_programs: list[str] = []
    if "loungekey" in f or "lounge key" in f:
        lounge_programs.append("LoungeKey")
    if "priority pass" in f:
        lounge_programs.append("Priority Pass")
    if "dragon pass" in f:
        lounge_programs.append("Dragon Pass")
    if "visa airport companion" in f or "airport companion" in f:
        lounge_programs.append("Visa Airport Companion")
    if "fast pass" in f:
        lounge_programs.append("Fast Pass (bandeira/aeroporto)")
    lounge_offered = bool(
        lounge_programs
        or "sala vip" in f
        or "salas vip" in f
        or "lounge" in f
        or "salão" in f
    )
    unlimited = "ilimit" in f and lounge_offered
    visits_known = False
    annual_visits: int | None = None
    m = re.search(
        r"(\d+)\s*(acessos|visitas|vezes)", fold(text).replace("ã", "a"), re.I
    )
    if m:
        visits_known = True
        annual_visits = int(m.group(1))
    return {
        "airport_lounge_offered": lounge_offered,
        "airport_lounge_unlimited_claim": unlimited,
        "airport_lounge_annual_visits_hint": annual_visits if visits_known else None,
        "airport_lounge_programs_detected": lounge_programs,
        "concierge_mentioned": "concierge" in f,
        "travel_insurance_mentioned": (
            "seguro viagem" in f or "seguro de viagem" in f or "travel insurance" in f
        ),
        "travel_assistance_mentioned": "assistencia" in f and "viagem" in f,
        "lost_delay_baggage_mentioned": "bagagem" in f,
        "rental_car_coverage_mentioned": "locadora" in f or "aluguel" in f,
    }


def infer_rewards_flags(text: str) -> dict[str, Any]:
    f = fold(text)
    return {
        "earn_points_or_miles_mentioned": bool(
            re.search(r"ponto|milha|milhas", f)
        ),
        "earn_cashback_mentioned": "cashback" in f or "cash back" in f,
        "earn_investback_mentioned": "investback" in f,
        "loyalty_transfer_mentioned": bool(
            re.search(
                r"livelo|esfera|smiles|latam|tudo azul|azul fidelidade|inter loop|coopera|atomos|dotz|latam pass",
                f,
            )
        ),
    }


def infer_fee_flags(waiver: str | None, fee_raw: str | None) -> dict[str, Any]:
    w = fold(waiver or "")
    fee = fold(fee_raw or "")
    full_waiver = bool(
        re.search(r"isento|100%\s*isen|gr[aá]tis|zero,\s*para\s*sempre", w)
        or re.search(r"\b0\b", fold(str(fee_raw or "")))
        and "mensalidade" not in fee
    )
    partial = bool(re.search(r"50%|parcial|desconto", w))
    promo = bool(re.search(r"primeiros?\s*\d+\s*meses|meses\s*gr", w))
    return {
        "full_fee_waiver_possible_claim": full_waiver,
        "partial_fee_waiver_possible_claim": partial,
        "promotional_waiver_period_claim": promo,
        "uses_monthly_subscription_model_instead_of_classic_annual": "mensalidade" in w
        or "r$89" in w.replace(" ", ""),
    }


def classify_segment(tier: str | None, network: str | None) -> str:
    t = fold(tier or "")
    n = fold(network or "")
    ultra = ("centurion", "privilege")
    premium = ("black", "infinite", "the platinum", "nanquim", "diners")
    if any(x in t for x in ultra) or any(x in n for x in ultra):
        return "ultra_premium"
    if any(x in t for x in premium):
        return "premium"
    if "gold" in t or "platinum" in t:
        return "upper_mass"
    return "mass_or_general"


def refine_market_segment(card: dict[str, Any]) -> None:
    """Classify card badges by product economics/eligibility, not only network tier.

    Segment semantics used by the app:
    - mass_or_general: common/simple cards, free or low fee, no meaningful travel gate.
    - upper_mass: Gold/Platinum/Signature/Grafite style cards with moderate fee/benefits.
    - premium: Black/Infinite/Nanquim/Diners/Amex Platinum or equivalent travel cards.
    - ultra_premium: invite/private/very high-fee cards or cards gated by very high wealth.
    """
    identity = card.get("identity") or {}
    categorization = card.setdefault("categorization", {})
    name = fold(str(identity.get("display_name") or ""))
    issuer = fold(str((identity.get("issuer") or {}).get("raw") or ""))
    tier = fold(str(identity.get("variant_band") or ""))
    network = fold(str(identity.get("network_primary") or ""))
    annual = ((card.get("fees") or {}).get("annual") or {}).get("amount_brl_numeric")
    annual_brl = annual if isinstance(annual, (int, float)) else 0
    elig = card.get("eligibility") or {}
    min_inv = elig.get("minimum_liquid_investments_brl_official")
    if min_inv is None:
        min_inv = elig.get("minimum_first_investment_brl_official")
    min_inv_brl = min_inv if isinstance(min_inv, (int, float)) else 0
    availability = str(elig.get("availability_status") or "")
    travel = card.get("travel_and_protection") or {}
    lounge = bool(travel.get("airport_lounge_offered"))
    unlimited_lounge = bool(travel.get("airport_lounge_unlimited_claim"))

    text = " ".join([name, issuer, tier, network, str(elig.get("requirements_text") or "")])

    common_names = (
        "cartao nubank",
        "cartao de credito saraiva",
        "c6 mastercard",
        "mercado pago visa gold",
        "itau click",
        "inter mastercard gold",
        "inter one mastercard platinum",
        "amazon prime mastercard platinum",
        "amazon.com.br mastercard platinum",
    )
    if any(x in text for x in common_names):
        segment = "mass_or_general"
    elif (
        "centurion" in text
        or "infinite privilege" in text
        or "legacy" in text
        or "aeternum" in text
        or "altus" in text
        or "dux" in text
        or "graphene world legend" in text
        or "ultrablue" in text
        or "the one mastercard" in text
        or "impar" in text
        or "í mpar" in text
        or min_inv_brl >= 1_000_000
        or annual_brl >= 3_000
        or availability in {"invite_only", "private_or_segment_restricted"}
    ):
        segment = "ultra_premium"
    elif (
        "ultravioleta" in text
        or "epic" in text
        or "carbon" in text
        or "black" in tier
        or "black" in name
        or "infinite" in tier
        or "infinite" in name
        or "nanquim" in tier
        or "nanquim" in name
        or "diners" in tier
        or "diners" in name
        or "the platinum" in name
        or (lounge and (annual_brl >= 700 or unlimited_lounge))
        or annual_brl >= 900
        or min_inv_brl >= 50_000
    ):
        segment = "premium"
    elif (
        "platinum" in tier
        or "platinum" in name
        or "signature" in tier
        or "signature" in name
        or "grafite" in tier
        or "grafite" in name
        or "gold" in tier
        or "gold" in name
        or annual_brl >= 300
        or lounge
    ):
        segment = "upper_mass"
    else:
        segment = "mass_or_general"

    categorization["market_segment_guess"] = segment


def extract_dates_dd_mm_yyyy(text: str) -> list[date]:
    found: list[date] = []
    for m in re.finditer(r"\b(\d{2})/(\d{2})/(\d{4})\b", text):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            found.append(date(y, mo, d))
        except ValueError:
            continue
    return found


def freshness_signals(text: str) -> dict[str, Any]:
    ds = extract_dates_dd_mm_yyyy(text)
    if not ds:
        return {}
    past = [str(d) for d in ds if d < REFERENCE_AS_OF_DATE]
    future = [str(d) for d in ds if d >= REFERENCE_AS_OF_DATE]
    out: dict[str, Any] = {"explicit_dates_found_iso": [str(d) for d in ds]}
    if past:
        out["contains_date_before_reference_as_of"] = True
        out["past_dates_iso"] = past
    if future:
        out["future_or_current_dates_iso"] = future
    return out


def classify_source(url: str | None) -> dict[str, Any]:
    if not url:
        return {
            "verification_bucket": "unknown",
            "source_is_official_issuer_domain": False,
        }
    u = fold(url)
    official_hints = (
        "itau.com.br",
        "banco.bradesco",
        "bb.com.br",
        "santander.com.br",
        "bancointer.com.br",
        "inter.co",
        "nubank.com.br",
        "btgpactual.com",
        "xpi.com.br",
        "rico.com.vc",
        "sicredi.com.br",
        "sicoob.com.br",
        "brb.com.br",
        "brbcard.com.br",
        "mastercard.com.br",
        "visa.com.br",
    )
    is_off = any(o in u for o in official_hints)
    bucket = "official_or_network_site" if is_off else "aggregator_or_blog_or_secondary"
    return {
        "verification_bucket": bucket,
        "source_is_official_issuer_domain": is_off,
        "primary_evidence_url": url.strip(),
    }


def primary_domain(url: str | None) -> str:
    if not url or not str(url).strip():
        return ""
    try:
        domain = urlparse(str(url).strip()).netloc.lower()
        if domain.startswith("www."):
            return domain[4:]
        return domain
    except (ValueError, TypeError):
        return ""


AGGREGATOR_AND_SECONDARY_DOMAIN_SUBSTRINGS = (
    "melhorescartoes.com.br",
    "melhoresdestinos.com.br",
    "passageirodeprimeira.com",
    "altarendablog.com.br",
    "creditcards.com",
)


def attach_cross_check_verification(enriched: dict[str, Any]) -> None:
    """Every card gets explicit verification metadata (no silent accuracy claims)."""
    ev = enriched.get("evidence") or {}
    url = str(ev.get("primary_evidence_url") or "").strip()
    domain = primary_domain(url)
    snap = enriched.get("official_product_snapshot") or {}
    embedded = bool(
        isinstance(snap, dict)
        and snap.get("refreshed_from_official_page") is True
    )

    product_kind = enriched.get("identity", {}).get("product_kind") or ""

    status = "third_party_or_blog_aggregate_not_individually_fetched"
    confidence = 0.28
    notes = (
        "Este pipeline não re-baixa cada URL no momento do build; valores devem ser "
        "confirmados na página oficial do emissor ou no PDF de tarifas vigente."
    )

    if embedded:
        pf = snap.get("product_family") or ""
        prod = snap.get("product") or ""
        if pf == "XP Visa Infinite" and snap.get("matched_line"):
            status = "embedded_official_table_matched_by_product_name_xp_legacy_infinite_one"
            confidence = 0.88
            notes = (
                "Campos principais foram alinhados a texto embutido da tabela oficial XP "
                "(snapshot manualmente mantido no gerador; revalidar se o site mudar)."
            )
        elif prod == "Rico Visa Infinite":
            status = "embedded_official_marketing_copy_matched_rico_visa_infinite"
            confidence = 0.82
        elif prod == "Nubank Ultravioleta":
            status = "embedded_official_marketing_copy_matched_nubank_ultravioleta"
            confidence = 0.8
        else:
            status = "embedded_official_snippet_unknown_product_bucket"
            confidence = 0.55

    elif not url:
        status = "no_primary_evidence_url_in_source_record"
        confidence = 0.18

    elif ev.get("source_is_official_issuer_domain"):
        status = "issuer_official_domain_url_present_pipeline_did_not_refetch_body"
        confidence = 0.42
        notes = (
            "Domínio parece oficial do emissor, mas o conteúdo da página não foi "
            "re-harvestado cartão a cartão neste build."
        )

    elif any(x in domain for x in ("mastercard.com.br", "visa.com.br")):
        status = "card_network_marketing_page_not_emissor_specific"
        confidence = 0.33

    elif any(a in domain for a in AGGREGATOR_AND_SECONDARY_DOMAIN_SUBSTRINGS):
        status = "third_party_ranking_or_review_site"
        confidence = 0.26

    if product_kind == "generic_market_category_article":
        confidence = round(min(confidence * 0.55, 0.95), 2)
        status = f"{status}_generic_non_product_article_penalty"

    actions = [
        "Confirmar nome comercial exato no app/site do emissor",
        "Abrir PDF ou página atual de tarifas/anuidade e benefícios",
    ]
    if confidence < 0.5:
        actions.append("Não usar números deste registro em decisão financeira sem segunda fonte")

    enriched["verification"] = {
        "cross_check_status": status,
        "confidence_score_0_to_1": confidence,
        "machine_truthfulness_note_pt": notes,
        "primary_evidence_domain": domain or UNKNOWN,
        "embedded_official_snippet_applied": embedded,
        "recommended_human_cross_check_actions": actions,
    }


def heuristic_minimum_investment_brl(text: str) -> str | int | float:
    """Extract a single minimum investment hint when structured fields are absent."""
    if not text:
        return UNKNOWN
    t = fold(text)
    if "consultar" in t or "n/" in t or "nao exig" in t:
        return UNKNOWN
    m = re.search(
        r"r?\$?\s*([\d\.\,]+)\s*mil(h(?:[oõ]es|[aã]o))?",
        text.replace(" ", "").lower(),
        re.I,
    )
    if m:
        raw_num = m.group(1).replace(".", "").replace(",", ".")
        try:
            v = float(raw_num)
            if m.group(2):  # milhões
                return int(v * 1_000_000)
            return int(v * 1000)
        except ValueError:
            pass
    m2 = re.search(r"(\d[\d\.]*)\s*mil\s*mil", text.lower())
    if m2:
        try:
            return int(float(m2.group(1).replace(".", "")) * 1_000_000)
        except ValueError:
            pass
    return UNKNOWN


def heuristic_minimum_income_brl(text: str) -> str | int | float:
    if not text:
        return UNKNOWN
    t = fold(text)
    if not re.search(r"renda|sal[aá]rio|comprova", t):
        return UNKNOWN
    m = re.search(
        r"(?:renda|sal[aá]rio)[^\d]*(?:r\$)?\s*([\d\.\,]+)\s*(milh[oõ]es|milh[aã]o|mil)?",
        t,
    )
    if not m:
        return UNKNOWN
    raw_num = m.group(1).replace(".", "").replace(",", ".")
    try:
        value = float(raw_num)
    except ValueError:
        return UNKNOWN
    suffix = m.group(2) or ""
    if "milh" in suffix:
        value *= 1_000_000
    elif "mil" in suffix:
        value *= 1_000
    return int(value) if value.is_integer() else round(value, 2)


def extract_requirement_claim_from_text(text: str) -> str:
    """Promote only card-eligibility prose, not fee-waiver or lounge conditions."""
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", html_to_text(str(text))).strip()
    if not cleaned:
        return ""
    sentences = [
        part.strip()
        for part in re.split(r"(?<=[.!?])\s+", cleaned)
        if len(part.strip()) >= 20
    ] or [cleaned]

    patterns = [
        r"(?:para solicitar(?: o cartão| o cartao)?[^.]*\.)",
        r"(?:exclusivamente por convite[^.]*\.)",
        r"(?:dispon[ií]vel apenas por convite[^.]*\.)",
        r"(?:convites? (?:são|sao) para [^.]*\.)",
        r"(?:é necessário ter[^.]*(?:renda|investimento|patrim[oô]nio)[^.]*\.)",
        r"(?:e necessario ter[^.]*(?:renda|investimento|patrimonio)[^.]*\.)",
        r"(?:exige[^.]*(?:renda|investimento|patrim[oô]nio)[^.]*\.)",
    ]
    for sentence in sentences:
        folded = fold(sentence)
        if (
            re.search(r"acesso|sala\s+vip|isencao|isenção|anuidade", folded)
            and "solicitar" not in folded
            and "convite" not in folded
        ):
            continue
        for pattern in patterns:
            match = re.search(pattern, sentence, flags=re.I)
            if match:
                return match.group(0).strip()
    whole_folded = fold(cleaned)
    if re.search(r"\b(private|private banking|alta renda|wealth|personnalit[eé]|unique)\b", whole_folded) and re.search(
        r"\b(cliente|clientes|segmento|p[uú]blico|demandas)\b", whole_folded
    ):
        return cleaned[:320].rstrip()
    return ""


def infer_eligibility_from_source_sections(card: dict[str, Any]) -> None:
    elig = card.setdefault("eligibility", {})
    if elig.get("requirements_text") or elig.get("requirements_text_verified_official"):
        return

    snapshot = card.get("raw_source_snapshot") or {}
    sections = snapshot.get("benefit_sections") or {}
    candidates: list[str] = []
    for heading, values in sections.items():
        heading_folded = fold(str(heading))
        if heading_folded.startswith("bandeira"):
            continue
        if heading_folded != "resumo" and "elegibilidade" not in heading_folded:
            continue
        for value in values or []:
            claim = extract_requirement_claim_from_text(str(value))
            if claim:
                candidates.append(claim)

    if not candidates:
        return

    requirements_text = candidates[0]
    elig["requirements_text"] = requirements_text
    parsed_inv = heuristic_minimum_investment_brl(requirements_text)
    if parsed_inv != UNKNOWN:
        elig["minimum_liquid_investments_brl_official"] = parsed_inv
    parsed_income = heuristic_minimum_income_brl(requirements_text)
    if parsed_income != UNKNOWN:
        elig["minimum_income_brl"] = parsed_income
    card.setdefault("data_quality_notes", []).append(
        "Elegibilidade inferida do parágrafo principal de Benefícios do cartão no PP; não usar política de anuidade/sala VIP como gate do produto."
    )


def infer_availability_status(card: dict[str, Any]) -> str:
    identity = card.get("identity") or {}
    text = fold(
        " ".join(
            str(x or "")
            for x in (
                identity.get("display_name"),
                identity.get("variant_band"),
                (card.get("eligibility") or {}).get("requirements_text"),
                (card.get("constraints") or {}).get("caveats_text"),
            )
        )
    )
    if re.search(r"descontinuad|nao esta disponivel|não esta disponivel|encerrad", text):
        return "unavailable"
    if re.search(r"convite|invite|somente convidados|apenas convidados", text):
        return "invite_only"
    if re.search(r"centurion|black card invite|by invitation", text):
        return "invite_only"
    if re.search(r"private|alta renda|wealth|unique|personnalite|personalitte|select", text):
        return "private_or_segment_restricted"
    return "available"


def parse_brl_thresholds(text: str) -> list[int]:
    values: list[int] = []
    if not text:
        return values
    normalized = fold(text)
    consumed_spans: list[tuple[int, int]] = []

    for m in re.finditer(
        r"(?:r\$)?\s*(\d[\d\.\,]*)\s*mil\s*(?:e\s*)?(\d{1,3})\s*reais",
        normalized,
    ):
        thousands = float(m.group(1).replace(".", "").replace(",", "."))
        values.append(int(thousands * 1000) + int(m.group(2)))
        consumed_spans.append(m.span())

    for m in re.finditer(
        r"(?:r\$)?\s*(\d[\d\.\,]*)\s*(milh[oõ]es|milh[aã]o|mil)?",
        normalized,
    ):
        if any(start <= m.start() and m.end() <= end for start, end in consumed_spans):
            continue
        if m.end() < len(normalized) and normalized[m.end()] == "%":
            continue
        if m.start() > 0 and normalized[m.start() - 1] == "%":
            continue
        if re.search(r"%\s*(?:de\s*)?$", normalized[max(0, m.start() - 6):m.start()]):
            continue
        raw_num = m.group(1).replace(".", "").replace(",", ".")
        try:
            value = float(raw_num)
        except ValueError:
            continue
        suffix = m.group(2) or ""
        if "milh" in suffix:
            value *= 1_000_000
        elif "mil" in suffix:
            value *= 1_000
        if value >= 100:
            values.append(int(value) if value.is_integer() else round(value))
    out: list[int] = []
    seen: set[int] = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def parse_thresholds_by_context(text: str) -> dict[str, list[int]]:
    thresholds = {"investment": [], "spend": []}
    if not text:
        return thresholds
    clauses = re.split(r"\s+ou\s+|;\s*|(?=\s+e\s+100%)", fold(text))
    all_values = parse_brl_thresholds(text)
    for clause in clauses:
        values = parse_brl_thresholds(clause)
        if not values:
            continue
        has_invest = bool(re.search(r"invest|patrimonio|cdb|aplicac|produtos", clause))
        has_spend = bool(re.search(r"fatura|gasto|compras|despesas", clause))
        if has_invest or (not has_spend and "clientes acima" in clause):
            thresholds["investment"].extend(values)
        if has_spend:
            thresholds["spend"].extend(values)
    if not thresholds["investment"] and re.search(r"invest|patrimonio|cdb|aplicac|produtos", fold(text)):
        thresholds["investment"] = all_values
    if not thresholds["spend"] and re.search(r"fatura|gasto|compras|despesas", fold(text)):
        thresholds["spend"] = all_values
    for key in thresholds:
        deduped: list[int] = []
        seen: set[int] = set()
        for value in thresholds[key]:
            if value in seen:
                continue
            seen.add(value)
            deduped.append(value)
        thresholds[key] = deduped
    return thresholds


def characteristics_by_key(card: dict[str, Any], key: str) -> list[dict[str, Any]]:
    return [
        item
        for item in (card.get("benefits") or {}).get("characteristics") or []
        if item.get("key") == key
    ]


def first_characteristic_value(card: dict[str, Any], key: str) -> str:
    values = characteristics_by_key(card, key)
    if not values:
        return ""
    return str(values[0].get("value") or "")


def bool_from_pt(value: str) -> bool | None:
    f = fold(value)
    if f in {"sim", "yes", "true"}:
        return True
    if f in {"nao", "não", "no", "false"}:
        return False
    return None


def evaluate_semantic_claims(card: dict[str, Any]) -> dict[str, Any]:
    """Normalize raw prose/characteristics into auditable recommendation claims."""
    elig = card.setdefault("eligibility", {})
    fees = card.get("fees") or {}
    annual = fees.get("annual") or {}
    waiver_text = first_characteristic_value(card, "fee_waiver") or (
        fees.get("waiver_and_discounts") or {}
    ).get("policy_text", "")
    requires_account_raw = first_characteristic_value(card, "requires_account")
    requires_account = bool_from_pt(requires_account_raw)
    if requires_account is not None:
        elig["requires_bank_account_claim"] = requires_account

    requirements_text = elig.get("requirements_text") or elig.get(
        "requirements_text_verified_official"
    )
    min_inv = elig.get("minimum_liquid_investments_brl_official") or elig.get(
        "minimum_first_investment_brl_official"
    )
    if min_inv is None:
        parsed_inv = heuristic_minimum_investment_brl(str(requirements_text or ""))
        min_inv = None if parsed_inv == UNKNOWN else parsed_inv

    min_income = elig.get("minimum_income_brl")
    if min_income is None:
        parsed_income = heuristic_minimum_income_brl(str(requirements_text or ""))
        min_income = None if parsed_income == UNKNOWN else parsed_income

    waiver_values = parse_brl_thresholds(str(waiver_text))
    waiver_contextual = parse_thresholds_by_context(str(waiver_text))
    waiver_norm = fold(str(waiver_text))
    waiver_claims: dict[str, Any] = {
        "raw_text": waiver_text or UNKNOWN,
        "has_full_waiver": bool(re.search(r"100%|isenc|isento|zero", waiver_norm)),
        "has_partial_waiver": bool(re.search(r"50%|parcial|desconto", waiver_norm)),
        "investment_thresholds_brl": [],
        "spend_thresholds_brl": [],
    }
    if waiver_contextual["investment"]:
        waiver_claims["investment_thresholds_brl"] = waiver_contextual["investment"]
    elif "invest" in waiver_norm or "patrimonio" in waiver_norm:
        waiver_claims["investment_thresholds_brl"] = waiver_values
    if waiver_contextual["spend"]:
        waiver_claims["spend_thresholds_brl"] = waiver_contextual["spend"]
    elif re.search(r"fatura|gasto|compras|despesas", waiver_norm):
        waiver_claims["spend_thresholds_brl"] = waiver_values

    earning_details = [
        str(item.get("value") or "")
        for item in characteristics_by_key(card, "earning_detail")
    ]
    earning_summary = first_characteristic_value(card, "earning_rate") or (
        card.get("rewards") or {}
    ).get("earning_rules_text", "")

    audit_notes: list[str] = []
    if not requirements_text and (
        card.get("categorization", {}).get("market_segment_guess") == "ultra_premium"
    ):
        audit_notes.append("Ultra-premium sem elegibilidade estruturada; recomendações devem ser conservadoras.")
    if "ate" in fold(str(earning_summary)) and not earning_details:
        audit_notes.append("Pontuação usa teto ('até') sem regras doméstica/exterior estruturadas.")
    if waiver_text and not waiver_values and "nao ha" not in fold(str(waiver_text)):
        audit_notes.append("Política de anuidade tem texto mas não gerou limiar numérico estruturado.")

    if min_inv is not None:
        elig["minimum_liquid_investments_brl_official"] = min_inv
    if min_income is not None:
        elig["minimum_income_brl"] = min_income

    return {
        "audited_at_utc": datetime.now(timezone.utc).isoformat(),
        "normalized_claims": {
            "eligibility": {
                "requirements_text": requirements_text or UNKNOWN,
                "minimum_investment_brl": min_inv if min_inv is not None else UNKNOWN,
                "minimum_income_brl": min_income if min_income is not None else UNKNOWN,
                "requires_bank_account": requires_account
                if requires_account is not None
                else UNKNOWN,
                "availability_status": infer_availability_status(card),
            },
            "annual_fee": {
                "raw_text": annual.get("raw_text")
                or annual.get("official_fee_policy_summary")
                or UNKNOWN,
                "amount_brl_numeric": annual.get("amount_brl_numeric", UNKNOWN),
                "monthly_fee_brl_after_intro_months": annual.get(
                    "monthly_fee_brl_after_intro_months", UNKNOWN
                ),
                "waiver_policy": waiver_claims,
            },
            "rewards": {
                "earning_summary": earning_summary or UNKNOWN,
                "earning_details": earning_details,
            },
        },
        "audit_notes": audit_notes,
        "needs_human_review": bool(audit_notes),
    }


def build_eligibility_facet(
    card: dict[str, Any],
    min_inv: str | int | float,
    min_income: str | int | float,
) -> dict[str, Any]:
    elig = card.get("eligibility") or {}
    availability = elig.get("availability_status") or infer_availability_status(card)
    requires_account = elig.get("requires_bank_account_claim")
    if requires_account is None:
        requires_account = UNKNOWN

    hard_gates: list[str] = []
    if min_inv != UNKNOWN:
        hard_gates.append("minimum_investment")
    if min_income != UNKNOWN:
        hard_gates.append("minimum_income")
    if availability in {"unavailable", "invite_only", "private_or_segment_restricted"}:
        hard_gates.append("availability")

    segment = (card.get("categorization") or {}).get("market_segment_guess")
    blocking_unknown = availability in {
        "unavailable",
        "invite_only",
        "private_or_segment_restricted",
    }
    if (
        availability == "available"
        and min_inv == UNKNOWN
        and min_income == UNKNOWN
        and segment == "ultra_premium"
    ):
        blocking_unknown = False

    return {
        "requirements_text": elig.get("requirements_text")
        or elig.get("requirements_text_verified_official")
        or UNKNOWN,
        "minimum_income_brl_best_estimate": min_income,
        "minimum_investment_brl_best_estimate": min_inv,
        "requires_bank_account_claim": requires_account,
        "availability_status": availability,
        "hard_gate_fields": hard_gates,
        "recommendation_blocking_unknowns": bool(blocking_unknown),
        "source_status": "official_or_structured" if hard_gates else "not_structured",
    }


def build_embedding_compare_text(card: dict[str, Any]) -> str:
    parts = [
        card["identity"]["display_name"],
        f"Emissor: {card['identity']['issuer'].get('raw') or UNKNOWN}",
        f"Bandeira: {card['identity'].get('network_primary') or UNKNOWN}",
        f"Faixa: {card['identity'].get('variant_band') or UNKNOWN}",
    ]
    el = card.get("eligibility") or {}
    parts.append(f"Elegibilidade: {el.get('requirements_text') or UNKNOWN}")
    rw = card.get("rewards") or {}
    parts.append(f"Ganhos: {rw.get('earning_rules_text') or UNKNOWN}")
    parts.append(f"Programas: {rw.get('loyalty_programs_text') or UNKNOWN}")
    fee_blk = (card.get("fees") or {}).get("annual") or {}
    parts.append(f"Anuidade (campo principal): {fee_blk.get('raw_text') or fee_blk.get('official_fee_policy_summary') or UNKNOWN}")
    lounge = (card.get("travel_and_protection") or {}).get(
        "official_airport_lounge_summary"
    ) or (card.get("travel_and_protection") or {}).get(
        "airport_lounge_programs_detected"
    )
    if lounge:
        parts.append(f"Salas VIP / programa: {lounge}")
    atoms = card.get("benefits", {}).get("atomic_benefit_statements") or []
    if atoms:
        parts.append("Benefícios (lista): " + "; ".join(atoms[:12]))
    v = card.get("verification") or {}
    parts.append(
        f"Verificação automática: {v.get('cross_check_status', UNKNOWN)} (confiança {v.get('confidence_score_0_to_1', UNKNOWN)})"
    )
    return " \n".join(str(p) for p in parts if p)


def build_ai_comparison_facets(cards: list[dict[str, Any]]) -> dict[str, Any]:
    rows = []
    for c in cards:
        elig = c.get("eligibility") or {}
        fees_a = (c.get("fees") or {}).get("annual") or {}
        fl = c.get("flags") or {}
        tp = c.get("travel_and_protection") or {}
        v = c.get("verification") or {}
        evidence = c.get("evidence") or {}
        rewards = c.get("rewards") or {}
        reward_return = rewards.get("return_cashlike") or {}
        media = c.get("media") or {}
        benefits = c.get("benefits") or {}
        benefit_groups = benefits.get("benefit_groups") or {}
        characteristics = benefits.get("characteristics") or []

        min_inv = elig.get("minimum_liquid_investments_brl_official")
        if min_inv is None:
            min_inv = elig.get("minimum_first_investment_brl_official")
        if min_inv is None:
            min_inv = heuristic_minimum_investment_brl(
                elig.get("requirements_text") or ""
            )

        min_income = elig.get("minimum_income_brl")
        if min_income is None:
            min_income = heuristic_minimum_income_brl(elig.get("requirements_text") or "")

        monthly_fee = fees_a.get("monthly_fee_brl_after_intro_months")
        annual_est = fees_a.get("amount_brl_numeric")
        if annual_est is None and monthly_fee is not None:
            annual_est = monthly_fee * 12
        if annual_est is None:
            annual_est = UNKNOWN if not fees_a.get("variable_pricing_claim") else "variable_pricing_claim"

        lounge_visits = tp.get("airport_lounge_annual_visits_hint")
        eligibility_facet = build_eligibility_facet(c, min_inv, min_income)

        filter_labels: list[str] = []
        seg = c.get("categorization", {}).get("market_segment_guess")
        if seg:
            filter_labels.append(f"segment:{seg}")
        if fl.get("has_any_lounge_claim"):
            filter_labels.append("travel:lounge")
        if fl.get("earn_points_or_miles"):
            filter_labels.append("rewards:points_or_miles")
        if fl.get("earn_cashback"):
            filter_labels.append("rewards:cashback")
        if fl.get("earn_investback"):
            filter_labels.append("rewards:investback")
        if fl.get("has_cashlike_return"):
            filter_labels.append("rewards:return_cashlike")
        if (
            c["identity"].get("product_kind")
            == "generic_market_category_article"
        ):
            filter_labels.append("meta:generic_article")

        application_url = evidence.get("application_url")
        direct_source_url = (
            application_url
            if application_url and application_url != UNKNOWN
            else evidence.get("primary_evidence_url", UNKNOWN)
        )
        source_label = (
            "Link direto do cartão"
            if application_url and application_url != UNKNOWN
            else evidence.get("source_name", UNKNOWN)
        )

        rows.append(
            {
                "card_stable_id": c["identity"]["stable_id"],
                "display_name": c["identity"]["display_name"],
                "issuer_raw": c["identity"]["issuer"].get("raw") or UNKNOWN,
                "network_primary": c["identity"].get("network_primary") or UNKNOWN,
                "variant_band": c["identity"].get("variant_band") or UNKNOWN,
                "market_segment_guess": c.get("categorization", {}).get(
                    "market_segment_guess", UNKNOWN
                ),
                "product_kind": c["identity"].get("product_kind") or UNKNOWN,
                "verification_cross_check_status": v.get(
                    "cross_check_status", UNKNOWN
                ),
                "verification_confidence_0_to_1": v.get(
                    "confidence_score_0_to_1", UNKNOWN
                ),
                "primary_evidence_url": evidence.get("primary_evidence_url", UNKNOWN),
                "application_url": application_url or UNKNOWN,
                "review_source_url": evidence.get("primary_evidence_url", UNKNOWN),
                "source_label": source_label,
                "review_source_label": evidence.get("source_name", UNKNOWN),
                "source_tier": evidence.get("source_tier", UNKNOWN),
                "source_url": direct_source_url,
                "ranking_position": (c.get("ranking") or {}).get("source_rank", UNKNOWN),
                "ranking_score": (c.get("ranking") or {}).get("source_score", UNKNOWN),
                "media": {
                    "card_art_url": media.get("card_art_url", UNKNOWN),
                    "alt_text": media.get("alt_text", c["identity"]["display_name"]),
                    "source_url": media.get("source_url", UNKNOWN),
                },
                "reward_return": {
                    "has_cashlike_return": bool(
                        reward_return.get("has_cashlike_return")
                    ),
                    "subtypes": reward_return.get("subtypes") or [],
                    "earning_summary": reward_return.get("earning_summary", UNKNOWN),
                },
                "lounge_access": {
                    "has_lounge_access": bool(tp.get("airport_lounge_offered")),
                    "programs": tp.get("airport_lounge_programs_detected") or [],
                    "unlimited": bool(tp.get("airport_lounge_unlimited_claim")),
                    "annual_visits": tp.get("airport_lounge_annual_visits_hint", UNKNOWN),
                    "guest_policy": tp.get("airport_lounge_guest_policy", UNKNOWN),
                    "complimentary_access_confirmed": bool(
                        tp.get("airport_lounge_complimentary_access_confirmed")
                    ),
                    "policy_varies_by_issuer": bool(
                        tp.get("airport_lounge_policy_varies_by_issuer")
                    ),
                    "summary": tp.get("official_airport_lounge_summary", UNKNOWN),
                },
                "eligibility": eligibility_facet,
                "benefit_groups": benefit_groups,
                "characteristics": characteristics,
                "facets_numeric_or_special": {
                    "annual_fee_brl_best_estimate": annual_est,
                    "monthly_fee_brl_after_intro_official_hint": monthly_fee
                    if monthly_fee is not None
                    else UNKNOWN,
                    "minimum_income_brl_best_estimate": min_income,
                    "minimum_investment_brl_best_estimate": min_inv,
                    "lounge_visits_per_year_hint": lounge_visits
                    if lounge_visits is not None
                    else UNKNOWN,
                    "official_forex_or_iof_note": tp.get(
                        "forex_spread_or_iof_text"
                    )
                    or UNKNOWN,
                },
                "facets_boolean": {
                    "has_any_lounge_claim": bool(fl.get("has_any_lounge_claim")),
                    "has_named_lounge_program": bool(
                        fl.get("has_named_lounge_program")
                    ),
                    "lounge_unlimited_claim": bool(
                        tp.get("airport_lounge_unlimited_claim")
                    ),
                    "earn_points_or_miles": bool(fl.get("earn_points_or_miles")),
                    "earn_cashback": bool(fl.get("earn_cashback")),
                    "earn_investback": bool(fl.get("earn_investback")),
                    "reward_return_cashlike": bool(fl.get("has_cashlike_return")),
                    "mentions_travel_insurance": bool(
                        fl.get("mentions_travel_insurance")
                    ),
                    "mentions_concierge": bool(fl.get("mentions_concierge")),
                    "co_brand_name_detected": bool(
                        c.get("categorization", {}).get(
                            "co_brand_detected_from_name"
                        )
                    ),
                    "issuer_multi_entity_row": bool(
                        fl.get("issuer_is_multi_entity_list")
                    ),
                    "generic_article_not_single_product": (
                        c["identity"].get("product_kind")
                        == "generic_market_category_article"
                    ),
                },
                "labels_for_filtering": filter_labels[:16],
                "text_for_embedding_compare": build_embedding_compare_text(c),
            }
        )

    return {
        "facets_meta": {
            "schema_version": "1.0",
            "unknown_sentinel": UNKNOWN,
            "purpose": "Flattened card facets for LLM tool calls, reranking, and cosine similarity on text_for_embedding_compare",
            "paired_nested_catalog": OUT.name,
        },
        "cards": rows,
    }


def normalize_issuer(raw: str | None) -> dict[str, Any]:
    if not raw or not str(raw).strip():
        return {"raw": "", "normalized": "UNKNOWN", "is_multi_issuer_listing": False}
    r = str(raw).strip()
    multi = "," in r or " e " in r.lower() or "vários" in r.lower()
    return {"raw": r, "normalized": r, "is_multi_issuer_listing": multi}


def product_kind(name: str, issuer_raw: str) -> str:
    n = fold(name)
    if n == "cartao black" or "cartões black" in n:
        return "generic_market_category_article"
    if "vários" in fold(issuer_raw) or issuer_raw.count(",") > 3:
        return "generic_market_category_article"
    return "named_credit_card_product"


def issuer_is_xp_family(raw: str | None) -> bool:
    f = fold(raw or "")
    return (
        f == "xp"
        or f.startswith("xp ")
        or "xp investimentos" in f
        or "xp inc" in f
        or "xp private" in f
    )


OFFICIAL_SNIPPETS: dict[str, dict[str, Any]] = {
    "xp_product_matrix": {
        "source_url": "https://www.xpi.com.br/produtos/cartao-de-credito/",
        "refreshed_from_official_page": True,
        # Verbatim column semantics from the comparison table on the official page (Legacy | Infinite | One).
        "official_comparison_table_pt": {
            "columns_order": ["Legacy", "Infinite", "One"],
            "elegibilidade_investimentos_liquidos_minimos": {
                "Legacy": "A partir de R$ 1 milhão em investimentos líquidos",
                "Infinite": "A partir de R$ 50 mil em investimentos líquidos",
                "One": "A partir de R$ 5 mil em investimentos líquidos",
            },
            "anuidade": {
                "Legacy": "R$ 350/mês, com 3 meses grátis. (Possibilidades de desconto e isenção)",
                "Infinite": "Zero, para sempre",
                "One": "Zero, para sempre",
            },
            "investback_com_turbo_beneficios": {
                "Legacy": "5,5% com Turbo Benefícios em compras internacionais e 1,7% com Turbo Benefícios em compras nacionais",
                "Infinite": "Até 1,5% com Turbo Benefícios",
                "One": "Até 1,1% com Turbo Benefícios",
            },
            "pontos_xp_por_dolar_com_turbo_beneficios": {
                "Legacy": "Até 10 pontos XP/USD com Turbo Benefícios em compras internacionais e Até 3,5 pontos XP/USD com Turbo Benefícios em compras nacionais",
                "Infinite": "Até 3,0 pontos com Turbo Benefícios",
                "One": "Até 1,8 pontos com Turbo Benefícios",
            },
            "design_cartao": {"Legacy": "Metal", "Infinite": "Plástico", "One": "Plástico"},
            "sala_vip": {
                "Legacy": "Ilimitado +12 acompanhantes",
                "Infinite": "4 acessos por ano",
                "One": "2 acessos por ano",
            },
            "concierge": {
                "Legacy": "Concierge Cartão XP Legacy Reconhecido pela Forbes Travel Guide",
                "Infinite": "Concierge Visa Infinite",
                "One": "Concierge Visa Infinite",
            },
        },
        "lines": {
            "Legacy": {
                "eligibility_minimum_liquid_investments_brl": 1_000_000,
                "annual_fee_model": "R$ 350/mês, com 3 meses grátis. (Possibilidades de desconto e isenção)",
                "investback_turbo_international_max_pct": 5.5,
                "investback_turbo_domestic_max_pct": 1.7,
                "points_xp_per_usd_international_max": 10.0,
                "points_xp_per_usd_domestic_max": 3.5,
                "card_material": "metal",
                "vip_access": "Ilimitado +12 acompanhantes (titular; conforme tabela oficial XP)",
                "concierge": "Concierge Cartão XP Legacy Reconhecido pela Forbes Travel Guide",
            },
            "Infinite": {
                "eligibility_minimum_liquid_investments_brl": 50_000,
                "annual_fee_model": "Zero, para sempre",
                "investback_turbo_max_pct": 1.5,
                "points_xp_per_usd_max": 3.0,
                "card_material": "plastic",
                "vip_access": "4 acessos por ano",
                "concierge": "Concierge Visa Infinite",
            },
            "One": {
                "eligibility_minimum_liquid_investments_brl": 5_000,
                "annual_fee_model": "Zero, para sempre",
                "investback_turbo_max_pct": 1.1,
                "points_xp_per_usd_max": 1.8,
                "card_material": "plastic",
                "vip_access": "2 acessos por ano",
                "concierge": "Concierge Visa Infinite",
            },
        },
        "shared_official_benefits": [
            "Até 6 cartões adicionais sem custo (detalhes na FAQ oficial)",
            "Apple Pay, Google Pay e Samsung Pay",
            "Central de Benefícios no app XP",
            "Benefícios Visa Infinite na linha Infinite/One/Legacy (onde aplicável)",
            "Fast Pass no embarque em GRU e GIG (benefício Visa Infinite onde aplicável)",
            "Seguros de viagem Visa (onde aplicável à linha)",
        ],
    },
    "nubank_ultravioleta": {
        "source_url": "https://nubank.com.br/ultravioleta/",
        "card_url": "https://nubank.com.br/ultravioleta/cartao",
        "points_cashback_url": "https://nubank.com.br/ultravioleta/cartao-black/pontos-cashback",
        "lounge_url": "https://nubank.com.br/ultravioleta/sala-vip",
        "refreshed_from_official_page": True,
        "monthly_fee_brl_if_not_waived": 89,
        "monthly_fee_waiver_conditions_official": [
            "Gastos no cartão de crédito acima de R$ 8.000 no período relevante",
            "OU R$ 50.000 guardados ou investidos no Nubank",
        ],
        "earning_rules_official": [
            "1,25% de cashback em compras no cartão de crédito Ultravioleta",
            "A partir de 2,2 pontos por dólar gasto, quando o cliente escolhe pontos",
            "9 pontos por dólar ou 5% de cashback em passagens aéreas e hotéis pelo Nu Viagens",
        ],
        "forex_or_iof_official": "IOF zero em compras internacionais no cartão de crédito Ultravioleta",
        "lounge_policy_official": (
            "Acesso gratuito e ilimitado ao Nubank Ultravioleta Lounge em GRU; "
            "4 visitas por ano à rede Priority Pass compartilhadas entre titular, acompanhante e adicionais; "
            "acesso à Sala VIP Mastercard Black conforme regras da bandeira."
        ),
        "experience_benefits_official": [
            "Casa Ultravioleta no Ibirapuera: estacionamento gratuito via NuTag, Wi‑Fi, carregadores, café/frutas, banheiros privativos com Toalhas Trousseau e amenities L'Occitane (conforme página oficial)",
            "Condições exclusivas para HBO Max",
            "2 NuTags gratuitas sem custo de recarga/taxas escondidas/mensalidade da tag (conforme página oficial)",
            "Cartão Mastercard Black dentro da experiência Ultravioleta (página oficial)",
            "Sem regra pública de renda mínima; análise de crédito na solicitação e revisões periódicas (FAQ oficial)",
        ],
    },
    "rico_visa_infinite": {
        "source_url": "https://www.rico.com.vc/produtos/cartao-de-credito",
        "refreshed_from_official_page": True,
        "eligibility_minimum_first_investment_brl": 1000,
        "annual_fee_official": "Sem anuidade",
        "investback_tiers_official": [
            "Gastos entre R$ 1.500 e R$ 2.999,99: 0,5% Investback no mês",
            "Gastos acima de R$ 3.000: até 1% Investback no mês",
        ],
        "official_bullets": [
            "6 cartões adicionais gratuitos",
            "Benefícios Visa Infinite",
            "Central de atendimento WhatsApp/app",
            "Apple Pay, Samsung Pay, Google Pay",
            "Cartão virtual para crédito e débito",
            "Débito e crédito no mesmo cartão físico",
            "Pontos resgatáveis via Central Livelo",
            "Análise cadastro/compliance/crédito até 14 dias úteis",
        ],
    },
}


def apply_official_overrides(card: dict[str, Any], enriched: dict[str, Any]) -> None:
    """Mutates enriched with official_snapshot when product matches."""
    name = fold(card.get("card_name") or "")
    issuer = fold(card.get("issuer_bank_or_cooperative") or "")

    if "nubank" in issuer and "ultravioleta" in name:
        nu = OFFICIAL_SNIPPETS["nubank_ultravioleta"]
        enriched["official_product_snapshot"] = {
            "product": "Nubank Ultravioleta",
            **nu,
        }
        enriched["fees"]["subscription_monthly"] = {
            "charge_brl_if_not_waived": nu["monthly_fee_brl_if_not_waived"],
            "waiver_conditions_text_lines": nu["monthly_fee_waiver_conditions_official"],
        }
        enriched["benefits"]["official_highlights"] = nu["experience_benefits_official"]
        enriched["rewards"]["prefer_embedded_official_over_aggregate_text"] = True

    if "rico" in issuer and "rico" in name:
        rc = OFFICIAL_SNIPPETS["rico_visa_infinite"]
        enriched["official_product_snapshot"] = {"product": "Rico Visa Infinite", **rc}
        enriched["rewards"]["investback_schedule_official"] = rc[
            "investback_tiers_official"
        ]
        enriched["eligibility"]["minimum_first_investment_brl_official"] = rc[
            "eligibility_minimum_first_investment_brl"
        ]
        enriched["rewards"]["prefer_embedded_official_over_aggregate_text"] = True

    cn = fold(card.get("card_name") or "")
    if issuer_is_xp_family(card.get("issuer_bank_or_cooperative")):
        xm = OFFICIAL_SNIPPETS["xp_product_matrix"]
        line = None
        if "privilege" in cn:
            line = None
            enriched["data_quality_notes"].append(
                "Produto XP Visa Infinite Privilege não pertence à matriz regular XP Legacy/Infinite/One; usa ficha própria e revisão manual."
            )
        elif "legacy" in cn:
            line = "Legacy"
        elif re.search(r"\bone\b", cn):
            line = "One"
        elif "infinite" in cn:
            line = "Infinite"
        # "XP Visa Privilege" etc.: não aplicar matriz — são produtos distintos.
        if line:
            enriched["official_product_snapshot"] = {
                "product_family": "XP Visa Infinite",
                "matched_line": line,
                **xm,
                "line_detail": xm["lines"][line],
            }
            enriched["data_quality_notes"].append(
                "Produto XP mapeado para uma linha da matriz Legacy/Infinite/One conforme nome da fonte; alinhamento detalhado à página oficial da XP quando finalize_embedded roda."
            )


def merge_official_snapshot_into_fields(enriched: dict[str, Any]) -> None:
    """Prefer authoritative fields embedded in official snapshots."""
    snap = enriched.get("official_product_snapshot")
    if not snap:
        return
    if snap.get("product") == "Nubank Ultravioleta":
        monthly_fee = snap.get("monthly_fee_brl_if_not_waived")
        if monthly_fee is not None:
            enriched["fees"]["annual"] = {
                "primary_source": "official_nubank_ultravioleta_page",
                "official_reference_url": snap.get("source_url", ""),
                "has_explicit_amount": True,
                "raw_text": f"R$ {monthly_fee}/mês",
                "amount_brl_numeric": monthly_fee * 12,
                "monthly_fee_brl_after_intro_months": monthly_fee,
                "is_zero_fee_claim": False,
                "official_fee_policy_summary": (
                    f"Mensalidade de R$ {monthly_fee}; isenta com gastos acima de R$ 8.000/mês "
                    "ou R$ 50.000 guardados/investidos no Nubank."
                ),
            }
        enriched["rewards"]["earning_rules_text"] = "; ".join(
            snap.get("earning_rules_official") or []
        )
        enriched["rewards"]["return_cashlike"] = {
            "has_points_or_miles": True,
            "has_cashlike_return": True,
            "subtypes": ["cashback"],
            "earning_summary": "1,25% de cashback geral; 5% apenas em Nu Viagens",
        }
        enriched["rewards"]["prefer_embedded_official_over_aggregate_text"] = True
        characteristics = (enriched.get("benefits") or {}).setdefault(
            "characteristics", []
        )
        characteristics[:] = [
            item
            for item in characteristics
            if item.get("key") not in {"earning_rate", "earning_detail"}
        ]
        characteristics.extend(
            [
                as_characteristic(
                    "rewards",
                    "earning_rate",
                    "Pontuação",
                    "1,25% de cashback geral ou a partir de 2,2 pontos por dólar gasto",
                    details="Fonte oficial Nubank Ultravioleta",
                ),
                as_characteristic(
                    "rewards",
                    "earning_detail",
                    "Bônus Nu Viagens",
                    "5% de cashback apenas em passagens aéreas e hotéis pelo Nu Viagens",
                    details="Benefício específico, não retorno geral do cartão",
                ),
            ]
        )
        enriched["travel_and_protection"]["official_airport_lounge_summary"] = snap.get(
            "lounge_policy_official", ""
        )
        enriched["travel_and_protection"]["airport_lounge_offered"] = True
        enriched["travel_and_protection"]["airport_lounge_unlimited_claim"] = True
        enriched["travel_and_protection"]["airport_lounge_annual_visits_hint"] = 4
        enriched["travel_and_protection"]["airport_lounge_programs_detected"] = [
            "Nubank Ultravioleta Lounge",
            "Priority Pass",
            "Sala VIP Mastercard Black",
        ]
        enriched["travel_and_protection"]["forex_spread_or_iof_text"] = snap.get(
            "forex_or_iof_official", ""
        )
        enriched["eligibility"]["requirements_text"] = (
            "Sem regra pública de renda mínima; sujeito à análise de crédito Nubank."
        )
    if snap.get("product") == "Rico Visa Infinite":
        if snap.get("annual_fee_official"):
            enriched["fees"]["annual"]["official_fee_policy_summary"] = snap[
                "annual_fee_official"
            ]
        mi = snap.get("eligibility_minimum_first_investment_brl")
        if mi is not None:
            enriched["eligibility"]["minimum_first_investment_brl_official"] = mi
        if snap.get("investback_tiers_official"):
            enriched["rewards"]["official_investback_tiers"] = snap[
                "investback_tiers_official"
            ]
    ld = snap.get("line_detail")
    if isinstance(ld, dict):
        inv = ld.get("eligibility_minimum_liquid_investments_brl")
        if inv is not None:
            enriched["eligibility"]["minimum_liquid_investments_brl_official"] = inv
        fee_txt = ld.get("annual_fee_model")
        if fee_txt:
            enriched["fees"]["annual"]["official_fee_policy_summary"] = fee_txt
            enriched["fees"]["annual"]["always_zero_fee_official_claim"] = (
                "zero" in fold(fee_txt) and "meses" not in fold(fee_txt)
            )
        cm = ld.get("card_material")
        if cm:
            enriched["card_physical"]["material_official"] = cm
            enriched["card_physical"]["is_metal_claim"] = "metal" in fold(cm)
        vip = ld.get("vip_access")
        if vip:
            enriched["travel_and_protection"][
                "official_airport_lounge_summary"
            ] = vip
        cx = ld.get("concierge")
        if cx:
            enriched["travel_and_protection"]["concierge_official_summary"] = cx
            enriched["travel_and_protection"]["concierge_mentioned"] = True
        ipp_i = ld.get("investback_turbo_international_max_pct")
        ipp_d = ld.get("investback_turbo_domestic_max_pct")
        ipp = ld.get("investback_turbo_max_pct")
        pxp_i = ld.get("points_xp_per_usd_international_max")
        pxp_d = ld.get("points_xp_per_usd_domestic_max")
        pxp = ld.get("points_xp_per_usd_max")
        if any(
            v is not None for v in (ipp_i, ipp_d, ipp, pxp_i, pxp_d, pxp)
        ):
            enriched["rewards"]["official_earn_ceiling"] = {
                k: v
                for k, v in (
                    ("investback_turbo_pct_international_max", ipp_i),
                    ("investback_turbo_pct_domestic_max", ipp_d),
                    ("investback_turbo_pct_max", ipp),
                    ("points_xp_per_usd_international_max", pxp_i),
                    ("points_xp_per_usd_domestic_max", pxp_d),
                    ("points_xp_per_usd_max", pxp),
                )
                if v is not None
            }
            enriched["rewards"][
                "prefer_official_xp_matrix_over_secondary_article_text"
            ] = True
            enriched["rewards"][
                "prefer_embedded_official_over_aggregate_text"
            ] = True


def finalize_embedded_official_authoritative_overwrites(
    enriched: dict[str, Any], raw: dict[str, Any]
) -> None:
    """Overwrite scraped fields when an embedded official snippet matched (XP Legacy/Infinite/One matrix today)."""
    snap = enriched.get("official_product_snapshot") or {}
    if snap.get("product_family") != "XP Visa Infinite":
        return
    line = snap.get("matched_line")
    if not line:
        return
    tbl = snap.get("official_comparison_table_pt") or {}
    ld = snap.get("line_detail") or {}

    row_elig = (tbl.get("elegibilidade_investimentos_liquidos_minimos") or {}).get(line)
    if row_elig:
        enriched["eligibility"]["requirements_text_verified_official"] = row_elig
        enriched["eligibility"]["requirements_text"] = row_elig

    ib_pt = (tbl.get("investback_com_turbo_beneficios") or {}).get(line, "")
    pts_pt = (tbl.get("pontos_xp_por_dolar_com_turbo_beneficios") or {}).get(line, "")
    earn_txt = f"Pontos XP (Turbo Benefícios): {pts_pt}. Investback (Turbo Benefícios): {ib_pt}."
    enriched["rewards"]["earning_rules_verified_official_pt"] = earn_txt
    enriched["rewards"]["earning_rules_text"] = earn_txt
    enriched["rewards"]["prefer_embedded_official_over_aggregate_text"] = True
    enriched["rewards"]["prefer_official_xp_matrix_over_secondary_article_text"] = True

    if line in ("Infinite", "One"):
        enriched["fees"]["annual"] = {
            "primary_source": "official_xp_comparison_table",
            "official_reference_url": snap.get("source_url", ""),
            "has_explicit_amount": True,
            "amount_brl_numeric": 0,
            "raw_text": "Zero, para sempre (tabela oficial XP — cartões Infinite e One)",
            "is_zero_fee_claim": True,
            "official_fee_policy_summary": ld.get("annual_fee_model", ""),
            "always_zero_fee_official_claim": True,
        }
    elif line == "Legacy":
        enriched["fees"]["annual"] = {
            "primary_source": "official_xp_comparison_table",
            "official_reference_url": snap.get("source_url", ""),
            "monthly_fee_brl_after_intro_months": 350,
            "complimentary_first_months_official": 3,
            "raw_text": ld.get(
                "annual_fee_model",
                "R$ 350/mês, com 3 meses grátis. (Possibilidades de desconto e isenção)",
            ),
            "has_explicit_amount": False,
            "is_zero_fee_claim": False,
            "official_fee_policy_summary": ld.get("annual_fee_model", ""),
            "always_zero_fee_official_claim": False,
        }

    sala = (tbl.get("sala_vip") or {}).get(line)
    if sala:
        enriched["travel_and_protection"]["official_airport_lounge_summary"] = sala

    cx = (tbl.get("concierge") or {}).get(line)
    if cx:
        enriched["travel_and_protection"]["concierge_official_summary"] = cx
        enriched["travel_and_protection"]["concierge_mentioned"] = True

    caveats = (raw.get("drawbacks_or_constraints") or "").strip()
    if caveats:
        enriched["evidence"]["superseded_secondary_caveats_text"] = caveats
        enriched["constraints"]["caveats_text"] = (
            "Restrições copiadas de sites agregadores foram arquivadas em "
            "evidence.superseded_secondary_caveats_text; use app XP e FAQ oficial para regras vigentes."
        )
    else:
        enriched["constraints"]["caveats_text"] = (
            "Sujeito a análise de crédito e elegibilidade no app XP; consulte FAQ oficial para Turbo Benefícios e salas VIP."
        )

    head_bits = [earn_txt, row_elig or "", enriched["fees"]["annual"].get("raw_text", ""), sala or ""]
    head_bits = [b for b in head_bits if b]
    enriched["benefits"]["atomic_benefit_statements"] = atomize_benefits(
        *head_bits, *enriched["benefits"]["atomic_benefit_statements"]
    )


def apply_curated_official_overrides_to_catalog_card(card: dict[str, Any]) -> None:
    """Apply curated official snippets to cards produced by the PP parser."""
    identity = card.get("identity") or {}
    issuer = identity.get("issuer") or {}
    raw_like = {
        "card_name": identity.get("display_name") or "",
        "issuer_bank_or_cooperative": issuer.get("raw") or "",
        "drawbacks_or_constraints": (card.get("constraints") or {}).get("caveats_text", ""),
    }

    card.setdefault("eligibility", {})
    card.setdefault("fees", {}).setdefault("annual", {})
    card.setdefault("rewards", {})
    card.setdefault("travel_and_protection", {})
    card.setdefault("benefits", {}).setdefault("atomic_benefit_statements", [])
    card.setdefault("constraints", {})
    card.setdefault("card_physical", {})
    card.setdefault("data_quality_notes", [])

    before_snapshot = card.get("official_product_snapshot")
    apply_official_overrides(raw_like, card)
    merge_official_snapshot_into_fields(card)
    finalize_embedded_official_authoritative_overwrites(card, raw_like)

    if card.get("official_product_snapshot") and not before_snapshot:
        card["data_quality_notes"].append(
            "Campos principais alinhados a snippet oficial curado no gerador; dados de ranking agregador mantidos em claims/evidence."
        )
        verification = card.setdefault("verification", {})
        verification["embedded_official_snippet_applied"] = True
        verification["cross_check_status"] = "trusted_catalog_with_curated_official_override"
        verification["confidence_score_0_to_1"] = max(
            float(verification.get("confidence_score_0_to_1") or 0), 0.88
        )
    card["semantic_audit"] = evaluate_semantic_claims(card)


def deep_merge_dict(base: dict[str, Any], patch: dict[str, Any]) -> None:
    for key, value in patch.items():
        if key in {"review_note", "append_characteristics", "replace_characteristics_by_key"}:
            continue
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge_dict(base[key], value)
        else:
            base[key] = value


def apply_manual_review_overrides(cards: list[dict[str, Any]]) -> None:
    overrides = load_manual_review_overrides()
    if not overrides:
        return
    by_id = {
        (card.get("identity") or {}).get("stable_id"): card
        for card in cards
    }
    for stable_id, patch in overrides.items():
        card = by_id.get(stable_id)
        if not card:
            continue
        deep_merge_dict(card, patch)
        replace_keys = set(patch.get("replace_characteristics_by_key") or [])
        if replace_keys:
            characteristics = card.setdefault("benefits", {}).setdefault(
                "characteristics", []
            )
            characteristics[:] = [
                item for item in characteristics if item.get("key") not in replace_keys
            ]
        for item in patch.get("append_characteristics") or []:
            card.setdefault("benefits", {}).setdefault("characteristics", []).append(item)
        if patch.get("append_characteristics") or replace_keys:
            card["benefits"]["benefit_groups"] = build_groups_from_characteristics(
                card["benefits"]["characteristics"]
            )
            card["benefits"]["atomic_benefit_statements"] = [
                f"{item['label']}: {item['value']}"
                + (f" - {item['details']}" if item.get("details") else "")
                for item in card["benefits"]["characteristics"]
            ][:40]
        note = patch.get("review_note")
        if note:
            card.setdefault("data_quality_notes", []).append(f"Revisão manual: {note}")
        normalize_cashback_summary(card)
        card["semantic_audit"] = evaluate_semantic_claims(card)


def build_card(raw: dict[str, Any]) -> dict[str, Any]:
    name = (raw.get("card_name") or "").strip() or "UNKNOWN_CARD"
    issuer_info = normalize_issuer(raw.get("issuer_bank_or_cooperative"))
    issuer_raw = issuer_info["raw"] or "UNKNOWN"

    blob = " ".join(
        str(raw.get(k) or "")
        for k in (
            "annual_fee_waiver_rules",
            "minimum_income_or_investment_requirement",
            "points_or_cashback_earn_rules",
            "points_programs",
            "points_expiration",
            "lounge_access_rules",
            "forex_spread_or_exchange_rules",
            "extra_benefits",
            "drawbacks_or_constraints",
        )
    )

    travel = infer_travel_flags(blob + " " + str(raw.get("lounge_access_rules") or ""))
    rewards = infer_rewards_flags(blob)
    fee_hints = infer_fee_flags(
        raw.get("annual_fee_waiver_rules"), raw.get("annual_fee_brl")
    )

    fee_parse = parse_money_brl(raw.get("annual_fee_brl"))

    benefits_list = atomize_benefits(
        raw.get("extra_benefits"),
        raw.get("lounge_access_rules"),
        raw.get("points_or_cashback_earn_rules"),
        raw.get("annual_fee_waiver_rules"),
    )

    material = (raw.get("material_if_any") or "").strip().lower()
    mat_map = {
        "metal": "metal",
        "metálico": "metal",
        "plástico": "plastic",
        "plastico": "plastic",
    }

    freshness = freshness_signals(blob)

    enriched: dict[str, Any] = {
        "identity": {
            "stable_id": slug_id(name, issuer_raw),
            "display_name": name,
            "issuer": issuer_info,
            "network_primary": (raw.get("network") or "").strip(),
            "variant_band": (raw.get("variant_tier") or "").strip(),
            "product_kind": product_kind(name, issuer_raw),
        },
        "categorization": {
            "market_segment_guess": classify_segment(
                raw.get("variant_tier"), raw.get("network")
            ),
            "co_brand_detected_from_name": bool(
                re.search(
                    r"gol|smiles|latam|amazon|cvc|decathlon|vivo|walmart|disney|azul|polo|marisa|banese",
                    fold(name),
                )
            ),
        },
        "card_physical": {
            "material": mat_map.get(material, material if material else ""),
            "is_metal_claim": "metal" in material or "metálico" in material,
        },
        "eligibility": {
            "requirements_text": (
                raw.get("minimum_income_or_investment_requirement") or ""
            ).strip(),
            "requires_bank_account_claim": "correntista" in fold(
                raw.get("drawbacks_or_constraints") or ""
            ),
        },
        "fees": {
            "annual": {
                **fee_parse,
                "is_zero_fee_claim": bool(
                    re.search(r"^(0+|r\$?\s*0)", fold(str(raw.get("annual_fee_brl"))))
                ),
            },
            "waiver_and_discounts": {
                "policy_text": (raw.get("annual_fee_waiver_rules") or "").strip(),
                **fee_hints,
            },
        },
        "rewards": {
            "earning_rules_text": (
                raw.get("points_or_cashback_earn_rules") or ""
            ).strip(),
            "loyalty_programs_text": (raw.get("points_programs") or "").strip(),
            "points_expiration_text": (raw.get("points_expiration") or "").strip(),
            "points_never_expire_claim": "nunca expira" in fold(
                raw.get("points_expiration") or ""
            )
            or "nao expiram" in fold(raw.get("points_expiration") or ""),
            **rewards,
        },
        "travel_and_protection": {
            **travel,
            "forex_spread_or_iof_text": extract_percent(
                raw.get("forex_spread_or_exchange_rules") or ""
            )
            or (raw.get("forex_spread_or_exchange_rules") or "").strip(),
        },
        "benefits": {
            "atomic_benefit_statements": benefits_list,
        },
        "constraints": {
            "caveats_text": (raw.get("drawbacks_or_constraints") or "").strip(),
        },
        "evidence": {
            **classify_source(raw.get("source_url")),
            "scraped_field_snapshot": {
                "annual_fee_brl": raw.get("annual_fee_brl"),
                "annual_fee_waiver_rules": raw.get("annual_fee_waiver_rules"),
                "minimum_income_or_investment_requirement": raw.get(
                    "minimum_income_or_investment_requirement"
                ),
                "points_or_cashback_earn_rules": raw.get(
                    "points_or_cashback_earn_rules"
                ),
                "points_programs": raw.get("points_programs"),
                "points_expiration": raw.get("points_expiration"),
                "lounge_access_rules": raw.get("lounge_access_rules"),
                "forex_spread_or_exchange_rules": raw.get(
                    "forex_spread_or_exchange_rules"
                ),
                "extra_benefits": raw.get("extra_benefits"),
                "drawbacks_or_constraints": raw.get("drawbacks_or_constraints"),
            },
        },
        "data_quality_notes": [],
        "freshness": freshness,
    }

    # Flags cleanup: remove nested None from travel hints
    if enriched["travel_and_protection"].get("airport_lounge_annual_visits_hint") is None:
        enriched["travel_and_protection"].pop("airport_lounge_annual_visits_hint", None)

    promo_deadline = re.search(
        r"\d{2}/\d{2}/\d{4}", raw.get("annual_fee_waiver_rules") or ""
    )
    if promo_deadline:
        enriched["data_quality_notes"].append(
            f"Possível condição promocional com data explícita ({promo_deadline.group(0)}); validar vigência no emissor."
        )
    if freshness.get("contains_date_before_reference_as_of"):
        enriched["data_quality_notes"].append(
            f"Texto contém datas anteriores a {REFERENCE_AS_OF_DATE.isoformat()} — regra/anúncio pode estar desatualizado."
        )

    if enriched["identity"]["product_kind"] == "generic_market_category_article":
        enriched["data_quality_notes"].append(
            "Registro agrega categoria de mercado (ex.: Black genérico), não um produto único — não use como ficha de produto."
        )

    apply_official_overrides(raw, enriched)
    merge_official_snapshot_into_fields(enriched)

    snap = enriched.get("official_product_snapshot")
    if snap:
        for key in (
            "shared_official_benefits",
            "official_bullets",
            "experience_benefits_official",
        ):
            block = snap.get(key)
            if isinstance(block, list):
                merged = enriched["benefits"]["atomic_benefit_statements"] + block
                seen: set[str] = set()
                dedup: list[str] = []
                for item in merged:
                    fk = fold(item)
                    if fk in seen or not item.strip():
                        continue
                    seen.add(fk)
                    dedup.append(item.strip())
                enriched["benefits"]["atomic_benefit_statements"] = dedup

    finalize_embedded_official_authoritative_overwrites(enriched, raw)

    if enriched.get("rewards", {}).get(
        "prefer_embedded_official_over_aggregate_text"
    ):
        enriched["data_quality_notes"].append(
            "Trechos principais foram sobrescritos por snippet oficial embutido no gerador (XP Rico/Nubank etc. quando há match); "
            "demais dados agregados permanecem em evidence.scraped_field_snapshot."
        )

    # Second pass: booleans must exist where promised
    enriched["flags"] = {
        "has_named_lounge_program": bool(
            enriched["travel_and_protection"]["airport_lounge_programs_detected"]
        ),
        "has_any_lounge_claim": enriched["travel_and_protection"][
            "airport_lounge_offered"
        ],
        "mentions_concierge": enriched["travel_and_protection"]["concierge_mentioned"],
        "mentions_travel_insurance": enriched["travel_and_protection"][
            "travel_insurance_mentioned"
        ],
        "earn_points_or_miles": enriched["rewards"]["earn_points_or_miles_mentioned"],
        "earn_cashback": enriched["rewards"]["earn_cashback_mentioned"],
        "earn_investback": enriched["rewards"]["earn_investback_mentioned"],
        "issuer_is_multi_entity_list": issuer_info["is_multi_issuer_listing"],
    }

    attach_cross_check_verification(enriched)

    return enriched


def request_text(url: str, *, timeout: int = 30) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": PP_RANKING_URL,
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "ignore")


def html_to_text(fragment: str) -> str:
    text = fragment
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*/\s*(p|li|ul|ol|div|h[1-6])\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*span[^>]*>", " - ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_lib.unescape(text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    lines = [line.strip(" -") for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def clean_inline_text(fragment: str) -> str:
    return re.sub(r"\s+", " ", html_to_text(fragment)).strip()


def extract_attr(tag: str, attr: str) -> str:
    m = re.search(rf'{attr}="([^"]*)"', tag)
    return html_lib.unescape(m.group(1)).strip() if m else ""


def extract_pp_articles_from_html(html: str) -> list[str]:
    return re.findall(
        r'<article class="card-cartao-ranking-completo"[\s\S]*?</article>',
        html,
    )


def fetch_pp_source_articles(source: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    source_url = source["url"]
    ajax_category = source.get("ajax_category")
    html = request_text(source_url)
    articles = extract_pp_articles_from_html(html)

    archive_page = 2
    while source.get("source_kind") == "category":
        try:
            page_html = request_text(f"{source_url.rstrip('/')}/page/{archive_page}/")
        except Exception:
            break
        page_articles = extract_pp_articles_from_html(page_html)
        if not page_articles:
            break
        articles.extend(page_articles)
        archive_page += 1

    page = 2
    reported_count = None
    if ajax_category:
        while True:
            params = {
                "page": page,
                "per_page": 100,
                "categoria": ajax_category,
                "search-credito": "",
                "pontuacao-min": "0",
                "pontuacao-max": "5.5",
                "anuidade-min": "0",
                "anuidade-max": "30000",
            }
            payload = request_text(f"{PP_AJAX_URL}?{urlencode(params)}")
            data = json.loads(payload)
            reported_count = data.get("count", reported_count)
            chunk = data.get("posts") or ""
            more = extract_pp_articles_from_html(chunk)
            if not more:
                break
            articles.extend(more)
            if len(more) < 100:
                break
            page += 1

    deduped: list[str] = []
    seen: set[str] = set()
    for article in articles:
        title = extract_pp_article_title(article)
        url = extract_pp_article_url(article)
        key = fold(url or title)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(article)

    return deduped, {
        "source_url": source_url,
        "source_label": source["label"],
        "source_kind": source.get("source_kind"),
        "ajax_category": ajax_category,
        "source_reported_count": reported_count,
        "raw_article_count": len(articles),
        "deduped_article_count": len(deduped),
    }


def fetch_pp_ranking_articles() -> tuple[list[str], dict[str, Any]]:
    all_articles: list[str] = []
    source_metas: list[dict[str, Any]] = []
    for source in PP_SOURCE_PAGES:
        articles, meta = fetch_pp_source_articles(source)
        source_metas.append(meta)
        all_articles.extend(articles)

    seen: set[str] = set()
    deduped: list[str] = []
    for article in all_articles:
        title = extract_pp_article_title(article)
        url = extract_pp_article_url(article)
        key = fold(url or title)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(article)

    return deduped, {
        "sources": source_metas,
        "raw_article_count": len(all_articles),
        "deduped_article_count": len(deduped),
    }


def fetch_pp_ranking_articles_legacy() -> tuple[list[str], dict[str, Any]]:
    html = request_text(PP_RANKING_URL)
    articles = re.findall(
        r'<article class="card-cartao-ranking-completo"[\s\S]*?</article>',
        html,
    )

    page = 2
    reported_count = None
    while True:
        params = {
            "page": page,
            "per_page": 100,
            "categoria": 3430,
            "search-credito": "",
            "pontuacao-min": "0",
            "pontuacao-max": "5.5",
            "anuidade-min": "0",
            "anuidade-max": "30000",
        }
        payload = request_text(f"{PP_AJAX_URL}?{urlencode(params)}")
        data = json.loads(payload)
        reported_count = data.get("count", reported_count)
        chunk = data.get("posts") or ""
        more = re.findall(
            r'<article class="card-cartao-ranking-completo"[\s\S]*?</article>',
            chunk,
        )
        if not more:
            break
        articles.extend(more)
        if len(more) < 100:
            break
        page += 1

    deduped: list[str] = []
    seen: set[str] = set()
    for article in articles:
        title = extract_attr(article.split(">", 1)[0], "title")
        key = fold(title)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(article)

    return deduped, {
        "source_url": PP_RANKING_URL,
        "source_reported_count": reported_count,
        "raw_article_count": len(articles),
        "deduped_article_count": len(deduped),
    }


ISSUER_HINTS = (
    ("XP Investimentos", ("xp ", "xp visa", "xp legacy", "xp one")),
    ("Banco do Brasil", ("banco do brasil", "ourocard", "bb ")),
    ("Porto Bank", ("porto bank", "porto seguro", "porto ")),
    ("C6 Bank", ("c6 ", "c6 bank")),
    ("BTG Pactual", ("btg", "ultrablue")),
    ("Banco BV", ("bv ", "banco bv")),
    ("Banco PAN", ("pan ", "banco pan")),
    ("Mercado Pago", ("mercado pago",)),
    ("Banco Bari", ("bari",)),
    ("Banco do Nordeste", ("nordeste",)),
    ("BRB", ("brb", "brbcard")),
    ("Bradesco", ("bradesco",)),
    ("Santander", ("santander",)),
    ("Nubank", ("nubank", "ultravioleta")),
    ("Sicredi", ("sicredi",)),
    ("Sicoob", ("sicoob",)),
    ("Unicred", ("unicred",)),
    ("Uniprime", ("uniprime",)),
    ("Sisprime", ("sisprime",)),
    ("Banrisul", ("banrisul",)),
    ("Banestes", ("banestes",)),
    ("Banese", ("banese",)),
    ("Banpará", ("banpara", "banpará")),
    ("CAIXA", ("caixa",)),
    ("Itaú", ("itau", "itaú", "personnalite", "personnalité")),
    ("Inter", ("inter",)),
    ("Rico", ("rico",)),
    ("Safra", ("safra",)),
    ("PicPay", ("picpay",)),
    ("RappiBank", ("rappi",)),
    ("RecargaPay", ("recargapay",)),
    ("Nomad", ("nomad",)),
    ("AstroPay", ("astropay",)),
    ("Revolut", ("revolut",)),
    ("Original", ("original",)),
    ("modalmais", ("modalmais", "modal mais")),
    ("digio", ("digio",)),
    ("Daycoval", ("daycoval",)),
    ("Cresol", ("cresol",)),
    ("ARQ", ("arq",)),
)


def infer_pp_issuer(name: str, request_url: str = "") -> str:
    haystack = fold(f"{name} {request_url}")
    for issuer, hints in ISSUER_HINTS:
        if any(h in haystack for h in hints):
            return issuer
    return name.split()[0] if name else UNKNOWN


def parse_card_info_list(article: str) -> dict[str, str]:
    info: dict[str, str] = {}
    m = re.search(r'<ul class="card-info-list">([\s\S]*?)</ul>', article)
    if not m:
        return info
    for label, value in re.findall(
        r"<li>\s*<h3>([\s\S]*?)</h3>\s*<p>([\s\S]*?)</p>\s*</li>",
        m.group(1),
    ):
        info[clean_inline_text(label)] = clean_inline_text(value)
    return info


def extract_pp_benefit_blocks(article: str) -> dict[str, str]:
    blocks: dict[str, str] = {}
    for question, response in re.findall(
        r"<div class='question'><span>([\s\S]*?)</span>[\s\S]*?"
        r"<div class='response'[^>]*>([\s\S]*?)</div>\s*</div>",
        article,
    ):
        blocks[clean_inline_text(question)] = response
    return blocks


def extract_pp_article_title(article: str) -> str:
    article_tag = article.split(">", 1)[0]
    return extract_attr(article_tag, "title")


def extract_pp_article_url(article: str) -> str:
    title_link = re.search(r'<h2 class="card-title"><a href="([^"]+)"', article)
    return html_lib.unescape(title_link.group(1)) if title_link else ""


def extract_pp_application_url(article: str) -> str:
    footer = article.split('<div class="card-footer"', 1)
    search_area = footer[1] if len(footer) > 1 else article
    match = re.search(
        r'<a[^>]+href="([^"]+)"[^>]*>\s*SOLICITAR\s+CART[ÃA]O\s*</a>',
        search_area,
        re.I,
    )
    return html_lib.unescape(match.group(1)) if match else ""


def extract_section_items(response_html: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    for heading, body in re.findall(
        r"<h4>([\s\S]*?)</h4>\s*<ul>([\s\S]*?)</ul>",
        response_html,
    ):
        label = clean_inline_text(heading).rstrip(":")
        items = []
        for li in re.findall(r"<li>([\s\S]*?)</li>", body):
            text = clean_inline_text(li)
            if text:
                items.append(text)
        if items:
            sections[label] = items
    intro = response_html.split("<ul>", 1)[0]
    intro_text = html_to_text(intro)
    if intro_text:
        sections.setdefault("Resumo", []).append(intro_text)
    return sections


def classify_benefit_group(heading: str, item: str) -> str:
    f = fold(f"{heading} {item}")
    if any(x in f for x in ("ponto", "milha", "cashback", "investback", "fidelidade", "bonus de adesao")):
        return "rewards"
    if any(x in f for x in ("sala vip", "salas vip", "lounge", "airport", "viagem", "companhia aerea", "transfer")):
        return "travel"
    if any(x in f for x in ("seguro", "proteção", "protecao", "garantia", "bagagem", "locadora")):
        return "insurance"
    if any(x in f for x in ("anuidade", "spread", "correntista", "adicional", "carteira digital", "iof")):
        return "fees"
    if any(x in f for x in ("hotel", "concierge", "restaurante", "hertz", "sixt", "status")):
        return "lifestyle"
    return "issuer_specific"


def infer_variant_band_from_name(name: str, network: str) -> str:
    f = fold(name)
    candidates = (
        "Infinite Privilege",
        "World Legend",
        "Diners Club",
        "Centurion",
        "Platinum",
        "Infinite",
        "Signature",
        "Nanquim",
        "Grafite",
        "Black",
        "Gold",
        "Classic",
        "Standard",
        "Internacional",
    )
    for candidate in candidates:
        if fold(candidate) in f:
            return candidate
    return network


def build_benefit_groups(sections: dict[str, list[str]]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {
        "rewards": [],
        "travel": [],
        "insurance": [],
        "lifestyle": [],
        "fees": [],
        "eligibility": [],
        "issuer_specific": [],
    }
    seen: set[tuple[str, str]] = set()
    for heading, items in sections.items():
        if "resumo" in fold(heading):
            continue
        for item in items:
            group = classify_benefit_group(heading, item)
            label = item if heading in ("Resumo", group) else f"{heading}: {item}"
            if len(label) > 260:
                continue
            key = (group, fold(label))
            if key in seen:
                continue
            seen.add(key)
            groups[group].append(label)
    return {k: v[:12] for k, v in groups.items() if v}


def split_item_value(item: str) -> tuple[str, str]:
    if " - " in item:
        left, right = item.split(" - ", 1)
        return left.strip(), right.strip()
    if ": " in item:
        left, right = item.split(": ", 1)
        return left.strip(), right.strip()
    return item.strip(), ""


def as_characteristic(
    category: str,
    key: str,
    label: str,
    value: Any,
    *,
    details: str = "",
    source_excerpt: str = "",
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "category": category,
        "key": key,
        "label": label,
        "value": value,
    }
    if details:
        out["details"] = details[:220]
    if source_excerpt:
        out["source_excerpt"] = source_excerpt[:260]
    return out


def add_characteristic(
    out: list[dict[str, Any]],
    seen: set[tuple[str, str, str]],
    item: dict[str, Any],
) -> None:
    value = str(item.get("value", "")).strip()
    if not value or value == UNKNOWN:
        return
    key = (str(item.get("category")), str(item.get("key")), fold(value))
    if key in seen:
        return
    seen.add(key)
    out.append(item)


def build_characteristics(
    info: dict[str, str],
    sections: dict[str, list[str]],
    lounge: dict[str, Any],
    reward_return: dict[str, Any],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()

    add_characteristic(
        items,
        seen,
        as_characteristic("fees", "annual_fee", "Anuidade", info.get("Anuidade") or UNKNOWN),
    )
    add_characteristic(
        items,
        seen,
        as_characteristic(
            "rewards",
            "earning_rate",
            "Pontuação",
            reward_return.get("earning_summary") or UNKNOWN,
        ),
    )
    for subtype in reward_return.get("subtypes") or []:
        add_characteristic(
            items,
            seen,
            as_characteristic("rewards", "financial_return", "Retorno financeiro", subtype),
        )

    if lounge.get("has_lounge_access"):
        add_characteristic(
            items,
            seen,
            as_characteristic(
                "travel",
                "lounge_access",
                "Sala VIP",
                "Acesso disponível",
                details="Política variável por emissor"
                if lounge.get("policy_varies_by_issuer")
                else "Gratuidade indicada pela fonte"
                if lounge.get("complimentary_access_confirmed")
                else "",
            ),
        )
        for program in lounge.get("programs") or []:
            add_characteristic(
                items,
                seen,
                as_characteristic("travel", "lounge_program", "Programa de sala VIP", program),
            )
        if lounge.get("guest_policy"):
            add_characteristic(
                items,
                seen,
                as_characteristic(
                    "travel",
                    "lounge_guest_policy",
                    "Acompanhantes em sala VIP",
                    lounge["guest_policy"],
                ),
            )
        if lounge.get("unlimited"):
            add_characteristic(
                items,
                seen,
                as_characteristic("travel", "lounge_visits", "Acessos a sala VIP", "Ilimitados"),
            )
        elif lounge.get("annual_visits"):
            add_characteristic(
                items,
                seen,
                as_characteristic(
                    "travel",
                    "lounge_visits",
                    "Acessos a sala VIP",
                    f"{lounge['annual_visits']} por ano",
                ),
            )

    section_map = {
        "Programa de fidelidade": ("rewards", "loyalty_program", "Programa de fidelidade"),
        "Validade dos pontos": ("rewards", "points_expiration", "Validade dos pontos"),
        "Bônus de adesão": ("rewards", "welcome_bonus", "Bônus de adesão"),
        "Pontuação": ("rewards", "earning_detail", "Regra de pontuação"),
        "Política de isenção da anuidade": ("fees", "fee_waiver", "Isenção da anuidade"),
        "Anuidade": ("fees", "annual_fee_detail", "Anuidade"),
        "Spread do dólar": ("fees", "forex_spread", "Spread do dólar"),
        "Precisa ser correntista?": ("eligibility", "requires_account", "Precisa ser correntista"),
        "Cartões adicionais gratuitos": ("fees", "free_additional_cards", "Adicionais gratuitos"),
        "Carteiras digitais": ("lifestyle", "digital_wallet", "Carteira digital"),
        "Adicionais com os mesmos benefícios do titular": (
            "fees",
            "additional_card_benefits",
            "Adicionais com benefícios",
        ),
    }

    for heading, values in sections.items():
        if "resumo" in fold(heading):
            continue
        mapped = section_map.get(heading)
        if mapped:
            category, key, label = mapped
            for value in values[:8]:
                name, detail = split_item_value(value)
                add_characteristic(
                    items,
                    seen,
                    as_characteristic(category, key, label, name, details=detail),
                )
            continue

        group = classify_benefit_group(heading, " ".join(values[:2]))
        if group == "issuer_specific" and heading == "Resumo":
            continue
        for value in values[:6]:
            if len(value) > 220:
                continue
            name, detail = split_item_value(value)
            add_characteristic(
                items,
                seen,
                as_characteristic(group, fold(heading).replace(" ", "_"), heading, name, details=detail),
            )

    return items[:80]


def build_groups_from_characteristics(
    characteristics: list[dict[str, Any]],
) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for item in characteristics:
        category = str(item.get("category") or "issuer_specific")
        value = str(item.get("value") or "").strip()
        if not value:
            continue
        label = str(item.get("label") or "").strip()
        details = str(item.get("details") or "").strip()
        display = f"{label}: {value}" if label else value
        if details:
            display = f"{display} - {details}"
        groups.setdefault(category, []).append(display)
    return {k: v[:12] for k, v in groups.items()}


def normalize_cashback_summary(card: dict[str, Any]) -> None:
    rewards = card.get("rewards") or {}
    ret = rewards.get("return_cashlike") or {}
    if not ret.get("has_cashlike_return"):
        return
    summary = str(ret.get("earning_summary") or rewards.get("earning_rules_text") or "")
    if not re.search(r"cashback", fold(summary)):
        return
    if not re.search(r"por\s+d[oó]lar|/usd", fold(summary)):
        return

    characteristics = (card.get("benefits") or {}).get("characteristics") or []
    cashback_items = [
        item
        for item in characteristics
        if item.get("key") in {"earning_rate", "earning_detail"}
        and "cashback" in fold(str(item.get("value") or ""))
    ]
    general_rates: list[str] = []
    category_rates: list[str] = []
    for item in cashback_items:
        value = str(item.get("value") or "").strip()
        value_folded = fold(value)
        if not re.search(r"\d+[,.]?\d*\s*%", value):
            continue
        if re.search(r"por\s+d[oó]lar|/usd|amazon|mercado livre|vivo|extra|p[aã]o de a[cç][uú]car", value_folded):
            category_rates.append(value)
            continue
        if not re.search(r"internacion|exterior|nacional|brasil", value_folded):
            general_rates.append(value)

    if not general_rates or not category_rates:
        return

    normalized = (
        f"{general_rates[0]} geral; até {extract_percent(category_rates[-1])} "
        "em categoria/parceiro específico"
    )
    rewards["earning_rules_text"] = normalized
    ret["earning_summary"] = normalized
    for item in characteristics:
        if item.get("key") == "earning_rate":
            item["value"] = normalized
            item["details"] = (
                "Resumo normalizado: percentual maior é categoria/parceiro específico, "
                "não retorno geral do cartão"
            )
            break
    card.setdefault("data_quality_notes", []).append(
        "Resumo de cashback normalizado para não tratar 'até X% por dólar' como retorno geral."
    )


def parse_lounge_access(info: dict[str, str], sections: dict[str, list[str]]) -> dict[str, Any]:
    items: list[str] = []
    for heading, values in sections.items():
        if "sala" in fold(heading) or "lounge" in fold(heading):
            items.extend(values)

    programs = []
    conditional = False
    complimentary = False
    unlimited = False
    max_visits = None
    guest_policies = []
    for item in items:
        f = fold(item)
        if "varia" in f or "consult" in f or "deve ser consultado" in f:
            conditional = True
        if "gratuito" in f or "gratuitos" in f or "ilimit" in f:
            complimentary = True
        if "ilimit" in f:
            unlimited = True
        m = re.search(r"(\d+)\s*(?:acessos|visitas)", f)
        if m:
            max_visits = max(max_visits or 0, int(m.group(1)))
        g = re.search(r"(\d+)\s+acompanhante", f)
        if g:
            guest_policies.append(f"{g.group(1)} acompanhante(s)")
        program = re.split(r"\s+-\s+|acessos|acesso", item, maxsplit=1, flags=re.I)[0]
        program = re.sub(r"^salas?\s+vip\s+do\s+", "", program, flags=re.I).strip()
        if program and fold(program) not in {"sim", "nao", "não"}:
            programs.append(program)

    summary = info.get("Salas VIP") or UNKNOWN
    has_lounge = fold(summary) == "sim" or bool(items)
    unique_programs = []
    seen = set()
    for p in programs:
        key = fold(p)
        if key not in seen:
            seen.add(key)
            unique_programs.append(p)
    return {
        "has_lounge_access": has_lounge,
        "programs": unique_programs[:10],
        "unlimited": unlimited,
        "annual_visits": max_visits,
        "guest_policy": "; ".join(dict.fromkeys(guest_policies)) if guest_policies else "",
        "complimentary_access_confirmed": complimentary and not conditional,
        "policy_varies_by_issuer": conditional,
        "raw_summary": summary,
        "source_excerpt": " | ".join(items[:4]),
    }


def parse_reward_return(info: dict[str, str], sections: dict[str, list[str]]) -> dict[str, Any]:
    blob = " ".join([info.get("Pontuação", ""), *(x for values in sections.values() for x in values)])
    f = fold(blob)
    subtypes = []
    if "cashback" in f or "cash back" in f:
        subtypes.append("cashback")
    if "investback" in f:
        subtypes.append("investback")
    if "credito na fatura" in f or "desconto na fatura" in f:
        subtypes.append("statement_credit")
    has_points = bool(re.search(r"ponto|milha|milhas", f))
    return {
        "has_points_or_miles": has_points,
        "has_cashlike_return": bool(subtypes),
        "subtypes": subtypes,
        "earning_summary": info.get("Pontuação") or UNKNOWN,
    }


def pp_field_source(field: str, excerpt: str = "") -> dict[str, Any]:
    return {
        "field": field,
        "source_tier": "trusted_catalog",
        "source_name": "Passageiro de Primeira",
        "url": PP_RANKING_URL,
        "internal_confidence": 1.0,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "excerpt": excerpt[:700],
    }


def parse_pp_article(article: str) -> dict[str, Any]:
    article_tag = article.split(">", 1)[0]
    name = extract_attr(article_tag, "title")
    title_link = re.search(r'<h2 class="card-title"><a href="([^"]+)"', article)
    product_url = html_lib.unescape(title_link.group(1)) if title_link else PP_RANKING_URL
    application_url = extract_pp_application_url(article)
    image = ""
    image_m = re.search(r'<img[^>]+src="([^"]+)"', article)
    if image_m:
        image = html_lib.unescape(image_m.group(1))
    rank_m = re.search(r'<div class="ranking">\s*<span>(\d+)', article)
    score_m = re.search(r'<div class="points">\s*<small>([^<]+)</small>', article)
    rank = int(rank_m.group(1)) if rank_m else None
    score = float(score_m.group(1).strip()) if score_m else None
    info = parse_card_info_list(article)
    blocks = extract_pp_benefit_blocks(article)
    card_sections = extract_section_items(blocks.get("Benefícios do cartão", ""))
    brand_sections = extract_section_items(blocks.get("Benefícios da bandeira", ""))
    all_sections = {**card_sections}
    for key, values in brand_sections.items():
        all_sections[f"Bandeira - {key}"] = values

    issuer = infer_pp_issuer(name, product_url)
    annual = parse_money_brl(info.get("Anuidade"))
    lounge = parse_lounge_access(info, all_sections)
    reward_return = parse_reward_return(info, all_sections)
    raw_benefit_groups = build_benefit_groups(all_sections)
    characteristics = build_characteristics(info, all_sections, lounge, reward_return)
    benefit_groups = build_groups_from_characteristics(characteristics)
    network = info.get("Bandeira") or ""
    variant = infer_variant_band_from_name(name, network)

    card = {
        "identity": {
            "stable_id": slug_id(name, issuer),
            "display_name": name,
            "issuer": {
                "raw": issuer,
                "normalized": fold(issuer).replace(" ", "_"),
                "is_multi_issuer_listing": False,
            },
            "network_primary": network,
            "variant_band": variant,
            "product_kind": product_kind(name, issuer),
        },
        "ranking": {
            "source_rank": rank,
            "source_score": score,
            "source_name": "Passageiro de Primeira",
            "source_url": product_url,
        },
        "categorization": {
            "market_segment_guess": classify_segment(variant, network),
            "co_brand_detected_from_name": bool(
                re.search(
                    r"gol|smiles|latam|amazon|cvc|decathlon|vivo|walmart|disney|azul|marisa|banese|mercado",
                    fold(name),
                )
            ),
        },
        "media": {
            "card_art_url": image,
            "source_url": product_url,
            "source_tier": "trusted_catalog",
            "alt_text": name,
        },
        "fees": {
            "annual": {
                **annual,
                "is_zero_fee_claim": (annual.get("amount_brl_numeric") == 0),
            }
        },
        "rewards": {
            "earning_rules_text": reward_return["earning_summary"],
            "earn_points_or_miles_mentioned": reward_return["has_points_or_miles"],
            "earn_cashback_mentioned": "cashback" in reward_return["subtypes"],
            "earn_investback_mentioned": "investback" in reward_return["subtypes"],
            "return_cashlike": reward_return,
        },
        "travel_and_protection": {
            "airport_lounge_offered": lounge["has_lounge_access"],
            "airport_lounge_unlimited_claim": lounge["unlimited"],
            "airport_lounge_annual_visits_hint": lounge["annual_visits"],
            "airport_lounge_programs_detected": lounge["programs"],
            "airport_lounge_guest_policy": lounge["guest_policy"],
            "airport_lounge_complimentary_access_confirmed": lounge[
                "complimentary_access_confirmed"
            ],
            "airport_lounge_policy_varies_by_issuer": lounge["policy_varies_by_issuer"],
            "official_airport_lounge_summary": lounge["source_excerpt"],
            "travel_insurance_mentioned": any(
                "seguro" in fold(x) and "viagem" in fold(x)
                for x in raw_benefit_groups.get("insurance", [])
            ),
            "concierge_mentioned": "concierge" in fold(str(benefit_groups)),
            "forex_spread_or_iof_text": next(
                (
                    item
                    for item in raw_benefit_groups.get("fees", [])
                    if "spread" in fold(item) or "iof" in fold(item)
                ),
                UNKNOWN,
            ),
        },
        "benefits": {
            "benefit_groups": benefit_groups,
            "characteristics": characteristics,
            "atomic_benefit_statements": [
                f"{item['label']}: {item['value']}"
                + (f" - {item['details']}" if item.get("details") else "")
                for item in characteristics
            ][:40],
        },
        "constraints": {},
        "claims": {
            "annual_fee": {
                "value": info.get("Anuidade") or UNKNOWN,
                "evidence": [pp_field_source("annual_fee", info.get("Anuidade", ""))],
            },
            "reward_return": {
                "value": reward_return,
                "evidence": [
                    pp_field_source("reward_return", reward_return["earning_summary"])
                ],
            },
            "lounge_access": {
                "value": lounge,
                "evidence": [pp_field_source("lounge_access", lounge["source_excerpt"])],
            },
            "benefits": {
                "value": {
                    "groups": benefit_groups,
                    "characteristics": characteristics,
                },
                "evidence": [
                    pp_field_source(
                        "benefits",
                        html_to_text(blocks.get("Benefícios do cartão", "")),
                    )
                ],
            },
            "card_art": {
                "value": image or UNKNOWN,
                "evidence": [pp_field_source("card_art", image)],
            },
        },
        "evidence": {
            "verification_bucket": "trusted_catalog",
            "source_is_official_issuer_domain": False,
            "primary_evidence_url": product_url,
            "application_url": application_url or UNKNOWN,
            "source_name": "Passageiro de Primeira",
            "source_tier": "trusted_catalog",
            "internal_confidence": 1.0,
            "ranking_page_url": PP_RANKING_URL,
        },
        "raw_source_snapshot": {
            "card_info_list": info,
            "benefit_sections": all_sections,
            "benefit_block_titles": list(blocks.keys()),
            "source_article_url": product_url,
            "application_url": application_url or UNKNOWN,
            "source_title": name,
        },
        "verification": {
            "cross_check_status": "trusted_passageiro_de_primeira_ranking",
            "confidence_score_0_to_1": 1.0,
            "machine_truthfulness_note_pt": (
                "Dados importados do ranking de cartões do Passageiro de Primeira; "
                "a interface deve mostrar a fonte, não um percentual de confiança."
            ),
            "primary_evidence_domain": "passageirodeprimeira.com",
            "embedded_official_snippet_applied": False,
            "recommended_human_cross_check_actions": [
                "Usar o link da fonte para auditoria quando necessário",
                "Consultar o emissor para regras contratuais vigentes antes de decisão financeira",
            ],
        },
        "flags": {
            "has_named_lounge_program": bool(lounge["programs"]),
            "has_any_lounge_claim": lounge["has_lounge_access"],
            "mentions_concierge": "concierge" in fold(str(benefit_groups)),
            "mentions_travel_insurance": any(
                "seguro" in fold(x) and "viagem" in fold(x)
                for x in raw_benefit_groups.get("insurance", [])
            ),
            "earn_points_or_miles": reward_return["has_points_or_miles"],
            "earn_cashback": "cashback" in reward_return["subtypes"],
            "earn_investback": "investback" in reward_return["subtypes"],
            "has_cashlike_return": reward_return["has_cashlike_return"],
            "issuer_is_multi_entity_list": False,
        },
        "data_quality_notes": [],
    }
    infer_eligibility_from_source_sections(card)
    apply_curated_official_overrides_to_catalog_card(card)
    normalize_cashback_summary(card)
    refine_market_segment(card)
    return card


def build_pp_catalog_cards() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    articles, meta = fetch_pp_ranking_articles()
    cards = [parse_pp_article(article) for article in articles]
    cards.extend(build_curated_official_cards())
    apply_manual_review_overrides(cards)
    cards = dedupe_catalog_cards(cards)
    cards.sort(key=lambda c: c.get("ranking", {}).get("source_rank") or 9999)
    return cards, meta


def dedupe_catalog_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop duplicate source rows for the same stable product while keeping best-ranked row."""
    by_id: dict[str, dict[str, Any]] = {}
    duplicate_sources: dict[str, list[str]] = {}
    for card in cards:
        stable_id = (card.get("identity") or {}).get("stable_id")
        if not stable_id:
            continue
        current = by_id.get(stable_id)
        if current is None:
            by_id[stable_id] = card
            continue
        current_rank = (current.get("ranking") or {}).get("source_rank") or 9999
        new_rank = (card.get("ranking") or {}).get("source_rank") or 9999
        keep, drop = (card, current) if new_rank < current_rank else (current, card)
        duplicate_sources.setdefault(stable_id, [])
        duplicate_sources[stable_id].append((drop.get("evidence") or {}).get("primary_evidence_url", UNKNOWN))
        by_id[stable_id] = keep

    for stable_id, urls in duplicate_sources.items():
        card = by_id[stable_id]
        card.setdefault("data_quality_notes", []).append(
            "Registro duplicado removido durante build; URLs descartadas: " + "; ".join(urls)
        )
        card.setdefault("evidence", {})["deduped_duplicate_source_urls"] = urls
    return list(by_id.values())


def build_curated_official_cards() -> list[dict[str, Any]]:
    return [build_curated_nubank_card()]


def build_curated_nubank_card() -> dict[str, Any]:
    name = "Cartão Nubank"
    issuer = "Nubank"
    characteristics = [
        as_characteristic("fees", "annual_fee", "Anuidade", "R$ 0"),
        as_characteristic("fees", "fee_waiver", "Isenção da anuidade", "Sem anuidade"),
        as_characteristic("fees", "requires_account", "Precisa ser correntista", "Não"),
        as_characteristic("lifestyle", "digital_wallet", "Carteira digital", "Google Pay, Apple Pay, Samsung Pay"),
        as_characteristic("issuer_specific", "credit_limit", "Limite", "Acompanhe seu NuScore e veja seu limite crescer com o tempo"),
        as_characteristic("issuer_specific", "nu_limite_garantido", "Nu Limite Garantido", "Dinheiro guardado nas Caixinhas pode virar limite do cartão"),
        as_characteristic("issuer_specific", "bill_control", "Fatura", "Compras em tempo real, antecipação de parcelas com desconto, ajuste de vencimento e parcelamento pelo app"),
        as_characteristic("issuer_specific", "credit_payments", "Passa Tudo no Crédito", "Pague contas, faça Pix ou adicione saldo à conta usando limite do cartão com parcelamento em até 12 vezes"),
        as_characteristic("fees", "additional_card_benefits", "Cartão adicional", "Compartilhe limite com familiares ou amigos com controle pelo app"),
        as_characteristic("issuer_specific", "card_tiers", "Versões", "Nubank Mastercard Gold e Nubank Mastercard Platinum disponíveis conforme perfil"),
    ]
    benefit_groups = build_groups_from_characteristics(characteristics)
    card = {
        "identity": {
            "stable_id": slug_id(name, issuer),
            "display_name": name,
            "issuer": {
                "raw": issuer,
                "normalized": "nubank",
                "is_multi_issuer_listing": False,
            },
            "network_primary": "Mastercard",
            "variant_band": "Gold/Platinum",
            "product_kind": "named_credit_card_product",
        },
        "ranking": {
            "source_rank": 9998,
            "source_score": UNKNOWN,
            "source_name": "Nubank",
            "source_url": NUBANK_CARD_URL,
        },
        "categorization": {
            "market_segment_guess": "mass_or_general",
            "co_brand_detected_from_name": False,
        },
        "media": {
            "card_art_url": NUBANK_CARD_IMAGE_URL,
            "source_url": NUBANK_CARD_IMAGE_URL,
            "source_tier": "user_provided_public_image",
            "alt_text": "Cartão Nubank roxo",
        },
        "eligibility": {
            "requirements_text": "Sujeito a análise individual de crédito pelo Nubank.",
            "requires_bank_account_claim": False,
        },
        "fees": {
            "annual": {
                "has_explicit_amount": True,
                "raw_text": "Sem anuidade",
                "amount_brl_numeric": 0,
                "is_zero_fee_claim": True,
                "official_fee_policy_summary": "Cartão de crédito Nubank sem anuidade.",
            }
        },
        "rewards": {
            "earning_rules_text": "Não há programa de pontos/cashback estruturado no cartão Nubank básico.",
            "earn_points_or_miles_mentioned": False,
            "earn_cashback_mentioned": False,
            "earn_investback_mentioned": False,
            "return_cashlike": {
                "has_points_or_miles": False,
                "has_cashlike_return": False,
                "subtypes": [],
                "earning_summary": "Sem pontos/cashback estruturado",
            },
        },
        "travel_and_protection": {
            "airport_lounge_offered": False,
            "airport_lounge_unlimited_claim": False,
            "airport_lounge_programs_detected": [],
            "airport_lounge_guest_policy": UNKNOWN,
            "airport_lounge_complimentary_access_confirmed": False,
            "airport_lounge_policy_varies_by_issuer": False,
            "official_airport_lounge_summary": UNKNOWN,
            "travel_insurance_mentioned": False,
            "concierge_mentioned": False,
            "forex_spread_or_iof_text": UNKNOWN,
        },
        "benefits": {
            "benefit_groups": benefit_groups,
            "characteristics": characteristics,
            "atomic_benefit_statements": [
                f"{item['label']}: {item['value']}" for item in characteristics
            ],
        },
        "constraints": {
            "caveats_text": "Aprovação sujeita à análise individual de crédito do Nubank.",
        },
        "claims": {
            "annual_fee": {
                "value": "Sem anuidade",
                "evidence": [
                    {
                        "field": "annual_fee",
                        "source_tier": "official_issuer",
                        "source_name": "Nubank",
                        "url": NUBANK_CARD_URL,
                        "internal_confidence": 1.0,
                        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
                        "excerpt": "Cartão de Crédito Nubank | Completo e sem anuidade",
                    }
                ],
            },
            "benefits": {
                "value": {"groups": benefit_groups, "characteristics": characteristics},
                "evidence": [
                    {
                        "field": "benefits",
                        "source_tier": "official_issuer",
                        "source_name": "Nubank",
                        "url": NUBANK_CARD_URL,
                        "internal_confidence": 1.0,
                        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
                        "excerpt": "Carteira digital; Passa Tudo no Crédito; Nu Limite Garantido; controle de fatura pelo app; cartão adicional; versões Gold e Platinum.",
                    }
                ],
            },
        },
        "evidence": {
            "verification_bucket": "official_or_network_site",
            "source_is_official_issuer_domain": True,
            "primary_evidence_url": NUBANK_CARD_URL,
            "source_name": "Nubank",
            "source_tier": "official_issuer",
            "internal_confidence": 1.0,
            "ranking_page_url": NUBANK_CARD_URL,
        },
        "raw_source_snapshot": {
            "card_info_list": {
                "Anuidade": "Sem anuidade",
                "Pontuação": "Sem pontos/cashback estruturado",
                "Salas VIP": "Não",
                "Bandeira": "Mastercard",
            },
            "benefit_sections": {
                "Cartão Nubank": [
                    "Use o limite do seu cartão para pagar contas, fazer Pix ou adicionar saldo à conta com parcelamento em até 12 vezes.",
                    "Tenha mais praticidade no dia a dia: use seu Cartão Nubank Mastercard direto no celular com Google Pay, Apple Pay ou Samsung Pay.",
                    "Use bem seu cartão, acompanhe seu NuScore e veja seu limite crescer com o tempo.",
                    "Seu dinheiro guardado nas Caixinhas e seus investimentos podem virar mais limite no cartão de crédito com Nu Limite Garantido.",
                    "Peça um cartão extra para família ou amigos. Ambos usam o mesmo limite, com total controle pelo app.",
                ]
            },
            "benefit_block_titles": ["Cartão do Nubank"],
            "source_article_url": NUBANK_CARD_URL,
            "source_title": name,
        },
        "verification": {
            "cross_check_status": "official_nubank_card_page_curated",
            "confidence_score_0_to_1": 0.92,
            "machine_truthfulness_note_pt": "Registro curado a partir da página oficial do Cartão Nubank informada pelo usuário.",
            "primary_evidence_domain": "nubank.com.br",
            "embedded_official_snippet_applied": True,
            "recommended_human_cross_check_actions": [
                "Confirmar tarifas e condições vigentes no contrato/app Nubank antes de decisão financeira",
            ],
        },
        "flags": {
            "has_named_lounge_program": False,
            "has_any_lounge_claim": False,
            "mentions_concierge": False,
            "mentions_travel_insurance": False,
            "earn_points_or_miles": False,
            "earn_cashback": False,
            "earn_investback": False,
            "has_cashlike_return": False,
            "issuer_is_multi_entity_list": False,
        },
        "data_quality_notes": [],
    }
    card["semantic_audit"] = evaluate_semantic_claims(card)
    refine_market_segment(card)
    return card


def build_raw_sources_file(cards: list[dict[str, Any]], source_meta: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for card in cards:
        identity = card.get("identity") or {}
        evidence = card.get("evidence") or {}
        rows.append(
            {
                "card_stable_id": identity.get("stable_id", UNKNOWN),
                "display_name": identity.get("display_name", UNKNOWN),
                "issuer_raw": (identity.get("issuer") or {}).get("raw", UNKNOWN),
                "source_url": evidence.get("primary_evidence_url", UNKNOWN),
                "raw_source_snapshot": card.get("raw_source_snapshot", {}),
                "semantic_audit": card.get("semantic_audit", {}),
                "official_product_snapshot": card.get("official_product_snapshot", {}),
            }
        )
    return {
        "raw_sources_meta": {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "purpose": "Raw parsed website fields plus semantic audit used to build the normalized card catalog.",
            "source_meta": source_meta,
        },
        "cards": rows,
    }


def main() -> None:
    built, source_meta = build_pp_catalog_cards()

    catalog = {
        "catalog_meta": {
            "schema_version": "3.0",
            "reference_as_of_date_for_freshness_checks": REFERENCE_AS_OF_DATE.isoformat(),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_file": " + ".join(source["url"] for source in PP_SOURCE_PAGES),
            "card_count": len(built),
            "source_meta": source_meta,
            "methodology": [
                "Camada 1: ranking completo e categoria de cashback do Passageiro de Primeira como fontes de descoberta.",
                "Camada 2: parsing estruturado de anuidade, pontuação, salas VIP, benefícios e imagem do cartão.",
                "Camada 3: semantic_audit normaliza claims de elegibilidade, anuidade, isenção e recompensas a partir do raw_source_snapshot.",
                "Camada 4: snippets oficiais curados sobrescrevem fontes agregadoras quando há match de produto (ex.: matriz XP Legacy/Infinite/One).",
                "Camada 5: campos de UX agrupam benefícios por recompensas, viagem, seguros, lifestyle, taxas e específicos do emissor.",
                "Para decisões financeiras sempre validar contrato/tabela vigente no site do emissor.",
            ],
            "limitations": [
                "O ranking público carregou a quantidade disponível no momento do build; o total pode mudar sem aviso.",
                "O build usa o Passageiro de Primeira como fonte confiável, mas não substitui PDF de tarifas/contrato do emissor.",
                "Datas promocionais e regras mudam; este arquivo não substitui PDF de tarifas/contrato.",
            ],
            "issuer_catalog_urls_for_human_audit": {},
            "ai_consumption": {
                "recommended_roles": {
                    "human_audits_provenance_deep_nested_json": OUT.name,
                    "llm_compare_rank_tool_calls_embeddings": FACETS_OUT.name,
                },
                "unknown_sentinel": UNKNOWN,
                "hint": "Para IA comparadora: use facets estruturados e source_label/source_url. Não mostre porcentagem de confiança ao usuário; mostre a fonte.",
            },
        },
        "cards": built,
    }

    cleaned = strip_nulls(catalog)
    OUT.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    PLATFORM_OUT.write_text(
        json.dumps(cleaned, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    facets_bundle = strip_nulls(build_ai_comparison_facets(built))
    FACETS_OUT.write_text(
        json.dumps(facets_bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    PLATFORM_FACETS_OUT.write_text(
        json.dumps(facets_bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    raw_bundle = strip_nulls(build_raw_sources_file(built, source_meta))
    RAW_OUT.write_text(
        json.dumps(raw_bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    PLATFORM_RAW_OUT.write_text(
        json.dumps(raw_bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Wrote {OUT} ({len(built)} cards)")
    print(f"Wrote {FACETS_OUT} ({len(facets_bundle.get('cards', []))} facet rows)")
    print(f"Wrote {RAW_OUT} ({len(raw_bundle.get('cards', []))} raw rows)")
    print(f"Wrote {PLATFORM_OUT}")
    print(f"Wrote {PLATFORM_FACETS_OUT}")
    print(f"Wrote {PLATFORM_RAW_OUT}")


if __name__ == "__main__":
    main()
