# 100 AI Styles in 100 Days — índice não-oficial

Índice **não-oficial** da série [100 AI Styles in 100 Days](https://x.com/NVTDanh), de **ToaiDanh** ([@NVTDanh](https://x.com/NVTDanh)).

Não há afiliação com o autor. A obra canônica está no X. Este repositório organiza o que ele publica: dia, estilo, logline, ferramentas, fio (vídeo, pranchas, prompt, inspiração) e o link original.

Leia [NOTICE.md](NOTICE.md) antes de reutilizar qualquer coisa.

## O que isto não é

- Não é o arquivo oficial da série.
- Não hospeda vídeo nem prancha Midjourney.
- Não reliceia prompts, imagens ou curtas.
- Não inventa os dias que ainda não foram fichados.

## Como usar

1. Grade: `site/index.html` (ou o site publicado).
2. Ficha: `site/dia.html?id=079`.
3. Fonte: `catalog/days/*.yml` — um arquivo por dia.
4. Export público: `python scripts/export_public_catalog.py`

Ficha `reviewed` = fio original aberto. O resto fica `empty` ou `discovered_needs_original_review`.

## Curadoria de estilos

A fonte e a interpretação editorial são mantidas separadas:

- `style.name`: texto publicado pelo autor, preservado mesmo quando é `Mixed`, `...` ou uma referência a outro dia.
- `style.name_status`: `published`, `published_generic`, `unnamed` ou `reference`.
- `curator.display_name`: nome em inglês usado publicamente para localizar e reutilizar a linguagem visual.
- `curator.naming_basis` e `curator.confidence`: origem e grau de segurança do nome curatorial.
- `curator.style_family` e `curator.tags`: classificação controlada, exibida em português a partir de [`catalog/style_taxonomy.yml`](catalog/style_taxonomy.yml).
- `curator.canonical_style_id`: relaciona continuações e repetições sem fundir as fichas originais.

Nomes inferidos são marcados como curadoria no site. Prompts ausentes nunca são reconstruídos.

## Site local

Abra `site/index.html` num servidor estático (os embeds do X não gostam de `file://`):

```bash
python -m http.server 4173 --directory site
```

## Captura de um dia novo

1. Abrir o post do dia no X e o fio (quotes, replies do autor, mídia).
2. Copiar `catalog/days/001.yml` e preencher só o que está no original.
3. `python scripts/validate_catalog.py`
4. `python scripts/export_public_catalog.py`
5. Commit.

Não usar scraper de mídia do X.

## Licença

MIT para o código e o schema deste índice. A série continua do autor. Ver [NOTICE.md](NOTICE.md).
