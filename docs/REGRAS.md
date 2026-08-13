# Regras para não quebrar o TVHub

Este arquivo é curto de propósito. São as restrições que **não** dá para
descobrir lendo o código, porque cada uma nasceu de algo que já quebrou.

Se você vai mexer no sistema, leia até o fim. Leva cinco minutos e evita
derrubar um ERP alheio ou cortar o filme de um assinante no meio.

---

## 1. O `next build` nunca roda na VPS

A VPS tem ~830 MB de RAM livre e hospeda um **Odoo em produção** — um ERP que
não é nosso e não pode cair.

O `next build` precisa de mais memória do que existe lá. Quando falta memória,
o kernel aciona o OOM killer, que escolhe a vítima **pelo consumo** — e a
vítima provável é o Odoo, não o build.

- O build sai do GitHub Actions, que tem 16 GB.
- Na VPS só se puxa a imagem pronta e se troca o container.
- O caminho de emergência (`deploy/deploy.ps1`) compila na máquina do
  desenvolvedor. Continua valendo: **build nenhum na VPS**.

## 2. Os limites de memória no `tvhub-stack.yml` não são sugestão

Todo serviço tem `resources.limits.memory`. Sem limite, um pico do Node vira
OOM e o alvo é escolhido por consumo — de novo, o Odoo.

O app tem `NODE_OPTIONS=--max-old-space-size=240` contra um limite de 320M. Os
~80 MB de diferença são para o que vive fora do heap (buffers, engine do
Prisma, pilha nativa). **Mexeu num, mexa no outro.**

Durante o deploy existem **dois** containers do app ao mesmo tempo (é assim que
o site não cai). São 640 MB de pico contra ~830 MB livres. Subir o limite de
320M sem medir a folga transforma todo deploy num sorteio.

## 3. Nomes de serviço são sempre qualificados (`tvhub_postgres`, não `postgres`)

O app vive em duas redes: `tvhub-internal` (própria) e `minha_rede` (a que o
Traefik enxerga). Em `minha_rede` **já existem** serviços chamados `postgres` e
`redis`, de outra stack.

Com o nome curto, o DNS do Swarm resolve para o banco alheio. Isso já aconteceu
aqui. Só não virou corrupção de dados porque a senha era diferente.

## 4. `restart_policy: condition: any`, nunca `on-failure`

Quando o Swarm para uma task por healthcheck reprovado, o processo sai com
código **0**. Com `on-failure` isso é lido como término bem-sucedido, e o
serviço fica parado em `0/1` para sempre — site fora do ar, sem nada tentando
subir.

## 5. Mudou o `schema.prisma`? Gerou migration. Sem exceção.

**`prisma db push` é só para banco local descartável.** Em qualquer banco que
outra pessoa vai usar, ele é proibido.

Este projeto já pagou o preço: as tabelas `M3uPlaylist`, `M3uGroup` e
`M3uChannel` — o núcleo do IPTV — existiam em produção e no `schema.prisma`,
mas em nenhuma migration. Consequências reais:

- `prisma migrate deploy` num banco vazio **falhava**. Ninguém conseguia subir
  o projeto do zero a partir do repositório.
- Colunas aplicadas com `ALTER TABLE` na mão dentro do script de deploy
  divergiram do schema: `watchCount` ficou aceitando nulo onde o Prisma esperava
  `Int`, e `fromBackup` simplesmente não existia no banco, embora o
  `sync-service.ts` já a usasse.
- A foreign key `WatchProgress → M3uChannel` ficou `ON DELETE CASCADE` em vez de
  `SET NULL`. Como toda sincronização apaga canais que sumiram do provedor, o
  histórico de "continuar assistindo" do assinante era apagado junto, em
  silêncio, a cada sync.

O CI agora tranca essa porta: o passo **"Migrations precisam reproduzir o
schema.prisma"** compara o banco que as migrations geram com o `schema.prisma`
e reprova o PR se divergirem. Ele não é opcional e não deve ser desligado.

