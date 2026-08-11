# TVHub

Plataforma de streaming (IPTV + VOD) em Next.js 14, Postgres e Redis, rodando em
Docker Swarm atrás do Traefik.

## Comece por aqui

| Você quer | Leia |
|---|---|
| Rodar o projeto na sua máquina | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Entender o que não pode ser quebrado | **[docs/REGRAS.md](docs/REGRAS.md)** |
| Publicar em produção | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Se achar no código | `graphify-out/graph.html` |

Se você chegou agora: leia o **REGRAS.md** antes de mexer em qualquer coisa.

## Subir localmente

```bash
npm ci && cp .env.example .env && docker compose up -d
```

```bash
npx prisma migrate deploy && npx prisma generate && npm run db:seed && npm run dev
```

## Como está montado

```
Navegador / TV
      │  HTTPS
   Traefik ──────────── outras stacks da VPS (Odoo, Portainer)
      │  healthcheck em /api/ready
   tvhub_app  (Next 14, standalone, 320 MB)
      │
      ├── tvhub_postgres   catálogo, usuários, progresso
      ├── tvhub_redis      trava de 2 telas simultâneas
      └── provedor IPTV    via proxy em /api/iptv/stream
```

O ponto que explica quase todas as decisões de operação: **o vídeo passa pelo
próprio app**. `/api/iptv/stream` faz proxy do stream do provedor, então cada
assinante assistindo é uma conexão HTTP aberta contra o container. É por isso
que o deploy sobe o container novo antes de derrubar o antigo, e por que o
antigo leva até 100 segundos drenando em vez de morrer na hora.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento em http://localhost:3000 |
| `npm run build` | build de produção |
| `npm run typecheck` | checagem de tipos (o CI roda isto) |
| `npm run lint` | ESLint (o CI roda isto) |
| `npm run db:migrate` | cria uma migration a partir do `schema.prisma` |
| `npm run db:studio` | abre o Prisma Studio |
| `npm run db:seed` | popula o banco local |

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind · Prisma 5 · PostgreSQL 16 ·
Redis 7 · Auth.js v5 · hls.js / mpegts.js · Docker Swarm · Traefik ·
GitHub Actions
