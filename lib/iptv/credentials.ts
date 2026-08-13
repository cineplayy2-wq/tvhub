import "server-only";

import { prisma } from "@/lib/prisma";

export type ParCredencial = { user: string; pass: string };

const CACHE_MS = 5 * 60 * 1000;
let paresEmCache: { ate: number; pares: ParCredencial[] } | null = null;

/**
 * User/senha no caminho Xtream:
 *   /user/pass/id.ts
 *   /movie/user/pass/id.mp4
 *   /series/user/pass/id.mp4
 *   /live/user/pass/id.ts
 */
const CAMINHO_XTREAM =
  /^(https?:\/\/[^/?#]+)\/(?:(movie|series|live)\/)?([^/]+)\/([^/]+)\/(.+)$/i;

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
  if (caminho?.[1] && caminho?.[2]) {
    return { user: caminho[1], pass: caminho[2] };
  }
  return null;
}

function chave(p: ParCredencial) {
  return `${p.user}\0${p.pass}`;
}

/**
 * Pares user/senha que aparecem no catálogo (lista principal + backup).
 *
 * Servem para saber se a linha do assinante É uma das contas da importação
 * (usuário de teste / dono técnico). Nesse caso o play não reescreve a URL:
 * o acervo mistura dois painéis, e forçar a senha de um no outro devolve 404.
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

export function eContaDoCatalogo(
  viewer: ParCredencial,
  catalogo: ParCredencial[],
): boolean {
  return catalogo.some((p) => p.user === viewer.user && p.pass === viewer.pass);
}

/**
 * Troca a conta que está na URL pela linha DESTE assinante.
 *
 * Só para cliente com linha PRÓPRIA (não a da importação). Sem linha o
 * chamador recusa o play.
 */
export function reescreverCredencial(
  url: string,
  viewer: ParCredencial,
): string | null {
  if (!viewer.user || !viewer.pass) return null;

  const naQuery = parDaUrl(url);
  if (naQuery && url.includes("username=")) {
    try {
      const parsed = new URL(url);
      if (parsed.searchParams.has("username") && parsed.searchParams.has("password")) {
        parsed.searchParams.set("username", viewer.user);
        parsed.searchParams.set("password", viewer.pass);
        return parsed.toString();
      }
    } catch {
      return null;
    }
  }

  const regex = new RegExp(CAMINHO_XTREAM.source, CAMINHO_XTREAM.flags);
  if (!regex.test(url)) return null;
  return url.replace(
    new RegExp(CAMINHO_XTREAM.source, CAMINHO_XTREAM.flags),
    (_match, origin: string, kind: string | undefined, _user: string, _pass: string, rest: string) => {
      const prefixo = kind ? `${kind}/` : "";
      return `${origin}/${prefixo}${viewer.user}/${viewer.pass}/${rest}`;
    },
  );
}

/** Extrai user/senha de uma URL de playlist (query ou caminho Xtream). */
function parDaPlaylist(playlist: {
  xtreamUsername: string | null;
  xtreamPassword: string | null;
  sourceUrl: string | null;
  backupSourceUrl: string | null;
}): ParCredencial | null {
  if (playlist.xtreamUsername && playlist.xtreamPassword) {
    return { user: playlist.xtreamUsername, pass: playlist.xtreamPassword };
  }
  for (const url of [playlist.sourceUrl, playlist.backupSourceUrl]) {
    if (!url) continue;
    const par = parDaUrl(url);
    if (par) return par;
  }
  return null;
}

/**
 * A linha que este assinante usa para tocar.
 *
 * Ordem: a linha própria do cliente primeiro; o catálogo do sistema só como
 * rede de segurança.
 *
 * ------------------------------------------------------------------------
 * POR QUE EXISTE A REDE DE SEGURANÇA
 * ------------------------------------------------------------------------
 * A linha por cliente entrou junto com o catálogo compartilhado, e o backfill
 * da migration `20260812233000_iptv_credencial_por_cliente` só alcança quem
 * é DONO de uma M3uPlaylist (`WHERE p.userId = u.id`). No modelo
 * compartilhado existe uma playlist só, marcada `isSystem`, e o dono dela é
 * uma conta técnica — então todo assinante comum ficou com `iptvUsername`
 * nulo e passou a receber 403 em TODA reprodução. Foi o "quebrou pra todo
 * mundo": o catálogo aparece, nada toca.
 *
 * Sem esta função, restaurar o serviço exigiria cadastrar a linha de cada
 * cliente à mão antes de qualquer um conseguir assistir.
 *
 * O CUSTO É REAL e precisa ser dito: assinantes sem linha própria voltam a
 * dividir a conta da importação, e o provedor limita 2 conexões por conta —
 * o terceiro a assistir simultaneamente cai. É exatamente o comportamento de
 * antes desta série de commits, nem melhor nem pior, e é estritamente melhor
 * do que ninguém conseguir assistir.
 *
 * O caminho para sair disso não é código: é cadastrar a linha de cada cliente
 * em Admin → IPTV. Conforme forem cadastradas, cada um passa a usar a sua e
 * sai do rateio sozinho — esta função prefere a linha própria sempre que ela
 * existir.
 */
export async function credencialDoUsuario(
  userId: string,
): Promise<ParCredencial | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { iptvUsername: true, iptvPassword: true },
  });

  if (user?.iptvUsername && user?.iptvPassword) {
    return { user: user.iptvUsername, pass: user.iptvPassword };
  }

  const catalogo = await prisma.m3uPlaylist.findFirst({
    where: { isSystem: true },
    select: {
      xtreamUsername: true,
      xtreamPassword: true,
      sourceUrl: true,
      backupSourceUrl: true,
    },
  });

  return catalogo ? parDaPlaylist(catalogo) : null;
}
