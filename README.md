# Técnicas de Art Style

Biblioteca **atemporal e multifonte** de linguagens visuais para criar imagem e vídeo com IA.

A interface pública organiza estilos canônicos, referências e receitas. Numeração de “dias” fica só nos metadados internos, para rastrear publicações originais.

Leia [NOTICE.md](NOTICE.md) antes de reutilizar qualquer coisa.

## Superfície pública

1. Explorar: `site/index.html`
2. Ficha de estilo: `site/estilo.html?id=<slug>`
3. Fonte interna: `catalog/days/*.yml`
4. Coleções complementares: `catalog/collections/*.yml`
5. Export público: `python scripts/export_public_catalog.py`

O site não rehospeda mídia. Imagens apontam para as fontes originais.

## Curadoria

- `style.name`: texto publicado pelo autor, preservado mesmo quando é placeholder.
- `curator.display_name`: nome público da linguagem visual.
- `curator.style_family` e `curator.tags`: taxonomia em português.
- `curator.canonical_style_id` + `canonical_relation`: agrupa continuações, o mesmo estilo ou a mesma obra.
- Prompts ausentes nunca são inventados.

## Fontes atuais

- Publicações de [ToaiDanh (@NVTDanh)](https://x.com/NVTDanh): `copy_policy: link_only`.
- Receitas testadas de [threerocks/hand-drawn-styles](https://github.com/threerocks/hand-drawn-styles) no commit `7388c55d2a135e91eb62f5b6b2fc5300a5b0f40d`, licença MIT, com atribuição. A variante 3.1 exige âncora e fluxo em três estágios; não é oferecida como prompt isolado.

## Site local

```bash
python -m http.server 4173 --directory site
```

## Captura de uma referência nova

1. Abrir a publicação original.
2. Copiar um YAML existente em `catalog/days/` e preencher só o que está na fonte.
3. `python scripts/validate_catalog.py`
4. `python scripts/export_public_catalog.py`
5. Commit.

Não usar scraper de mídia do X.

## Licença

MIT para o código e o schema deste índice. Conteúdo das fontes permanece de seus autores. Ver [NOTICE.md](NOTICE.md).
