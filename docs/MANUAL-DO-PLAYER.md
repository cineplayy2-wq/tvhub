# Manual do Player

> **Leia antes de mexer em qualquer coisa do caminho do vídeo.**
> Isto é diário de bordo, não documentação de API. Cada linha aqui custou uma
> reprodução quebrada em produção.

**Arquivos cobertos por este manual:**

| Arquivo | Papel |
|---|---|
| `components/iptv/iptv-player.tsx` | O player: motores, failover, controles |
| `app/api/iptv/stream/route.ts` | A proxy: todo byte de vídeo passa por aqui |
| `lib/iptv/media-kind.ts` | Decide canal ao vivo × filme/série |
| `tests/prova-fontes.mjs` | Montagem de fontes + reescrita de manifesto |
| `tests/prova-timeout-socket.mjs` | Prova do socket ocioso |

---

## Como usar este documento

**Antes de mexer:** leia as *Regras invioláveis* e procure o sintoma na
*Tabela de defeitos*. Boa parte do que parece ideia nova já foi tentada aqui.

**Depois de mexer:** acrescente uma entrada. Mesmo que tenha dado certo —
principalmente se deu errado. Uma entrada precisa de:

```
### [AAAA-MM-DD] Título do que mudou
**Sintoma:**   o que o usuário via
**Causa:**     por que acontecia, no nível do mecanismo
**Correção:**  o que foi feito
**Verificação:** como se provou (teste? reprodução? só leitura de código?)
**Status:**    ✅ confirmado em produção · ⏳ no ar, aguardando confirmação · ❌ revertido
```

**Nunca** marque ✅ sem uso real confirmando. A maior parte dos erros deste
projeto veio de tratar "compila e parece certo" como "funciona".

---

## Arquitetura: o caminho do byte

```
M3uChannel.streamUrl (Postgres)
        │
        ▼
montarFontes()                 monta a LISTA de tentativas por formato
        │                      (principal → alternativa → backup da 2ª M3U)
        ▼
pelaProxy(url)                 /api/iptv/stream?url=…   ← SEMPRE. Sem exceção.
        │
        ▼
app/api/iptv/stream/route.ts   DNS em cache → agente keep-alive → provedor
        │                      reescreve manifesto HLS, repassa binário
        ▼
motor por formato:
   hls.js       .m3u8              (também assume iPhone 17.1+ via MMS)
   mpegts.js    .ts cru e .flv     (ÚNICA opção no navegador — ver §Formatos)
   <video> nu   .mp4 .webm .mov
        │
        ▼
Vigia de progresso             decide se a fonte morreu (§Regra 1)
```

---

## Regras invioláveis

### 1. Quem decide que a fonte morreu é o PROGRESSO, não o relógio

Nunca troque de fonte por causa de `waiting`, `stalled` ou de um cronômetro
fixo. `waiting` é o navegador **enchendo o buffer** — comportamento normal, e
num 4G passa de 15 segundos com frequência.

O vigia mede `buffered.end` e `currentTime` a cada segundo. Enquanto qualquer
um dos dois se mexe, a fonte está viva e ninguém interrompe, **demore o que
demorar**. Só o silêncio total conta:

- `SILENCIO_ANTES_DO_PRIMEIRO_QUADRO_MS` = 22s
- `SILENCIO_DEPOIS_DE_TOCAR_MS` = 18s

Fonte realmente morta (404, DNS) nem chega nesse prazo: a biblioteca dispara
erro fatal em menos de um segundo.

**Vídeo pausado nunca conta como fonte morta** — checar `video.paused` direto,
sem depender do rótulo de estado da tela.

### 2. Nada toca fora da proxy

O site é https e a lista do provedor é http. Apontar o `<video>` para a URL
crua é conteúdo misto: o navegador de celular **bloqueia em silêncio** — sem
erro, sem evento, só tela preta.

Já existiu um "fallback" que fazia isso quando a proxy falhava. Ele não
ajudava ninguém e escondia o defeito real.

### 3. Timeout de socket é prazo para RESPONDER, nunca para transmitir

`http.get({ timeout })` **não** é prazo de conexão: é prazo de socket
**ocioso**, e vale pela vida inteira do socket.

