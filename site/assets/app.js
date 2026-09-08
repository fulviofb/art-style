import {
  filterStyleItems,
  groupStyleItems,
  namingLabel,
  parseStyleState,
  serializeStyleState,
  sourceDescription,
} from "./style-index.mjs?v=14";

const ROLE_LABEL = {
  hero: "Vídeo no X",
  midjourney_sheets: "Pranchas Midjourney",
  prompt: "Prompt no X",
  quote: "Inspiração citada",
};

async function loadCatalog() {
  const res = await fetch("data/catalog.public.json?v=14", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar o catálogo");
  return res.json();
}

function filledDays(catalog) {
  return catalog.days
    .filter((d) => d.source_review === "reviewed")
    .sort((a, b) => Number(b.day) - Number(a.day) || String(b.variant || "").localeCompare(String(a.variant || "")));
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1600);
}

async function copyText(text, label) {
  if (!text) {
    toast("Este dia ainda não tem prompt publicado");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(label || "Copiado");
  } catch {
    toast("Não deu para copiar — selecione o texto");
  }
}

function copyButton(text, shortLabel) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy";
  btn.textContent = shortLabel || "Copiar prompt";
  btn.disabled = !text;
  if (!text) {
    btn.classList.add("ghost");
    btn.textContent = "Sem prompt";
  }
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyText(text, "Prompt copiado");
  });
  return btn;
}

function still(url, alt) {
  if (!url) return `<div class="hero-still media-fallback"><span>Mídia externa indisponível</span></div>`;
  return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt || "")}" referrerpolicy="no-referrer" loading="lazy" decoding="async" width="1600" height="900">`;
}

function installImageFallback() {
  document.addEventListener("error", (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    const container = event.target.closest(".style-card__image, .hero-still, .still");
    if (!container) return;
    container.classList.add("media-fallback");
    container.innerHTML = "<span>Mídia externa indisponível</span>";
  }, true);
}

