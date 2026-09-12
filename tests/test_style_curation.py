from pathlib import Path
import sys

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.validate_catalog import validate_reading, validate_style_curation
from scripts.export_public_catalog import public_day, public_reading


DAYS = ROOT / "catalog" / "days"
PLACEHOLDER_TITLES = {
    "...",
    "....",
    "mixed",
    "(i don't know)",
    "same as day 14",
    "same as day 28",
}


def reviewed_days():
    for path in sorted(DAYS.glob("*.yml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if data.get("source_review") == "reviewed":
            yield path, data


def test_reviewed_days_have_usable_curatorial_display_names():
    failures = []
    for path, data in reviewed_days():
        curator = data.get("curator") or {}
        name = str(curator.get("display_name") or "").strip()
        if not name or name.lower() in PLACEHOLDER_TITLES:
            failures.append(path.stem)

    assert failures == [], f"missing/placeholder curator.display_name: {failures}"


def test_reviewed_days_use_registered_portuguese_taxonomy():
    taxonomy_path = ROOT / "catalog" / "style_taxonomy.yml"
    assert taxonomy_path.exists(), "catalog/style_taxonomy.yml is required"
    taxonomy = yaml.safe_load(taxonomy_path.read_text(encoding="utf-8")) or {}
    families = {item["id"] for item in taxonomy.get("families") or []}
    tags = {item["id"] for item in taxonomy.get("tags") or []}
    assert families, "taxonomy needs families"
    assert tags, "taxonomy needs tags"

    failures = []
    for path, data in reviewed_days():
        curator = data.get("curator") or {}
        family = curator.get("style_family")
        item_tags = curator.get("tags") or []
        if family not in families or not item_tags or any(tag not in tags for tag in item_tags):
            failures.append(path.stem)

    assert failures == [], f"invalid/missing family or tags: {failures}"


def test_reviewed_days_classify_original_style_label():
    allowed = {"published", "published_generic", "unnamed", "reference"}
    failures = []
    for path, data in reviewed_days():
        style = data.get("style") or {}
        if style.get("name_status") not in allowed:
            failures.append(path.stem)
        if style.get("name_status") == "reference" and not style.get("reference_day"):
            failures.append(f"{path.stem}:reference_day")

    assert failures == [], f"invalid/missing source name status: {failures}"


def test_validator_rejects_placeholder_public_title():
    day = {
        "style": {"name": "...", "name_status": "unnamed"},
        "curator": {
            "display_name": "...",
            "naming_basis": "curator_inference",
            "confidence": "medium",
            "style_family": "animation-2d",
            "tags": ["animation-2d"],
        },
    }
    errors = validate_style_curation(day, {"animation-2d"}, {"animation-2d"})
    assert "curator.display_name is missing or a placeholder" in errors


def test_public_export_separates_source_and_curatorial_style_names():
    day = {
        "id": "041",
        "day": 41,
        "source_review": "reviewed",
        "style": {
            "name": "...",
            "name_status": "unnamed",
            "prompt_published": "Ghibli-inspired hand-painted animation",
        },
        "curator": {
            "display_name": "Ghibli-Inspired Hand-Painted Animation",
            "naming_basis": "published_prompt",
            "confidence": "high",
            "style_family": "animation-2d",
            "canonical_style_id": "028",
            "tags": ["animation-2d", "painterly"],
        },
        "thread": [],
    }
    exported = public_day(day, {"painterly": "Pictórico", "animation-2d": "Animação 2D"})
    assert exported["curator_display_name"] == "Ghibli-Inspired Hand-Painted Animation"
    assert exported["source_style_name"] == "..."
    assert exported["source_style_name_status"] == "unnamed"
    assert exported["curator_tag_labels"] == ["Animação 2D", "Pictórico"]
    assert exported["curator_canonical_style_id"] == "028"


def test_repeated_styles_point_to_canonical_records():
    expected = {
        "032": "028",
        "036": "014",
        "048": "028",
        "055": "039",
        "057": "072",
        "075a": "074",
    }
    found = {}
    relation_types = {}
    for path, data in reviewed_days():
        curator = data.get("curator") or {}
        canonical = curator.get("canonical_style_id")
        if canonical:
            found[path.stem] = str(canonical)
            relation_types[path.stem] = curator.get("canonical_relation")
    assert found == expected
    assert relation_types == {
        "032": "same_style",
        "036": "same_style",
        "048": "same_style",
        "055": "same_style",
        "057": "same_work",
        "075a": "same_style",
    }


def _good_reading(**changes):
    reading = {
        "defines_pt": "Personagem simples sobre fundo pintado.",
        "prompt": "[seu tema], hand-painted anime, painted animation backgrounds",
        "descriptors": ["hand-painted anime", "cel-shaded characters", "painted backgrounds"],
        "avoid": ["3D render"],
        "tested": False,
        "status": "approved",
    }
    reading.update(changes)
    return reading


def test_curator_reading_shape_is_validated():
    assert validate_reading(_good_reading()) == []
    assert "curator.reading.tested must be true or false" in validate_reading(_good_reading(tested="no"))
    assert "curator.reading.descriptors must list 3 to 6 search terms" in validate_reading(_good_reading(descriptors=["um só"]))
    assert "curator.reading.defines_pt is required" in validate_reading(_good_reading(defines_pt=" "))
    assert "curator.reading.status must be draft or approved" in validate_reading(_good_reading(status="rascunho"))


def test_reading_prompt_describes_the_style_not_the_scene():
    errors = validate_reading(_good_reading(prompt="a blond child running downhill, hand-painted anime"))
    assert any("[seu tema]" in error for error in errors)


def test_old_reading_fields_are_rejected():
    assert "curator.reading.prompt_suffix was merged into prompt" in validate_reading(_good_reading(prompt_suffix="x"))
    assert "curator.reading.observations_pt was renamed to defines_pt" in validate_reading(_good_reading(observations_pt="x"))


def test_draft_reading_never_reaches_the_site():
    assert public_reading(_good_reading(status="draft")) is None
    assert public_reading(_good_reading())["prompt"].startswith("[seu tema]")


def test_curator_reading_never_poses_as_the_author_prompt():
    for path, data in reviewed_days():
        reading = (data.get("curator") or {}).get("reading")
        if not reading:
            continue
        published = (data.get("style") or {}).get("prompt_published")
        assert published != reading.get("prompt"), f"{path.stem}: curator prompt copied into the author field"
