# Deploy

## O que acontece quando você faz merge na `main`

```
merge / push na main
   │
   └─ 1. GitHub Actions COMPILA a imagem            (automático)
         next build → ghcr.io/<org>/tvhub:sha-a1b2c3d
         A VPS NÃO é tocada.

Publicar na VPS (só à mão, Actions → Deploy → Run workflow)
   │
   ├─ 0. Recusa se TVHUB_PROTECT_IMAGE=1 ou se a
   │     imagem no ar for `emergencia-*`
   ├─ 2. VPS baixa a imagem
   ├─ 3. prisma migrate deploy                      (só adiciona — ver REGRAS.md §6)
   ├─ 4. Rolling update start-first
   └─ 5. Confere https://<host>/api/ready = 200
```

Push sozinho já reverteu logo e configs duas vezes: a VPS estava numa imagem
de emergência que o GitHub não tem. Por isso o job `producao` não roda no
push. A trava `TVHUB_PROTECT_IMAGE=1` no `.env` da VPS é a segunda barreira —
mesmo o botão recusa enquanto ela estiver ligada.

## Por que o site não cai

O deploy antigo derrubava o site em todo release, e o motivo era uma linha que
não existia: sem `update_config`, o Swarm usa `order: stop-first` — **mata o
container antigo e só então sobe o novo**. Com `replicas: 1`, isso é o site fora
do ar durante todo o boot do Next.

Hoje a sequência é esta:

| Momento | O que acontece |
|---|---|
| `t=0` | Container **novo** sobe em paralelo. O antigo continua atendendo tudo. |
| `t≈40s` | O novo passa no healthcheck. O Traefik começa a mandar tráfego para ele. |
| `t≈40s` | Só agora o antigo recebe `SIGTERM`. |
| `t+0s` | `server-entry.js` grava a flag de dreno → `/api/ready` passa a dar 503. |
| `t+5s` | O Traefik reprova o healthcheck e tira o antigo de rotação. Requisição nova nenhuma chega mais lá. |
| `t+15s` | `server.close()`: para de aceitar conexões, **as abertas continuam**. Quem estava assistindo não percebe nada. |
| `t+100s` | Prazo final: o que ainda estiver aberto é encerrado. |
| `t+120s` | `stop_grace_period` do Swarm. Nunca é atingido — o processo já saiu limpo aos 100s. |

Se a versão nova não ficar saudável em 90s (`monitor`), o Swarm reverte sozinho
(`failure_action: rollback`), também com `start-first`.

### O limite honesto

Canal ao vivo em **MPEG-TS bruto** mantém uma única conexão HTTP aberta por
horas e não termina sozinho. Para esse caso o corte aos 100s é inevitável — o
player reconecta e o assinante vê um engasgo de alguns segundos.

Aumentar o prazo não resolve: só estica o tempo em que dois containers de
320 MB dividem os ~830 MB livres da VPS. Quem assiste por **HLS** (`.m3u8`) não
é afetado, porque cada segmento é uma requisição curta e independente.

---

## Configuração (uma vez só)

### 1. Secrets do repositório

`Settings → Secrets and variables → Actions → New repository secret`

| Secret | O que é |
|---|---|
| `VPS_HOST` | IP da VPS |
| `VPS_USER` | usuário SSH (hoje `root`) |
| `VPS_SSH_KEY` | **conteúdo** da chave privada, incluindo as linhas `BEGIN`/`END` |
| `VPS_KNOWN_HOSTS` | saída de `ssh-keyscan -H <ip>` |
| `GHCR_USER` | seu usuário do GitHub |
| `GHCR_PULL_TOKEN` | PAT clássico com escopo `read:packages` |

Sobre o `GHCR_PULL_TOKEN`: precisa ser um token de longa duração, não o
`GITHUB_TOKEN` da execução. O Swarm guarda a credencial na spec do serviço
(`--with-registry-auth`) e a reutiliza em todo restart de task — com um token
efêmero, o site cairia horas depois do deploy, quando ninguém está olhando.

Gere em `github.com/settings/tokens` → *Tokens (classic)* → escopo
`read:packages`.

### 2. Portão de aprovação

`Settings → Environments → New environment` → nome **`production`** →
marque **Required reviewers** e adicione quem pode aprovar.

> Sem reviewers configurados o deploy passa direto, sem pausa. O workflow
> funciona, mas você perde o controle do horário da troca.

Opcional: em *Environment variables*, crie `TVHUB_PUBLIC_URL` com a URL do site
— ela aparece como link na tela do deploy.

### 3. Na VPS, uma vez

`TVHUB_IMAGE` é o único lugar do sistema que diz qual código está em produção.
O pipeline reescreve essa linha a cada deploy.

```bash
ssh root@<vps> 'grep -q "^TVHUB_IMAGE=" /opt/tvhub/.env || echo "TVHUB_IMAGE=tvhub-app:latest" >> /opt/tvhub/.env'
```

