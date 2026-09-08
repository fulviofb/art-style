from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
sys.path.insert(0, str(ROOT))

import scripts.export_public_catalog as export


def sample_day(identifier: str, title: str, *, canonical: str | None = None, post_id: str | None = None) -> dict:
    curator = {
        "display_name": title,
        "naming_basis": "source_name",
        "confidence": "high",
        "style_family": "animation-2d",
        "tags": ["animation-2d"],
    }
    if canonical:
        curator["canonical_style_id"] = canonical
    return {
        "id": identifier,
        "day": int(identifier),
        "source_review": "reviewed",
        "date_utc": "2026-01-01",
        "poster_url": f"https://images.example/{identifier}.jpg",
        "style": {
            "name": title,
            "name_status": "published",
            "prompt_published": f"prompt {identifier}",
        },
        "curator": curator,
        "thread": [
            {
                "role": "hero",
                "post_url": f"https://x.com/creator/status/{post_id or identifier}",
                "source_review": "reviewed",
            }
        ],
        "tools": [],
        "inspiration": [],
    }


def test_public_library_collapses_repeated_sources_into_one_style():
    assert hasattr(export, "build_public_library"), "timeless library builder is missing"
    days = [
        sample_day("028", "Graphic Action Animation", post_id="280"),
        sample_day("032", "Graphic Action Animation", canonical="028", post_id="320"),
    ]

    payload = export.build_public_library(
        days,
        taxonomy={
            "families": [{"id": "animation-2d", "label_pt": "Animação 2D"}],
            "tags": [{"id": "animation-2d", "label_pt": "Animação 2D"}],
        },
        sources={"sources": [{"id": "nvtdanh", "label": "ToaiDanh", "url": "https://x.com/NVTDanh"}]},
    )

    assert "days" not in payload
    assert payload["counts"] == {"styles": 1, "references": 2, "recipes": 2}
    assert len(payload["styles"]) == 1
    style = payload["styles"][0]
    assert style["slug"] == "graphic-action-animation"
    assert style["display_name"] == "Graphic Action Animation"
    assert style["family"] == "animation-2d"
    assert len(style["examples"]) == 2
    assert {example["source_url"] for example in style["examples"]} == {
        "https://x.com/creator/status/280",
        "https://x.com/creator/status/320",
    }
    assert all("day" not in example for example in style["examples"])


def test_public_library_supports_more_than_one_curated_source():
    assert hasattr(export, "build_public_library"), "timeless library builder is missing"
    payload = export.build_public_library(
        [sample_day("080", "Wayang Kulit–Inspired Animation", post_id="800")],
        taxonomy={"families": [], "tags": []},
        sources={
            "sources": [
                {"id": "nvtdanh", "label": "ToaiDanh", "url": "https://x.com/NVTDanh"},
                {"id": "hand-drawn-styles", "label": "hand-drawn-styles", "url": "https://github.com/threerocks/hand-drawn-styles"},
            ]
        },
    )

    assert [source["id"] for source in payload["sources"]] == ["nvtdanh", "hand-drawn-styles"]
    assert payload["styles"][0]["display_name"] == "Wayang Kulit–Inspired Animation"


def test_style_slugs_stay_unique_when_names_collide() -> None:
    payload = export.build_public_library(
        [sample_day("010", "Ink Study", post_id="10"), sample_day("011", "Ink Study", post_id="11")],
        taxonomy={"families": [], "tags": []},
        sources={"sources": []},
    )
    assert [style["slug"] for style in payload["styles"]] == ["ink-study", "ink-study-2"]


def test_public_pages_use_timeless_explore_routes() -> None:
    index = (SITE / "index.html").read_text(encoding="utf-8")
    assert ">Explorar<" in index
    assert ">Galeria<" not in index
    assert "dia.html" not in index
    assert (SITE / "estilo.html").exists()


def test_external_collection_can_enrich_and_create_styles() -> None:
    collection = {
        "source_id": "hand-drawn-styles",
        "source_commit": "abc123",
        "license": "MIT",
        "entries": [
            {
                "id": "ghibli-recipe",
                "canonical_style_id": "080",
                "recipe": {"template": "Ghibli illustration of 【subject】.", "tested": True},
            },
            {
                "id": "family-crayon-card",
                "display_name": "Family Crayon Card",
                "family": "storybook-illustration",
                "tags": ["children"],
                "example": {"poster_url": "https://example.com/crayon.png", "source_url": "https://example.com/source"},
                "recipe": {"template": "Crayon drawing of 【subject】.", "tested": True},
            },
        ],
    }
    payload = export.build_public_library(
        [sample_day("080", "Ghibli-Inspired Hand-Painted Animation", post_id="800")],
        taxonomy={
            "families": [{"id": "storybook-illustration", "label_pt": "Livro ilustrado"}],
            "tags": [{"id": "children", "label_pt": "Infantil"}],
        },
        sources={"sources": [{"id": "hand-drawn-styles", "label": "hand-drawn-styles"}]},
        collections=[collection],
    )

    assert payload["counts"] == {"styles": 2, "references": 2, "recipes": 3}
    ghibli = next(style for style in payload["styles"] if style["display_name"].startswith("Ghibli"))
    crayon = next(style for style in payload["styles"] if style["display_name"] == "Family Crayon Card")
    assert ghibli["recipes"][-1]["source_commit"] == "abc123"
    assert crayon["examples"][0]["source_url"] == "https://example.com/source"
    assert crayon["recipes"][0]["license"] == "MIT"


def test_workflow_only_recipe_is_not_copyable() -> None:
    collection = {
        "source_id": "hand-drawn-styles",
        "source_commit": "abc123",
        "license": "MIT",
        "entries": [
            {
                "id": "family-crayon-card",
                "display_name": "Family Crayon Card",
                "family": "storybook-illustration",
                "recipe": {
                    "availability": "workflow_bundle_only",
                    "required_contract": "family-crayon-card-v3",
                    "tested": True,
                },
            }
        ],
    }
    payload = export.build_public_library(
        [],
        taxonomy={"families": [{"id": "storybook-illustration", "label_pt": "Livro ilustrado"}], "tags": []},
        sources={"sources": [{"id": "hand-drawn-styles", "label": "hand-drawn-styles"}]},
        collections=[collection],
    )
    recipe = payload["styles"][0]["recipes"][0]
    assert "text" not in recipe
    assert recipe["availability"] == "workflow_bundle_only"
    assert recipe["required_contract"] == "family-crayon-card-v3"
