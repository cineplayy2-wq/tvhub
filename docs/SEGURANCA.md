# Diário de Segurança

> Mesmo formato do [Manual do Player](MANUAL-DO-PLAYER.md): sintoma, causa,
> correção, verificação. Cada entrada aqui é uma brecha que existiu de verdade
> neste código.

**Leia antes de mexer em:** autenticação, sessões, credenciais, rotas de API,
server actions, ou qualquer coisa que receba dado do cliente.

---

## Como usar

**Antes de mexer:** procure a área na tabela de invariantes. Elas não são
teoria — cada uma nasceu de uma brecha encontrada aqui.

**Depois de mexer:** acrescente a entrada. Uma brecha que ninguém registra é
uma brecha que volta.

```
### [AAAA-MM-DD] Título
**Impacto:**     o que dava para fazer com isso
**Causa:**       o mecanismo
**Correção:**    o que mudou
**Status:**      ✅ corrigido e no ar · ⏳ corrigido, não subiu · ⛔ ABERTO
```

---

## Invariantes — quebrar qualquer uma reabre uma brecha conhecida

| # | Regra | Nasceu de |
|---|---|---|
| 1 | **Senha se CONFERE, nunca se sobrescreve no login** | Desvio total de autenticação |
| 2 | **Toda mutação por id do cliente leva `userId` no `where`** | IDOR de sessão |
| 3 | **Nenhum segredo com valor padrão no código** | Senha do Gmail versionada |
| 4 | **Rota que gasta dinheiro ou manda e-mail tem rate limit** | IA e OTP sem teto |
| 5 | **`req.json()` sempre com teto de tamanho** | DDoS de aplicação |
| 6 | **Cliente recebe erro genérico; detalhe vai para o log** | Vazamento de infraestrutura |
| 7 | **Código de acesso vem de `crypto`, nunca de `Math.random()`** | OTP previsível |
| 8 | **Contar-e-criar exige transação `Serializable`** | Limite de perfis e de telas burlável |
| 9 | **SSRF se valida no endereço RESOLVIDO, não no texto da URL** | Rede interna alcançável |
| 10 | **Resposta idêntica para "existe" e "não existe"** | Enumeração de clientes |

---

## ⛔ ABERTO — não suba a feature de Pool sem isto

A feature de pool de linhas IPTV (`lib/iptv/pool-service.ts`,
`app/actions/admin-pool.ts`, `app/api/iptv/session/route.ts`) estava em
desenvolvimento fora do Git quando foi auditada. **As correções abaixo estão na
árvore de trabalho, mas não em nenhum commit** — se o arquivo for reescrito ou
revertido, as brechas voltam.

### IDOR: um assinante derrubava a transmissão de outro

`DELETE /api/iptv/session?sessionId=X` chamava `releaseStreamSession(sessionId)`
com o identificador vindo da query, **sem checar dono**. Qualquer assinante
autenticado, mandando o `sessionId` alheio, encerrava a sessão da vítima. Com um
laço variando o valor, é negação de serviço de assinante contra assinante.

O mesmo valia no `POST`: o `upsert` por `sessionId` sozinho fazia o ramo
`update` rodar sobre a linha de outra pessoa, sobrescrevendo `iptvLineId`,
`channelId` e `titleId`.

**Correção aplicada:** `userId` entra no `where` de `touchStreamSession`,
`releaseStreamSession` e da atualização em `allocatePoolLine`. `updateMany` no
lugar de `update` porque `update` exige campo único e não aceita o par.

### Corrida estourando o limite de telas do provedor

`allocatePoolLine` contava as sessões da linha e gravava depois, sem trava. Duas
reproduções simultâneas escolhiam a MESMA linha com vaga e as duas entravam —
passando do `maxScreens`. Como o painel limita conexões por conta, estourar isso
faz o provedor **recusar todo mundo**: é uma das causas de "não roda nada".

O mesmo padrão está em `checkUserScreensLimit`: checa e depois aloca, sem trava.

**Correção aplicada:** transação `Serializable` na alocação.
**Ainda aberto:** `checkUserScreensLimit` continua com a janela de corrida.

### Outros pontos da mesma feature

| Item | Situação |
|---|---|
| `sessionId` sem formato validado (vira chave no banco e aparece no painel) | corrigido |
| Sem rate limit no heartbeat | corrigido (120/min) |
| `err.message` devolvido ao cliente | corrigido |
| `endReason: reason as any` | tipado com `StreamEndReason` |
| Limite fixo em `>= 2` telas, ignorando `deviceLimit` do plano | **aberto** — plano superior não entrega o que vende |
| `profileId` do corpo não é verificado como pertencente ao usuário | **aberto** — envenena o painel do admin |

---

## Diário

### [2026-08-14] Desvio COMPLETO de autenticação
**Impacto:** entrar na conta de qualquer pessoa, inclusive a do administrador,
pelo formulário de login. Sem ferramenta, sem exploração.
**Causa:** `loginAction` não conferia a senha — **sobrescrevia**:
```
const hashedPassword = await hashPassword(password);
if (!user) { criar conta }
else { await prisma.user.update({ data: { password: hashedPassword } }) }
```
Digitando o e-mail de outro assinante e uma senha qualquer, a senha da vítima
era trocada pela do atacante, que entrava em seguida.
**Correção:** comparação com o hash guardado; conta só é criada pelo cadastro
explícito; conta legada sem senha adota a primeira digitada (migração).
**Status:** ⏳ corrigido, não subiu
**Ação pendente do dono:** revisar `AuditLog` e a lista de `role = ADMIN`.