**As chaves do TMDB precisam ser adicionadas.** Elas viviam como valor padrão
dentro do `tvhub-stack.yml` e foram removidas de lá — sem estas duas linhas o
próximo `docker stack deploy` **aborta** com a mensagem dizendo qual falta.
(`DEEPSEEK_API_KEY` e `DEEPSEEK_API_URL` já estão no arquivo.)

```bash
ssh root@<vps> 'cd /opt/tvhub && cp .env .env.bak && grep -q "^TMDB_API_KEY=" .env || echo "TMDB_API_KEY=<a chave>" >> .env'
```

```bash
ssh root@<vps> 'cd /opt/tvhub && grep -q "^TMDB_READ_TOKEN=" .env || echo "TMDB_READ_TOKEN=<o token>" >> .env; chmod 600 .env'
```

O modelo completo do arquivo, com todos os campos e valores mascarados, está em
[deploy/env.vps.example](../deploy/env.vps.example).

### 4. Antes do primeiro push: reescrever o histórico

O commit inicial deste repositório carregava as chaves de TMDB e DeepSeek em
texto puro. Elas foram removidas do código, mas **continuam no histórico** —
`git log -p` mostra o valor, e apagar do arquivo não apaga do passado.

Enquanto nada foi publicado, o conserto é trivial: um commit único a partir da
árvore atual, que já está limpa.

```bash
cd C:\Users\felip\Desktop\tvhub\TVHUB && git checkout --orphan limpa && git add -A
```

```bash
git commit -m "chore: repositorio, CI/CD e deploy sem queda" && git branch -D main && git branch -m main
```

Confira que ficou limpo antes de subir — o comando abaixo não deve devolver
nada:

```bash
git log --all -p | grep -cE "sk-[0-9a-f]{32}|TMDB_READ_TOKEN=eyJ"
```

> Depois do push isso deixa de ser barato: reescrever histórico publicado exige
> `--force` e quebra o clone de todo mundo. Faça agora.

### 5. Proteja a `main`

`Settings → Branches → Add rule` para `main`:

- Require a pull request before merging
- Require status checks to pass → selecione **`Tipos, lint, migrations e build`**
- Do not allow bypassing the above settings

---

## Quando algo dá errado

### Voltar para a versão anterior

```bash
ssh root@<vps> docker service rollback tvhub_app
```

Não derruba o site: o `rollback_config` também usa `start-first`. O Swarm guarda
a spec anterior, então isso funciona mesmo sem saber qual era a tag.

### Publicar uma versão específica

`Actions → Deploy → Run workflow` e informe a tag (ex.: `sha-a1b2c3d`). Ele pula
o build e publica uma imagem que já existe no GHCR — é o caminho mais rápido
para voltar a um estado conhecido.

### Ver o que está acontecendo

```bash
ssh root@<vps> 'docker service ps tvhub_app --no-trunc | head -5'
```

```bash
ssh root@<vps> 'docker service logs tvhub_app --tail 100 -f'
```

```bash
ssh root@<vps> 'docker service inspect tvhub_app --format "{{.UpdateStatus.State}}: {{.UpdateStatus.Message}}"'
```

### Qual código está no ar

```bash
ssh root@<vps> 'grep TVHUB_IMAGE /opt/tvhub/.env'
```

A tag carrega o SHA do commit. É por isso que a imagem nunca usa `:latest` —
com `latest`, o Swarm não distingue uma versão da outra e o rollback vira
loteria.

### O deploy travou em "aguardando convergência"

Quase sempre é a versão nova reprovando no healthcheck. Veja o motivo:

```bash
ssh root@<vps> 'docker service ps tvhub_app --no-trunc --format "{{.CurrentState}} · {{.Error}}"'
```

Se o Swarm já reverteu sozinho, o site está de pé na versão anterior — a
correção pode esperar você acordar.

---

## Caminho de emergência (GitHub fora do ar)

`deploy/deploy.ps1` compila na sua máquina e envia direto para a VPS por SSH,
sem passar pelo GitHub. Ele usa o mesmo `tvhub-stack.yml`, então **também não
derruba o site**.

```powershell
.\deploy\deploy.ps1
```

Não é o caminho normal: ele publica um build que ninguém revisou e que não
passou pelo CI. Use quando o GitHub estiver indisponível e o site precisar de
correção agora — e abra o PR depois.

---

## O que continua manual

O `/opt/tvhub/.env` da VPS. Ele guarda as senhas de produção e nunca entra no
Git. Para mudar uma variável: edite o arquivo e rode

```bash
ssh root@<vps> 'cd /opt/tvhub && set -a && . ./.env && set +a && docker stack deploy -c tvhub-stack.yml tvhub --with-registry-auth --detach=true'
```

A troca também é `start-first` — trocar variável de ambiente não derruba o site.
