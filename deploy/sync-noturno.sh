#!/usr/bin/env bash
#
# Dispara a sincronizacao do catalogo M3U.
#
# Existe porque nada chamava essa rota. A lista tem autoSyncHours=48 e um
# nextSyncAt gravado no banco, mas esses campos so descrevem quando a
# sincronizacao DEVERIA rodar - nenhum processo os lia. Na pratica o catalogo
# so era atualizado quando alguem abria o painel e clicava, e foi assim que ele
# envelheceu ate o provedor trocar de servidor e metade do acervo parar de
# tocar sem ninguem perceber.
#
# Sem argumento: pede a sincronizacao e a propria rota decide se ja venceu.
# Com --forcar: antecipa o vencimento no banco antes de pedir, para uma carga
# imediata sem esperar o ciclo de 48h.
set -euo pipefail

LOG=/var/log/tvhub-sync.log
exec >>"$LOG" 2>&1

echo "=== $(date -Is) inicio ${1:-} ==="

set -a
. /opt/tvhub/.env
set +a

if [ -z "${TVHUB_SYNC_KEY:-}" ]; then
  echo "ERRO: TVHUB_SYNC_KEY ausente em /opt/tvhub/.env"
  exit 1
fi

if [ "${1:-}" = "--forcar" ]; then
  echo "antecipando o vencimento da lista"
  docker exec "$(docker ps -q -f name=tvhub_postgres)" \
    psql -U tvhub -d tvhub -c \
    "UPDATE \"M3uPlaylist\" SET \"nextSyncAt\" = now() - interval '1 hour' WHERE \"autoSyncHours\" > 0;"
fi

echo "chamando a rota de sincronizacao"
curl -sS -m 60 \
  -H "Authorization: Bearer ${TVHUB_SYNC_KEY}" \
  "https://tvhub.170.238.45.225.nip.io/api/iptv/sync"
echo

# A rota responde assim que agenda o trabalho; a carga continua em segundo
# plano. Este resumo sai depois de uma espera para registrar como terminou.
sleep 600
echo "--- situacao 10 min depois ---"
docker exec "$(docker ps -q -f name=tvhub_postgres)" \
  psql -U tvhub -d tvhub -t -A -F' | ' -c \
  "SELECT \"syncStatus\", \"totalChannels\", left(coalesce(\"lastSyncError\",'sem erro'),120) FROM \"M3uPlaylist\";"

docker exec "$(docker ps -q -f name=tvhub_postgres)" \
  psql -U tvhub -d tvhub -t -A -F' | ' -c \
  "SELECT substring(\"streamUrl\" from 'https?://([^/:]+)'), count(*) FROM \"M3uChannel\" WHERE \"isActive\" GROUP BY 1 ORDER BY 2 DESC;"

echo "=== $(date -Is) fim ==="