> A tabela `M3uBackupStage` é a única exceção legítima. Ela é `UNLOGGED`,
> criada em runtime pelo `lib/iptv/sync-service.ts` como área de estágio da
> sincronização, e de propósito não é um model do Prisma.

## 6. Migration em produção só adiciona. Nunca remove nem renomeia.

Durante o rolling update as **duas versões do código rodam ao mesmo tempo** —
é isso que impede o site de cair. O banco precisa servir as duas.

Uma coluna removida derruba a versão antiga, que ainda está entregando vídeo
para alguém. Então remoção acontece em **dois releases**:

| Release | O que faz |
|---|---|
| 1 | Adiciona o novo. O código passa a escrever nos dois e a ler do novo. |
| 2 | Só depois que o release 1 está em produção e estável: remove o antigo. |

O mesmo vale para renomear (que é remover + adicionar) e para apertar uma
restrição (`NOT NULL` numa coluna que a versão antiga ainda deixa vazia).

## 7. `/api/health` e `/api/ready` são coisas diferentes — não unifique

| Endpoint | Quem observa | Durante o desligamento |
|---|---|---|
| `/api/health` | Swarm (liveness) | responde **200**, sempre |
| `/api/ready` | Traefik (readiness) | responde **503** |

O `/api/iptv/stream` faz proxy do vídeo pelo próprio Node: cada assinante
assistindo é uma conexão aberta contra aquele container. O
`server-entry.js` usa a diferença entre os dois endpoints para sair de rotação
antes de fechar a porta.

Se o `/api/health` também reprovasse durante a drenagem, o Swarm mataria a task
no meio do processo — cortando exatamente os streams que a drenagem existe para
preservar. E se o `/api/health` checasse Postgres ou Redis, uma oscilação de 5s
no banco viraria um restart completo do app: troca de uma indisponibilidade
curta por uma longa.

## 8. Segredo de produção mora em `/opt/tvhub/.env`, na VPS

Esse arquivo não está no Git e não deve estar. O `tvhub-stack.yml` só referencia
`${VARIÁVEL}`.

O repositório é **privado** e precisa continuar assim: o `tvhub-stack.yml` ainda
carrega chaves de TMDB e DeepSeek como valor padrão. Tornar o repositório
público expõe as duas.

## 9. Ninguém faz push direto na `main`

Trabalho novo sai em branch e entra por Pull Request, com o CI verde. A `main` é
o que vai para produção — veja [CONTRIBUTING.md](../CONTRIBUTING.md).

## 10. Mexeu no player ou na proxy de vídeo? Leia o Manual do Player antes.

**[docs/MANUAL-DO-PLAYER.md](MANUAL-DO-PLAYER.md)** — obrigatório antes de
tocar em:

- `components/iptv/iptv-player.tsx`
- `app/api/iptv/stream/route.ts`
- `lib/iptv/media-kind.ts`

Ele é diário de bordo: guarda o sintoma, a causa e a correção de tudo que já
quebrou a reprodução, **e o que já foi tentado e deu errado**. Duas mudanças
que pareciam melhorias óbvias estão lá marcadas como revertidas, com o motivo.
Sem ler, a chance de reintroduzir uma delas é alta.

Terminou de mexer? **Acrescente a entrada no diário.** Principalmente se deu
errado — é o que tem mais valor lá dentro.

---

## Antes de abrir o PR

```bash
npm run typecheck && npm run lint && npm run build
```

Mexeu no player ou na proxy de vídeo (regra 10):

```bash
node tests/prova-fontes.mjs && node tests/prova-timeout-socket.mjs
```

Mexeu no banco:

```bash
npx prisma migrate dev --name descreva_a_mudanca
```

## Se derrubou produção

```bash
ssh root@<vps> docker service rollback tvhub_app
```

Volta para a versão anterior sem queda (o `rollback_config` também usa
`start-first`). Depois disso, com calma, veja
[docs/DEPLOY.md](DEPLOY.md#quando-algo-dá-errado).
