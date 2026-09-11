import {
  filterStyleItems,
  groupStyleItems,
  parseStyleState,
  serializeStyleState,
} from "./style-index.mjs?v=15";

async function loadCatalog() {
  const response = await fetch("data/catalog.public.json?v=15", { cache: "no-store" });
  if (!response.ok) throw new Error("Falha ao carregar a biblioteca");
  return response.json();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function still(url, alt, eager = false) {
  if (!url) return '<div class="media-fallback"><span>Mídia externa indisponível</span></div>';
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" loading="${eager ? "eager" : "lazy"}" decoding="async" width="1600" height="900">`;
}

function installImageFallback() {
  document.addEventListener("error", (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    const frame = event.target.closest(".style-card__image, .style-hero__media, .example-card__media");
    if (frame) frame.innerHTML = '<div class="media-fallback"><span>Mídia externa indisponível</span></div>';
  }, true);
}

function toast(message) {
  let element = document.getElementById("toast");
  if (!element) {
    element = document.createElement("div");
    element.id = "toast";
    element.className = "toast";
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 1600);
}

async function copyText(text, done = "Prompt copiado") {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast("Não foi possível copiar — selecione o texto");
  }
}

function metricText(style) {
  const references = `${style.example_count} ${style.example_count === 1 ? "referência" : "referências"}`;
  if (!style.recipe_count) return references;
  return `${references} · ${style.recipe_count} ${style.recipe_count === 1 ? "receita" : "receitas"}`;
}

function styleCard(style) {
  const tags = (style.tag_labels || []).slice(0, 4);
  return `<a class="style-card" href="estilo.html?id=${encodeURIComponent(style.slug)}">
    <div class="style-card__image">${still(style.poster_url, style.display_name)}</div>
    <div class="style-card__body">
      <div class="style-card__eyebrow"><span>${escapeHtml(style.family_label)}</span><span>${escapeHtml(metricText(style))}</span></div>
      <h3>${escapeHtml(style.display_name)}</h3>
      ${style.summary_pt ? `<p class="style-card__summary">${escapeHtml(style.summary_pt)}</p>` : ""}
      ${tags.length ? `<div class="style-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    </div>
  </a>`;
}

function renderExplore(catalog) {
  const root = document.getElementById("styles");
  if (!root) return;
  const input = document.getElementById("style-search");
  const clear = document.getElementById("style-search-clear");
  const filters = document.getElementById("style-filters");
  const status = document.getElementById("style-result-status");
  const items = catalog.styles || [];
  const families = catalog.style_taxonomy?.families || [];
  const initial = parseStyleState(new URLSearchParams(location.search));
  let activeFamily = families.some((family) => family.id === initial.family) ? initial.family : "all";
  if (input) input.value = initial.query;

  const counts = new Map(families.map((family) => [family.id, items.filter((style) => style.family === family.id).length]));
  if (filters) {
    filters.innerHTML = [
      `<button type="button" data-family="all" aria-pressed="${activeFamily === "all"}" class="${activeFamily === "all" ? "active" : ""}">Todos <span>${items.length}</span></button>`,
      ...families.filter((family) => counts.get(family.id)).map((family) =>
        `<button type="button" data-family="${escapeHtml(family.id)}" aria-pressed="${activeFamily === family.id}" class="${activeFamily === family.id ? "active" : ""}">${escapeHtml(family.label_pt)} <span>${counts.get(family.id)}</span></button>`
      ),
    ].join("");
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-family]");
      if (!button) return;
      activeFamily = button.dataset.family;
      filters.querySelectorAll("button").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  }

  function render() {
    const query = input?.value || "";
    const filtered = filterStyleItems(items, { query, family: activeFamily });
    const groups = groupStyleItems(filtered, families);
    const params = serializeStyleState({ query, family: activeFamily });
    history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}`);
    if (clear) clear.hidden = !query;
    if (status) status.textContent = `${filtered.length} de ${items.length} estilos`;
    if (!filtered.length) {
      root.innerHTML = '<div class="style-empty"><strong>Nenhum estilo encontrado.</strong><span>Tente outro termo ou selecione “Todos”.</span></div>';
      return;
    }
    root.innerHTML = groups.map((group) => `<section class="style-group" aria-labelledby="family-${escapeHtml(group.id)}">
      <header class="style-group__header">
        <div><p>${group.items.length} ${group.items.length === 1 ? "estilo" : "estilos"}</p><h2 id="family-${escapeHtml(group.id)}">${escapeHtml(group.label)}</h2></div>
        <p>${escapeHtml(group.description)}</p>
      </header>
      <div class="style-grid">${group.items.map(styleCard).join("")}</div>
    </section>`).join("");
  }

  input?.addEventListener("input", render);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      input.value = "";
      render();
    }
  });
  clear?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    render();
  });
  render();
}

