# Plano de migração para o protótipo v4 — HUBFLIX

Base: `prisma-prototipo v4.html` (2.392 linhas) contra o app real.
Dados de produção conferidos em 11/08/2026: **150.000 canais**, 150 grupos,
tabela `Title` vazia, 4 perfis.

---

## 1. Resumo executivo

O v4 é um protótipo de **produto de streaming completo** desenhado sobre dados
que um agregador de IPTV não tem. A parte visual migra quase inteira. A parte
de **dados esportivos e de agenda de novelas não migra** — não é questão de
esforço, é ausência de fonte.

Veredito por aba:

| Aba | Migra | Observação |
|---|---|---|
| Filmes e séries | **~95%** | Só o "combina X%" e duração ficam de fora |
| Canais | **~60%** | EPG cobre 55% da grade; número de canal e saúde do stream não existem |
| Novelas | **~40%** | Estado por título é fácil; agenda de capítulo e horário de exibição, não |
| Dicas | **~70%** | Motivos textuais sim; percentuais fabricados, não |
| Kids | **~85%** | Faixa etária exige curadoria própria |
| Esportes | **~20%** | Placar, tabela, artilharia, chaveamento e grid: **impossível sem API esportiva paga** |

**O maior risco do projeto é a aba Esportes.** Ela é ~40% do protótipo em
volume de tela e quase toda inviável com o que temos. Decisão necessária antes
de começar: contratar uma API esportiva (API-Football, Sportradar) ou reduzir a
aba a "canais de esporte + agenda de EPG".

---

## 2. Filmes e séries (aba principal)

### Como fica
Hero rotativo → Continuar assistindo → Top 10 → e então **fileiras alternadas**:
gênero, recomendação, gênero, recomendação.

### Card (o que você pediu para copiar)

| Propriedade | v4 | Decisão |
|---|---|---|
| Largura | 112px | Adotar |
| Pôster | 2:3, raio 14px | Adotar |
| Rótulo | 12,5px/600, branco 62% | Adotar |
| Sublinha | 11px/700, âmbar `#FFD86B` | Adotar, trocando âmbar por `#B15CFF` |
| Selo (esq.) | 19px, raio 6, blur | Adotar; sem blur no modo leve |
| Chip (dir.) | 19px, raio 6, fundo escuro | Adotar |
| Não-focado | `brightness(.86) saturate(.92)` | Adotar; **desligar no modo leve** |
| Focado | glow 54px na cor `--c1` do título | Adotar, com `--c1` derivada do id |
| Numeral Top 10 | Anton 166px refrativo | **Manter o nosso** (decisão sua) |

`--c1` por item não existe no banco. Extrair cor dominante de 150 mil pôsteres é
inviável. Solução: derivar do id, como `Artwork` já faz nos fallbacks.

### Elementos

| Elemento | De onde vem | Situação | O que fazer |
|---|---|---|---|
| Hero rotativo | `matchTmdbInPlaylist` + trending | JÁ TEMOS | — |
| Continuar assistindo | `WatchProgress` + `channelId` | JÁ TEMOS | Migração já aplicada |
| Top 10 | ordem do TMDB trending | JÁ TEMOS | — |
| Fileira de gênero | nome do `M3uGroup` | DERIVÁVEL | Índice `(playlistId, name)` |
| Fileira de recomendação | TMDB `/recommendations` | **NÃO EXISTE** | Exige `tmdbId` no histórico (§6) |
| Ficha "2024 · Suspense · 2h04" | TMDB details | DERIVÁVEL | Ano e gênero sim; duração só via TMDB por título |
| "combina 94%" | — | **NÃO EXISTE** | Ver §5: substituir por motivo escrito |

---

## 3. Canais

Conferido em produção: `tvgId` preenchido em formato XMLTV padrão (`Ae.br`,
`Amc.br`) — **455 de 821 canais ao vivo (55%)** e **149 de 223 de esporte (67%)**.

| Elemento | Situação | O que fazer |
|---|---|---|
| Grade por categoria | JÁ TEMOS | `M3uGroup.category` |
| Selo "Ao vivo" | JÁ TEMOS | Derivado da URL |
| Detalhe do canal | JÁ TEMOS | `/tv/assistir/[channelId]` |
| **"No ar agora / a seguir"** | **NÃO EXISTE** | Importar XMLTV → 3 tabelas novas |
| Barra de progresso do programa | NÃO EXISTE | Depende do EPG |
| Favoritos por perfil | **NÃO EXISTE** | Hoje `isFavorite` é booleano **no canal**, compartilhado por todos os perfis da conta — defeito real |
| Ponto verde de "canal no ar" | NÃO EXISTE | Exige verificação ativa de stream |
| Número do canal (7, 11, 21…) | NÃO EXISTE | Atributo `tvg-chno`; o parser não captura |
| Top 10 por estado | IMPOSSÍVEL hoje | Exige agregar audiência própria (§6) |