function renderGallery(catalog) {
  const root = document.getElementById("gallery");
  if (!root) return;
  const items = filledDays(catalog);
  root.innerHTML = "";
  for (const d of items) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = `dia.html?id=${encodeURIComponent(d.id)}`;
    a.innerHTML = `
      <div class="still">${still(d.poster_url, d.style_name)}</div>
      <div class="body">
        <div class="n">Dia ${escapeHtml(String(d.id))}</div>
        <h2>${escapeHtml(d.style_name || "sem nome")}</h2>
        <p>${escapeHtml(d.logline || "")}</p>
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(copyButton(d.prompt_published));
    a.querySelector(".body").appendChild(actions);
    root.appendChild(a);
  }
}

function renderTicks(catalog) {
  const root = document.getElementById("ticks");
  if (!root) return;
  const map = new Map();
  for (const d of filledDays(catalog)) {
    if (!map.has(Number(d.day))) map.set(Number(d.day), d);
  }
  const planned = catalog.planned_days || 100;
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= planned; n++) {
    const d = map.get(n);
    if (d) {
      const a = document.createElement("a");
      a.href = `dia.html?id=${encodeURIComponent(d.id)}`;
      a.title = `${n} — ${d.style_name || ""}`;
      frag.appendChild(a);
    } else {
      const s = document.createElement("span");
      s.title = String(n);
      frag.appendChild(s);
    }
  }
  root.innerHTML = "";
  root.appendChild(frag);
}

function familyLookup(catalog) {
  return new Map((catalog.style_taxonomy?.families || []).map((item) => [item.id, item]));
}

function sourceEvidence(d) {
  const label = namingLabel(d.curator_naming_basis);
  const source = sourceDescription(d);
  const canonical = d.curator_canonical_style_id
    ? `Mesma linguagem visual do dia ${escapeHtml(d.curator_canonical_style_id)}.`
    : "";
  if (!label && !source && !canonical) return "";
  return `<div class="style-card__provenance">
    ${label ? `<span>${escapeHtml(label)}</span>` : ""}
    ${source ? `<small>${escapeHtml(source)}</small>` : ""}
    ${canonical ? `<small>${canonical}</small>` : ""}
  </div>`;
}

function styleCard(d, families) {
  const family = families.get(d.curator_style_family);
  const tags = (d.curator_tag_labels || []).slice(0, 4);
  return `<a class="style-card" href="dia.html?id=${encodeURIComponent(d.id)}">
    <div class="style-card__image">${still(d.poster_url, d.curator_display_name || d.style_name)}</div>
    <div class="style-card__body">
      <div class="style-card__eyebrow"><span>Dia ${escapeHtml(String(d.id))}</span><span>${escapeHtml(family?.label_pt || "")}</span></div>
      <h3>${escapeHtml(d.curator_display_name || d.style_name || "Estilo sem nome")}</h3>
      ${sourceEvidence(d)}
      ${tags.length ? `<div class="style-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    </div>
  </a>`;
}

function renderStyleIndex(catalog) {
  const root = document.getElementById("styles");
  if (!root) return;
  const input = document.getElementById("style-search");
  const clear = document.getElementById("style-search-clear");
  const filters = document.getElementById("style-filters");
  const status = document.getElementById("style-result-status");
  const items = filledDays(catalog);
  const familyList = catalog.style_taxonomy?.families || [];
  const families = familyLookup(catalog);
  const initial = parseStyleState(new URLSearchParams(location.search));
  let activeFamily = familyList.some((family) => family.id === initial.family) ? initial.family : "all";
  if (input) input.value = initial.query;

  function updateUrl(query) {
    const params = serializeStyleState({ query, family: activeFamily });
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    history.replaceState(null, "", next);
  }

  if (filters) {
    const counts = new Map(familyList.map((family) => [family.id, items.filter((d) => d.curator_style_family === family.id).length]));
    filters.innerHTML = [
      `<button type="button" class="${activeFamily === "all" ? "active" : ""}" aria-pressed="${activeFamily === "all"}" data-family="all">Todos <span>${items.length}</span></button>`,
      ...familyList
        .filter((family) => counts.get(family.id))
        .map((family) => `<button type="button" class="${activeFamily === family.id ? "active" : ""}" aria-pressed="${activeFamily === family.id}" data-family="${escapeAttr(family.id)}">${escapeHtml(family.label_pt)} <span>${counts.get(family.id)}</span></button>`),
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
    const groups = groupStyleItems(filtered, familyList);
    updateUrl(query);
    if (clear) clear.hidden = !query;
    if (status) {
      status.textContent = `${filtered.length} de ${items.length} ${items.length === 1 ? "estilo" : "estilos"}`;
    }
    if (!filtered.length) {
      root.innerHTML = `<div class="style-empty"><strong>Nenhum estilo encontrado.</strong><span>Tente outro termo ou selecione “Todos”.</span></div>`;
      return;
    }
    root.innerHTML = groups.map((group) => `
      <section class="style-group" aria-labelledby="family-${escapeAttr(group.id)}">
        <header class="style-group__header">
          <div><p>${group.items.length} ${group.items.length === 1 ? "estilo" : "estilos"}</p><h2 id="family-${escapeAttr(group.id)}">${escapeHtml(group.label)}</h2></div>
          <p>${escapeHtml(group.description)}</p>
        </header>
        <div class="style-grid">${group.items.map((d) => styleCard(d, families)).join("")}</div>
      </section>
    `).join("");
  }

  input?.addEventListener("input", render);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      input.value = "";
      render();
    }
  });
  clear?.addEventListener("click", () => {
    if (input) {
      input.value = "";
      input.focus();
    }
    render();
  });
  render();
}

function renderIndexes(catalog) {
  const tools = document.getElementById("tools");
  const items = filledDays(catalog);
  renderStyleIndex(catalog);
  if (tools) {
    const bag = new Map();
    for (const d of items) {
      for (const t of d.tools || []) {
        if (!t.name) continue;
        if (!bag.has(t.name)) bag.set(t.name, []);
        bag.get(t.name).push(d);
      }
    }
    tools.innerHTML = [...bag.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([name, ds]) =>
          `<a href="#"><span></span><span><strong>${escapeHtml(name)}</strong><small>${ds.map((d) => d.id).join(", ")}</small></span></a>`
      )
      .join("");
  }
}

function embedBlock(part) {
  const label = ROLE_LABEL[part.role] || part.role;
  const url = part.post_url;
  const note = part.note ? `<p style="color:var(--muted)">${escapeHtml(part.note)}</p>` : "";
  const body = url
    ? `<div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
        <a class="btn" href="${escapeAttr(url)}" rel="noopener noreferrer">Abrir no X</a>
        ${part.embed ? `<blockquote class="twitter-tweet"><a href="${escapeAttr(url)}"></a></blockquote>` : ""}
      </div>`
    : `<p style="color:var(--muted)">URL ainda não verificada.</p>`;
  return `<div class="block"><h3>${escapeHtml(label)}</h3>${note}${body}</div>`;
}

