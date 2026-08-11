import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { VideoPlayer } from "@/components/player/video-player";
import { prisma } from "@/lib/prisma";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { AGE_RATING_ORDER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Assistir",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Player.
 *
 * A rota recebe o SLUG do título (o nome do parâmetro é [id] por herança da
 * estrutura de pastas). O episódio opcional vem em ?ep=.
 *
 * TODO(Passo 6): antes de liberar a fonte, registrar a sessão no Redis e
 * recusar quando a conta já estiver com 2 telas ativas.
 */
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ep?: string };
}) {
  const user = await requireUser();
  const profile = await requireProfile(user.id);

  const title = await prisma.title.findFirst({
    where: { slug: params.id, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      ageRating: true,
      videoUrl: true,
      videoStatus: true,
    },
  });

  if (!title) notFound();

  // Classificação verificada AQUI também, não só na listagem: o link direto
  // para o player é o caminho mais óbvio para contornar o filtro do perfil.
  const allowedIndex = AGE_RATING_ORDER.indexOf(profile.maxAgeRating);
  if (AGE_RATING_ORDER.indexOf(title.ageRating) > allowedIndex) {
    redirect("/inicio");
  }

  let source = title.videoUrl;
  let episodeId: string | null = null;
  let episodeLabel: string | null = null;

  if (title.type === "SERIES") {
    const episode = searchParams.ep
      ? await prisma.episode.findFirst({
          where: { id: searchParams.ep, titleId: title.id },
          select: {
            id: true,
            season: true,
            number: true,
            name: true,
            videoUrl: true,
            videoStatus: true,
          },
        })
      : await prisma.episode.findFirst({
          where: { titleId: title.id, videoStatus: "READY" },
          orderBy: [{ season: "asc" }, { number: "asc" }],
          select: {
            id: true,
            season: true,
            number: true,
            name: true,
            videoUrl: true,
            videoStatus: true,
          },
        });

    if (!episode || episode.videoStatus !== "READY" || !episode.videoUrl) {
      redirect(`/titulo/${title.slug}`);
    }

    source = episode.videoUrl;
    episodeId = episode.id;
    episodeLabel = `T${episode.season}:E${episode.number} · ${episode.name}`;
  } else if (title.videoStatus !== "READY" || !title.videoUrl) {
    // Sem vídeo pronto, devolve para o detalhe em vez de abrir player vazio
    redirect(`/titulo/${title.slug}`);
  }

  if (!source) redirect(`/titulo/${title.slug}`);

  const progress = await prisma.watchProgress.findUnique({
    where: {
      profileId_itemKey: {
        profileId: profile.id,
        itemKey: episodeId ?? title.id,
      },
    },
    select: { positionSeconds: true, completed: true },
  });

  // Título já concluído recomeça do zero: retomar nos créditos é pior que
  // recomeçar quando a pessoa escolheu assistir de novo.
  const startAt = progress && !progress.completed ? progress.positionSeconds : 0;

  return (
    <VideoPlayer
      src={source}
      titleName={title.name}
      titleId={title.id}
      episodeId={episodeId}
      episodeLabel={episodeLabel}
      startAtSeconds={startAt}
    />
  );
}
