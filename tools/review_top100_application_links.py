#!/usr/bin/env python3
"""Fetch top-100 application links and extract eligibility/reward evidence snippets."""

from __future__ import annotations

import html
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "platform" / "data" / "cards_brazil_catalog_v2.json"
OUT = ROOT / "tools" / "top100_application_link_review.json"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
KEYWORDS = (
    "convite",
    "investimento",
    "investimentos",
    "renda",
    "anuidade",
    "isenção",
    "isencao",
    "pontos",
    "cashback",
    "milhas",
    "dólar",
    "dolar",
    "iof",
    "spread",
    "sala vip",
    "lounge",
)


def fold(value: str) -> str:
    value = "".join(
        c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn"
    )
    return value.lower()


def html_to_text(value: str) -> str:
    value = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", value)
    value = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h[1-6]>", "\n", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"[ \t\r\f\v]+", " ", value)


def snippets(text: str) -> list[str]:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if len(line) < 25:
            continue
        folded = fold(line)
        if not any(keyword in folded for keyword in KEYWORDS):
            continue
        clipped = line[:500]
        key = fold(clipped)
        if key in seen:
            continue
        seen.add(key)
        out.append(clipped)
        if len(out) >= 16:
            break
    return out


def fetch_text(url: str) -> tuple[str, str]:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(req, timeout=25) as response:
        final_url = response.geturl()
        charset = response.headers.get_content_charset() or "utf-8"
        body = response.read().decode(charset, errors="replace")
    return final_url, html_to_text(body)


def main() -> None:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    cards = [
        card
        for card in data.get("cards", [])
        if isinstance((card.get("ranking") or {}).get("source_rank"), int)
        and (card.get("ranking") or {}).get("source_rank") <= 100
    ]
    cards.sort(key=lambda c: ((c.get("ranking") or {}).get("source_rank"), c["identity"]["display_name"]))

    rows = []
    for card in cards:
        raw = card.get("raw_source_snapshot") or {}
        url = raw.get("application_url")
        if not url or url == "unknown":
            rows.append(
                {
                    "rank": (card.get("ranking") or {}).get("source_rank"),
                    "card_stable_id": card["identity"]["stable_id"],
                    "name": card["identity"]["display_name"],
                    "application_url": "unknown",
                    "status": "missing_application_url",
                    "snippets": [],
                }
            )
            continue
        try:
            final_url, text = fetch_text(url)
            rows.append(
                {
                    "rank": (card.get("ranking") or {}).get("source_rank"),
                    "card_stable_id": card["identity"]["stable_id"],
                    "name": card["identity"]["display_name"],
                    "application_url": url,
                    "final_url": final_url,
                    "domain": urlparse(final_url).netloc,
                    "status": "fetched",
                    "snippets": snippets(text),
                }
            )
        except Exception as exc:  # noqa: BLE001 - audit should continue.
            rows.append(
                {
                    "rank": (card.get("ranking") or {}).get("source_rank"),
                    "card_stable_id": card["identity"]["stable_id"],
                    "name": card["identity"]["display_name"],
                    "application_url": url,
                    "status": "fetch_failed",
                    "error": str(exc)[:300],
                    "snippets": [],
                }
            )

    summary = {
        "ranked_rows_lte_100": len(rows),
        "with_application_url": sum(1 for row in rows if row["application_url"] != "unknown"),
        "fetched": sum(1 for row in rows if row["status"] == "fetched"),
        "failed": sum(1 for row in rows if row["status"] == "fetch_failed"),
        "missing_application_url": sum(
            1 for row in rows if row["status"] == "missing_application_url"
        ),
        "with_snippets": sum(1 for row in rows if row["snippets"]),
    }
    OUT.write_text(
        json.dumps({"summary": summary, "cards": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