async function imageAsPng(url) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(String(response.status));
  const source = await response.blob();
  if (source.type === "image/png") return source;
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png"));
}

async function copyImage(url) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    toast("Este navegador não copia imagens — use “Abrir imagem”");
    return;
  }
  // O ClipboardItem precisa nascer dentro do clique: o Safari recusa a escrita depois de um await.
  const png = imageAsPng(url);
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    toast("Imagem copiada — cole no seu editor");
  } catch {
    toast("Não foi possível copiar — use “Abrir imagem”");
  }
}

function imageActions(url, source) {
  if (!url) return "";
  const credit = source?.source_label ? `Imagem de ${escapeHtml(source.source_label)}` : "Imagem da fonte";
  const link = source?.source_url ? ` · <a href="${escapeHtml(source.source_url)}" rel="noopener noreferrer">ver na fonte ↗</a>` : "";
  return `<div class="image-actions">
    <button type="button" class="copy" data-copy-image="${escapeHtml(url)}">Copiar imagem</button>
    <a class="ghost" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir imagem ↗</a>
    <p>${credit}${link}. Use como referência de estilo no seu editor; não publique como sua.</p>
  </div>`;
}

const READING_TOAST = {
  prompt: "Prompt copiado — troque [seu tema] pelo seu assunto",
  avoid: "Lista do que evitar copiada",
  terms: "Termos copiados",
};

function readingText(reading, kind) {
  if (!reading) return "";
  if (kind === "prompt") return reading.prompt || "";
  if (kind === "avoid") return (reading.avoid || []).join(", ");
  if (kind === "terms") return (reading.descriptors || []).join(", ");
  return "";
}

