#!/usr/bin/env python3
"""Export site-safe JSON. No internal copy_policy dump as guidance to copy."""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("PyYAML required: uv run --with pyyaml python scripts/export_public_catalog.py\n")
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
DAYS = ROOT / "catalog" / "days"
SERIES = ROOT / "catalog" / "series.yml"
TAXONOMY = ROOT / "catalog" / "style_taxonomy.yml"
OUTS = [
    ROOT / "public-data" / "catalog.public.json",
    ROOT / "site" / "data" / "catalog.public.json",
]


def public_day(d: dict, tag_labels: dict[str, str] | None = None) -> dict:
    tag_labels = tag_labels or {}
    thread = []
    for part in d.get("thread") or []:
        thread.append(
            {
                "role": part.get("role"),
                "post_url": part.get("post_url"),
                "embed": bool(part.get("embed")),
                "source_review": part.get("source_review"),
                "note": part.get("note"),
            }
        )
    tools = []
    for t in d.get("tools") or []:
        tools.append(
            {
                "name": t.get("name"),
                "handles": t.get("handles") or [],
                "role": t.get("role"),
            }
        )
    inspiration = []
    for item in d.get("inspiration") or []:
        inspiration.append(
            {
                "type": item.get("type"),
                "handle": item.get("handle"),
                "name": item.get("name"),
                "work": item.get("work"),
                "post_url": item.get("post_url"),
                "quote": item.get("quote"),
                "text": item.get("text"),
                "day": item.get("day"),
                "note": item.get("note"),
            }
        )
    style = d.get("style") or {}
    curator = d.get("curator") or {}
    return {
        "id": str(d.get("id")),
        "day": d.get("day"),
        "variant": d.get("variant"),
        "slug": d.get("slug") or str(d.get("id")),
        "source_review": d.get("source_review"),
        "date_utc": d.get("date_utc"),
        "poster_url": d.get("poster_url"),
        "style_name": curator.get("display_name") or style.get("name"),
        "curator_display_name": curator.get("display_name"),
        "source_style_name": style.get("name"),
        "source_style_name_status": style.get("name_status"),
        "source_style_reference_day": style.get("reference_day"),
        "style_name_extra": style.get("name_extra"),
        "prompt_published": style.get("prompt_published"),
        "logline": d.get("logline"),
        "creator_notes": d.get("creator_notes"),
        "tools": tools,
        "inspiration": inspiration,
        "thread": thread,
        "curator_style_family": curator.get("style_family"),
        "curator_canonical_style_id": curator.get("canonical_style_id"),
        "curator_tags": curator.get("tags") or [],
        "curator_tag_labels": [tag_labels.get(tag, tag) for tag in (curator.get("tags") or [])],
        "curator_naming_basis": curator.get("naming_basis"),
        "curator_confidence": curator.get("confidence"),
        "curator_notes": curator.get("notes"),
        "open_on_x": next(
            (p.get("post_url") for p in (d.get("thread") or []) if p.get("role") == "hero" and p.get("post_url")),
            "https://x.com/NVTDanh",
        ),
    }


def main() -> int:
    series = yaml.safe_load(SERIES.read_text(encoding="utf-8"))
    taxonomy = yaml.safe_load(TAXONOMY.read_text(encoding="utf-8")) or {}
    tag_labels = {item["id"]: item["label_pt"] for item in taxonomy.get("tags") or []}
    days = []
    for path in sorted(DAYS.glob("*.yml"), key=lambda p: p.name):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        days.append(public_day(data, tag_labels))
    days.sort(key=lambda d: (int(d["day"] or 0), str(d.get("variant") or "")))
    payload = {
        "public_title": series.get("public_title") or "Técnicas de Art Style",
        "tagline": series.get("tagline") or "",
        "creator": series.get("creator"),
        "title": series.get("title"),
        "planned_days": series.get("planned_days", 100),
        "style_taxonomy": taxonomy,
        "days": days,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    for out in OUTS:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(out)
    filled = sum(1 for d in days if d["source_review"] != "empty")
    print(f"days={len(days)} filled={filled}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
