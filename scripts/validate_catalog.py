#!/usr/bin/env python3
"""Validate catalog YAML. Exit 1 on schema errors."""
from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("PyYAML required: uv run --with pyyaml python scripts/validate_catalog.py\n")
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
DAYS = ROOT / "catalog" / "days"
SERIES = ROOT / "catalog" / "series.yml"
TAXONOMY = ROOT / "catalog" / "style_taxonomy.yml"
ALLOWED_REVIEW = {
    "empty",
    "discovered_needs_original_review",
    "reviewed",
    "inaccessible",
    "superseded",
}
errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


PLACEHOLDER_TITLES = {
    "...",
    "....",
    "mixed",
    "(i don't know)",
    "same as day 14",
    "same as day 28",
}
ALLOWED_NAME_STATUS = {"published", "published_generic", "unnamed", "reference"}
ALLOWED_NAMING_BASIS = {
    "source_name",
    "source_context",
    "source_reference",
    "published_prompt",
    "curator_normalization",
    "curator_inference",
}
ALLOWED_CONFIDENCE = {"high", "medium", "low"}


def validate_style_curation(data: dict, families: set[str], tags: set[str]) -> list[str]:
    found: list[str] = []
    style = data.get("style") or {}
    curator = data.get("curator") or {}
    display_name = str(curator.get("display_name") or "").strip()
    if not display_name or display_name.lower() in PLACEHOLDER_TITLES:
        found.append("curator.display_name is missing or a placeholder")
    if style.get("name_status") not in ALLOWED_NAME_STATUS:
        found.append("style.name_status is missing or invalid")
    if style.get("name_status") == "reference" and not style.get("reference_day"):
        found.append("style.reference_day is required for references")
    if curator.get("naming_basis") not in ALLOWED_NAMING_BASIS:
        found.append("curator.naming_basis is missing or invalid")
    if curator.get("confidence") not in ALLOWED_CONFIDENCE:
        found.append("curator.confidence is missing or invalid")
    if curator.get("style_family") not in families:
        found.append("curator.style_family is missing or unregistered")
    item_tags = curator.get("tags") or []
    if not item_tags:
        found.append("curator.tags must not be empty")
    elif any(tag not in tags for tag in item_tags):
        found.append("curator.tags contains an unregistered tag")
    return found


def main() -> int:
    series = yaml.safe_load(SERIES.read_text(encoding="utf-8"))
    taxonomy = yaml.safe_load(TAXONOMY.read_text(encoding="utf-8")) or {}
    families = {item.get("id") for item in taxonomy.get("families") or [] if item.get("id")}
    tags = {item.get("id") for item in taxonomy.get("tags") or [] if item.get("id")}
    if not families:
        err("style taxonomy needs families")
    if not tags:
        err("style taxonomy needs tags")
    if series.get("copy_policy") != "link_only":
        err("series.copy_policy must be link_only")
    if series.get("affiliation") != "unofficial":
        err("series.affiliation must be unofficial")

    ids: set[str] = set()
    files = sorted(DAYS.glob("*.yml"))
    if not files:
        err("no day files")
    for path in files:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            err(f"{path.name}: not a mapping")
            continue
        did = str(data.get("id", ""))
        if not did:
            err(f"{path.name}: missing id")
            continue
        if did in ids:
            err(f"{path.name}: duplicate id {did}")
        ids.add(did)
        if data.get("copy_policy") != "link_only":
            err(f"{path.name}: copy_policy must be link_only")
        review = data.get("source_review")
        if review not in ALLOWED_REVIEW:
            err(f"{path.name}: bad source_review {review!r}")
        if review == "reviewed":
            style = (data.get("style") or {}).get("name")
            if not style:
                err(f"{path.name}: reviewed day needs style.name")
            for message in validate_style_curation(data, families, tags):
                err(f"{path.name}: {message}")
            thread = data.get("thread") or []
            hero = next((t for t in thread if t.get("role") == "hero"), None)
            if not hero or not hero.get("post_url"):
                err(f"{path.name}: reviewed day needs hero.post_url")
            for part in thread:
                if part.get("source_review") == "reviewed" and not part.get("post_url"):
                    err(f"{path.name}: reviewed thread part missing post_url ({part.get('role')})")
        for part in data.get("thread") or []:
            if part.get("post_url") == "":
                err(f"{path.name}: empty post_url string; use null")
    if errors:
        print("INVALID")
        for e in errors:
            print(f"- {e}")
        return 1
    print(f"OK files={len(files)} ids={len(ids)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