Num filme, o navegador enche o buffer e para de ler. A contrapressão sobe, o
provedor para de mandar bytes, e o socket fica ocioso **porque está tudo
funcionando**. Se o cronômetro continuar armado, ele mata a conexão no meio.

O cronômetro é desarmado (`req.setTimeout(0)` + `res.socket.setTimeout(0)`)
assim que os cabeçalhos chegam. Quem encerra depois disso é o cliente indo
embora, via `request.signal`.

### 4. Toda resposta do provedor que a gente não vai usar precisa ser descartada

`descartarUpstream(res)` — `resume()` e depois `destroy()`.

O agente tem teto de **256 sockets**. Resposta abandonada sem drenar continua
ocupando vaga para sempre. Esgotado o pool, toda requisição nova de vídeo entra
numa fila esperando socket que nunca vaga: o sintoma **não é um canal que
falha, é o app inteiro parando** até o contêiner reiniciar.

Caminhos que precisam descartar: 404 antes de tentar o formato alternativo,
`statusCode >= 400`, manifesto já lido para memória, e cancelamento do cliente.

### 5. A URL vence a categoria do grupo

`lib/iptv/media-kind.ts`. A categoria do grupo é **adivinhada do nome** por
`detectCategory`, e a lista tem "CANAIS | TELECINE", "FILMES E SÉRIES 24H" —
todos cheios de canal ao vivo caindo em `movies`.

Ordem obrigatória: caminho Xtream (`/live/`, `/movie/`, `/series/`) →
extensão (`.ts`/`.m3u8` × `.mp4`/`.mkv`) → categoria do grupo → padrão `live`.

### 6. Começa mudo

Navegador de celular recusa autoplay com som, e a recusa vem como exceção — o
vídeo simplesmente não começa. Nasce mudo, com botão "toque para ativar o som".

Depois que o usuário pediu som, **uma troca de fonte não pode devolver o vídeo
mudo** (`pediuSomRef`). O gesto que liberou o autoplay vale para a sessão toda.

### 7. Failover preserva a posição

`avancar()` fotografa `video.currentTime` em `posicaoInicialRef` antes de
trocar de fonte, e o hls.js lê a **ref**, não a propriedade. Sem isso, uma
troca no minuto 45 recomeçava o filme do início da sessão.

---

## Formatos: o que toca e o que não toca

| Formato | Motor | Observação |
|---|---|---|
| HLS `.m3u8` | hls.js | ABR real. iPhone 17.1+ entra aqui via `preferManagedMediaSource` |
| MPEG-TS `.ts` cru | mpegts.js | **Única opção existente no navegador.** Nenhum player de mercado faz isso |
| FLV `.flv` | mpegts.js | `type: "flv"`. Era ignorado até 2026-08-13 |
| MP4 / M4V / WebM / MOV | `<video>` nativo | |
| **MKV / AVI / WMV** | ❌ **nenhum** | Ver abaixo |
| **DASH `.mpd`** | ❌ não suportado | Precisaria de `dash.js` |

### MKV e AVI não tocam em navegador nenhum

Nem desktop, nem celular, **nem com H.264 dentro**. O codec o navegador sabe
decodificar; o contêiner Matroska/AVI ele não reconhece. Não existe
configuração que resolva no cliente.

O que dá para fazer, e é o que `montarFontes` faz: tentar o irmão `.mp4` do
mesmo título **antes** da original. A maioria dos provedores publica os dois.
A original fica como última tentativa porque alguns servem MP4 sob nome `.mkv`.

Resolver de verdade exigiria remux com ffmpeg no servidor — CPU que a VPS não
tem (§1 do REGRAS.md).

### Por que não trocamos por Shaka Player / Video.js / Vidstack

Pesquisado em 2026-08-13. Nenhum deles toca **MPEG-TS cru sobre HTTP** — o
Shaka desempacota TS só *dentro* de playlist HLS. Como boa parte da lista serve
`.ts` direto, mpegts.js continuaria obrigatório de qualquer jeito.

Trocar não elimina uma linha: trocaria hls.js por Shaka e ganharia DASH. E
**nenhum dos defeitos desta tabela era do player** — quase todos eram da proxy.

---

## Tabela de defeitos: sintoma → causa

