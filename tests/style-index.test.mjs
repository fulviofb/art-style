import test from "node:test";
import assert from "node:assert/strict";

import {
  filterStyleItems,
  groupStyleItems,
  namingLabel,
  parseStyleState,
  serializeStyleState,
  sourceDescription,
} from "../site/assets/style-index.mjs";

const families = [
  { id: "animation-2d", label_pt: "Animação 2D" },
  { id: "storybook-illustration", label_pt: "Livro ilustrado e narrativa" },
];
const items = [
  {
    id: "041",
    curator_display_name: "Ghibli-Inspired Hand-Painted Animation",
    source_style_name: "...",
    curator_style_family: "animation-2d",
    curator_tags: ["painterly"],
    curator_tag_labels: ["Pictórico"],
    curator_naming_basis: "published_prompt",
  },
  {
    id: "012",
    curator_display_name: "Whimsical Watercolor Storybook",
    source_style_name: "Whimsical Watercolor Storybook",
    curator_style_family: "storybook-illustration",
    curator_tags: ["watercolor", "storybook"],
    curator_tag_labels: ["Aquarela", "Livro ilustrado"],
    curator_naming_basis: "source_name",
  },
];

test("filter searches curated name, source name and Portuguese tags", () => {
  assert.deepEqual(filterStyleItems(items, { query: "aquarela" }).map((d) => d.id), ["012"]);
  assert.deepEqual(filterStyleItems(items, { query: "ghibli" }).map((d) => d.id), ["041"]);
  assert.deepEqual(filterStyleItems(items, { query: "..." }).map((d) => d.id), ["041"]);
});

test("filter combines query and family", () => {
  assert.deepEqual(
    filterStyleItems(items, { query: "animation", family: "animation-2d" }).map((d) => d.id),
    ["041"],
  );
  assert.deepEqual(filterStyleItems(items, { query: "animation", family: "storybook-illustration" }), []);
});

test("groups follow taxonomy order and omit empty families", () => {
  const groups = groupStyleItems(items, families);
  assert.deepEqual(groups.map((g) => [g.id, g.label, g.items.length]), [
    ["animation-2d", "Animação 2D", 1],
    ["storybook-illustration", "Livro ilustrado e narrativa", 1],
  ]);
});

test("curatorial naming is labeled without treating source normalization as inference", () => {
  assert.equal(namingLabel("curator_inference"), "nome curatorial");
  assert.equal(namingLabel("published_prompt"), "extraído do prompt publicado");
  assert.equal(namingLabel("source_name"), "");
});

test("source description distinguishes unnamed, generic and referenced labels", () => {
  assert.equal(sourceDescription({ source_style_name_status: "unnamed" }), "O autor não publicou um nome de estilo neste post.");
  assert.equal(
    sourceDescription({ source_style_name_status: "published_generic", source_style_name: "Mixed" }),
    "Nome no post: “Mixed”.",
  );
  assert.equal(
    sourceDescription({ source_style_name_status: "reference", source_style_name: "Same as day 28", source_style_reference_day: 28 }),
    "Nome no post: “Same as day 28” — referência ao dia 28.",
  );
});

test("style controls round-trip through URL parameters", () => {
  const parsed = parseStyleState(new URLSearchParams("q=aquarela&familia=storybook-illustration"));
  assert.deepEqual(parsed, { query: "aquarela", family: "storybook-illustration" });
  assert.equal(serializeStyleState(parsed).toString(), "q=aquarela&familia=storybook-illustration");
  assert.equal(serializeStyleState({ query: "", family: "all" }).toString(), "");
});
