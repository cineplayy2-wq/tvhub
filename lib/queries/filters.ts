import "server-only";

import { Prisma } from "@prisma/client";

import { cached, TTL } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

/**
 * Sistema de filtros do protótipo, ligado ao conteúdo REAL da lista.
 *
 * O protótipo trazia seis grupos com contagens fictícias (geradas por hash).
 * Aqui cada filtro precisa existir de fato no acervo, senão vira promessa
 * falsa: a pessoa toca em "Faroeste", não vem nada, e desiste do filtro.
 *
 * O que dá para fazer e o que não dá:
 *
 *  - Gênero, Origem, Destaques e Catálogo saem do NOME DO GRUPO da M3U, que é
 *    onde o provedor já classificou o conteúdo ("♦️ Terror", "♦️ Nacionais",
 *    "Prime Video"). São exatos e baratos de contar.
 *  - Ocasião é um apelido editorial sobre gênero — "Pra chorar" é Drama e
 *    Romance juntos. Não é dado novo, é atalho de linguagem.
 *  - DURAÇÃO FICOU DE FORA. Não existe nenhuma coluna de duração no banco e
 *    buscar no TMDB por 142 mil títulos a cada filtro é inviável. Filtro que
 *    não funciona é pior que filtro ausente.
 */

export type FilterOption = {
  /** Chave usada na URL. */
  id: string;
  label: string;
  /** Termos casados contra o nome do grupo. */
  terms: string[];
};

export type FilterGroup = {
  id: string;
  label: string;
  options: FilterOption[];
};

/**
 * Taxonomia derivada dos grupos que a lista realmente tem.
 * Ao trocar de provedor, é este arquivo que precisa ser revisto.
 */
export const FILTER_GROUPS: FilterGroup[] = [
  {
    id: "genero",
    label: "Gênero",
    options: [
      { id: "acao", label: "Ação", terms: ["ação", "acao"] },
      { id: "comedia", label: "Comédia", terms: ["comedia", "comédia"] },
      { id: "drama", label: "Drama", terms: ["drama"] },
      { id: "terror", label: "Terror", terms: ["terror"] },
      { id: "suspense", label: "Suspense", terms: ["suspense"] },
      { id: "romance", label: "Romance", terms: ["romance"] },
      { id: "ficcao", label: "Ficção científica", terms: ["ficcao", "ficção"] },
      { id: "fantasia", label: "Fantasia", terms: ["fantasia"] },
      { id: "crime", label: "Crime", terms: ["crime", "policial"] },
      { id: "animacao", label: "Animação", terms: ["animacao", "animação"] },
      { id: "documentario", label: "Documentário", terms: ["documentario", "documentário"] },
      { id: "faroeste", label: "Faroeste", terms: ["faroeste"] },
    ],
  },
  {
    id: "destaques",
    label: "Destaques",
    options: [
      { id: "lancamentos", label: "Lançamentos", terms: ["lançamento", "lancamento"] },
      { id: "quatrok", label: "4K e UHD", terms: ["4k", "uhd"] },
      { id: "natal", label: "Especial de Natal", terms: ["natal"] },
    ],
  },
  {
    id: "origem",
    label: "Origem",
    options: [
      { id: "nacional", label: "Nacional", terms: ["nacional", "brasil"] },
      { id: "dorama", label: "Coreano", terms: ["dorama", "k-drama"] },
      { id: "anime", label: "Anime", terms: ["crunchyroll", "funimation", "anime"] },
      { id: "legendado", label: "Legendado", terms: ["legendado"] },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    options: [
      { id: "netflix", label: "Netflix", terms: ["netflix"] },
      { id: "prime", label: "Prime Video", terms: ["prime video"] },
      { id: "disney", label: "Disney+", terms: ["disney"] },
      { id: "hbo", label: "HBO Max", terms: ["hbo"] },
      { id: "globoplay", label: "Globoplay", terms: ["globoplay"] },
      { id: "appletv", label: "Apple TV+", terms: ["apple tv"] },
      { id: "paramount", label: "Paramount+", terms: ["paramount"] },
    ],
  },
  {
    id: "ocasiao",
    label: "Ocasião",
    options: [
      // Apelidos editoriais sobre gênero — não são dado novo
      { id: "prarir", label: "Pra rir", terms: ["comedia", "comédia"] },
      { id: "prachorar", label: "Pra chorar", terms: ["drama", "romance"] },
      { id: "tensao", label: "Tensão máxima", terms: ["terror", "suspense"] },
      { id: "familia", label: "Em família", terms: ["animacao", "animação", "infantil"] },
    ],
  },
];

const OPTION_INDEX = new Map<string, FilterOption>();
for (const group of FILTER_GROUPS) {
  for (const option of group.options) OPTION_INDEX.set(option.id, option);
}

export function findFilterOption(id: string) {
  return OPTION_INDEX.get(id);
}

/**
 * Condição Prisma de um conjunto de filtros.
 * Filtros do mesmo grupo somam (OR); grupos diferentes restringem (AND).
 */
export function filterWhere(ids: string[]): Prisma.M3uChannelWhereInput[] {
  const byGroup = new Map<string, FilterOption[]>();

  for (const id of ids) {
    const option = OPTION_INDEX.get(id);
    if (!option) continue;
    const groupId = FILTER_GROUPS.find((g) => g.options.includes(option))!.id;
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), option]);
  }

  return [...byGroup.values()].map((options) => ({
    OR: options.flatMap((option) =>
      option.terms.map((term) => ({
        group: { name: { contains: term, mode: "insensitive" as const } },
      })),
    ),
  }));
}

/**
 * Contagem real por opção, para o número ao lado do rótulo.
 *
 * Uma consulta agregada por grupo da M3U, não uma por filtro: são 30 opções e
 * 142 mil canais — trinta `count` separados levariam segundos.
 */
export async function getFilterCounts(
  playlistId: string,
  scope: "movies" | "series",
): Promise<Record<string, number>> {
  return cached(`filter-counts:${playlistId}:${scope}`, TTL.playlist, async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string; total: bigint }>>`
      SELECT g.name AS "name", count(c.id) AS "total"
      FROM "M3uGroup" g
      JOIN "M3uChannel" c ON c."groupId" = g.id
      WHERE g."playlistId" = ${playlistId}
        AND g."isHidden" = false
        AND g.category IS DISTINCT FROM 'adult'
        AND c."isActive" = true
        AND c."streamUrl" LIKE ${scope === "movies" ? "%/movie/%" : "%/series/%"}
      GROUP BY g.name
    `;

    const counts: Record<string, number> = {};

    for (const group of FILTER_GROUPS) {
      for (const option of group.options) {
        let total = 0;
        for (const row of rows) {
          const name = row.name.toLowerCase();
          if (option.terms.some((term) => name.includes(term))) {
            total += Number(row.total);
          }
        }
        // Opção sem conteúdo não aparece na interface
        if (total > 0) counts[option.id] = total;
      }
    }

    return counts;
  });
}
