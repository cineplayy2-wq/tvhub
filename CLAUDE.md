# TVHub — instruções do projeto

## Leia antes de mexer

**[docs/REGRAS.md](docs/REGRAS.md)** — as restrições que não dá para descobrir
lendo o código. Cada uma nasceu de algo que já quebrou: build na VPS derrubando
um ERP alheio, DNS resolvendo para o banco de outra stack, migration que
apagou tabela em produção.

**[docs/MANUAL-DO-PLAYER.md](docs/MANUAL-DO-PLAYER.md)** — **obrigatório** antes
de tocar em qualquer arquivo do caminho do vídeo:

- `components/iptv/iptv-player.tsx`
- `app/api/iptv/stream/route.ts`
- `lib/iptv/media-kind.ts`

É diário de bordo, não documentação de API. Guarda sintoma, causa e correção de
tudo que já quebrou a reprodução — **e o que já foi tentado e deu errado**. Há
mudanças que parecem melhoria óbvia registradas lá como revertidas, com o
motivo técnico. Sem ler, a chance de reintroduzir uma é alta.

**Depois de mexer no player, acrescente a entrada no diário.** Principalmente
quando der errado: é o que tem mais valor no documento. O formato da entrada
está no topo do manual.

## Verificação antes do PR

```bash
npm run typecheck && npm run lint && npm run build
```

Tocou no player ou na proxy:

```bash
node tests/prova-fontes.mjs && node tests/prova-timeout-socket.mjs
```

Os dois saem com código 1 quando falham. O `prova-fontes` já pegou um bug que
teria ido para produção — leitura de código não tinha pego.

## Convenções

- Comentário explica **por que**, não o que. O código já diz o que faz.
- Português nos comentários e nas mensagens de commit, como o resto do projeto.
- Nada de push direto na `main`: branch e PR, com CI verde.
