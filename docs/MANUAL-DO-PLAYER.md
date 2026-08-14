# Manual do Player

> **Leia antes de mexer em qualquer coisa do caminho do vídeo.**
> Isto é diário de bordo, não documentação de API. Cada linha aqui custou uma
> reprodução quebrada em produção.

**Arquivos cobertos:**

| Arquivo | Papel |
|---|---|
| `components/iptv/iptv-player.tsx` | Motores, failover, qualidade, controles |
| `app/api/iptv/stream/route.ts` | A proxy: todo byte de vídeo passa por aqui |
| `lib/iptv/credentials.ts` | Qual linha do provedor cada assinante usa |
| `lib/playback/connection.ts` | Perfil de conexão e plano de buffer |
| `lib/iptv/quality.ts` | Variantes de resolução do mesmo canal |
| `tests/prova-timeout-socket.mjs` | Prova do socket ocioso |

---

## Como usar este documento

**Antes de mexer:** leia as *Regras invioláveis* e procure o sintoma na
*Tabela de sintomas*. Boa parte do que parece ideia nova já foi tentada aqui.

**Depois de mexer:** acrescente uma entrada. Mesmo que tenha dado certo —
principalmente se deu errado.

```
### [AAAA-MM-DD] Título
**Sintoma:**     o que o usuário via
**Causa:**       o mecanismo, não o palpite
**Correção:**    o que foi feito
**Verificação:** teste? reprodução? só leitura de código?
**Status:**      ✅ confirmado em produção · ⏳ no ar, sem confirmação · ❌ revertido
```

**Nunca** marque ✅ sem uso real confirmando. A maior parte dos erros deste
projeto veio de tratar "compila e parece certo" como "funciona".

### Regra zero: confira em que commit a produção está

Já aconteceu de uma auditoria inteira ser feita sobre um arquivo que **não era
o que estava rodando**. A `main` andou 25 commits enquanto o trabalho corria em
cima de uma base velha, e o merge teria revertido um sistema inteiro de
credencial por cliente.

```bash
git fetch origin && git log --oneline origin/main -5
```

---

## Arquitetura: o caminho do byte

```
M3uChannel.streamUrl (Postgres)
        │
        ▼
buildStreamVariants()        lista de tentativas por formato
        │                    (.mp4/.mkv, .ts/.m3u8, principal → reserva)
        ▼
credencialDoUsuario()        troca a conta da URL pela linha DESTE assinante
        │                    (com rede de segurança: cai na conta do catálogo)
        ▼
/api/iptv/stream?url=…       SEMPRE. Nunca aponte o <video> para o provedor.
        │
        ├── &sonda=1         diz só QUE FORMATO é, com cache de 30 min
        │
        ▼
route.ts                     DNS em cache → agente keep-alive → provedor
        │                    reescreve manifesto HLS, repassa binário
        ▼
motor escolhido pelo formato REAL (não pela extensão):
   hls.js       manifesto HLS
   mpegts.js    MPEG-TS cru — ÚNICA opção no navegador
   <video> nu   .mp4 .webm .mov, e HLS nativo no Safari
        │
        ▼
Vigia de progresso           decide se a fonte morreu
```

---

## Regras invioláveis

### 1. Quem decide que a fonte morreu é o PROGRESSO, não o relógio

Nunca troque de fonte por causa de `waiting` ou de um cronômetro fixo.
`waiting` é o navegador **enchendo o buffer** — normal, e num 4G passa
facilmente de dez segundos.

O vigia mede `buffered.end` e `currentTime` a cada segundo. Enquanto qualquer
um dos dois se mexe, a fonte está viva. Só o silêncio total conta (20s).
**Vídeo pausado nunca é fonte morta.**

### 2. Toda conexão com o provedor é escassa — feche o que não vai usar

O painel concede **poucas conexões simultâneas por conta**, e com o catálogo
compartilhado muitos assinantes dividem a mesma. Passado o limite, o provedor
recusa tudo e o sintoma é "não roda nada".

Isso torna obrigatório:

- `descartarUpstream()` em todo caminho que abandona uma resposta (404, erro,
  manifesto já lido, troca de fonte, cancelamento do cliente).
- Nenhuma requisição extra ao provedor sem necessidade — ver a sonda (§4).

### 3. Timeout de socket é prazo para RESPONDER, nunca para transmitir

`http.get({ timeout })` **não** é prazo de conexão: é prazo de socket
**ocioso**, e vale enquanto o socket existir. Num filme, o navegador enche o
buffer e para de ler; a contrapressão sobe e o socket fica ocioso **porque
está tudo funcionando**.

