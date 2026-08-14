import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enrichChannelsWithTmdb, isTmdbConfigured } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

/**
 * Preenche a capa do que ainda está sem.
 *
 * O cruzamento com o TMDB não pode acontecer dentro da renderização: são
 * centenas de milhares de títulos e cada um é uma requisição externa. Se a
 * página esperasse por isso, ou ela demora, ou ela corta — e cortar era
 * exatamente o que deixava gênero inteiro sem arte, porque o corte caía sempre
 * nos mesmos itens do fim da lista.
 *
 * Aqui a busca sai do caminho crítico: a tela pinta primeiro, e depois o
 * navegador pede um lote. O resultado fica gravado no canal, então o trabalho
 * nunca é refeito e o catálogo se completa sozinho conforme é usado.
 *
 * Só VOD entra na varredura. Canal ao vivo tem logo próprio na M3U e não tem
 * pôster no TMDB — buscar por ele é gastar cota para não achar nada.
 */

/** Itens por chamada. Baixo de propósito: é trabalho de fundo, não urgência. */
const LOTE = 20;

export async function POST() {
  const user = await requireUser();

  if (!isTmdbConfigured()) {
    return NextResponse.json({ processados: 0, restantes: 0, motivo: "tmdb-off" });
  }

  const playlist = await prisma.m3uPlaylist.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!playlist) {
    return NextResponse.json({ processados: 0, restantes: 0 });
  }

  const pendentesWhere: Prisma.M3uChannelWhereInput = {
    playlistId: playlist.id,
    isActive: true,
    tmdbSyncedAt: null,
    group: { isHidden: false, category: { in: ["movies", "series"] } },
    OR: [
      { streamUrl: { contains: "/movie/" } },
      { streamUrl: { contains: "/series/" } },
      { streamUrl: { endsWith: ".mp4" } },
      { streamUrl: { endsWith: ".mkv" } },
    ],
  };

  // Os sem logo vêm primeiro: são os que aparecem como buraco na grade.
  const pendentes = await prisma.m3uChannel.findMany({
    where: pendentesWhere,
    take: LOTE,
    orderBy: [{ logoUrl: { sort: "asc", nulls: "first" } }, { relevanceScore: "desc" }],
    select: {
      id: true,
      name: true,
      logoUrl: true,
      tmdbPosterUrl: true,
      tmdbBackdropUrl: true,
      tmdbRating: true,
      tmdbYear: true,
      tmdbOverview: true,
      tmdbSyncedAt: true,
    },
  });

  if (pendentes.length === 0) {
    return NextResponse.json({ processados: 0, restantes: 0 });
  }

  // O próprio enriquecimento grava o resultado em cada canal.
  await enrichChannelsWithTmdb(pendentes, LOTE);

  const restantes = await prisma.m3uChannel.count({ where: pendentesWhere });

  return NextResponse.json({ processados: pendentes.length, restantes });
}
