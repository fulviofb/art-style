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
- `curator.summary_pt`: uma frase em português dizendo como o estilo se parece e para que serve.
  O nome do estilo permanece no idioma da fonte porque é ele que vai no prompt; a descrição é a camada do curador.
  A frase descreve o que o pôster mostra, não o que o nome promete: quando o nome afirma algo que a imagem
  não tem, a frase diz isso. `curator.summary_review: poster_checked` registra que ela foi conferida contra o
  pôster, que é um quadro do vídeo e não o vídeo inteiro. O validador exige os dois campos nos estilos canônicos.
- `curator.reading`: leitura da curadoria, opcional, com `status: draft|approved`; só a aprovada vai para o site.
  Campos: `defines_pt` (o que define o estilo; a primeira frase é a chave), `prompt` (só o estilo, começando por
  `[seu tema]`), `avoid` e `avoid_why_pt`, `descriptors` (3 a 6 termos para busca), `alt_pt` (texto alternativo
  do pôster, opcional) e `tested: true|false`. É autoria do curador: nunca vai para `style.prompt_published`.
  **Teste da troca de tema:** troque o assunto do pôster por outro qualquer; o que continuar verdadeiro é estilo
  e fica no prompt, o que deixar de fazer sentido é cena e sai. A cena só entra em `alt_pt`. O validador exige
  `[seu tema]` no prompt.
- `curator.style_family` e `curator.tags`: taxonomia em português.
- `curator.canonical_style_id` + `canonical_relation`: agrupa continuações, o mesmo estilo ou a mesma obra.
- Prompts ausentes nunca são inventados.


## Regra de idioma

- **Inglês, para o que vai ao gerador:** `curator.reading.prompt`, `descriptors` e `avoid`.
  Os modelos de imagem e vídeo respondem melhor em inglês. O nome do estilo (`style.name` e
  `curator.display_name`) também fica no idioma da fonte, porque já é material de prompt.
- **Português, para o que a pessoa lê para entender e decidir:** `curator.summary_pt`,
  `curator.reading.defines_pt`, `curator.reading.alt_pt`, `curator.reading.avoid_why_pt`, famílias, tags e toda a interface do site.
  Os campos em português levam o sufixo `_pt`.
- **Idioma original, para o que é do autor:** `logline`, `creator_notes` e `style.prompt_published` ficam como
  foram publicados.

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