---

## 4. Esportes — leia antes de investir

O protótipo tem placar ao vivo, tabela de classificação, artilharia,
chaveamento, cinturões de luta, grid de largada e forma recente (V/E/D).

**Nada disso existe no nosso banco.** Temos 223 canais de esporte com nome e
grupo. Não há evento, time, placar nem calendário.

| Bloco | Situação |
|---|---|
| Mosaico de modalidades | DERIVÁVEL (nome do grupo) |
| Agenda por horário | DERIVÁVEL **só com EPG** |
| Seus times / seguir | NÃO EXISTE (tabela nova, mas viável) |
| Placar ao vivo | **IMPOSSÍVEL** |
| Tabela de classificação | **IMPOSSÍVEL** |
| Artilharia | **IMPOSSÍVEL** |
| Chaveamento | **IMPOSSÍVEL** |
| Lutas / corridas | **IMPOSSÍVEL** |

**Recomendação:** entregar a aba como "canais de esporte + agenda vinda do EPG +
seus times favoritos (atalho para canais)". Tudo além disso exige API paga.

---

## 5. Novelas e Dicas

| Elemento | Situação | Substituto honesto |
|---|---|---|
| Estado por título (em dia/pausado/abandonado/concluído) | NÃO EXISTE | Tabela `ProfileTitleState` — **viável e barato** |
| "Capítulo 118 de 178" | NÃO EXISTE | Contável: `getSeriesList` já devolve `episodeCount`; falta saber em qual o perfil está |
| "hoje às 21h20" | IMPOSSÍVEL | Sem EPG de novela |
| "4 caps" por dia | IMPOSSÍVEL | — |
| "combina 94%" | NÃO EXISTE | **Trocar por motivo escrito**: "Você terminou X e este é do mesmo gênero" — verdadeiro e mais persuasivo que um número inventado |
| "Top 4% no coorte" | IMPOSSÍVEL | Remover |
| "Sai do catálogo em 6 dias" | IMPOSSÍVEL | Só com diff de sincronização (§6) |
| "1h29 até o jogo" | IMPOSSÍVEL | Depende de agenda esportiva |

---

## 6. Perfis e faixas etárias

`Profile` hoje: `isKids`, `maxAgeRating`, `pinHash`, `avatarUrl`.
**Não tem idade.**

### Faixas finas (0; 1-2; 3-4; 5-6; 7-8; 9-10; 11-12)

Nenhuma API entrega isso. O TMDB dá só a classificação brasileira
(`L, 10, 12, 14, 16, 18`) e o "L" trata igual 1 ano e 9 anos.

**Desenho proposto:**

1. `Profile.birthDate` — data de nascimento, não faixa. A criança **muda de
   faixa sozinha** no aniversário.
2. Tabela `AgeBandRule` — curadoria nossa: padrão de título → faixa mínima e
   máxima. Semeada com as 7 franquias que já curamos:
   - Música e bebês (Galinha Pintadinha, Mundo Bita) → **0 a 2**
   - Patrulha Canina, Peppa, Pocoyo, Bluey → **3 a 6**
   - Barbie, Clássicos (Tom e Jerry, Pica-Pau) → **5 a 8**
   - Disney e Pixar → **5 a 10**
   - Super-heróis, Aventura e games (Sonic, Mario, Pokémon) → **7 a 12**
3. `maxAgeRating` do TMDB vira **teto de segurança**, nunca a faixa: jamais
   mostrar um "12" a um perfil de 5 anos, mesmo que a regra permita.
4. Editável no admin — a curadoria é o produto aqui.

### Outros itens

| Elemento | Situação |
|---|---|
| Seletor "Quem está assistindo?" | JÁ TEMOS (`listProfiles`) |
| PIN | JÁ TEMOS (`pinHash`) |
| Avatar colorido por perfil | NÃO EXISTE coluna de cor — derivar do id |
| Tabbar infantil de 3 abas | NÃO EXISTE — variante do `tab-bar.tsx` |
| Favoritos por perfil | **NÃO EXISTE** — hoje é do canal, não do perfil |
| Top 10 "para a sua idade" | NÃO EXISTE — sem métrica de audiência própria |

---

## 7. Desktop e TV Box

O v4 é mobile-first. A adaptação não é esticar: é **trocar o eixo**.

- **Menu lateral** substitui a tabbar. Recolhido: 72px, só ícones. Expandido:
  240px, ícone + rótulo. Expande no foco/hover e por botão fixo.
- As **tags de filtro** saem do dropdown e viram lista permanente na lateral,
  abaixo do menu — em tela larga há espaço, e filtro visível é filtro usado.
