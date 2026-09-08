import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  filterStyleItems,
  groupStyleItems,
  parseStyleState,
  serializeStyleState,
} from "../site/assets/style-index.mjs";

const families = [
  { id: "animation-2d", label_pt: "Animação 2D", description_pt: "Desenho animado." },
  { id: "storybook-illustration", label_pt: "Livro ilustrado e narrativa", description_pt: "Narrativas ilustradas." },
];

const items = [
  {
    id: "ghibli-inspired-hand-painted-animation",
    slug: "ghibli-inspired-hand-painted-animation",
    display_name: "Ghibli-Inspired Hand-Painted Animation",
    family: "animation-2d",
    family_label: "Animação 2D",
    tags: ["painterly"],
    tag_labels: ["Pictórico"],
    example_count: 2,
    recipe_count: 1,
    examples: [{ source_style_name: "...", caption: "A hand-painted chase", tools: ["Seedance"] }],
  },
  {
    id: "whimsical-watercolor-storybook",
    slug: "whimsical-watercolor-storybook",
    display_name: "Whimsical Watercolor Storybook",
    family: "storybook-illustration",
    family_label: "Livro ilustrado e narrativa",
    tags: ["watercolor", "storybook"],
    tag_labels: ["Aquarela", "Livro ilustrado"],
    example_count: 1,
    recipe_count: 0,
    examples: [{ source_style_name: "Whimsical Watercolor Storybook", caption: "Soft narrative watercolor", tools: [] }],
  },
];

test("filter searches timeless style fields and example metadata", () => {
  assert.deepEqual(filterStyleItems(items, { query: "aquarela" }).map((style) => style.id), ["whimsical-watercolor-storybook"]);
  assert.deepEqual(filterStyleItems(items, { query: "ghibli" }).map((style) => style.id), ["ghibli-inspired-hand-painted-animation"]);
  assert.deepEqual(filterStyleItems(items, { query: "seedance" }).map((style) => style.id), ["ghibli-inspired-hand-painted-animation"]);
});

test("filter combines query and family", () => {
  assert.deepEqual(
    filterStyleItems(items, { query: "animation", family: "animation-2d" }).map((style) => style.id),
    ["ghibli-inspired-hand-painted-animation"],
  );
  assert.deepEqual(filterStyleItems(items, { query: "animation", family: "storybook-illustration" }), []);
});

test("groups follow taxonomy order and omit empty families", () => {
  const groups = groupStyleItems(items, families);
  assert.deepEqual(groups.map((group) => [group.id, group.label, group.items.length]), [
    ["animation-2d", "Animação 2D", 1],
    ["storybook-illustration", "Livro ilustrado e narrativa", 1],
  ]);
});

test("style controls round-trip through URL parameters", () => {
  const parsed = parseStyleState(new URLSearchParams("q=aquarela&familia=storybook-illustration"));
  assert.deepEqual(parsed, { query: "aquarela", family: "storybook-illustration" });
  assert.equal(serializeStyleState(parsed).toString(), "q=aquarela&familia=storybook-illustration");
  assert.equal(serializeStyleState({ query: "", family: "all" }).toString(), "");
});

test("image fallback assigns valid HTML without stray identifiers", () => {
  const source = readFileSync(new URL("../site/assets/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /innerHTML\s+IRequest/);
});
