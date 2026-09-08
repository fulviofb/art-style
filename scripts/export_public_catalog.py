#!/usr/bin/env python3
"""Export site-safe JSON. No internal copy_policy dump as guidance to copy."""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("PyYAML required: uv run --with pyyaml python scripts/export_public_catalog.py\n")
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
DAYS = ROOT / "catalog" / "days"
SERIES = ROOT / "catalog" / "series.yml"
SOURCES = ROOT / "catalog" / "sources.yml"
COLLECTIONS = ROOT / "catalog" / "collections"
TAXONOMY = ROOT / "catalog" / "style_taxonomy.yml"
OUTS = [
    ROOT / "public-data" / "catalog.public.json",
    ROOT / "site" / "data" / "catalog.public.json",
]


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_value))


def hero_url(day: dict) -> str | None:
    return next(
        (
            part.get("post_url")
            for part in (day.get("thread") or [])
            if part.get("role") == "hero" and part.get("post_url")
        ),
        None,
    )


def build_public_library(
    days: list[dict],
    taxonomy: dict,
    sources: dict,
    collections: list[dict] | None = None,
) -> dict:
    reviewed = [day for day in days if day.get("source_review") == "reviewed"]
    by_id = {str(day.get("id")): day for day in reviewed}
    source_list = sources.get("sources") or []
    source_lookup = {source.get("id"): source for source in source_list}
    tag_labels = {item.get("id"): item.get("label_pt") for item in taxonomy.get("tags") or []}
    family_labels = {item.get("id"): item.get("label_pt") for item in taxonomy.get("families") or []}
    groups: dict[str, list[dict]] = {}
    for day in reviewed:
        canonical_id = str((day.get("curator") or {}).get("canonical_style_id") or day.get("id"))
        groups.setdefault(canonical_id, []).append(day)

    styles = []
    style_by_canonical: dict[str, dict] = {}
    used_slugs: set[str] = set()
    for canonical_id, examples in groups.items():
        canonical = by_id.get(canonical_id, examples[0])
        curator = canonical.get("curator") or {}
        source_style = canonical.get("style") or {}
        display_name = curator.get("display_name") or source_style.get("name") or "Estilo sem nome"
        base_slug = slugify(display_name) or f"style-{canonical_id}"
        slug = base_slug
        suffix = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        used_slugs.add(slug)

        public_examples = []
        recipes = []
        source_meta = source_lookup.get("nvtdanh", {})
        for example in sorted(examples, key=lambda item: (str(item.get("date_utc") or ""), str(item.get("id") or "")), reverse=True):
            style = example.get("style") or {}
            prompt = style.get("prompt_published")
            public_examples.append(
                {
                    "source_id": "nvtdanh",
                    "source_label": source_meta.get("label") or "ToaiDanh",
                    "source_url": hero_url(example),
                    "date_utc": example.get("date_utc"),
                    "poster_url": example.get("poster_url"),
                    "caption": example.get("logline"),
                    "creator_notes": example.get("creator_notes"),
                    "source_style_name": style.get("name"),
                    "source_style_name_status": style.get("name_status"),
                    "tools": [tool.get("name") for tool in (example.get("tools") or []) if tool.get("name")],
                }
            )
            if prompt:
                recipes.append(
                    {
                        "source_id": "nvtdanh",
                        "source_label": source_meta.get("label") or "ToaiDanh",
                        "source_url": hero_url(example),
                        "kind": "published_prompt",
                        "copy_policy": source_meta.get("copy_policy") or "link_only",
                        "text": prompt,
                    }
                )

        family = curator.get("style_family")
        tags = curator.get("tags") or []
        style_item = {
            "id": slug,
            "slug": slug,
            "display_name": display_name,
            "family": family,
            "family_label": family_labels.get(family, family),
            "tags": tags,
            "tag_labels": [tag_labels.get(tag, tag) for tag in tags],
            "naming_basis": curator.get("naming_basis"),
            "confidence": curator.get("confidence"),
            "poster_url": next((item.get("poster_url") for item in public_examples if item.get("poster_url")), None),
            "example_count": len(public_examples),
            "recipe_count": len(recipes),
            "examples": public_examples,
            "recipes": recipes,
        }
        styles.append(style_item)
        style_by_canonical[canonical_id] = style_item

    for collection in collections or []:
        collection_source_id = collection.get("source_id")
        source_meta = source_lookup.get(collection_source_id, {})
        source_label = source_meta.get("label") or collection_source_id
        for entry in collection.get("entries") or []:
            canonical_id = str(entry.get("canonical_style_id") or "")
            target = style_by_canonical.get(canonical_id)
            if target is None:
                display_name = entry.get("display_name") or entry.get("id") or "Estilo sem nome"
                base_slug = slugify(display_name) or slugify(str(entry.get("id") or "external-style"))
                slug = base_slug
                suffix = 2
                while slug in used_slugs:
                    slug = f"{base_slug}-{suffix}"
                    suffix += 1
                used_slugs.add(slug)
                family = entry.get("family")
                tags = entry.get("tags") or []
                target = {
                    "id": slug,
                    "slug": slug,
                    "display_name": display_name,
                    "family": family,
                    "family_label": family_labels.get(family, family),
                    "tags": tags,
                    "tag_labels": [tag_labels.get(tag, tag) for tag in tags],
                    "naming_basis": "source_name",
                    "confidence": "high",
                    "poster_url": None,
                    "example_count": 0,
                    "recipe_count": 0,
                    "examples": [],
                    "recipes": [],
                }
                styles.append(target)
                style_by_canonical[str(entry.get("id") or slug)] = target

            example = entry.get("example") or {}
            if example:
                target["examples"].append(
                    {
                        "source_id": collection_source_id,
                        "source_label": source_label,
                        "source_url": example.get("source_url") or source_meta.get("url"),
                        "date_utc": example.get("date_utc"),
                        "poster_url": example.get("poster_url"),
                        "caption": example.get("caption"),
                        "creator_notes": example.get("creator_notes"),
                        "source_style_name": entry.get("source_style_name") or entry.get("display_name"),
                        "source_style_name_status": "published",
                        "tools": example.get("tools") or [],
                    }
                )
                target["poster_url"] = target.get("poster_url") or example.get("poster_url")

            recipe = entry.get("recipe") or {}
            if recipe.get("template") or recipe.get("availability"):
                public_recipe = {
                    "source_id": collection_source_id,
                    "source_label": source_label,
                    "source_url": recipe.get("source_url") or source_meta.get("url"),
                    "source_commit": collection.get("source_commit"),
                    "license": collection.get("license"),
                    "kind": "template" if recipe.get("template") else "workflow_bundle",
                    "tested": bool(recipe.get("tested")),
                    "copy_policy": collection.get("copy_policy"),
                }
                if recipe.get("template"):
                    public_recipe["text"] = recipe.get("template")
                else:
                    public_recipe["availability"] = recipe.get("availability")
                    public_recipe["required_contract"] = recipe.get("required_contract")
                    public_recipe["required_asset"] = recipe.get("required_asset")
                    public_recipe["final_stage"] = recipe.get("final_stage")
                    public_recipe["style_id"] = recipe.get("style_id") or entry.get("source_style_id")
                target["recipes"].append(public_recipe)
            target["example_count"] = len(target["examples"])
            target["recipe_count"] = len(target["recipes"])

    styles.sort(key=lambda item: item["display_name"].casefold())
    return {
        "public_title": "Técnicas de Art Style",
        "style_taxonomy": taxonomy,
        "sources": sources.get("sources") or [],
        "counts": {
            "styles": len(styles),
            "references": sum(len(style["examples"]) for style in styles),
            "recipes": sum(len(style["recipes"]) for style in styles),
        },
        "styles": styles,
    }


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
    series = yaml.safe_load(SERIES.read_text(encoding="utf-8")) or {}
    taxonomy = yaml.safe_load(TAXONOMY.read_text(encoding="utf-8")) or {}
    sources = yaml.safe_load(SOURCES.read_text(encoding="utf-8")) or {}
    collections = []
    if COLLECTIONS.exists():
        for path in sorted(COLLECTIONS.glob("*.yml")):
            collections.append(yaml.safe_load(path.read_text(encoding="utf-8")) or {})
    days = []
    for path in sorted(DAYS.glob("*.yml"), key=lambda p: p.name):
        days.append(yaml.safe_load(path.read_text(encoding="utf-8")) or {})

    payload = build_public_library(days, taxonomy, sources, collections)
    payload["public_title"] = series.get("public_title") or payload["public_title"]
    payload["tagline"] = "linguagens visuais, referências e receitas para criar"
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    for out in OUTS:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(out)
    counts = payload["counts"]
    print(
        f"styles={counts['styles']} references={counts['references']} "
        f"recipes={counts['recipes']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