Consulte por sintoma antes de investigar do zero.

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| App inteiro para de abrir vídeo, some ao reiniciar contêiner | pool de sockets esgotado por vazamento | §Regra 4 · `descartarUpstream` |
| Filme congela no meio, sem mensagem de erro | socket ocioso morto pelo timeout | §Regra 3 |
| Canal trava depois de tempo ligado | SourceBuffer sem limpeza | `autoCleanupSourceBuffer` |
| Funciona no PC e não no celular | failover por relógio matando fonte boa | §Regra 1 |
| Tela preta sem erro no celular | conteúdo misto (URL crua http) | §Regra 2 |
| Canal criptografado não abre | `#EXT-X-KEY:URI` não proxiado | reescrita de manifesto |
| HLS moderno não abre | `#EXT-X-MAP:URI` (init fMP4) não proxiado | idem |
| Canal abre e engasga logo depois | manifesto truncado | `peekUpstream` |
| Filme reinicia do zero após engasgo | posição perdida no failover | §Regra 7 |
| Vídeo abre mudo e não volta o som | `comecar()` remutando na troca | §Regra 6 |
| Canal aparece em "Continuar assistindo" de filmes | categoria do grupo vencendo a URL | §Regra 5 |

---

## Parâmetros atuais e por que estão assim

### hls.js

