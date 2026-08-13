import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";

import { BackButton } from "@/components/iptv/back-button";
import { IptvPlayer } from "@/components/iptv/iptv-player";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { getChannelById, getSeriesEpisodes } from "@/lib/queries/iptv";
import { isAdultContent } from "@/lib/iptv/category-detector";
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

  const isAdult =
    channel.group?.category === "adult" ||
    isAdultContent(channel.name, channel.group?.name || "");

  if (isAdult && activeProfile?.isKids) {
    redirect("/tv/kids");
  }

  // Módulo Adulto bloqueado por padrão (necessita contratação ou permissão de administrador)
  const hasAdultUnlocked = user.role === "ADMIN" || (user as any).hasAdultAddon === true;

  if (isAdult && !hasAdultUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-rose-500/10 border border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.25)]">
          <Lock className="h-12 w-12 text-rose-500" />
          <span className="absolute -top-2 -right-2 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold text-white uppercase">
            +18
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-white">Módulo Adulto Bloqueado</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          Este canal ou conteúdo faz parte do <span className="text-rose-400 font-semibold">Módulo Adulto 18+</span>, contratado separadamente. Para liberar o catálogo completo, adicione o pacote à sua assinatura.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/admin/planos"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            Adquirir Módulo Adulto
          </Link>
          <Link
            href="/tv"
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
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

  let seriesEpisodes: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
    isWatched?: boolean;
    season?: number;
    episodeNum?: number;
  }> = [];

  if (channel.group?.category === "series" || channel.streamUrl.includes("/series/")) {
    try {
      const allEps = await getSeriesEpisodes(channel.playlist.id, channel.name);
      if (allEps.length > 1) {
        let watchedKeys = new Set<string>();
        if (activeProfile?.id) {
          const progresses = await prisma.watchProgress.findMany({
            where: {
              profileId: activeProfile.id,
              OR: allEps.map((ep) => ({ itemKey: slugify(cleanMediaTitle(ep.name)) })),
            },
            select: { itemKey: true, completed: true, positionSeconds: true },
          });
          watchedKeys = new Set(
            progresses
              .filter((p) => p.completed || p.positionSeconds > 120)
              .map((p) => p.itemKey),
          );
        }

        seriesEpisodes = allEps.map((ep) => {
          const match =
            ep.name.match(/(?:S|T)(\d+)\s*(?:E|X)(\d+)/i) ||
            ep.name.match(/EP?\s*\.?\s*(\d+)/i);
          const season = match && match[2] ? Number.parseInt(match[1], 10) : 1;
          const episodeNum = match ? Number.parseInt(match[2] || match[1], 10) : 1;
          const key = slugify(cleanMediaTitle(ep.name));

          return {
            id: ep.id,
            name: ep.name,
            isCurrent: ep.id === channel.id,
            isWatched: watchedKeys.has(key),
            season,
            episodeNum,
          };
        });
      }
    } catch (err) {
      console.warn("[Series episodes load]", err);
    }
  }

  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="absolute left-4 top-4 z-40">
        {/* Antes isto era um Link para `/tv/${channel.group.slug}`: quem
            chegava num filme pela Home era despejado na categoria do filme,
            uma tela onde nunca esteve. O botão agora volta no histórico, que é
            o que preserva a aba, o filtro e a posição da rolagem. */}
        <BackButton />
      </div>

      <div className="relative aspect-video w-full bg-black shadow-2xl">
        <IptvPlayer
          streamUrl={channel.streamUrl}
          channelName={channel.name}
          channelId={channel.id}
          isLive={!isVod}
          alternativeStreams={channel.backupStreamUrl ? [channel.backupStreamUrl] : []}
          initialPosition={initialPosition}
          episodes={seriesEpisodes}
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