- **Grade em vez de trilha**: acima de 1280px, trilhas horizontais viram grade
  de 6-8 colunas. Rolagem horizontal com controle remoto é ruim.
- **D-pad**: ordem de foco explícita, `scrollIntoView({block:'nearest'})` a cada
  movimento, anel de foco de 3px (já implementado no modo leve).
- **10-foot UI**: fonte mínima 16px, alvo mínimo 48px, contraste reforçado.
- Breakpoints: `< 768` mobile (tabbar) · `768–1279` híbrido (lateral recolhida)
  · `≥ 1280` lateral expansível + grade.

Componentes a criar: `SideNav`. A alterar: `tv-nav`, `tab-bar`, `rail` (virar
grade acima do breakpoint), `filter-bar` (virar lista vertical).

---

## 8. Fileiras alternadas: gênero + recomendação

Pedido explícito: uma de gênero, uma de recomendação por histórico, alternando.

**Cadeia técnica:**

1. Perfil assiste → `WatchProgress` grava. **Hoje não grava `tmdbId`.** ⛔
2. Migração: `WatchProgress.tmdbId Int?` + `tmdbMediaType String?`, preenchidos
   no momento do play (o app já resolve o TMDB na página de assistir).
3. Pegar os N títulos mais recentes e concluídos do perfil.
4. Para cada um: `getTmdbRecommendations(tmdbId, mediaType)` — **já existe** em
   `lib/tmdb/client.ts`, sem uso hoje.
5. Cruzar com a M3U via `matchTmdbInPlaylist` — **já existe e funciona**.
6. Intercalar com as fileiras de gênero (derivadas do nome do grupo).
7. Cache por perfil, 30 min (`cachedRow`).

**Sem o passo 2, nada disso funciona.** É a migração mais importante do plano.

---

## 9. Migrações de banco

| # | Mudança | Tipo | Backfill | Risco |
|---|---|---|---|---|
| 1 | `WatchProgress.tmdbId`, `tmdbMediaType` | Aditiva | Não | Baixo |
| 2 | `Profile.birthDate` | Aditiva | Não | Baixo |
| 3 | `AgeBandRule` (tabela) | Nova | Seed | Baixo |
| 4 | `ProfileTitleState` (tabela) | Nova | Não | Baixo |
| 5 | `ProfileChannelFavorite` (tabela) | Nova | Migrar `isFavorite` | Médio |
| 6 | `EpgSource`, `EpgChannel`, `EpgProgramme` | Novas | Job XMLTV | Médio |
| 7 | `@@index([playlistId, tvgId])` | Índice | — | Baixo |
| 8 | `pg_trgm` + GIN em `M3uChannel.name` | Índice | — | **Alto** — 150 mil linhas, usar `CONCURRENTLY` |
| 9 | `M3uChannel.seriesKey/season/episode` | Aditiva | Sim, 150 mil | Médio |
| 10 | `FollowedTeam` (tabela) | Nova | Não | Baixo |
| 11 | Múltiplas M3U por cliente | **Destrutiva** | Sim | **Alto** — hoje `M3uPlaylist.userId` é `@unique` |

O item 11 é o backup que você pediu: exige remover a unicidade e criar
prioridade entre listas, com fallback de stream.

---

## 10. Ordem de execução

**Fase 1 — Fundação (entrega sozinha)**
Migração 1 + 2. Card do v4. Ajuste do cabeçalho. Fileiras alternadas.

**Fase 2 — Perfis**
Migração 3. Faixas etárias finas. Tabbar infantil. Curadoria no admin.

**Fase 3 — Favoritos e estados**
Migrações 4 e 5. Aba Novelas com estados. Corrige o defeito de favorito
compartilhado entre perfis.

**Fase 4 — EPG**
Migrações 6 e 7. "No ar agora". Destrava metade da aba Canais e a agenda de
Esportes.

**Fase 5 — Desktop e TV Box**
`SideNav`, grade, D-pad.

**Fase 6 — Backup de listas**
Migração 11. Requer janela de manutenção.

**Fase 7 — Busca**
Migração 8, com `CONCURRENTLY`.

---

## 11. O que não vamos fazer

Franqueza sobre o que o protótipo promete e os dados não sustentam:

- Placar ao vivo, tabela, artilharia, chaveamento, cinturões, grid de largada
- Horário de exibição de novela e contagem de capítulos por dia
- "Combina 94%", "Top 4% no coorte", "Sai do catálogo em 6 dias"
- Ponto de "canal no ar" sem verificação ativa
- Número do canal (o provedor não envia `tvg-chno`)
- Top 10 por estado enquanto não houver audiência própria agregada

Cada um destes tem substituto honesto descrito acima. Nenhum deve ser
implementado com dado inventado — número falso em tela de recomendação destrói
a confiança que a recomendação existe para construir.
