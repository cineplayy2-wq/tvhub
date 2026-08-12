# Imagem completa do TVHub: instala, compila e empacota.
#
# Esta é a FONTE DE VERDADE do build. Ela roda no GitHub Actions, onde há
# 16 GB de RAM. Nunca rode `docker build -f Dockerfile` na VPS: ela tem
# ~830 MB livres e hospeda um Odoo em produção — o `next build` acionaria o
# OOM killer, que escolhe a vítima pelo consumo de memória, e a vítima
# provável seria o ERP, não o build.
#
# O caminho de emergência (deploy/deploy.ps1 + deploy/Dockerfile.runtime)
# existe para quando o GitHub está fora do ar. Ele compila na máquina do
# desenvolvedor e só empacota na VPS.
#
# Debian slim (não Alpine) porque a engine do Prisma é gerada para
# debian-openssl-3.0.x (veja binaryTargets em prisma/schema.prisma).
# Trocar a base sem trocar o binaryTargets quebra na primeira query.

# ---------- 1. Dependências ----------
FROM node:20-bookworm-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` (não `npm install`): respeita o lockfile à risca. Sem isso, dois
# desenvolvedores em máquinas diferentes podem gerar árvores de dependência
# distintas e o bug só aparece em produção.
#
# Sem `|| npm install` de propósito. O fallback existia para contornar um
# lockfile fora de sincronia (faltavam @emnapi/core e @emnapi/runtime), mas
# tratava o sintoma: com ele, a imagem passava a ser construída com versões
# resolvidas na hora em vez das travadas — silenciosamente, sem avisar
# ninguém. O lockfile foi corrigido de verdade neste commit; se ele
# dessincronizar de novo, o certo é o build falhar aqui e alto.
RUN npm ci

# ---------- 2. Build ----------
FROM node:20-bookworm-slim AS builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Placeholders de build. O Next avalia módulos no momento da compilação e o
# PrismaClient valida a URL da datasource já na construção — sem estes valores
# o build falha antes de gerar qualquer página. Nenhum deles vaza para a
# imagem final: o estágio `runner` recebe as variáveis reais do Swarm.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    DIRECT_DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    REDIS_URL="redis://localhost:6379" \
    AUTH_SECRET="build-time-placeholder-nao-usado-em-runtime" \
    AUTH_TRUST_HOST="true" \
    NEXT_TELEMETRY_DISABLED="1"

RUN npx prisma generate
RUN npm run build

# ---------- 2b. sharp, em árvore própria ----------
#
# Estágio separado porque o sharp precisa ir INTEIRO para o runtime, com as
# dependências dele (color, detect-libc, semver e o binário nativo em @img).
# Copiar pasta por pasta do build já falhou uma vez: faltou uma, o require
# quebrou dentro de um catch que lê `err.code` de um erro sem `code`, e o que
# apareceu foi "Cannot read properties of undefined" — mensagem que não diz
# nada sobre módulo ausente. Deixar o npm montar a árvore elimina o palpite.
#
# A VERSÃO É TRAVADA EM 0.33.5, e não é preciosismo: a partir da 0.34 os
# binários de Linux x64 exigem microarquitetura x86-64-v2, e esta VPS roda um
# "Common KVM processor" sem sse4_2, ssse3 nem popcnt. Lá o sharp detecta a
# CPU, se recusa a usar o binário e se desliga em silêncio — o site continua
# de pé servindo imagem sem otimizar, que é justamente o que se queria
# corrigir. Antes de subir esta faixa, confira `grep flags /proc/cpuinfo`.
FROM node:20-bookworm-slim AS sharp
WORKDIR /sharp
RUN npm install --no-audit --no-fund --omit=dev sharp@0.33.5

# ---------- 3. Runtime ----------
FROM node:20-bookworm-slim AS runner

# openssl: exigido pela engine do Prisma
# curl: usado pelo HEALTHCHECK abaixo e pelo Swarm para decidir a troca
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Saída standalone: server.js + apenas as dependências realmente alcançadas
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Envelope de desligamento com drenagem. Não vem no standalone porque o
# tracer do Next só inclui o que o app importa, e este arquivo importa o app.
COPY --from=builder --chown=nextjs:nodejs /app/server-entry.js ./server-entry.js

# Migrations e schema viajam na imagem: o job de migração usa esta mesma
# imagem para rodar `prisma migrate deploy`, então versão do app e versão do
# schema são sempre a mesma coisa — nunca dá para aplicar a migration de um
# commit e subir o código de outro.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# A engine do Prisma é carregada dinamicamente e o tracer do Next nem sempre a
# inclui no standalone. Quando falta, o erro só aparece na primeira query, já
# em produção. Copiar explicitamente elimina essa classe de falha.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# sharp, pelo mesmo motivo do Prisma: o otimizador de imagem do Next o carrega
# por require dinâmico, então o tracer do standalone não o enxerga. Sem ele o
# servidor sobe e serve as páginas, mas toda capa e todo avatar saem no tamanho
# original — o aviso "sharp is required in standalone mode" no build era isso.
COPY --from=sharp --chown=nextjs:nodejs /sharp/node_modules ./node_modules

# O cache do Next precisa ser gravável pelo usuário não-root
RUN mkdir -p ./.next/cache && chown -R nextjs:nodejs ./.next

USER nextjs
EXPOSE 3000

# LIVENESS, não readiness. Aponta para /api/health de propósito: esse endpoint
# responde ok até durante a drenagem. Se apontasse para /api/ready, o Swarm
# veria a task ficar doente ao receber SIGTERM e a mataria no meio do dreno —
# cortando justamente os streams que o dreno existe para preservar.
#
# start-period 40s: o Swarm só começa a contar falhas depois disso. Sem essa
# folga, um boot mais lento marcaria a task nova como doente e o rolling
# update faria rollback de uma versão que estava perfeita.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# server-entry.js, não server.js: é ele que transforma o SIGTERM em saída
# ordenada de rotação em vez de tesourada nas conexões abertas.
CMD ["node", "server-entry.js"]
