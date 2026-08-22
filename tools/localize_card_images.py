#!/usr/bin/env python3
"""Download card art into platform/public and rewrite catalog URLs to local paths."""

from __future__ import annotations

import json
import mimetypes
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "platform" / "public" / "card-images"
DATA_FILES = [
    ROOT / "cards_brazil_catalog_v2.json",
    ROOT / "cards_brazil_ai_comparison_facets.json",
    ROOT / "cards_brazil_raw_sources.json",
    ROOT / "platform" / "data" / "cards_brazil_catalog_v2.json",
    ROOT / "platform" / "data" / "cards_brazil_ai_comparison_facets.json",
    ROOT / "platform" / "data" / "cards_brazil_raw_sources.json",
]
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def fold(value: str) -> str:
    value = "".join(
        c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn"
    )
    return value.lower()


def slug(value: str, fallback: str) -> str:
    folded = fold(value)
    folded = folded.replace("®", "").replace("™", "")
    folded = re.sub(r"[^a-z0-9]+", "-", folded).strip("-")
    return folded[:120].strip("-") or fallback


def extension_from_response(url: str, content_type: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    guessed = mimetypes.guess_extension(content_type.split(";", 1)[0].strip())
    if guessed in {".jpe"}:
        guessed = ".jpg"
    if guessed:
        return guessed
    return ".jpg"


def iter_cards(data: dict) -> list[dict]:
    cards = data.get("cards")
    return cards if isinstance(cards, list) else []


def image_url(card: dict) -> str:
    media = card.get("media") or {}
    value = media.get("card_art_url") or ""
    if isinstance(value, str) and value.startswith("/card-images/"):
        value = media.get("remote_card_art_url") or value
    return value if isinstance(value, str) else ""


def card_name(card: dict) -> str:
    return (
        card.get("display_name")
        or (card.get("identity") or {}).get("display_name")
        or (card.get("raw_source_snapshot") or {}).get("source_title")
        or "cartao"
    )


def card_issuer(card: dict) -> str:
    issuer = card.get("issuer_raw")
    if issuer:
        return str(issuer)
    raw = ((card.get("identity") or {}).get("issuer") or {}).get("raw")
    return str(raw or "emissor")


def card_id(card: dict) -> str:
    return (
        card.get("card_stable_id")
        or (card.get("identity") or {}).get("stable_id")
        or slug(f"{card_issuer(card)} {card_name(card)}", "cartao")
    )


def target_stem(card: dict) -> str:
    return slug(f"{card_issuer(card)} {card_name(card)}", card_id(card))


def collect_downloads() -> dict[str, dict[str, str]]:
    facets = json.loads(
        (ROOT / "platform" / "data" / "cards_brazil_ai_comparison_facets.json").read_text(
            encoding="utf-8"
        )
    )
    downloads: dict[str, dict[str, str]] = {}
    used_stems: set[str] = set()
    for card in iter_cards(facets):
        url = image_url(card)
        if not url or url == "unknown" or url.startswith("/card-images/"):
            continue
        stable_id = card_id(card)
        stem = target_stem(card)
        if stem in used_stems:
            stem = f"{stem}-{stable_id[-10:]}"
        used_stems.add(stem)
        downloads[stable_id] = {"url": url, "stem": stem}
    return downloads


def download_image(url: str, stem: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as response:
        payload = response.read()
        content_type = response.headers.get("Content-Type", "")
    ext = extension_from_response(url, content_type)
    path = PUBLIC_DIR / f"{stem}{ext}"
    path.write_bytes(payload)
    stale_bin = PUBLIC_DIR / f"{stem}.bin"
    if ext != ".bin" and stale_bin.exists():
        stale_bin.unlink()
    return f"/card-images/{path.name}"


def rewrite_media_urls(obj, mapping: dict[str, str]) -> None:
    if isinstance(obj, dict):
        stable_id = obj.get("card_stable_id") or (obj.get("identity") or {}).get("stable_id")
        media = obj.get("media")
        if stable_id in mapping and isinstance(media, dict):
            original = media.get("card_art_url")
            if original and original != "unknown":
                media.setdefault("remote_card_art_url", original)
                media["card_art_url"] = mapping[stable_id]
        for value in obj.values():
            rewrite_media_urls(value, mapping)
    elif isinstance(obj, list):
        for item in obj:
            rewrite_media_urls(item, mapping)


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    downloads = collect_downloads()
    local_urls: dict[str, str] = {}
    failures: list[str] = []

    for stable_id, spec in downloads.items():
        try:
            local_urls[stable_id] = download_image(spec["url"], spec["stem"])
        except Exception as exc:  # noqa: BLE001 - keep batch download going.
            failures.append(f"{stable_id}: {spec['url']} ({exc})")

    for path in DATA_FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        rewrite_media_urls(data, local_urls)
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, separators=(",", ": "))
            + "\n",
            encoding="utf-8",
        )

    manifest = {
        "downloaded": len(local_urls),
        "failed": failures,
        "base_path": "/card-images",
        "items": local_urls,
    }
    (PUBLIC_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n",
        encoding="utf-8",
    )
    print(f"downloaded {len(local_urls)} images to {PUBLIC_DIR}")
    if failures:
        print(f"failed {len(failures)} images")
        for failure in failures[:20]:
            print(failure)


if __name__ == "__main__":
    main()