| Parâmetro | Valor | Razão |
|---|---|---|
| `startLevel` | `0` | O primeiro quadro é o que a pessoa espera. Buscá-lo em 1080p numa rede não medida é o jeito mais rápido de virar tela preta. O ABR sobe sozinho |
| `preferManagedMediaSource` | `true` | Dá o comando ao hls.js no iPhone 17.1+; no caminho nativo não existe controle de buffer nem troca de faixa |
| `maxBufferHole` | `0.3` | Padrão é `0.1`. Já esteve em `0.8` — **valores altos causam travamento** (hls.js#2226) |
| `nudgeMaxRetry` | `6` | Padrão 3. Mais empurrões antes de erro fatal |
| `liveSyncDuration` | `14` | Folga atrás da borda ao vivo. Pedido explícito: "mínimo 10, até 20, o importante é não travar" |
| `maxBufferLength` | `32` live / `40` VOD | |
| `backBufferLength` | `20` live / `30` VOD | Segura a memória em sessão longa |
| `startPosition` | `posicaoInicialRef` | **Ref, não propriedade** — §Regra 7 |
| `fragLoadingMaxRetry` | `4` | Lista de IPTV falha segmento com frequência |

Erro **não fatal do hls.js é rotina** (fragmento que vai ser repetido).
Desistir nele é jogar fora fonte boa por soluço de rede. Só fatal conta — e
mesmo aí, `recoverMediaError()` e `startLoad()` antes de trocar de fonte.

### mpegts.js

| Parâmetro | Valor | Razão |
|---|---|---|
| `autoCleanupSourceBuffer` | `true` | **Padrão é `false`.** Sem isto o SourceBuffer acumula tudo e o canal congela ao bater na cota do navegador |
| `autoCleanupMaxBackwardDuration` | `120` | |
| `autoCleanupMinBackwardDuration` | `60` | |
| `liveBufferLatencyChasing` | `false` | **Não ligue.** Ver entrada de 2026-08-13 no diário |
| `enableStashBuffer` | `true` | Absorve jitter de rede |
| `stashInitialSize` | `384KB` | Igual ao padrão |
| `lazyLoad` | `false` | Canal ao vivo é contínuo |
| `fixAudioTimestampGap` | `true` | Evita dessincronizar A/V em fluxo com furo |

---

## Ordem das fontes

Regra: **o formato que o provedor declarou vem primeiro.**

| URL de entrada | Ordem tentada |
|---|---|
| `…/101.ts` | `.ts` (mpegts) → `.m3u8` (hls) |
| `…/101.m3u8` | `.m3u8` (hls) → `.ts` (mpegts) |
| `…/101` (Xtream sem extensão) | `.m3u8` → `.ts` — aqui HLS primeiro, é onde costuma haver mais de uma resolução |
| `…/9.mkv` | `.mp4` → `.mkv` |
| `…/7.flv` | `.flv` (mpegts) → `.mp4` |
| `…/9.mp4` | só `.mp4` |

Depois da lista principal vem a lista de backup (2ª M3U), na mesma ordem.

Duas passagens completas (`MAX_PASSAGENS_FONTES`) antes de erro definitivo.

---

## Como diagnosticar em produção

**Trava em todos os canais ao mesmo tempo** → servidor. Pool de sockets ou
memória. `docker stats tvhub_app` e `docker service logs tvhub_app`.

**Trava em um canal só** → fonte. Provedor fora, formato sem suporte, ou
conteúdo que só existe em MKV.

**Memória do contêiner crescendo ao longo do dia** → sobrou vazamento.
Suspeitar de resposta de upstream não descartada.

**Congela sempre depois de X minutos** → buffer/memória do lado do navegador,
não da rede. Suspeitar de limpeza de SourceBuffer.

**Só no celular** → autoplay, conteúdo misto ou failover impaciente.

### Testes

```bash
node tests/prova-fontes.mjs          # 17 casos: formatos + manifesto HLS
node tests/prova-timeout-socket.mjs  # socket ocioso não derruba o fluxo
```

Os dois saem com código 1 quando falham. **Rode antes de abrir PR que toque no
player ou na proxy.**

---

## Diário de bordo

### [2026-08-13] Vazamento de socket na proxy
**Sintoma:** o app inteiro parava de abrir vídeo depois de um tempo de uso;
só voltava reiniciando o contêiner. Não era um canal — eram todos.
**Causa:** três caminhos abandonavam a resposta do provedor sem drenar nem
destruir. O agente tem teto de 256 sockets. O pior rodava em **toda abertura
de canal** (404 do `.m3u8`) e outro **a cada atualização de playlist HLS**, por
espectador. Esgotado o pool, requisição nova espera socket que nunca vaga.
**Correção:** `descartarUpstream()` nos quatro pontos, incluindo cancelamento
do cliente via `request.signal`.
**Verificação:** leitura do fluxo. Sem reprodução automatizada — o teste exigiria
simular esgotamento de pool.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] Filme congelando no meio (Zootopia, ~45 min)
**Sintoma:** filme travava do nada depois de 40-50 minutos, sem mensagem de erro.
**Causa:** `timeout: 15000` no `http.get` é prazo de socket **ocioso**, não de
conexão. O navegador enche o buffer e para de ler → contrapressão → socket
ocioso → 15s → `req.destroy()`. O `<video>` não recebia erro: para ele o
arquivo tinha **terminado** ali. Tocava o buffer restante e congelava. O minuto
exato dependia só de quando o ciclo de contrapressão se alinhava.
**Correção:** cronômetro desarmado quando os cabeçalhos chegam (§Regra 3).
**Verificação:** `tests/prova-timeout-socket.mjs` — antigo morre com
`ECONNRESET`, novo sobrevive e continua recebendo.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] Canal travando depois de tempo ligado
**Sintoma:** canal ao vivo congelava "do nada", sempre depois de um tempo,
pior em aparelho fraco.
**Causa:** `autoCleanupSourceBuffer` da mpegts.js vem `false`. O SourceBuffer
acumula tudo que passou — uma hora de canal são centenas de MB. Ao bater na
cota do navegador, `appendBuffer` falha e a imagem para. **Memória, não rede.**
**Correção:** limpeza ligada, janela de 120s para trás.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] ❌ REVERTIDO — `liveBufferLatencyChasing: true`
**O que se tentou:** ligar a perseguição de latência do mpegts.js para
controlar o atraso do canal ao vivo.
**Por que deu errado:** a perseguição funciona dando **seek** no fluxo ao vivo,
e seek em MPEG-TS sobre MSE provoca engasgo e reinício de decodificação. Pior:
ela **come o buffer**, que é a única defesa contra oscilação de rede. Trabalha
diretamente contra o objetivo de não travar. A issue
[mpegts.js#13](https://github.com/xqq/mpegts.js/issues/13) relata tela preta
nos primeiros segundos com a opção ligada.
**Status:** ❌ revertido. **Não tentar de novo.** O preço de deixar desligada é
o atraso crescer numa sessão muito longa — preço barato: ninguém compara canal
com relógio, travar é o que incomoda.

### [2026-08-13] ❌ REVERTIDO — `maxBufferHole: 0.8`
**O que se tentou:** aumentar a tolerância a furo no buffer, achando que
ajudaria em lista de IPTV com emenda irregular.
**Por que deu errado:** valor escolhido sem base. O padrão do hls.js é `0.1` e
há [relato de travamento com valores altos](https://github.com/video-dev/hls.js/issues/2226):
quanto maior o furo aceito, mais tempo o player espera parado antes de saltar.
**Status:** ❌ revertido para `0.3`.

### [2026-08-13] Celular não reproduzia (PC sim)
**Sintoma:** canal e filme abriam no computador e falhavam no celular,
terminando em "não consegui abrir este conteúdo".
**Causa:** o evento `waiting` disparava um cronômetro de 15s que trocava de
fonte. Mas `waiting` é o navegador enchendo o buffer — normal, e num 4G passa
de 15s. A fonte certa era descartada no meio do carregamento; o player
percorria a lista de reservas (pior) e terminava em erro. Na fibra do PC o
buffer enchia antes do prazo.
**Correção:** vigia por progresso (§Regra 1).
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] Chave AES-128 e init fMP4 não passavam pela proxy
**Sintoma:** canal criptografado ou HLS moderno simplesmente não abria, sem
erro que explicasse.
**Causa:** a reescrita do manifesto pulava **toda** linha começada por `#`, e é
lá que ficam `#EXT-X-KEY:URI` (chave AES) e `#EXT-X-MAP:URI` (segmento de
inicialização do fMP4). Buscados em http a partir de página https: conteúdo
misto, bloqueado, falha calada.
**Correção:** `TAGS_COM_URI` reescreve o atributo `URI="…"` preservando o resto
da tag (METHOD, IV, BYTERANGE).
**Verificação:** `tests/prova-fontes.mjs`.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] Manifesto chegando truncado
**Sintoma:** canal abria e engasgava logo depois, em rede lenta.
**Causa:** `peekUpstream` devolvia 15ms após o último pedaço, ou ao ver
`#EXT-X-STREAM-INF` — que é a **primeira** linha de uma lista mestre, não a
última. Resultado: playlist cortada no meio de uma URL.
**Correção:** só `#EXT-X-ENDLIST`, fim da resposta ou teto de 256KB encerram.
Rede travada tem escape de 8s.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] `.ts` pedindo `.m3u8` antes
**Sintoma:** demora a mais para o primeiro quadro em todo canal.
**Causa:** `montarFontes` colocava `.m3u8` na frente do `.ts` que estava no
cadastro, apostando em ganhar ABR. Em provedor que não publica HLS, isso é 404
garantido **em toda abertura**: round-trip perdido, segundos a mais, e uma
conexão desperdiçada (que ainda por cima vazava).
**Correção:** o formato declarado pelo provedor vem primeiro.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] FLV não era reconhecido
**Causa:** `.flv` caía no ramo "sem extensão" e virava tentativa de HLS.
**Correção:** motor próprio via mpegts.js com `type: "flv"`.
**Status:** ⏳ no ar, aguardando confirmação

### [2026-08-13] Bug pego pelo teste antes de subir
**O que quase foi:** ao generalizar a expressão de contêiner sem suporte, um
grupo de captura a mais fez `$1` virar a extensão em vez do marcador de query —
`filme.mkv` virava `filme.mp4mkv`.
**Lição:** leitura de código não pegou; o teste pegou. Toda mudança em
`montarFontes` ou na reescrita de manifesto precisa passar por
`tests/prova-fontes.mjs`.
**Status:** ✅ corrigido antes de sair da máquina

---

## Em aberto

| Item | Situação |
|---|---|
| **MKV/AVI** | Sem solução no cliente. Exigiria remux com ffmpeg — CPU que a VPS não tem |
| **DASH `.mpd`** | Não suportado. Adicionar `dash.js` sob demanda se existir no acervo |
| **Proxy aberta** | A autorização passa quando o User-Agent tem `Chrome`/`Safari` ou não há referer — quase sempre. Qualquer um pode usar a banda da VPS como relay. **Precisa ser fechado** |
| **Confirmação em campo** | Nada da leva de 2026-08-13 foi confirmado com stream real e aparelho real |