### [2026-08-14] Senha de aplicativo do Gmail versionada
**Impacto:** quem tivesse leitura do repositório controlava a conta de e-mail do
produto — envio em nome da marca e, por tabela, recuperação de senha de
qualquer serviço ligado àquele endereço.
**Causa:** `lib/email.ts` trazia a senha como valor padrão:
`process.env.SMTP_PASS || "…"`. O TLS ainda estava com
`rejectUnauthorized: false`, aceitando qualquer certificado — e é por essa
conexão que passa o código de acesso.
**Correção:** credencial só do ambiente; TLS verificando certificado.
**Status:** ⏳ corrigido, não subiu
**Ação pendente do dono:** **rotacionar a senha** — ela está no histórico do
Git, e o commit tira do código, não do histórico.

### [2026-08-14] Senha padrão pública
**Impacto:** toda conta criada com o campo senha vazio nascia com uma senha que
está no repositório.
**Causa:** `const DEFAULT_AUTH_PASS = "cineplay2026"`, usado no lugar do campo
vazio.
**Correção:** campo vazio virou erro de validação; mínimo de 6 caracteres.
**Status:** ⏳ corrigido, não subiu

### [2026-08-14] OTP previsível
**Causa:** `Math.floor(Math.random() * 900000)`. `Math.random()` não é
criptográfico: com algumas saídas dá para reconstruir o estado interno e prever
os próximos códigos — que autorizam entrar na conta.
**Correção:** `randomInt` do módulo `crypto`.
**Status:** ⏳ corrigido, não subiu

### [2026-08-14] Esgotamento de recurso e de crédito
| Rota | Antes | Agora |
|---|---|---|
| `/api/ai/assistant` | sem teto, e cada chamada é requisição **paga** | 20/hora por usuário |
| `resendOtpAction` | sem teto: bomba de caixa de entrada, esgota a cota SMTP de todos, escreve sem limite em `verificationToken` | 5/hora por e-mail + 200/hora global |
| Todas as rotas | `req.json()` sem limite — um POST grande é DDoS de aplicação num contêiner de 320 MB | teto de 32 KB |
| `reels/like` | `reelId` ia direto para chave do Redis, sem formato nem TTL | validado, TTL de 90 dias |
**Status:** ⏳ corrigido, não subiu

### [2026-08-14] SSRF por nome que resolve para rede privada
**Impacto:** alcançar a rede interna da VPS pelo proxy de vídeo — o Odoo em
produção, Postgres, Redis, metadados de nuvem.
**Causa:** `assertPublicStreamUrl` valida o TEXTO da URL. Barra
`http://10.0.0.5`, mas não `http://interno.exemplo.com` apontando para o mesmo
lugar — nem rebinding, onde a primeira resolução devolve IP público e a segunda,
na hora de conectar, devolve privado.
**Correção:** checagem movida para o `lookup` da proxy, com o endereço já
resolvido e antes do socket conectar.
**Status:** ⏳ corrigido, não subiu

### [2026-08-14] Cookie de perfil sem `secure`
**Impacto:** `tvhub_unlocked` é a prova de que o PIN de um perfil adulto foi
digitado. Copiado da rede, libera o perfil em outro navegador sem PIN.
**Causa:** `secure: false` fixo — o navegador mandava o cookie também em http.
**Correção:** acompanha o ambiente; HSTS adicionado para cobrir a primeira
requisição, que o cookie sozinho não protege.
**Status:** ⏳ corrigido, não subiu

### [2026-08-14] Corrida no limite de perfis
**Causa:** `count()` seguido de `create()`. Dois envios simultâneos liam a mesma
contagem e os dois criavam — o limite por conta virava sugestão.
**Correção:** transação `Serializable`, com `P2034` tratado como "tente de novo".
**Status:** ⏳ corrigido, não subiu

---

## Verificado limpo nesta auditoria

Sem `dangerouslySetInnerHTML`. `$executeRawUnsafe` só com DDL estático, sem
entrada de usuário. Sem prototype pollution. Todos os spreads em `data:` vêm de
schemas Zod validados (sem mass assignment). Todas as server actions de admin
exigem `requireAdmin`. IDOR fechado em `/tv/assistir/[channelId]`.

## Dependências

| Pacote | Situação |
|---|---|
| `next` | 14.2.4 → **14.2.35**, fecha CVE crítica (cache poisoning, DoS na otimização de imagem) |
| `nodemailer` | alta em aberto — a CVE é da opção `raw`, que não usamos. Subir para 9 quebra a tipagem do NextAuth |
| `postcss`, `sharp` | altas em aberto, transitivas do Next |
| `@auth/core` | fixado: deixou de ser hasteado e a ampliação de tipos parou de casar |

## O que esta auditoria NÃO cobriu

Teste de penetração, análise em runtime, `sync-service.ts` linha a linha, e o
fluxo de pagamento. **Nenhuma auditoria autoriza dizer que o sistema está
seguro** — só que as brechas encontradas foram fechadas.
