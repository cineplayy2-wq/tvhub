import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchXtreamAccountInfo } from "@/app/actions/admin-pool";
import { pruneExpiredSessions } from "@/lib/iptv/pool-service";
import { sincronizarFontesDaLinha, varrerFontesMortas, type RelatorioFontes } from "@/lib/iptv/sync-fontes";
import { estatisticaDeCobertura } from "@/lib/iptv/source-router";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "tvhub_nightly_secret";

  if (authHeader !== `Bearer ${cronSecret}` && request.nextUrl.searchParams.get("key") !== cronSecret) {
    // Permite execução interna em produção
    const isLocal = request.headers.get("host")?.includes("localhost") || request.headers.get("host")?.includes("127.0.0.1");
    if (!isLocal) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const startTime = Date.now();
  const report: {
    prunedSessions: number;
    linesSynced: number;
    fontes: RelatorioFontes[];
    fontesVarridas: number;
    cobertura?: Awaited<ReturnType<typeof estatisticaDeCobertura>>;
    errors: string[];
  } = {
    prunedSessions: 0,
    linesSynced: 0,
    fontes: [],
    fontesVarridas: 0,
    errors: [],
  };

  try {
    // 1. Limpa sessões zumbis
    report.prunedSessions = await pruneExpiredSessions();

    // 2. Atualiza validades e status de todas as linhas do Pool (C1, C2, C3, C4, C5, C9, etc.)
    const lines = await prisma.iptvLine.findMany({ where: { isActive: true } });
    for (const line of lines) {
      try {
        const info = await fetchXtreamAccountInfo(
          line.serverUrl,
          line.username,
          line.password,
        );

        await prisma.iptvLine.update({
          where: { id: line.id },
          data: {
            expiresAt: info.expiresAt,
            statusInfo: info.status || "Active",
            maxScreens: info.maxScreens || line.maxScreens,
          },
        });
        report.linesSynced++;

        /**
         * Além do metadado, o CATÁLOGO deste servidor.
         *
         * Antes o cron só atualizava validade e status da linha. O acervo
         * continuava vindo de uma sincronização única, sem saber de qual
         * servidor cada item tinha vindo — e era isso que impedia unificar o
         * catálogo e distinguir o conteúdo exclusivo de cada servidor.
         */
        const fontes = await sincronizarFontesDaLinha(line);
        report.fontes.push(fontes);
        if (fontes.erro) {
          report.errors.push(`Catálogo ${line.serverCode}: ${fontes.erro}`);
        }
      } catch (err: any) {
        report.errors.push(`Linha ${line.label}: ${err.message}`);
      }
    }

    /**
     * Varredura das fontes que nenhum servidor confirma há uma semana.
     *
     * Fica DEPOIS do laço de propósito: rodando durante a sincronização, uma
     * leitura parcial da lista de um provedor viraria remoção em massa.
     */
    try {
      report.fontesVarridas = await varrerFontesMortas(7);
    } catch {}

    report.cobertura = await estatisticaDeCobertura();

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startTime,
      report,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
