# Verificações do player e da proxy

Lógica pura, sem dependência de banco, rede real ou navegador. Roda em
segundos e cobre justamente o que já quebrou em produção antes.

```bash
node tests/prova-fontes.mjs          # montagem de fontes por formato + reescrita de manifesto HLS
node tests/prova-timeout-socket.mjs  # prova que socket ocioso não derruba mais o fluxo
```

Os dois saem com código 1 quando falham, então servem de portão em CI.

## Por que existem

`prova-fontes` nasceu depois de um bug que teria ido para produção: ao
generalizar a expressão do contêiner, um grupo de captura a mais fez
`filme.mkv` virar `filme.mp4mkv`. Leitura de código não pegou; o teste pegou.

`prova-timeout-socket` reproduz o congelamento de filme no meio da sessão. O
`timeout` do `http.get` não é prazo de conexão, é prazo de socket OCIOSO — e
socket ocioso é o estado NORMAL quando o navegador encheu o buffer e parou de
ler. O teste mostra a conexão morrendo com `ECONNRESET` no comportamento
antigo e sobrevivendo no novo.
