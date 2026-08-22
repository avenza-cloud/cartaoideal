#!/usr/bin/env python3
"""Validate generated card facets used by recommendations."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACETS = ROOT / "platform" / "data" / "cards_brazil_ai_comparison_facets.json"


def fail(message: str) -> None:
    raise SystemExit(f"card data validation failed: {message}")


def main() -> None:
    data = json.loads(FACETS.read_text(encoding="utf-8"))
    cards = data.get("cards") or []
    if not cards:
        fail("no cards found")

    missing_eligibility = [
        card.get("card_stable_id", "<missing-id>")
        for card in cards
        if not isinstance(card.get("eligibility"), dict)
    ]
    if missing_eligibility:
        fail(f"{len(missing_eligibility)} cards missing eligibility facets")

    legacy = next(
        (card for card in cards if "xp-legacy" in card.get("card_stable_id", "")),
        None,
    )
    if legacy is None:
        fail("XP Legacy card not found")

    legacy_elig = legacy["eligibility"]
    if legacy_elig.get("minimum_investment_brl_best_estimate") != 1_000_000:
        fail("XP Legacy minimum investment gate is not 1000000")
    if legacy.get("facets_numeric_or_special", {}).get("annual_fee_brl_best_estimate") != 4_200:
        fail("XP Legacy annualized fee is not 4200")

    expected_xp_gates = {
        "XP Visa Infinite": 50_000,
        "XP Visa Infinite Categoria One": 5_000,
    }
    by_name = {card.get("display_name"): card for card in cards}
    for name, expected_gate in expected_xp_gates.items():
        card = by_name.get(name)
        if card is None:
            fail(f"{name} not found")
        actual_gate = card["eligibility"].get("minimum_investment_brl_best_estimate")
        if actual_gate != expected_gate:
            fail(f"{name} minimum investment gate is {actual_gate}, expected {expected_gate}")

    conservative_blocks = [
        card
        for card in cards
        if card["eligibility"].get("recommendation_blocking_unknowns") is True
    ]

    print(
        "card data validation ok: "
        f"{len(cards)} cards, {len(conservative_blocks)} conservative unknown blocks"
    )


if __name__ == "__main__":
    main()
