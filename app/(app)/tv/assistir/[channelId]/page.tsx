import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";

import { BackButton } from "@/components/iptv/back-button";
import { IptvPlayer } from "@/components/iptv/iptv-player";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { credencialDoUsuario } from "@/lib/iptv/credentials";
import { resolverFontes, type FonteResolvida } from "@/lib/iptv/source-router";
import { getChannelById, getQualityVariants, getSeriesEpisodes } from "@/lib/queries/iptv";
import { isAdultContent } from "@/lib/iptv/category-detector";
import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, cleanSeriesTitle, slugify } from "@/lib/utils";

import { DetalhesDoConteudo, DetalhesEsqueleto } from "./detalhes";

export const dynamic = "force-dynamic";

/**
 * Página de reprodução.
 *
 * Regra desta tela: NADA que não seja necessário para o primeiro quadro pode
 * ficar na frente do player.
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

  const isAdult =
    channel.group?.category === "adult" ||
    isAdultContent(channel.name, channel.group?.name || "");

  if (isAdult && activeProfile?.isKids) {
    redirect("/tv/kids");
  }

  const hasAdultUnlocked = user.role === "ADMIN" || (user as { adultUnlocked?: boolean }).adultUnlocked === true;

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

  // Onde o assinante parou. É rápido e precisa estar pronto antes do player.
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

  /**
   * Quais servidores têm ESTE conteúdo, e em qual deles cabe mais um.
   *
   * Resolvido aqui, no servidor, antes de o player montar: assim o primeiro
   * clique já sai com o endereço certo e a lista de reservas pronta, sem
   * nenhuma ida extra à rede na hora de tocar. É o que faz "clicou, rodou".
   */
  const fontes: FonteResolvida[] = linhaIptv
    ? await resolverFontes(channel.id, linhaIptv).catch(() => [] as FonteResolvida[])
    : [];

  // Só canal ao vivo vem repetido por qualidade; filme e episódio são únicos.
  const qualidades = isVod
    ? []
    : await getQualityVariants(systemId || channel.playlist.id, channel.name, channel.streamUrl).catch(() => []);

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
        <BackButton />
      </div>

      <div className="relative aspect-video w-full bg-black shadow-2xl">
        {linhaIptv ? (
          <IptvPlayer
            /*
             * A primeira fonte é a do servidor que TEM o conteúdo e está com
             * mais folga — não a URL gravada no canal.
             *
             * O endereço em `channel.streamUrl` é o do servidor onde o item
             * foi visto primeiro. Com várias linhas de servidores diferentes,
             * insistir nele manda o assinante para um painel que pode estar
             * lotado, ou que nem tem mais aquele conteúdo. O roteador resolve
             * isso antes de o player existir (ver lib/iptv/source-router.ts).
             *
             * Se o roteador não achar nada (catálogo ainda sem fontes, logo
             * após o deploy), cai na URL do canal — que é o comportamento
             * anterior e continua funcionando.
             */
            streamUrl={fontes[0]?.streamUrl ?? channel.streamUrl}
            channelName={channel.name}
            channelId={channel.id}
            isLive={!isVod}
            /*
             * TODAS as outras fontes vão junto, já com a credencial certa de
             * cada servidor. É o que permite o player trocar de servidor
             * sozinho quando um falha, sem uma nova ida ao banco — e é o que
             * transforma "clicou e não rodou" em "clicou e rodou pela segunda
             * fonte, sem a pessoa perceber".
             */
            alternativeStreams={[
              ...fontes.slice(1).map((f) => f.streamUrl),
              ...(channel.backupStreamUrl ? [channel.backupStreamUrl] : []),
            ]}
            qualidades={qualidades}
            initialPosition={initialPosition}
            episodes={seriesEpisodes}
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
