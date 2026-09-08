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

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterStyleItems(items, { query = "", family = "all" } = {}) {
  const needle = normalized(query);
  return items.filter((item) => {
    if (family !== "all" && item.curator_style_family !== family) return false;
    if (!needle) return true;
    const haystack = normalized([
      item.curator_display_name,
      item.source_style_name,
      ...(item.curator_tag_labels || []),
      ...(item.curator_tags || []),
      item.logline,
    ].join(" "));
    return haystack.includes(needle);
  });
}

export function groupStyleItems(items, families) {
  return (families || [])
    .map((family) => ({
      id: family.id,
      label: family.label_pt,
      description: family.description_pt || "",
      items: items.filter((item) => item.curator_style_family === family.id),
    }))
    .filter((group) => group.items.length > 0);
}

export function namingLabel(basis) {
  return {
    curator_inference: "nome curatorial",
    source_context: "nome curatorial a partir do contexto",
    source_reference: "nome recuperado de outro dia",
    published_prompt: "extraído do prompt publicado",
    curator_normalization: "nome normalizado pela curadoria",
    source_name: "",
  }[basis] || "";
}

export function sourceDescription(item) {
  const status = item.source_style_name_status;
  const source = String(item.source_style_name || "").trim();
  if (status === "unnamed") {
    return "O autor não publicou um nome de estilo neste post.";
  }
  if (status === "reference" && source) {
    const suffix = item.source_style_reference_day ? ` — referência ao dia ${item.source_style_reference_day}` : "";
    return `Nome no post: “${source}”${suffix}.`;
  }
  if (status === "published_generic" && source) {
    return `Nome no post: “${source}”.`;
  }
  return "";
}
