import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  TmdbNotConfiguredError,
  getTmdbDetails,
  isTmdbConfigured,
  searchTmdb,
  tmdbImage,
} from "@/lib/tmdb/client";
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";

/**
 * Busca e importação de metadados do TMDB para o painel admin.
 *
 * /api não passa pelo middleware (está fora do matcher), então a autorização
 * precisa acontecer aqui dentro.
 */

/** Certificação brasileira do TMDB → enum AgeRating do schema. */
const RATING_MAP: Record<string, string> = {
  L: "L",
  "10": "TEN",
  "12": "TWELVE",
  "14": "FOURTEEN",
  "16": "SIXTEEN",
  "18": "EIGHTEEN",
};

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  if (!isTmdbConfigured()) {
    return NextResponse.json(
      { error: "TMDB_API_KEY não configurada no servidor." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const tmdbId = searchParams.get("id");
  const mediaType = searchParams.get("type") === "tv" ? "tv" : "movie";

  // O TMDB limita por IP: se um admin segurar a tecla na busca, quem toma
  // 429 é o servidor inteiro, não a aba dele.
  const limit = await rateLimit("tmdb", session.user.id, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Muitas buscas seguidas. Aguarde um instante." },
      { status: 429 },
    );
  }

  try {
    // --- Detalhe: devolve já no formato do formulário de título ---
    if (tmdbId) {
      const details = await getTmdbDetails(Number(tmdbId), mediaType);

      return NextResponse.json({
        tmdbId: details.tmdbId,
        name: details.name,
        originalName: details.originalName,
        slug: slugify(details.name),
        synopsis: details.overview,
        type: details.mediaType === "tv" ? "SERIES" : "MOVIE",
        releaseYear: details.releaseYear,
        durationSeconds: details.runtimeSeconds,
        director: details.director,
        cast: details.cast,
        country: details.country,
        tmdbRating: details.rating,
        // Arte do TMDB entra como sugestão; o admin substitui pela definitiva
        posterUrl: tmdbImage(details.posterPath, "w500"),
        backdropUrl: tmdbImage(details.backdropPath, "w1280"),
        // Sem certificação brasileira no TMDB, o padrão é o mais restritivo:
        // errar para o lado permissivo exibiria conteúdo adulto em perfil infantil
        ageRating: details.brazilianRating
          ? (RATING_MAP[details.brazilianRating] ?? "EIGHTEEN")
          : "EIGHTEEN",
        tmdbGenres: details.genres,
      });
    }

    // --- Busca ---
    if (query) {
      const results = await searchTmdb(query);
      return NextResponse.json({
        results: results.map((item) => ({
          ...item,
          posterUrl: tmdbImage(item.posterPath, "w342"),
        })),
      });
    }

    return NextResponse.json({ error: "Informe q ou id." }, { status: 400 });
  } catch (error) {
    if (error instanceof TmdbNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[tmdb] falha:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Não foi possível consultar o TMDB." },
      { status: 502 },
    );
  }
}
