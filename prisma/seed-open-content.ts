import { ContentStatus, ContentType, PrismaClient, VideoStatus } from "@prisma/client";

import { OPEN_CATALOG, type OpenTitle } from "./open-catalog";
import { resolveCommonsMedia } from "../lib/commons";

const prisma = new PrismaClient();

/**
 * Abastece o catálogo com conteúdo legalmente redistribuível.
 *
 * Nada é hospedado na nossa VPS: guardamos só a URL e o navegador do
 * assinante busca direto no CDN de origem. Zero disco e zero banda nossa.
 *
 * Para itens do Commons o importador resolve por API a fonte LEVE (derivada
 * transcodificada), a CAPA (quadro do próprio filme) e a LICENÇA — e recusa
 * o que não for domínio público ou Creative Commons.
 *
 * Uso:  npm run db:seed:open
 */

async function checkDirectUrl(item: OpenTitle) {
  if (!item.sourceUrl) return null;
  try {
    const response = await fetch(item.sourceUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok && response.status !== 206) return null;
    const mime = response.headers.get("content-type") ?? "";
    return {
      src: item.sourceUrl,
      posterUrl: null,
      backdropUrl: null,
      durationSeconds: item.durationSeconds ?? null,
      license: item.license ?? "não declarada",
      browserPlayable: /webm|mp4/i.test(mime),
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log(`🎬 Resolvendo ${OPEN_CATALOG.length} fontes...\n`);

  const published: string[] = [];
  const blocked: string[] = [];

  for (const item of OPEN_CATALOG) {
    let src: string | null = null;
    let posterUrl: string | null = null;
    let backdropUrl: string | null = null;
    let duration: number | null = item.durationSeconds ?? null;
    let license = item.license ?? "não verificada";
    const reasons: string[] = [];

    if (item.commonsFile) {
      const media = await resolveCommonsMedia(item.commonsFile);
      if (!media) {
        reasons.push("não resolveu no Commons ou licença recusada");
      } else {
        src = media.src;
        posterUrl = media.posterUrl;
        backdropUrl = media.backdropUrl;
        duration = media.durationSeconds ?? duration;
        license = media.license;
        // Sem derivada, sobra o original de arquivamento — que pode ter
        // gigabytes e simplesmente não inicia no navegador do assinante.
        if (media.usingOriginal && media.originalBytes > 400_000_000) {
          reasons.push(
            `só há o original (${Math.round(media.originalBytes / 1e6)} MB), pesado demais`,
          );
        }
      }
    } else {
      const direct = await checkDirectUrl(item);
      if (!direct) reasons.push("fonte fora do ar");
      else {
        src = direct.src;
        license = direct.license;
        if (!direct.browserPlayable) reasons.push("formato exige transcodificação");
      }
    }

    if (item.needsSubtitlesPtBr !== false) reasons.push("sem legenda pt-BR");

    const ok = reasons.length === 0 && src !== null;

    const tags = [license];
    if (item.attribution) tags.push(item.attribution);
    for (const reason of reasons) tags.push(`PENDENTE: ${reason}`);

    try {
      await prisma.title.upsert({
        where: { slug: item.slug },
        update: {
          videoUrl: src,
          posterUrl,
          backdropUrl,
          durationSeconds: duration,
          videoStatus: ok ? VideoStatus.READY : VideoStatus.PENDING,
          status: ok ? ContentStatus.PUBLISHED : ContentStatus.DRAFT,
          tags,
        },
        create: {
          slug: item.slug,
          name: item.name,
          originalName: item.originalName ?? null,
          synopsis: item.synopsis,
          type: ContentType.MOVIE,
          status: ok ? ContentStatus.PUBLISHED : ContentStatus.DRAFT,
          releaseYear: item.year,
          director: item.director,
          country: item.country,
          durationSeconds: duration,
          ageRating: item.ageRating,
          tags,
          posterUrl,
          backdropUrl,
          // Curtas de animação são candidatos ruins a Hero; longa com arte, bom
          isFeatured: Boolean(backdropUrl) && (duration ?? 0) > 1800,
          videoProvider: "EXTERNAL",
          videoUrl: src,
          videoStatus: ok ? VideoStatus.READY : VideoStatus.PENDING,
          publishedAt: ok ? new Date() : null,
          genres: { connect: item.genres.map((slug) => ({ slug })) },
        },
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .slice(0, 6)
              .join(" | ")
          : String(error);
      console.error(`  ✗ ${item.name}: ${detail}`);
      continue;
    }

    if (ok) {
      published.push(item.name);
      console.log(
        `  ✓ ${item.name} (${item.year}) · ${license} · ${
          duration ? `${Math.round(duration / 60)}min` : "?"
        } · capa: ${posterUrl ? "sim" : "não"}`,
      );
    } else {
      blocked.push(item.name);
      console.log(`  ⚠ ${item.name} (${item.year}) → rascunho · ${reasons.join(", ")}`);
    }
  }

  console.log(
    `\n✅ ${published.length} publicados · ${blocked.length} em rascunho · ${OPEN_CATALOG.length} avaliados`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