function readingSection(reading) {
  if (!reading) return "";
  const chips = (items) => `<div class="style-tags">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
  const block = (title, kind, label, content, ghost = false) => `<div class="reading-block">
      <header><h3>${title}</h3>${kind ? `<button type="button" class="copy${ghost ? " ghost" : ""}" data-copy-reading="${kind}">${label}</button>` : ""}</header>
      ${content}
    </div>`;
  const prompt = escapeHtml(reading.prompt || "").split("[seu tema]").join('<mark class="slot">[seu tema]</mark>');
  const status = reading.tested ? "Prompt testado" : "Prompt ainda não testado";
  return `<section class="detail-section reading">
    <header><p class="section-kicker">Leitura da curadoria</p><h2>Como reconhecer e reproduzir</h2></header>
    <div class="reading-body">
      <p class="reading-note"><span class="reading-badge${reading.tested ? " is-tested" : ""}">${status}</span>Esta leitura e este prompt são da curadoria, não do autor dos vídeos.${reading.tested ? "" : " Teste antes de confiar no resultado."}</p>
      ${reading.defines_pt ? block("O que define o estilo", null, "", `<p class="reading-observations">${escapeHtml(reading.defines_pt)}</p>`) : ""}
      ${reading.prompt ? block("Prompt de estilo", "prompt", "Copiar prompt", `<pre>${prompt}</pre><p class="reading-why">Troque [seu tema] pelo que você quer mostrar. O prompt traz só o estilo; para a cena, cole a imagem como referência.</p>`) : ""}
      ${reading.avoid?.length ? block("Evite estes termos", "avoid", "Copiar lista", `${chips(reading.avoid)}${reading.avoid_why_pt ? `<p class="reading-why">${escapeHtml(reading.avoid_why_pt)}</p>` : ""}`, true) : ""}
      ${reading.descriptors?.length ? block("Termos para busca", "terms", "Copiar termos", chips(reading.descriptors), true) : ""}
    </div>
  </section>`;
}

function renderStyleDetail(catalog) {
  const root = document.getElementById("style-detail");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const style = (catalog.styles || []).find((item) => item.slug === id || item.id === id);
  if (!style) {
    root.innerHTML = '<div class="style-empty"><strong>Estilo não encontrado.</strong><a href="index.html">Voltar para Explorar</a></div>';
    return;
  }
  document.title = `${style.display_name} — Técnicas de Art Style`;
  const heroSource = (style.examples || []).find((example) => example.poster_url === style.poster_url) || (style.examples || [])[0];
  const examples = (style.examples || []).map((example, index) => `<article class="example-card">
    <div class="example-card__media">${still(example.poster_url, `${style.display_name} — exemplo ${index + 1}`)}</div>
    ${imageActions(example.poster_url, example)}
    <div class="example-card__body">
      <p class="eyebrow">Referência selecionada · ${escapeHtml(example.source_label)}</p>
      ${example.caption ? `<p>${escapeHtml(example.caption)}</p>` : ""}
      ${(example.tools || []).length ? `<p class="example-tools">${example.tools.map(escapeHtml).join(" · ")}</p>` : ""}
      ${example.source_url ? `<a href="${escapeHtml(example.source_url)}" rel="noopener noreferrer">Abrir fonte original ↗</a>` : ""}
    </div>
  </article>`).join("");
  const recipes = (style.recipes || []).map((recipe, index) => {
    const copyable = Boolean(recipe.text);
    return `<article class="recipe-card">
    <header><div><p class="eyebrow">Receita ${index + 1}${recipe.license ? ` · ${escapeHtml(recipe.license)}` : ""}</p><h3>${copyable ? `Prompt publicado por ${escapeHtml(recipe.source_label)}` : `Pacote de execução · ${escapeHtml(recipe.source_label)}`}</h3></div>${copyable ? `<button type="button" class="copy" data-recipe="${index}">Copiar prompt</button>` : ""}</header>
    ${copyable ? `<pre>${escapeHtml(recipe.text)}</pre>` : `<p class="empty-note">Esta receita exige âncora visual e um fluxo em três estágios. Copiar só o texto quebraria o contrato da fonte.</p>`}
    ${recipe.source_url ? `<a href="${escapeHtml(recipe.source_url)}" rel="noopener noreferrer">Conferir na fonte ↗</a>` : ""}
  </article>`;
  }).join("");
  root.innerHTML = `<a class="back-link" href="index.html">← Explorar estilos</a>
    <section class="style-hero">
      <div class="style-hero__copy"><p class="section-kicker">${escapeHtml(style.family_label)}</p><h2>${escapeHtml(style.display_name)}</h2><div class="style-tags">${(style.tag_labels || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>${style.summary_pt ? `<p class="style-summary style-summary--pt">${escapeHtml(style.summary_pt)}</p>` : ""}<p class="style-summary">${escapeHtml(metricText(style))} nesta curadoria.</p></div>
      <div class="style-hero__visual"><div class="style-hero__media">${still(style.poster_url, style.reading?.alt_pt || style.display_name, true)}</div>${imageActions(style.poster_url, heroSource)}</div>
    </section>
    ${readingSection(style.reading)}
    <section class="detail-section"><header><p class="section-kicker">Referências</p><h2>Veja a linguagem em uso</h2></header><div class="example-grid">${examples}</div></section>
    <section class="detail-section"><header><p class="section-kicker">Receitas</p><h2>${recipes ? "Prompts disponíveis" : style.reading ? "Nenhum prompt do autor" : "Receita ainda não catalogada"}</h2></header>${recipes || (style.reading ? '<p class="empty-note">O autor não publicou prompt para este estilo. A leitura da curadoria, acima, traz um prompt próprio.</p>' : '<p class="empty-note">A referência visual está catalogada, mas nenhuma receita verificável foi publicada ou incorporada.</p>')}</section>`;
  root.querySelectorAll("button[data-copy-image]").forEach((button) => {
    button.addEventListener("click", () => copyImage(button.dataset.copyImage));
  });
  root.querySelectorAll("button[data-copy-reading]").forEach((button) => {
    button.addEventListener("click", () => {
      const text = readingText(style.reading, button.dataset.copyReading);
      if (text) copyText(text, READING_TOAST[button.dataset.copyReading]);
    });
  });
  root.querySelectorAll("button[data-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      const recipe = style.recipes[Number(button.dataset.recipe)];
      if (recipe?.text) copyText(recipe.text);
    });
  });
}

function renderTools(catalog) {
  const root = document.getElementById("tools");
  if (!root) return;
  const tools = new Map();
  for (const style of catalog.styles || []) {
    for (const example of style.examples || []) {
      for (const tool of example.tools || []) {
        if (!tools.has(tool)) tools.set(tool, new Set());
        tools.get(tool).add(style.slug);
      }
    }
  }
  root.innerHTML = [...tools.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tool, slugs]) =>
    `<a href="index.html?q=${encodeURIComponent(tool)}"><span class="tool-count">${slugs.size}</span><span><strong>${escapeHtml(tool)}</strong><small>${slugs.size} ${slugs.size === 1 ? "estilo relacionado" : "estilos relacionados"}</small></span></a>`
  ).join("");
}

function updateCounts(catalog) {
  document.querySelectorAll("[data-style-count]").forEach((element) => { element.textContent = catalog.counts?.styles || 0; });
  document.querySelectorAll("[data-reference-count]").forEach((element) => { element.textContent = catalog.counts?.references || 0; });
}

async function boot() {
  installImageFallback();
  try {
    const catalog = await loadCatalog();
    updateCounts(catalog);
    renderExplore(catalog);
    renderStyleDetail(catalog);
    renderTools(catalog);
  } catch (error) {
    const root = document.getElementById("styles") || document.getElementById("style-detail") || document.getElementById("tools");
    if (root) root.innerHTML = '<div class="style-empty"><strong>Não foi possível carregar a biblioteca.</strong><span>Tente novamente em instantes.</span></div>';
    console.error(error);
  }
}

boot();
