import "server-only";

import { prisma } from "@/lib/prisma";
import { reescreverCredencial } from "@/lib/iptv/credentials";

/**
 * Para qual servidor mandar o assinante — e com qual credencial.
 *
 * ------------------------------------------------------------------
 * O QUE ESTAVA ERRADO ANTES
 * ------------------------------------------------------------------
 * `allocatePoolLine` escolhia a linha MENOS OCUPADA do pool, e só. Isso trata
 * as linhas como se fossem intercambiáveis, e elas não são: cada uma vem de um
 * servidor com acervo PRÓPRIO. O assinante clicava num canal, era mandado para
 * a linha mais vazia — que podia ser de um servidor que nem tem aquele canal —
 * e recebia 404.
 *
 * Do ponto de vista do pool estava tudo certo: linha ativa, vaga livre, sessão
 * registrada. Por isso o sintoma chegava como "clicou e não roda" sem nada nos
 * logs.
 *
 * ------------------------------------------------------------------
 * A ORDEM CERTA
 * ------------------------------------------------------------------
 *   1. Quais servidores TÊM este conteúdo?        (ChannelSource)
 *   2. Desses, quais têm linha ativa e VAGA?      (IptvLine + sessões)
 *   3. Ordena: menos ocupado primeiro.
 *   4. Devolve TODAS as opções, não só a primeira — o player precisa da lista
 *      inteira para trocar de servidor sozinho quando um falha, sem uma nova
 *      ida ao servidor para descobrir a próxima.
 *
 * É o passo 1 que não existia, e é ele que faz o clique virar reprodução.
 */

export type FonteResolvida = {
  serverCode: string;
  /** URL já com a credencial do assinante, pronta para a proxy. */
  streamUrl: string;
  /** Ocupação atual do servidor, para diagnóstico no admin. */
  ocupacao: number;
  capacidade: number;
};

/** Considera ativa a sessão que bateu heartbeat nos últimos 45s. */
const JANELA_VIVA_MS = 45 * 1000;

/**
 * Fontes jogáveis para um conteúdo, na ordem em que devem ser tentadas.
 *
 * Devolve vazio quando NENHUM servidor que tem o conteúdo está com vaga — que
 * é diferente de "o conteúdo não existe", e o chamador deve dizer isso ao
 * assinante com essas palavras.
 */
export async function resolverFontes(
  channelId: string,
  viewer: { user: string; pass: string },
): Promise<FonteResolvida[]> {
  const limite = new Date(Date.now() - JANELA_VIVA_MS);

  const [fontes, linhas] = await Promise.all([
    prisma.channelSource.findMany({
      where: { channelId },
      select: { serverCode: true, streamUrl: true },
    }),
    prisma.iptvLine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        serverCode: true,
        maxScreens: true,
        sessions: {
          where: { isActive: true, lastSeenAt: { gte: limite } },
          select: { id: true },
        },
      },
    }),
  ]);

  if (fontes.length === 0) return [];

  /**
   * Capacidade AGREGADA por servidor.
   *
   * Um mesmo servidor pode ter várias linhas contratadas — é assim que se
   * ganha escala sem trocar de provedor. O que importa para o roteamento é a
   * soma: 3 linhas de 2 telas no C1 são 6 telas no C1.
   */
  const porServidor = new Map<string, { ocupacao: number; capacidade: number }>();
  for (const linha of linhas) {
    const atual = porServidor.get(linha.serverCode) ?? { ocupacao: 0, capacidade: 0 };
    atual.ocupacao += linha.sessions.length;
    atual.capacidade += linha.maxScreens;
    porServidor.set(linha.serverCode, atual);
  }

  const candidatas: FonteResolvida[] = [];

  for (const fonte of fontes) {
    const servidor = porServidor.get(fonte.serverCode);
    // Servidor sem linha ativa não é opção, por mais que tenha o conteúdo.
    if (!servidor) continue;

    /**
     * A credencial é reescrita POR SERVIDOR.
     *
     * O user/senha do assinante vale num painel específico. Mandar a
     * credencial do C1 para o C2 devolve 401 mesmo com o conteúdo existindo
     * lá — e o sintoma é idêntico ao de conteúdo ausente, o que torna o
     * defeito difícil de atribuir.
     */
    const comCredencial = reescreverCredencial(fonte.streamUrl, viewer);
    if (!comCredencial) continue;

    candidatas.push({
      serverCode: fonte.serverCode,
      streamUrl: comCredencial,
      ocupacao: servidor.ocupacao,
      capacidade: servidor.capacidade,
    });
  }

  /**
   * Servidor lotado vai para o FIM, não para fora.
   *
   * A contagem de sessões é uma foto de um instante atrás: uma sessão pode ter
   * acabado de encerrar. Descartar o servidor cheio transforma um talvez em
   * um não definitivo — e num pool pequeno isso é a diferença entre abrir e
   * mostrar erro. Como última opção ele ainda pode salvar a reprodução.
   */
  return candidatas.sort((a, b) => {
    const folgaA = a.capacidade - a.ocupacao;
    const folgaB = b.capacidade - b.ocupacao;
    if (folgaA > 0 !== folgaB > 0) return folgaA > 0 ? -1 : 1;
    return folgaB - folgaA;
  });
}

/**
 * Quantos servidores têm cada conteúdo — leitura para o painel.
 *
 * Um canal com fonte única é conteúdo EXCLUSIVO daquele servidor: se a linha
 * dele cair, o canal some do catálogo inteiro. É o número que diz onde faz
 * sentido contratar redundância.
 */
export async function estatisticaDeCobertura() {
  const [totalCanais, comFonte, exclusivos] = await Promise.all([
    prisma.m3uChannel.count({ where: { isActive: true } }),
    prisma.channelSource.groupBy({ by: ["channelId"], _count: { channelId: true } }),
    prisma.$queryRaw<Array<{ serverCode: string; exclusivos: bigint }>>`
      SELECT s."serverCode", COUNT(*)::bigint AS exclusivos
      FROM "ChannelSource" s
      WHERE s."channelId" IN (
        SELECT "channelId" FROM "ChannelSource"
        GROUP BY "channelId" HAVING COUNT(*) = 1
      )
      GROUP BY s."serverCode"
      ORDER BY exclusivos DESC
    `,
  ]);

  return {
    totalCanais,
    canaisComFonte: comFonte.length,
    /** Conteúdo que existe em um servidor só, agrupado por servidor. */
    exclusivosPorServidor: exclusivos.map((e) => ({
      serverCode: e.serverCode,
      exclusivos: Number(e.exclusivos),
    })),
    /** Canal sem nenhuma fonte é inalcançável — sintoma de sync incompleta. */
    canaisSemFonte: Math.max(0, totalCanais - comFonte.length),
  };
}
