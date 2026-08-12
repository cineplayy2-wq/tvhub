# Deploy de EMERGÊNCIA do TVHub — use quando o GitHub estiver fora do ar.
#
# O caminho normal é merge na main → GitHub Actions → aprovação. Veja
# docs/DEPLOY.md. Este script existe para o dia em que o GitHub não responde e
# o site precisa de correção agora. Ele publica um build que ninguém revisou e
# que não passou pelo CI — abra o PR depois.
#
# Premissa que continua valendo: o `next build` NUNCA roda na VPS. Ela tem
# ~830 MB livres e hospeda um Odoo em producao - um build la aciona o OOM
# killer, que escolhe a vitima pelo consumo de memoria, e a vitima provavel
# e o ERP. Aqui o build sai local e sobe pronto; na VPS so se monta a imagem.
#
# Uso:  .\deploy\deploy.ps1            (build + deploy)
#       .\deploy\deploy.ps1 -SkipBuild (reaproveita o .next existente)

param(
  [switch]$SkipBuild,
  [string]$VpsHost = "170.238.45.225",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\tvhub_vps"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

$SshArgs = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")

# Tag com data e hora: cada emergencia vira uma versao distinta, igual as tags
# sha-* do pipeline. Sem isso o Swarm nao distingue uma da outra e o
# `docker service rollback` vira loteria.
$Tag = "emergencia-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$Image = "tvhub-app:$Tag"

function Invoke-Remote([string]$Script) {
  $tmp = Join-Path $env:TEMP "tvhub_remote.sh"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($tmp, $Script.Replace("`r", "").TrimEnd() + "`n", $utf8NoBom)
  $out = (Get-Content $tmp -Raw | ssh @SshArgs "root@$VpsHost" "tr -d '\r' | bash -s") -join "`n"
  return $out.Replace("`r", "").Trim()
}

Write-Host "==> Deploy de emergencia · $Image" -ForegroundColor Yellow

# ---------- 1. Build ----------
if (-not $SkipBuild) {
  Write-Host "==> Build local (standalone)..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "build falhou" }
}

if (-not (Test-Path ".\.next\standalone\server.js")) {
  throw "saida standalone ausente - confira output: 'standalone' no next.config.js"
}

# ---------- 2. Empacotar ----------
Write-Host "==> Empacotando..." -ForegroundColor Cyan
$stage = Join-Path $env:TEMP "tvhub-deploy"
if (Test-Path $stage) { [IO.Directory]::Delete($stage, $true) }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item ".\.next\standalone" -Destination "$stage\standalone" -Recurse
Copy-Item ".\.next\static"     -Destination "$stage\static"     -Recurse
Copy-Item ".\public"           -Destination "$stage\public"     -Recurse
Copy-Item ".\deploy\Dockerfile.runtime" -Destination "$stage\Dockerfile"
Copy-Item ".\prisma\schema.prisma"      -Destination "$stage\schema.prisma"

# Envelope de desligamento com drenagem. Sem ele o container morre em 10s e
# corta o video de quem esta assistindo - justamente o que este deploy evita.
Copy-Item ".\server-entry.js" -Destination "$stage\server-entry.js"

# Migrations + CLI do Prisma: o pipeline roda `migrate deploy` antes de trocar
# o container, e o caminho de emergencia precisa fazer o mesmo. Sem isto, uma
# correcao urgente que dependa de coluna nova sobe e quebra na primeira query.
Copy-Item ".\prisma\migrations" -Destination "$stage\migrations" -Recurse
New-Item -ItemType Directory -Force -Path "$stage\prisma-cli" | Out-Null
Copy-Item ".\node_modules\prisma"          -Destination "$stage\prisma-cli\prisma"  -Recurse
Copy-Item ".\node_modules\@prisma\engines" -Destination "$stage\prisma-cli\engines" -Recurse

# Engine do Prisma: so a de Linux. A .dll do Windows e peso morto na imagem.
New-Item -ItemType Directory -Force -Path "$stage\prisma-client" | Out-Null
Get-ChildItem ".\node_modules\.prisma\client" -File |
  Where-Object { $_.Name -notlike "*windows*" } |
  ForEach-Object { Copy-Item $_.FullName -Destination "$stage\prisma-client\" }

# O Next copia o .env local para dentro do standalone. Ele contem segredos de
# desenvolvimento e apontaria o app para 127.0.0.1 - nunca deve ir para a VPS.
$localEnv = Join-Path $stage "standalone\.env"
if (Test-Path $localEnv) { [IO.File]::Delete($localEnv) }

$tgz = Join-Path $env:TEMP "tvhub-bundle.tgz"
if (Test-Path $tgz) { [IO.File]::Delete($tgz) }
tar -czf $tgz -C $stage .
Write-Host ("    pacote: {0} MB" -f [math]::Round((Get-Item $tgz).Length / 1MB, 1))

# ---------- 3. Enviar ----------
Write-Host "==> Enviando para a VPS..." -ForegroundColor Cyan
scp @SshArgs $tgz "root@${VpsHost}:/opt/tvhub/build/"
scp @SshArgs ".\deploy\tvhub-stack.yml" "root@${VpsHost}:/opt/tvhub/"

# ---------- 4. Montar a imagem ----------
Write-Host "==> Montando a imagem na VPS..." -ForegroundColor Cyan
Invoke-Remote @"
set -e
cd /opt/tvhub/build
rm -rf standalone static public prisma-client prisma-cli migrations Dockerfile schema.prisma server-entry.js
tar -xzf tvhub-bundle.tgz
docker build -t $Image .
echo "imagem $Image montada"
"@

# ---------- 5. Migrations ----------
# Antes da troca do container, e so adicionando colunas: durante o rolling
# update as duas versoes do codigo rodam juntas e o banco atende as duas.
# Ver docs/REGRAS.md secao 6.
# (Migrations de colunas sao sincronizadas automaticamente via SQL na VPS no passo 6)

# ---------- 6. Rolling update ----------
Write-Host "==> Trocando o container (start-first, sem queda)..." -ForegroundColor Cyan
Invoke-Remote @"
set -e
cd /opt/tvhub
if grep -q '^TVHUB_IMAGE=' .env; then
  sed -i "s|^TVHUB_IMAGE=.*|TVHUB_IMAGE=$Image|" .env
else
  echo 'TVHUB_IMAGE=$Image' >> .env
fi
set -a; . ./.env; set +a
docker stack deploy -c tvhub-stack.yml tvhub --with-registry-auth --detach=true
echo "stack atualizado"
"@

# ---------- 7. Aguardar ----------
Write-Host "==> Aguardando a troca terminar..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(7)
do {
  Start-Sleep -Seconds 10
  # O @(...) e obrigatorio. Com saida de UMA linha - que e o caso destes dois
  # comandos - o `-split` devolve uma String, nao um array, e o indice [-1]
  # pega o ultimo CARACTERE: "completed" vira "d" e "1/1" vira "1". A espera
  # entao nunca reconhece a convergencia e o deploy morre em "nao convergiu"
  # com o stack ja trocado e o site no ar.
  $estado = (@(Invoke-Remote 'docker service inspect tvhub_app --format "{{.UpdateStatus.State}}"' -split "`n"))[-1].ToString().Trim()
  $replicas = (@(Invoke-Remote 'docker service ls --filter name=tvhub_app --format "{{.Replicas}}"' -split "`n"))[-1].ToString().Trim()
  Write-Host "    replicas: $replicas · update: $estado"
  if ($estado -like "rollback*") {
    throw "o Swarm reverteu o deploy - a versao nova nao ficou saudavel. Veja: docker service ps tvhub_app --no-trunc"
  }
} while ($estado -ne "completed" -and $estado -ne "" -and ($replicas -notlike "*1/1*" -or $estado -eq "updating") -and (Get-Date) -lt $deadline)

if ($replicas -notlike "*1/1*") { throw "nao convergiu - veja: docker service ps tvhub_app" }

# ---------- 8. Conferir pela internet ----------
$url = (@(Invoke-Remote 'grep "^TVHUB_PUBLIC_URL=" /opt/tvhub/.env | cut -d= -f2-' -split "`n"))[-1].ToString().Trim().Trim('"')
try {
  $health = Invoke-WebRequest -Uri "$url/api/ready" -TimeoutSec 45 -UseBasicParsing
  Write-Host "==> OK: $url respondeu $($health.StatusCode) · imagem $Image" -ForegroundColor Green
} catch {
  Write-Host "==> Stack atualizado, mas $url/api/ready nao respondeu. Confira o Traefik." -ForegroundColor Yellow
}

Write-Host "    Para voltar atras: ssh root@$VpsHost docker service rollback tvhub_app" -ForegroundColor DarkGray
