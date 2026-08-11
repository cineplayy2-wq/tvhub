import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { revincularBackup, syncPlaylist } from "@/lib/iptv/sync-service";

/**
 * GET / POST /api/iptv/sync
 * 
 * Inicia a sincronização de todas as playlists pendentes ou configuradas para autosync em segundo plano.
 */
export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.IPTV_SYNC_API_KEY;

  /**
   * Sem chave configurada, a rota FECHA — não abre.
   *
   * A versão anterior era `if (expectedKey && ...)`: quando a variável não
   * estava definida, a checagem inteira era pulada e o endpoint ficava
   * exposto na internet. Em produção ela não estava definida, ou seja,
   * qualquer pessoa podia disparar uma reimportação de 150 mil canais —
   * que apaga o catálogo antes de repovoar. É negação de serviço de graça.
   *
   * Falha fechada é a única postura correta para gatilho de tarefa pesada.
   */
  if (!expectedKey) {
    console.error("[sync] IPTV_SYNC_API_KEY não configurada — rota bloqueada.");
    return NextResponse.json(
      { error: "Sincronização não configurada" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /**
   * `?mode=relink` revincula só as URLs de backup, sem reimportar.
   *
   * A reimportação apaga o catálogo antes de repovoar, então quando os canais
   * já estão corretos e só o failover ficou para trás — o caso de uma
   * sincronização interrompida por restart — este modo resolve sem tirar o
   * assinante do ar. Ele roda de forma síncrona porque é rápido e o resultado
   * (quantos canais ganharam backup) é a informação que se quer de volta.
   */
  const modo = new URL(request.url).searchParams.get("mode");
  if (modo === "relink") {
    const comBackup = await prisma.m3uPlaylist.findMany({
      where: { OR: [{ backupSourceUrl: { not: null } }, { backupXtreamServer: { not: null } }] },
    });

    const relinks = [];
    for (const playlist of comBackup) {
      try {
        relinks.push({
          playlistId: playlist.id,
          label: playlist.label,
          ...(await revincularBackup(playlist)),
        });
      } catch (erro) {
        relinks.push({
          playlistId: playlist.id,
          label: playlist.label,
          erro: erro instanceof Error ? erro.message : "falha desconhecida",
        });
      }
    }

    return NextResponse.json({ mode: "relink", playlists: relinks.length, relinks });
  }

  const playlists = await prisma.m3uPlaylist.findMany({
    where: {
      OR: [
        { syncStatus: "PENDING" },
        { syncStatus: "ERROR" },
        {
          autoSyncHours: { gt: 0 },
          nextSyncAt: { lte: new Date() },
        },
      ],
    },
  });

  const results = [];

  for (const playlist of playlists) {
    // Dispara a sincronização em segundo plano sem estourar tempo de proxy HTTP
    void syncPlaylist(playlist).catch((err) => {
      console.error("Erro na sincronização em segundo plano:", err);
    });

    results.push({
      playlistId: playlist.id,
      userId: playlist.userId,
      label: playlist.label,
      status: "SYNCING_STARTED",
    });
  }

  return NextResponse.json({
    triggered: results.length,
    results,
  });
}