Desarme com `req.setTimeout(0)` e `res.socket.setTimeout(0)` assim que os
cabeçalhos chegarem. Quem encerra depois é o cliente, via `request.signal`.

### 4. A sonda de formato não pode custar uma conexão por tentativa

O motor é escolhido pelo formato REAL, não pela extensão — o painel Xtream
nomeia canal ao vivo como `.m3u8` mesmo servindo TS puro.

Mas a descoberta tem que ser barata. Ela vive em `?sonda=1`, com cache de 30
minutos por URL no servidor: só o primeiro espectador de cada endereço paga
uma conexão. **Não volte a sondar direto da URL de reprodução.**

### 5. Nada toca fora da proxy

Site https, lista do provedor http. Apontar o `<video>` para a URL crua é
conteúdo misto — o navegador de celular **bloqueia em silêncio**: sem erro,
sem evento, só tela preta.

### 6. Cair de qualidade é caro — não caia por engasgo curto

A espera para voltar a subir **dobra a cada queda**, com teto de oito minutos.
Derrubar a resolução num engasgo de um segundo e meio (tempo normal de troca
de segmento em rede móvel) prende o assinante em SD pela sessão inteira. O
limiar é 4 segundos parado.

### 7. Buffer de mídia precisa ser limpo em transmissão longa

`autoCleanupSourceBuffer` da mpegts.js vem `false`. Sem limpeza o SourceBuffer
acumula tudo que passou; ao bater na cota do navegador o `appendBuffer` falha e
a imagem para. **Memória, não rede** — por isso vem "do nada" e é pior em
aparelho fraco.

---

## Formatos: o que toca e o que não toca

| Formato | Motor | Observação |
|---|---|---|
| HLS (manifesto) | hls.js | ABR real |
| MPEG-TS cru | mpegts.js | **Única opção no navegador** |
| MP4 / M4V / MOV / WebM | `<video>` nativo | Com Range e busca na barra |
| HLS no Safari/iOS | `<video>` nativo | Sem controle de buffer nem de faixa |
| **MKV / AVI** | ❌ nenhum | Ver abaixo |
| **DASH `.mpd`** | ❌ não suportado | Precisaria de `dash.js` |

### MKV e AVI não tocam em navegador nenhum

Nem desktop, nem celular, **nem com H.264 dentro**. O codec o navegador sabe
decodificar; o contêiner Matroska/AVI não. Todo navegador do iPhone usa o motor
do sistema, então nem trocar de navegador resolve.

O que dá para fazer, e é o que `buildStreamVariants` faz: tentar o irmão `.mp4`
do mesmo id. No iOS o `.mp4` vai na **frente**, porque ali o `.mkv` é recusa
certa e tentá-lo primeiro gasta um ciclo de failover na cara do assinante.

### Por que não trocamos por Shaka Player / Video.js / Vidstack

Pesquisado em 2026-08-13. **Nenhum toca MPEG-TS cru sobre HTTP** — o Shaka
desempacota TS só *dentro* de playlist HLS. Como boa parte da lista serve `.ts`
direto, a mpegts.js continuaria obrigatória.

Trocar não elimina uma linha: trocaria hls.js por Shaka e ganharia DASH. E
**quase nenhum defeito deste diário era do player** — a maioria era da proxy.

---

## Tabela de sintomas

| Sintoma | Causa provável | Regra |
|---|---|---|
| **Não roda nada, para ninguém** | conexões do provedor esgotadas por vazamento ou sonda | §2, §4 |
| Não roda nada, e o catálogo aparece | credencial: `credencialDoUsuario` devolveu nulo → 403 | `credentials.ts` |
| Filme congela no meio, sem erro | socket ocioso morto pelo timeout | §3 |
| Canal trava depois de tempo ligado | SourceBuffer sem limpeza | §7 |
| Funciona no PC e não no celular | failover por relógio matando fonte boa | §1 |
| Tela preta sem erro no celular | conteúdo misto (URL crua http) | §5 |
| Preso em SD a sessão inteira | queda de qualidade por engasgo curto | §6 |
| Canal fica "só carregando" | motor errado: TS entregue ao hls.js | §4 |
| Canal criptografado não abre / fica mudo | `URI="..."` da tag não proxiado | reescrita de manifesto |
| Tela preta nos primeiros segundos | `liveBufferLatencyChasing` ligado | ver revertidos |
| Catálogo inteiro em 502 por 5 min | soluço de DNS marcado como host morto | `lookupComCache` |

---

## Parâmetros e por que estão assim

### hls.js

