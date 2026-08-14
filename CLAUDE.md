# TVHub — instruções do projeto

## Regra zero: confira em que commit a produção está

```bash
git fetch origin && git log --oneline origin/main -5
```

Já houve auditoria inteira feita sobre uma base 25 commits atrasada — o merge
teria revertido um sistema inteiro de credencial por cliente. Faça isso **antes
de abrir o primeiro arquivo**, não depois.

## Leia antes de mexer

**[docs/REGRAS.md](docs/REGRAS.md)** — restrições que não dá para descobrir
lendo o código. Cada uma nasceu de algo que já quebrou: build na VPS derrubando
um ERP alheio, DNS resolvendo para o banco de outra stack, migration que apagou
tabela em produção.

**[docs/MANUAL-DO-PLAYER.md](docs/MANUAL-DO-PLAYER.md)** — **obrigatório** antes
de tocar em qualquer arquivo do caminho do vídeo:

- `components/iptv/iptv-player.tsx`
- `app/api/iptv/stream/route.ts`
- `lib/iptv/credentials.ts`
- `lib/playback/connection.ts`
- `lib/iptv/quality.ts`

É diário de bordo, não documentação de API. Guarda sintoma, causa e correção de
tudo que já quebrou a reprodução — **e o que já foi tentado e deu errado**, com
o motivo técnico e o link da issue.

**Depois de mexer no player, acrescente a entrada no diário.** Principalmente
quando der errado: é o que tem mais valor no documento. O formato está no topo
do manual. Nunca marque uma correção como confirmada sem uso real confirmando.

## Verificação antes do PR

```bash
npm run typecheck && npm run lint && npm run build
node tests/prova-timeout-socket.mjs
```

## Convenções

- Comentário explica **por que**, não o que. O código já diz o que faz.
- Português nos comentários e nas mensagens de commit.
- Nada de push direto na `main`: branch e PR, com CI verde.
