export function parseStyleState(params) {
  return {
    query: params.get("q") || "",
    family: params.get("familia") || "all",
  };
}

export function serializeStyleState({ query = "", family = "all" } = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (family && family !== "all") params.set("familia", family);
  return params;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function searchText(style) {
  const exampleText = (style.examples || [])
    .flatMap((example) => [
      example.source_style_name,
      example.caption,
      example.source_label,
      ...(example.tools || []),
    ]);
  const recipeText = (style.recipes || []).flatMap((recipe) => [
    recipe.source_label,
    recipe.kind,
    recipe.license,
  ]);
  return normalize([
    style.display_name,
    style.summary_pt,
    ...(style.reading?.descriptors || []),
    style.family,
    style.family_label,
    ...(style.tags || []),
    ...(style.tag_labels || []),
    ...exampleText,
    ...recipeText,
  ].join(" "));
}

export function filterStyleItems(items, { query = "", family = "all" } = {}) {
  const needle = normalize(query.trim());
  return [...items]
    .filter((style) => family === "all" || style.family === family)
    .filter((style) => !needle || searchText(style).includes(needle))
    .sort((a, b) => String(a.display_name || "").localeCompare(String(b.display_name || ""), "en"));
}

export function groupStyleItems(items, families) {
  const grouped = new Map();
  for (const style of items) {
    if (!grouped.has(style.family)) grouped.set(style.family, []);
    grouped.get(style.family).push(style);
  }
  return (families || [])
    .filter((family) => grouped.has(family.id))
    .map((family) => ({
      id: family.id,
      label: family.label_pt,
      description: family.description_pt || "",
      items: grouped.get(family.id),
    }));
}
