import { Suspense } from "react";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/iptv/back-button";
import { IptvPlayer } from "@/components/iptv/iptv-player";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { getChannelById } from "@/lib/queries/iptv";
import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, slugify } from "@/lib/utils";

import { DetalhesDoConteudo, DetalhesEsqueleto } from "./detalhes";

export const dynamic = "force-dynamic";

/**
 * Página de reprodução.
 *
 * Regra desta tela: NADA que não seja necessário para o primeiro quadro pode
 * ficar na frente do player. A versão anterior resolvia capa, sinopse, elenco e
 * a lista de relacionados antes de renderizar — incluindo duas chamadas
 * sequenciais ao TMDB pela internet. Quem clicava num canal esperava metadado
 * que não tinha pedido para o vídeo sequer aparecer na página.
 *
 * Agora só o essencial é aguardado: o canal e a posição salva. O resto desce
 * por streaming atrás de um Suspense, com o vídeo já rodando.
 */
export default async function WatchChannelPage({
  params,
}: {
  params: { channelId: string };
}) {
  const user = await requireUser();

  // Independentes: vão em paralelo em vez de uma esperar a outra.
  const [activeProfile, canalDireto] = await Promise.all([
    getActiveProfile(user.id),
    getChannelById(params.channelId),
  ]);

  let channel = canalDireto;

  if (!channel) {
    const userPlaylist = await prisma.m3uPlaylist.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (userPlaylist) {
      const fallbackChannel = await prisma.m3uChannel.findFirst({
        where: { playlistId: userPlaylist.id, isActive: true },
        include: {
          group: { select: { id: true, name: true, slug: true, category: true } },
          playlist: { select: { id: true, userId: true } },
        },
        orderBy: { relevanceScore: "desc" },
      });
      if (fallbackChannel) channel = fallbackChannel;
    }
  }

  if (!channel || channel.playlist.userId !== user.id) {
    notFound();
  }

  // Onde o assinante parou. É rápido e precisa estar pronto antes do player,
  // senão o vídeo começa do zero e depois pula.
  let initialPosition = 0;
  if (activeProfile?.id) {
    try {
      const chave = slugify(cleanMediaTitle(channel.name));
      const salvo = await prisma.watchProgress.findFirst({
        where: { profileId: activeProfile.id, itemKey: chave },
        select: { positionSeconds: true, completed: true },
      });
      if (salvo && !salvo.completed && salvo.positionSeconds > 10) {
        initialPosition = salvo.positionSeconds;
      }
    } catch {}
  }

  const isVod =
    channel.group?.category === "movies" ||
    channel.group?.category === "series" ||
    /\.(mp4|mkv|avi|webm)/i.test(channel.streamUrl) ||
    channel.streamUrl.includes("/movie/") ||
    channel.streamUrl.includes("/series/");

  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="absolute left-4 top-4 z-40">
        <BackButton
          fallbackHref={channel.group ? `/tv/${channel.group.slug}` : "/tv"}
        />
      </div>

      <div className="relative aspect-video w-full bg-black shadow-2xl">
        <IptvPlayer
          streamUrl={channel.streamUrl}
          channelName={channel.name}
          channelId={channel.id}
          isLive={!isVod}
          alternativeStreams={channel.backupStreamUrl ? [channel.backupStreamUrl] : []}
          initialPosition={initialPosition}
        />
      </div>

      <div className="relative bg-background px-4 py-6 md:px-8">
        <Suspense fallback={<DetalhesEsqueleto nome={channel.name} />}>
          <DetalhesDoConteudo
            channelId={channel.id}
            playlistId={channel.playlist.id}
            nome={channel.name}
            logoUrl={channel.logoUrl}
            quality={channel.quality}
            isFavorite={channel.isFavorite}
            group={channel.group}
            isVod={isVod}
          />
        </Suspense>
      </div>
    </div>
  );
}
