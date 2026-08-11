# APIs necessárias — Esportes e EPG

Pesquisa de agosto/2026. Preços e limites conferidos nas páginas oficiais.

---

## 1. O que cada esporte precisa

A aba de Esportes do protótipo pede, por modalidade, coisas diferentes. Não é
uma API só — é um conjunto de recursos:

| Recurso | Futebol | Basquete | MMA | F1 | Vôlei | Tênis | NFL |
|---|---|---|---|---|---|---|---|
| Agenda / calendário | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Placar ao vivo | ✔ | ✔ | — | — | ✔ | ✔ | ✔ |
| Tabela de classificação | ✔ | ✔ | — | ✔ (pilotos/construtores) | ✔ | ranking | ✔ |
| Artilharia / cestinha | ✔ | ✔ | — | — | — | — | ✔ |
| Chaveamento mata-mata | ✔ | ✔ | ✔ (card) | — | ✔ | ✔ | ✔ |
| Escalação / elenco | ✔ | ✔ | — | ✔ (grid) | ✔ | — | ✔ |
| Brasão / escudo | ✔ | ✔ | — | ✔ | ✔ | — | ✔ |
| Card de luta / ordem | — | — | ✔ | — | — | — | — |
| Sessões (treino/quali) | — | — | — | ✔ | — | — | — |

**Para o público brasileiro, a prioridade é:** futebol ≫ MMA/UFC > F1 > vôlei >
NBA > tênis > NFL. Vôlei importa mais aqui que na maioria dos mercados, e isso
elimina algumas opções.

---

## 2. Provedores comparados

### API-SPORTS — **recomendado para começar**
12 APIs separadas: futebol, AFL, beisebol, basquete, **Fórmula 1**, handebol,
hóquei, **MMA**, NBA, NFL/NCAA, rúgbi, **vôlei**.

- **Grátis:** 100 requisições/dia por API, permanente, sem cartão
- **Pro:** US$ 19/mês → 7.500 req/dia
- **Mega:** US$ 39/mês → 150.000 req/dia
- Cobre 1.236 ligas no futebol

**Por que recomendo:** é o único com **vôlei e handebol** por preço de indie, e
a granularidade por esporte permite pagar só pelo que a gente usa.

**Custo real:** futebol + MMA + F1 + basquete + vôlei = 5 × US$ 19 = **US$ 95/mês**
no Pro. Começando só com futebol + MMA: **US$ 38/mês**.

### TheSportsDB — **complemento barato, pegar junto**
- **US$ 9/mês** (Patreon) — libera uso comercial e dataset completo
- Grátis: 30 req/min, só 10 resultados por endpoint, **não comercial**
- Forte em **metadados e arte**: escudos, brasões, fotos de time, logos

**Por que pegar:** o protótipo mostra **brasões de time** em vários lugares.
Nenhuma API de placar entrega arte boa. Por US$ 9 resolve o visual inteiro.

### BALLDONTLIE
20+ ligas numa API só (NBA, NFL, MLB, NHL, EPL, La Liga, Serie A, Champions,
MLS, MMA, tênis ATP/WTA, F1, e-sports).

- Grátis: 5 req/min, **1 esporte**
- All-Star US$ 9,99/mês · GOAT US$ 39,99/mês — ainda **1 esporte cada**
- **All-Access US$ 299,99/mês** — aí sim todos os 20+

**Problema:** não tem vôlei, e o preço para "todos" é 3× o do API-SPORTS.

### SportsDataIO
A partir de US$ 25/mês. Forte em ligas norte-americanas, métricas avançadas.
Fraco no que interessa aqui (futebol brasileiro, vôlei).

### Sportradar
Dados oficiais licenciados, usado por casas de aposta.
**US$ 500 a 5.000+/mês.** Fora de escala para nós agora.

---

## 3. Recomendação

**Fase 1 — US$ 47/mês**
- API-SPORTS Futebol (US$ 19) — Brasileirão, Libertadores, Champions, Copa do Brasil
- API-SPORTS MMA (US$ 19) — UFC
- TheSportsDB (US$ 9) — escudos e arte de todos os esportes

**Fase 2 — +US$ 57/mês**
- API-SPORTS F1, Vôlei, Basquete (3 × US$ 19)

**Desenvolvimento:** use o tier grátis (100 req/dia por API) enquanto a gente
constrói. Só assine quando for para produção.

**O que preciso de você:** as chaves. Cadastro em `dashboard.api-football.com`
(a mesma conta serve para todos os esportes do API-SPORTS) e no Patreon do
TheSportsDB.

---

## 4. EPG — grátis, não precisa pagar

O `tvgId` da sua lista já vem no formato XMLTV padrão (`Ae.br`, `Amc.br`), com
**55% dos canais ao vivo** e **67% dos de esporte** preenchidos.

Fontes gratuitas:

| Fonte | Observação |
|---|---|
| **iptv-org/epg** | Maior cobertura, mantido pela comunidade, XMLTV |
| **BrazilTVEPG** | Específico do Brasil, extrai de vários players, XMLTV |
| **epg.pw** | Por país, fácil de apontar |
| **m3u4u** | Permite casar e editar seu próprio EPG |

O provedor da sua lista também pode fornecer um XMLTV próprio — normalmente é o
melhor, porque casa 100% com os `tvg-id` dele.

**Vou deixar o campo no painel admin** para você colar a URL, com botão de testar
(baixa, conta quantos canais casaram com a sua lista e mostra o resultado antes
de salvar).

---

## Fontes

- [API-Football — planos](https://www.api-football.com/pricing)
- [API-Sports — futebol](https://api-sports.io/sports/football)
- [BALLDONTLIE](https://www.balldontlie.io/)
- [TheSportsDB — preços](https://www.thesportsdb.com/pricing)
- [TheSportsDB — API grátis](https://www.thesportsdb.com/free_sports_api)
- [SportsDataIO](https://sportsdata.io/free-trial)
- [Melhores fontes de EPG 2026](https://tuneline.app/blog/best-free-epg-xmltv-sources-2026)
- [BrazilTVEPG](https://github.com/limaalef/BrazilTVEPG)
- [Comparativo de APIs esportivas](https://www.moneylineapp.com/blog/best-sports-apis)