function renderFicha(catalog) {
  const root = document.getElementById("ficha");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const d = catalog.days.find((x) => String(x.id) === String(id));
  if (!d || d.source_review === "empty") {
    root.innerHTML = `<p>Ficha ainda não preenchida.</p><p><a href="index.html">Voltar</a></p>`;
    return;
  }
  document.title = `Dia ${d.id} — ${d.curator_display_name || d.style_name || "sem nome"}`;
  const extra = d.style_name_extra ? ` ${escapeHtml(d.style_name_extra)}` : "";
  const tools = (d.tools || []).filter((t) => t.name).map((t) => t.name).join(" · ");
  const family = familyLookup(catalog).get(d.curator_style_family);
  const naming = namingLabel(d.curator_naming_basis);
  const source = sourceDescription(d);
  const confidence = { high: "alta", medium: "média", low: "baixa" }[d.curator_confidence] || "";
  const canonical = d.curator_canonical_style_id
    ? `<p>Esta ficha usa a mesma linguagem visual catalogada no <a href="dia.html?id=${encodeURIComponent(d.curator_canonical_style_id)}">dia ${escapeHtml(d.curator_canonical_style_id)}</a>.</p>`
    : "";
  const classification = `
    <section class="style-classification" aria-labelledby="classification-title">
      <div class="style-classification__top">
        <h3 id="classification-title">Classificação da curadoria</h3>
        ${family ? `<span class="style-classification__family">${escapeHtml(family.label_pt)}</span>` : ""}
        ${naming ? `<span class="style-classification__badge">${escapeHtml(naming)}${confidence ? ` · confiança ${escapeHtml(confidence)}` : ""}</span>` : ""}
      </div>
      ${(d.curator_tag_labels || []).length ? `<div class="style-tags">${d.curator_tag_labels.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${source ? `<p>${escapeHtml(source)}</p>` : `<p>Nome publicado pelo autor: “${escapeHtml(d.source_style_name || d.style_name || "") }”.</p>`}
      ${canonical}
    </section>`;
  const insp = (d.inspiration || [])
    .map((item) => {
      if (item.quote) {
        const href = item.post_url
          ? `<p><a href="${escapeAttr(item.post_url)}" rel="noopener noreferrer">@${escapeHtml(item.handle || "")} — ${escapeHtml(item.work || "post")}</a></p>`
          : "";
        return `${href}<blockquote class="quote">${escapeHtml(item.quote)}</blockquote>`;
      }
      const bits = [item.work, item.text, item.note].filter(Boolean).join(" — ");
      const link = item.post_url
        ? `<a href="${escapeAttr(item.post_url)}" rel="noopener noreferrer">${escapeHtml(bits || item.post_url)}</a>`
        : escapeHtml(bits);
      return `<p>${link}</p>`;
    })
    .join("");

  root.innerHTML = `
    <p><a href="index.html">← galeria</a></p>
    <div class="kicker">Dia ${escapeHtml(String(d.id))} ${tools ? " · " + escapeHtml(tools) : ""}</div>
    <h2>${escapeHtml(d.curator_display_name || d.style_name || "sem nome")}${extra}</h2>
    ${d.logline ? `<p class="logline">${escapeHtml(d.logline)}</p>` : ""}
    <div class="hero-still">${still(d.poster_url, d.curator_display_name || d.style_name)}</div>
    <div class="prompt-box" id="prompt-box">
      <header>
        <h3>Bloco de estilo — copiar</h3>
      </header>
      <p class="prompt-text">${escapeHtml(d.prompt_published || "O autor não publicou bloco de estilo neste dia.")}</p>
    </div>
    ${classification}
    ${d.creator_notes ? `<div class="block"><h3>Notas do autor</h3><p>${escapeHtml(d.creator_notes)}</p></div>` : ""}
    ${insp ? `<div class="block"><h3>Inspiração</h3>${insp}</div>` : ""}
    ${(d.thread || []).map(embedBlock).join("")}
    ${d.curator_notes ? `<div class="block"><h3>Nota do curador</h3><p>${escapeHtml(d.curator_notes)}</p></div>` : ""}
    <p><a class="btn" href="${escapeAttr(d.open_on_x)}" rel="noopener noreferrer">Ver o dia no X</a></p>
  `;
  const box = document.getElementById("prompt-box");
  if (box) box.querySelector("header").appendChild(copyButton(d.prompt_published, "Copiar"));
  if (window.twttr && window.twttr.widgets) window.twttr.widgets.load();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function boot() {
  installImageFallback();
  try {
    const catalog = await loadCatalog();
    const n = filledDays(catalog).length;
    const tag = document.getElementById("tagline");
    if (tag) {
      const rest = catalog.tagline || "art styles para copiar — ilustração, animação, folk, HQ";
      tag.textContent = `${n} ${rest}`;
    }
    renderGallery(catalog);
    renderTicks(catalog);
    renderIndexes(catalog);
    renderFicha(catalog);
  } catch (e) {
    const box = document.getElementById("gallery") || document.getElementById("ficha") || document.getElementById("styles");
    if (box) box.innerHTML = `<p>Sirva a pasta <code>site/</code> via HTTP para carregar o catálogo.</p>`;
    console.error(e);
  }
}

boot();
