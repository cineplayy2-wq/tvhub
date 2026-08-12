import "server-only";

import { prisma } from "@/lib/prisma";

export type ParCredencial = { user: string; pass: string };

const CACHE_MS = 5 * 60 * 1000;
let paresEmCache: { ate: number; pares: ParCredencial[] } | null = null;

function parDaUrl(url: string | null | undefined): ParCredencial | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const user = parsed.searchParams.get("username");
    const pass = parsed.searchParams.get("password");
    if (user && pass) return { user, pass };
  } catch {}

  const caminho = url.match(
    /https?:\/\/[^/]+\/(?:movie\/|series\/|live\/)?([^/]+)\/([^/]+)\//i,
  );
  if (caminho?.[1] && caminho[2]) {
    return { user: caminho[1], pass: caminho[2] };
  }
  return null;
}

function chave(p: ParCredencial) {
  return `${p.user}\0${p.pass}`;
}

/**
 * Pares user/senha que aparecem nas URLs do catálogo.
 *
 * São estes que o proxy troca pela linha do assinante. Sem a lista, não dá
 * para saber o que substituir — o acervo mistura a lista principal e a de
 * backup, cada uma com a própria conta.
 */
export async function paresDoCatalogo(): Promise<ParCredencial[]> {
  if (paresEmCache && paresEmCache.ate > Date.now()) return paresEmCache.pares;

  const playlist = await prisma.m3uPlaylist.findFirst({
    where: { isSystem: true },
    select: {
      sourceUrl: true,
      backupSourceUrl: true,
      xtreamUsername: true,
      xtreamPassword: true,
      backupXtreamUsername: true,
      backupXtreamPassword: true,
    },
  });

  const vistos = new Map<string, ParCredencial>();
  const meter = (p: ParCredencial | null) => {
    if (!p?.user || !p?.pass) return;
    vistos.set(chave(p), p);
  };

  if (playlist) {
    meter(parDaUrl(playlist.sourceUrl));
    meter(parDaUrl(playlist.backupSourceUrl));
    if (playlist.xtreamUsername && playlist.xtreamPassword) {
      meter({ user: playlist.xtreamUsername, pass: playlist.xtreamPassword });
    }
    if (playlist.backupXtreamUsername && playlist.backupXtreamPassword) {
      meter({
        user: playlist.backupXtreamUsername,
        pass: playlist.backupXtreamPassword,
      });
    }
  }

  // Amostras reais do acervo: a união da secundária traz contas que não
  // estão na URL da playlist.
  const amostras = await prisma.$queryRaw<Array<{ url: string }>>`
    (
      SELECT "streamUrl" AS url FROM "M3uChannel"
       WHERE "isActive" AND "streamUrl" LIKE '%/movie/%' LIMIT 1
    )
    UNION ALL
    (
      SELECT "streamUrl" AS url FROM "M3uChannel"
       WHERE "isActive" AND "streamUrl" LIKE '%/series/%' LIMIT 1
    )
    UNION ALL
    (
      SELECT "streamUrl" AS url FROM "M3uChannel"
       WHERE "isActive"
         AND "streamUrl" NOT LIKE '%/movie/%'
         AND "streamUrl" NOT LIKE '%/series/%' LIMIT 1
    )
  `;
  for (const linha of amostras) meter(parDaUrl(linha.url));

  const pares = Array.from(vistos.values());
  paresEmCache = { ate: Date.now() + CACHE_MS, pares };
  return pares;
}

export function invalidarParesDoCatalogo() {
  paresEmCache = null;
}

/**
 * Troca as contas do catálogo pela linha deste assinante.
 *
 * Cobre os dois jeitos que o provedor escreve URL:
 *   /username/password/id.ts
 *   /movie/username/password/id.mp4
 *   ?username=&password=
 *
 * Se o assinante não tem linha própria, devolve a URL intacta — o play
 * continua, mas compartilha as 2 conexões da conta do catálogo.
 */
export function reescreverCredencial(
  url: string,
  viewer: ParCredencial | null,
  catalogo: ParCredencial[],
): string {
  if (!viewer?.user || !viewer?.pass || catalogo.length === 0) return url;
  if (catalogo.some((p) => p.user === viewer.user && p.pass === viewer.pass)) {
    return url;
  }

  let saida = url;
  for (const par of catalogo) {
    const dePath = `/${par.user}/${par.pass}/`;
    const paraPath = `/${viewer.user}/${viewer.pass}/`;
    if (saida.includes(dePath)) saida = saida.split(dePath).join(paraPath);

    saida = saida
      .replaceAll(`username=${encodeURIComponent(par.user)}`, `username=${encodeURIComponent(viewer.user)}`)
      .replaceAll(`password=${encodeURIComponent(par.pass)}`, `password=${encodeURIComponent(viewer.pass)}`)
      .replaceAll(`username=${par.user}`, `username=${viewer.user}`)
      .replaceAll(`password=${par.pass}`, `password=${viewer.pass}`);
  }
  return saida;
}

export async function credencialDoUsuario(userId: string): Promise<ParCredencial | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { iptvUsername: true, iptvPassword: true },
  });
  if (!user?.iptvUsername || !user?.iptvPassword) return null;
  return { user: user.iptvUsername, pass: user.iptvPassword };
}
