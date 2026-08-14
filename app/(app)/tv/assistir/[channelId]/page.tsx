import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

import { IptvPlayer } from "@/components/iptv/iptv-player";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { credencialDoUsuario } from "@/lib/iptv/credentials";
import { getChannelById, getQualityVariants } from "@/lib/queries/iptv";
import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, cleanSeriesTitle, slugify } from "@/lib/utils";

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
  const [activeProfile, canalDireto, linhaIptv] = await Promise.all([
    getActiveProfile(user.id),
    getChannelById(params.channelId),
    credencialDoUsuario(user.id),
  ]);

  let channel = canalDireto;

  // Catálogo compartilhado: qualquer assinante autenticado pode assistir.
  // A checagem antiga exigia channel.playlist.userId === user.id e quebrava
  // para todo mundo que não fosse o dono técnico da playlist do sistema.
  if (!channel) {
    const systemPlaylist = await prisma.m3uPlaylist.findFirst({
      where: { isSystem: true },
      select: { id: true },
    });

    if (systemPlaylist) {
      const fallbackChannel = await prisma.m3uChannel.findFirst({
        where: { playlistId: systemPlaylist.id, isActive: true },
        include: {
          group: { select: { id: true, name: true, slug: true, category: true } },
          playlist: { select: { id: true, userId: true, isSystem: true } },
        },
        orderBy: { relevanceScore: "desc" },
      });
      if (fallbackChannel) channel = fallbackChannel;
    }
  }

  if (!channel) {
    notFound();
  }

  // Catálogo compartilhado: qualquer assinante autenticado assiste.
  // A checagem antiga (playlist.userId === user.id) 404 em todo mundo que
  // não fosse o dono técnico da lista — e o player simplesmente não abria.
  const systemId =
    channel.playlist.isSystem
      ? channel.playlist.id
      : (
          await prisma.m3uPlaylist.findFirst({
            where: { isSystem: true },
            select: { id: true },
          })
        )?.id;

  if (channel.playlistId !== systemId && channel.playlist.userId !== user.id) {
    notFound();
  }

  let isFavorite = false;
  if (activeProfile?.id) {
    const fav = await prisma.channelFavorite.findUnique({
      where: {
        profileId_channelId: {
          profileId: activeProfile.id,
          channelId: channel.id,
        },
      },
      select: { id: true },
    });
    isFavorite = Boolean(fav);
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

  const isSeries =
    channel.group?.category === "series" ||
    channel.streamUrl.includes("/series/") ||
    /(?:S|T)\d+\s*(?:E|X)\d+/i.test(channel.name);

  const seriesNameClean = cleanSeriesTitle(channel.name);

  const isMovie =
    channel.group?.category === "movies" ||
    channel.streamUrl.includes("/movie/");

  const backHref = isSeries && seriesNameClean
    ? `/tv/serie/${encodeURIComponent(seriesNameClean)}`
    : isMovie
    ? "/tv/movies"
    : "/tv/live";

  const backLabel = isSeries
    ? "Episódios"
    : isMovie
    ? "Filmes"
    : "Canais";

  // Só canal ao vivo vem repetido por qualidade; filme e episódio são únicos.
  const qualidades = isVod
    ? []
    : await getQualityVariants(channel.playlist.id, channel.name).catch(() => []);

  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="absolute left-4 top-4 z-40">
        <Link
          href={backHref}
          aria-label="Voltar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 active:scale-95 shadow-lg border border-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="relative aspect-video w-full bg-black shadow-2xl">
        {linhaIptv ? (
          <IptvPlayer
            streamUrl={qualidades.length > 0 ? qualidades[0].streamUrl : channel.streamUrl}
            channelName={channel.name}
            channelId={channel.id}
            isLive={!isVod}
            alternativeStreams={channel.backupStreamUrl ? [channel.backupStreamUrl] : []}
            qualidades={qualidades}
            initialPosition={initialPosition}
          />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center">
            <div>
              <p className="text-base font-semibold text-foreground">
                Este cliente não tem linha IPTV
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Sem usuário e senha do provedor cadastrados para esta conta, o
                vídeo não abre — a conta da lista nunca é usada. O admin grava
                a linha em Admin → cliente → IPTV.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="relative bg-background px-4 py-6 md:px-8">
        <Suspense fallback={<DetalhesEsqueleto nome={channel.name} />}>
          <DetalhesDoConteudo
            channelId={channel.id}
            playlistId={channel.playlist.id}
            nome={channel.name}
            logoUrl={channel.logoUrl}
            quality={channel.quality}
            isFavorite={isFavorite}
            group={channel.group}
            isVod={isVod}
          />
        </Suspense>
      </div>
    </div>
  );
}
