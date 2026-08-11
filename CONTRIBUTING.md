# Como trabalhar neste projeto

Agora somos mais de um, em máquinas diferentes. Este arquivo é o combinado.

Antes de mexer em qualquer coisa, leia **[docs/REGRAS.md](docs/REGRAS.md)**. São
cinco minutos e cada regra ali nasceu de algo que já quebrou.

---

## Primeira vez na máquina

Você precisa de **Node 20** e **Docker**.

```bash
git clone <url-do-repo> && cd TVHUB
```

```bash
npm ci
```

```bash
cp .env.example .env
```

Abra o `.env` e preencha pelo menos `AUTH_SECRET` (gere com
`openssl rand -base64 32`). Os valores de `DATABASE_URL` e `REDIS_URL` que já
vêm no exemplo apontam para o Postgres e o Redis do passo seguinte.

```bash
docker compose up -d
```

```bash
npx prisma migrate deploy && npx prisma generate && npm run db:seed
```

```bash
npm run dev
```

O site sobe em http://localhost:3000.

> Se `npm run dev` reclamar de coluna inexistente, você está com o banco
> desatualizado: rode `npx prisma migrate deploy` de novo.

---

## O ciclo do dia a dia

### 1. Branch a partir da `main` atualizada

```bash
git checkout main && git pull && git checkout -b feat/nome-curto
```

Prefixos: `feat/` novidade · `fix/` correção · `chore/` manutenção ·
`docs/` documentação.

### 2. Faça a mudança

Siga o estilo que já está no código. A convenção aqui é forte e vale seguir:
**comentário explica o porquê, não o quê.** Olhe qualquer arquivo de
`lib/iptv/` ou o `deploy/tvhub-stack.yml` para calibrar. Se você escreveu um
comentário que só repete o código, apague; se você tomou uma decisão que o
próximo leitor vai querer desfazer sem saber o motivo, escreva.

Código e comentários em português, como o resto do projeto.

### 3. Confira antes de subir

```bash
npm run typecheck && npm run lint && npm run build
```

É exatamente o que o CI vai rodar. Rodar aqui primeiro economiza um ciclo.

### 4. Mexeu no banco?

```bash
npx prisma migrate dev --name descreva_a_mudanca
```

**Nunca `prisma db push`** num banco que outra pessoa usa. O CI reprova o PR se
o `schema.prisma` e as migrations divergirem — e essa trava existe porque o
projeto já perdeu três tabelas inteiras do controle de versão por causa disso
(ver [REGRAS.md §5](docs/REGRAS.md#5-mudou-o-schemaprisma-gerou-migration-sem-exceção)).

Commite o diretório da migration junto com a mudança no `schema.prisma`. Os dois
sempre andam no mesmo commit.

### 5. Commit e push

```bash
git add -A && git commit -m "feat: descreve o que muda para quem usa"
```

```bash
git push -u origin feat/nome-curto
```

### 6. Pull Request

Abra o PR para a `main`. Descreva **o que muda para quem usa o site**, não quais
arquivos você tocou — isso o diff já mostra.

O CI roda sozinho. Precisa estar verde para poder mesclar.

---

## O que o CI verifica

| Passo | Reprova quando |
|---|---|
| Tipos | `tsc` acusa erro |
| Lint | ESLint acusa erro |
| Migrations aplicam | `prisma migrate deploy` falha num banco vazio |
| **Migrations = schema** | o banco gerado pelas migrations difere do `schema.prisma` |
| Build | `next build` falha |

O passo em negrito é o mais importante e o menos óbvio. Ele garante que quem
clonar o repositório amanhã consegue levantar o banco correto — coisa que já
não era verdade neste projeto.

---

## Regras que não se negociam

1. **Ninguém faz push direto na `main`.** Ela é o que vai para produção.
2. **Segredo não entra no Git.** `.env` está no `.gitignore`; as senhas de
   produção moram em `/opt/tvhub/.env`, na VPS.
3. **Este repositório é privado e continua privado.** O `tvhub-stack.yml` ainda
   carrega chaves de TMDB e DeepSeek como valor padrão.
4. **`next build` nunca roda na VPS.** Ela tem ~830 MB livres e hospeda um ERP
   de produção que não é nosso.

---

## Deploy

Merge na `main` compila a imagem sozinho, mas **não publica**: fica esperando
alguém aprovar no GitHub. O detalhe todo está em [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Onde as coisas ficam

| Pasta | O que tem |
|---|---|
| `app/` | rotas e páginas (App Router do Next) |
| `app/api/` | endpoints; `iptv/stream` é o proxy de vídeo |
| `components/` | componentes de UI |
| `lib/` | regra de negócio; `lib/iptv/` é o núcleo da sincronização |
| `prisma/` | schema e migrations |
| `deploy/` | stack do Swarm e caminho de emergência |
| `docs/` | estas instruções |
| `graphify-out/` | mapa navegável do projeto — abra o `graph.html` no navegador |

Perdido no código? Comece pelo `graphify-out/GRAPH_REPORT.md`.
