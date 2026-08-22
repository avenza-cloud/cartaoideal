#!/usr/bin/env python3
"""Create an audit report for ranked cards up to position 100."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACETS = ROOT / "platform" / "data" / "cards_brazil_ai_comparison_facets.json"
OUT = ROOT / "tools" / "top100_card_review_report.json"


def main() -> None:
    data = json.loads(FACETS.read_text(encoding="utf-8"))
    cards = [
        card
        for card in data.get("cards", [])
        if isinstance(card.get("ranking_position"), int) and card["ranking_position"] <= 100
    ]
    cards.sort(key=lambda c: (c["ranking_position"], c.get("display_name", "")))

    rows = []
    for card in cards:
        elig = card.get("eligibility") or {}
        media = card.get("media") or {}
        req = elig.get("requirements_text", "unknown")
        min_inv = elig.get("minimum_investment_brl_best_estimate", "unknown")
        min_income = elig.get("minimum_income_brl_best_estimate", "unknown")
        review_flags = []
        if req == "unknown":
            review_flags.append("eligibility_not_published_in_source")
        if elig.get("recommendation_blocking_unknowns"):
            review_flags.append("recommendation_blocked_by_availability_or_gate")
        if not str(media.get("card_art_url", "")).startswith("/card-images/"):
            review_flags.append("image_not_localized")
        rows.append(
            {
                "rank": card["ranking_position"],
                "card_stable_id": card.get("card_stable_id"),
                "name": card.get("display_name"),
                "issuer": card.get("issuer_raw"),
                "availability": elig.get("availability_status"),
                "requirements_text": req,
                "minimum_investment_brl": min_inv,
                "minimum_income_brl": min_income,
                "requires_bank_account": elig.get("requires_bank_account_claim"),
                "annual_fee_brl": (card.get("facets_numeric_or_special") or {}).get(
                    "annual_fee_brl_best_estimate"
                ),
                "earning_summary": (card.get("reward_return") or {}).get("earning_summary"),
                "lounge_summary": (card.get("lounge_access") or {}).get("summary"),
                "image_local_path": media.get("card_art_url"),
                "remote_image_source": media.get("remote_card_art_url"),
                "review_flags": review_flags,
            }
        )

    summary = {
        "ranked_rows_lte_100": len(rows),
        "structured_eligibility_rows": sum(
            1 for row in rows if row["requirements_text"] != "unknown"
        ),
        "numeric_investment_gate_rows": sum(
            1 for row in rows if isinstance(row["minimum_investment_brl"], int)
        ),
        "blocked_rows": sum(
            1
            for row in rows
            if "recommendation_blocked_by_availability_or_gate" in row["review_flags"]
        ),
        "public_available_blocked_rows": sum(
            1
            for row in rows
            if row["availability"] == "available"
            and "recommendation_blocked_by_availability_or_gate" in row["review_flags"]
        ),
        "non_local_image_rows": sum(
            1 for row in rows if "image_not_localized" in row["review_flags"]
        ),
    }
    OUT.write_text(
        json.dumps({"summary": summary, "cards": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
