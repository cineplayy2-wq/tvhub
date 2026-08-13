import "server-only";

import { prisma } from "@/lib/prisma";

export type ParCredencial = { user: string; pass: string };

/**
 * User/senha no caminho Xtream:
 *   /user/pass/id.ts
 *   /movie/user/pass/id.mp4
 *   /series/user/pass/id.mp4
 *   /live/user/pass/id.ts
 */
const CAMINHO_XTREAM =
  /^(https?:\/\/[^/?#]+)\/(?:(movie|series|live)\/)?([^/]+)\/([^/]+)\/(.+)$/i;

function parDaQuery(url: string): ParCredencial | null {
  try {
    const parsed = new URL(url);
    const user = parsed.searchParams.get("username");
    const pass = parsed.searchParams.get("password");
    if (user && pass) return { user, pass };
  } catch {}
  return null;
}

/**
 * Troca a conta que está na URL pela linha DESTE assinante.
 *
 * Sem linha, não reescreve — o chamador recusa o play. Nunca devolve a
 * URL do catálogo intacta: isso faria todo mundo estourar as 2 conexões
 * da conta usada na importação.
 */
export function reescreverCredencial(
  url: string,
  viewer: ParCredencial,
): string | null {
  if (!viewer.user || !viewer.pass) return null;

  const naQuery = parDaQuery(url);
  if (naQuery) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("username", viewer.user);
      parsed.searchParams.set("password", viewer.pass);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  if (!CAMINHO_XTREAM.test(url)) return null;
  return url.replace(
    CAMINHO_XTREAM,
    (_match, origin: string, kind: string | undefined, _user: string, _pass: string, rest: string) => {
      const prefixo = kind ? `${kind}/` : "";
      return `${origin}/${prefixo}${viewer.user}/${viewer.pass}/${rest}`;
    },
  );
}

export async function credencialDoUsuario(
  userId: string,
): Promise<ParCredencial | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { iptvUsername: true, iptvPassword: true },
  });
  if (!user?.iptvUsername || !user?.iptvPassword) return null;
  return { user: user.iptvUsername, pass: user.iptvPassword };
}