| Parâmetro | Valor | Razão |
|---|---|---|
| `startLevel` | `0` | `-1` parte de faixa alta antes de existir medição de banda — dez segundos de tela preta na abertura |
| `capLevelToPlayerSize` | `true` | Não baixa faixa maior que o vídeo na tela |
| `maxBufferHole` | `0.3` | Padrão 0.1; valores altos **causam travamento** (hls.js#2226) |
| `nudgeMaxRetry` | `6` | Padrão 3. Mais empurrões antes de erro fatal |
| `lowLatencyMode` | `false` | Em canal ninguém percebe 10s de atraso; todo mundo percebe travar |
| `liveSyncDurationCount` | `3` | ~15s de folga com segmentos de 5s |
| `backBufferLength` | `30` live | Segura memória em canal ligado por horas |
| `fragLoadingMaxRetry` | `4` | Lista de IPTV falha segmento com frequência |

### mpegts.js

| Parâmetro | Valor | Razão |
|---|---|---|
| `autoCleanupSourceBuffer` | `true` | **Padrão é `false`** — §7 |
| `liveBufferLatencyChasing` | `false` | **Não ligue** — ver revertidos |
| `enableStashBuffer` | `true` | Absorve jitter de rede |
| `fixAudioTimestampGap` | `true` | Evita dessincronizar A/V em fluxo com furo |
| `lazyLoad` | `false` | Canal ao vivo é contínuo |

---

## Como diagnosticar em produção

**Não roda em todos os canais ao mesmo tempo** → servidor. Conexões do
provedor, pool de sockets ou credencial.

**Não roda em um canal só** → fonte. Provedor fora, ou conteúdo só em MKV.

**Memória do contêiner crescendo ao longo do dia** → sobrou vazamento de
resposta de upstream.

**Congela sempre depois de X minutos** → buffer/memória no navegador, não rede.

### Onde ver o motivo exato

O status de `/api/iptv/stream` diz em qual porta parou:

| Status | Significa |
|---|---|
| 401 | sessão |
| 403 | credencial (a mensagem diz qual das duas) |
| 404/5xx no upstream | provedor |
| 502 "Servidor de origem indisponível" | DNS marcou o host como morto |
| 500 | provavelmente migration não aplicada (coluna inexistente) |

```bash
docker service logs tvhub_app --tail 100
docker exec $(docker ps -qf name=tvhub_app) npx prisma migrate status
```

### Testes

```bash
node tests/prova-timeout-socket.mjs
```

---

## Diário de bordo

### [2026-08-13] Auditoria sobre o código de produção

Cinco defeitos encontrados lendo o que está na VPS. Contexto que importa: a
auditoria anterior foi feita sobre uma base 25 commits atrasada e não valia.

---

#### A. Timeout de socket derrubando o fluxo no meio
**Sintoma:** filme congelava do nada depois de dezenas de minutos, sem erro.
**Causa:** `timeout: 15000` no `http.get` é prazo de socket **ocioso**. O
navegador enche o buffer e para de ler → contrapressão → socket ocioso → 15s →
`req.destroy()`. O `<video>` não recebia erro: para ele o arquivo **terminou**
ali. Tocava o buffer restante e congelava.
**Correção:** cronômetro desarmado quando os cabeçalhos chegam (§3).
**Verificação:** `tests/prova-timeout-socket.mjs` — antigo morre com
`ECONNRESET`, novo recebe 200 MB e sobrevive.
**Status:** ⏳ no ar, sem confirmação

#### B. Vazamento na troca 404 `.m3u8` → `.ts`
**Sintoma:** contribui para "não roda nada".
**Causa:** ao recuperar via `.ts`, a resposta 404 original era abandonada sem
`destroy()`; e quando o `.ts` também falhava, as duas vazavam. Este caminho
roda em **toda abertura de canal** cujo provedor não publica HLS — a maioria.
Cada vazamento segura uma vaga do agente (teto 256) e uma das poucas conexões
que o painel concede por conta.
**Correção:** `descartarUpstream()` nos dois ramos.
**Status:** ⏳ no ar, sem confirmação

#### C. Sonda de formato gastando uma conexão por tentativa
**Sintoma:** "não roda nada", pior quanto mais o assinante insiste.
**Causa:** o player descobria o formato pedindo `Range: bytes=0-7` na própria
URL de reprodução. Somando as 3 insistências na mesma fonte, as variantes de
formato e as fontes de reserva, **uma única abertura de canal batia no painel
até dez vezes em poucos segundos**. O painel concede poucas conexões por conta
— e com o catálogo compartilhado, muitos assinantes dividem a mesma. Passado o
limite ele recusa tudo, e a culpa parece do player.
**Correção:** sonda virou `?sonda=1` no servidor, com cache de 30 min por URL.
Só o primeiro espectador de cada endereço paga uma conexão.
**Status:** ⏳ no ar, sem confirmação

#### D. `waiting` derrubando fonte boa
**Sintoma:** funciona no PC, falha no celular.
**Causa:** doze segundos em `waiting` trocavam de fonte. Mas `waiting` é o
buffer enchendo, e num 4G passa disso. A fonte certa era abandonada no meio do
carregamento; o player descia a lista de reservas e terminava em erro.
**Correção:** vigia por progresso de buffer (§1).
**Status:** ⏳ no ar, sem confirmação

#### E. Qualidade caindo por engasgo curto
**Sintoma:** assinante pagando HD e assistindo SD a sessão inteira.
**Causa:** um segundo e meio parado já derrubava a resolução — e um segundo e
meio é o tempo normal de troca de segmento em rede móvel. A espera para voltar
a subir dobra a cada queda, até oito minutos, então uma oscilação corriqueira
prendia o assinante embaixo.
**Correção:** limiar para 4 segundos.
**Status:** ⏳ no ar, sem confirmação

#### F. hls.js abrindo em faixa alta
**Causa:** `startLevel: -1` deixa o hls.js escolher pela banda estimada, que no
primeiro segundo ainda não existe. Na prática partia de faixa alta.
**Correção:** `startLevel: 0` + `capLevelToPlayerSize`. Sobe sozinho depois.
**Status:** ⏳ no ar, sem confirmação

---

### [2026-08-13] ❌ REVERTIDO — `liveBufferLatencyChasing: true`
**O que se tentou:** perseguição de latência no mpegts.js para controlar o
atraso do canal ao vivo.
**Por que deu errado:** funciona dando **seek** no fluxo ao vivo, e seek em
MPEG-TS sobre MSE reinicia a decodificação. Pior: come exatamente o colchão de
buffer que é a defesa contra oscilação de rede — trabalha contra o objetivo.
[mpegts.js#13](https://github.com/xqq/mpegts.js/issues/13) relata tela preta
nos primeiros segundos com ela ligada.
**Status:** ❌ **Não tentar de novo.** O preço de deixar desligada é o atraso
crescer numa sessão longa — barato: ninguém compara canal com relógio.

### [2026-08-13] ❌ REVERTIDO — `maxBufferHole: 0.8`
**Por que deu errado:** valor escolhido sem base. Padrão do hls.js é `0.1` e há
[relato de travamento com valores altos](https://github.com/video-dev/hls.js/issues/2226).
**Status:** ❌ revertido para `0.3`.

### [2026-08-13] Auditoria feita sobre base errada
**O que aconteceu:** várias rodadas de análise e correção sobre
`components/iptv/iptv-player.tsx` numa base 25 commits atrasada. A `main` já
tinha credencial por cliente, catálogo compartilhado, detecção de formato real
e correções de DNS. O merge teria revertido tudo isso.
**Lição:** virou a *regra zero* no topo deste documento. `git fetch` e conferir
`origin/main` **antes** de abrir qualquer arquivo.
**Status:** ✅ branch descartada, trabalho refeito sobre `origin/main`

### Defeitos anteriores já corrigidos na `main` (contexto histórico)

Registrados aqui porque explicam o porquê de várias decisões atuais:

| Defeito | Correção que sobrou |
|---|---|
| Play recusado para todo assinante comum (backfill da migration só alcançava dono de playlist) | rede de segurança em `credencialDoUsuario` |
| Soluço de DNS derrubava o catálogo por 5 min | `dnsCache` guarda o código de erro original |
| Canal ao vivo entregue como manifesto → hls.js girando para sempre | detecção de formato real |
| Filme e série pedidos como HLS (painel serve arquivo) | variantes `.mp4`/`.mkv` na frente |
| `.mkv` no iPhone sem segunda chance | `.mp4` primeiro no iOS |
| Conexão boa classificada como ruim, todos em SD | `detectBufferProfile` separado de `detectConnectionProfile` |
| Motor montado duas vezes por abertura (perfil detectado em efeito) | perfil detectado no primeiro render |

---

## Em aberto

| Item | Situação |
|---|---|
| **MKV/AVI** | Sem solução no cliente. Exigiria remux com ffmpeg — CPU que a VPS não tem |
| **DASH `.mpd`** | Não suportado. Adicionar `dash.js` sob demanda se existir no acervo |
| **Confirmação em campo** | Nada da leva de 2026-08-13 foi confirmado com stream e aparelho reais |
| **Linha por cliente** | Enquanto os assinantes dividirem a conta do catálogo, o limite de conexões do painel continua sendo o gargalo. Cadastrar em Admin → IPTV tira cada um do rateio |
