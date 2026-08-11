import {
  AgeRating,
  ContentStatus,
  ContentType,
  PlanInterval,
  PrismaClient,
  UserRole,
  VideoStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Arte de demonstração. Substituída pelos uploads reais no painel admin —
 * serve só para o catálogo não ficar vazio em desenvolvimento.
 */
const poster = (slug: string) => `https://picsum.photos/seed/${slug}-p/400/600`;
const backdrop = (slug: string) => `https://picsum.photos/seed/${slug}-b/1600/900`;

const GENRES = [
  { name: "Ação", slug: "acao", order: 1 },
  { name: "Drama", slug: "drama", order: 2 },
  { name: "Comédia", slug: "comedia", order: 3 },
  { name: "Terror", slug: "terror", order: 4 },
  { name: "Ficção Científica", slug: "ficcao-cientifica", order: 5 },
  { name: "Documentário", slug: "documentario", order: 6 },
  { name: "Infantil", slug: "infantil", order: 7 },
  { name: "Suspense", slug: "suspense", order: 8 },
];

const TITLES = [
  {
    slug: "ultimo-horizonte",
    name: "Último Horizonte",
    synopsis:
      "Uma tripulação encarregada de reativar o último satélite habitável descobre que o sinal que os guiava nunca veio da Terra.",
    type: ContentType.MOVIE,
    releaseYear: 2024,
    ageRating: AgeRating.FOURTEEN,
    durationSeconds: 7620,
    genres: ["ficcao-cientifica", "suspense"],
    isFeatured: true,
    popularity: 980,
  },
  {
    slug: "cinzas-da-capital",
    name: "Cinzas da Capital",
    synopsis:
      "Após um apagão de 72 horas, um delegado aposentado é o único que ainda acredita que o incêndio não foi acidente.",
    type: ContentType.MOVIE,
    releaseYear: 2025,
    ageRating: AgeRating.SIXTEEN,
    durationSeconds: 6900,
    genres: ["drama", "suspense"],
    isFeatured: true,
    popularity: 870,
  },
  {
    slug: "protocolo-vermelho",
    name: "Protocolo Vermelho",
    synopsis:
      "Uma agente infiltrada tem doze horas para impedir um ataque que ela mesma ajudou a planejar.",
    type: ContentType.MOVIE,
    releaseYear: 2025,
    ageRating: AgeRating.SIXTEEN,
    durationSeconds: 7200,
    genres: ["acao", "suspense"],
    popularity: 940,
  },
  {
    slug: "a-casa-do-lago",
    name: "A Casa do Lago",
    synopsis:
      "Uma família se muda para o interior em busca de silêncio. O silêncio, ali, nunca foi de graça.",
    type: ContentType.MOVIE,
    releaseYear: 2023,
    ageRating: AgeRating.EIGHTEEN,
    durationSeconds: 5940,
    genres: ["terror"],
    popularity: 610,
  },
  {
    slug: "segunda-chance",
    name: "Segunda Chance",
    synopsis:
      "Um ex-jogador falido volta à cidade natal para treinar o time que um dia o expulsou.",
    type: ContentType.MOVIE,
    releaseYear: 2024,
    ageRating: AgeRating.L,
    durationSeconds: 6600,
    genres: ["drama", "comedia"],
    popularity: 720,
  },
  {
    slug: "noite-de-estreia",
    name: "Noite de Estreia",
    synopsis:
      "Três comediantes dividem o mesmo palco, a mesma dívida e a pior noite de suas vidas.",
    type: ContentType.MOVIE,
    releaseYear: 2025,
    ageRating: AgeRating.FOURTEEN,
    durationSeconds: 5700,
    genres: ["comedia"],
    popularity: 540,
  },
  {
    slug: "oceano-invisivel",
    name: "Oceano Invisível",
    synopsis:
      "Um mergulho de quatro anos pelas correntes que sustentam a vida no Atlântico Sul.",
    type: ContentType.MOVIE,
    releaseYear: 2024,
    ageRating: AgeRating.L,
    durationSeconds: 5400,
    genres: ["documentario"],
    popularity: 430,
  },
  {
    slug: "as-aventuras-de-pipo",
    name: "As Aventuras de Pipo",
    synopsis:
      "Um pinguim que odeia água precisa atravessar o oceano para reencontrar a família.",
    type: ContentType.MOVIE,
    releaseYear: 2023,
    ageRating: AgeRating.L,
    durationSeconds: 5100,
    genres: ["infantil", "comedia"],
    popularity: 660,
  },
  {
    slug: "rota-de-fuga",
    name: "Rota de Fuga",
    synopsis:
      "Dois irmãos, um carro roubado e mil quilômetros até a fronteira.",
    type: ContentType.MOVIE,
    releaseYear: 2025,
    ageRating: AgeRating.FOURTEEN,
    durationSeconds: 6300,
    genres: ["acao", "drama"],
    popularity: 810,
  },
  {
    slug: "o-peso-do-silencio",
    name: "O Peso do Silêncio",
    synopsis:
      "Trinta anos depois, a testemunha que nunca falou decide contar o que viu.",
    type: ContentType.MOVIE,
    releaseYear: 2024,
    ageRating: AgeRating.SIXTEEN,
    durationSeconds: 7080,
    genres: ["drama"],
    popularity: 590,
  },
];

const SERIES = [
  {
    slug: "estacao-central",
    name: "Estação Central",
    synopsis:
      "Todo dia, meio milhão de pessoas passa por ali. Uma delas não deveria ter chegado.",
    releaseYear: 2025,
    ageRating: AgeRating.SIXTEEN,
    genres: ["suspense", "drama"],
    isFeatured: true,
    popularity: 1000,
    episodes: [
      { season: 1, number: 1, name: "Plataforma 9", durationSeconds: 3180 },
      { season: 1, number: 2, name: "Hora do rush", durationSeconds: 3060 },
      { season: 1, number: 3, name: "Linha morta", durationSeconds: 3240 },
      { season: 1, number: 4, name: "Último vagão", durationSeconds: 3300 },
    ],
  },
  {
    slug: "codigo-aberto",
    name: "Código Aberto",
    synopsis:
      "Quatro desenvolvedores criam a startup do ano. Um deles vendeu tudo antes do lançamento.",
    releaseYear: 2024,
    ageRating: AgeRating.FOURTEEN,
    genres: ["drama", "suspense"],
    popularity: 760,
    episodes: [
      { season: 1, number: 1, name: "Commit inicial", durationSeconds: 2820 },
      { season: 1, number: 2, name: "Merge conflict", durationSeconds: 2940 },
      { season: 1, number: 3, name: "Rollback", durationSeconds: 3000 },
    ],
  },
];

/**
 * Preços oficiais, em centavos. Ficam aqui e em lib/queries/plans.ts (o
 * fallback da landing) — os dois precisam bater, senão a vitrine promete um
 * valor e o checkout cobra outro.
 */
const PRICE_MONTHLY_CENTS = 2990; // R$ 29,90
const PRICE_YEARLY_CENTS = 19700; // R$ 197,00
const PRICE_YEARLY_COMPARE_AT_CENTS = 35880; // 12 × 29,90

async function main() {
  console.log("🌱 Iniciando seed...");

  // ---------- Planos ----------
  // `update` preenchido, e não `{}`: com objeto vazio o seed nunca corrige
  // preço de um plano que já existe — foi assim que a base ficou com um valor
  // e a landing prometendo outro.
  const mensal = await prisma.plan.upsert({
    where: { slug: "mensal" },
    update: {
      priceCents: PRICE_MONTHLY_CENTS,
      isActive: true,
    },
    create: {
      slug: "mensal",
      name: "Mensal",
      description: "Flexibilidade total. Cancele quando quiser.",
      priceCents: PRICE_MONTHLY_CENTS,
      interval: PlanInterval.MONTH,
      deviceLimit: 2,
      maxProfiles: 4,
      trialDays: 0,
      sortOrder: 1,
      features: [
        "Catálogo completo",
        "2 telas simultâneas",
        "Até 4 perfis",
        "Full HD, sem anúncios",
        "Cancele quando quiser",
      ],
    },
  });

  const anual = await prisma.plan.upsert({
    where: { slug: "anual" },
    update: {
      priceCents: PRICE_YEARLY_CENTS,
      compareAtPriceCents: PRICE_YEARLY_COMPARE_AT_CENTS,
      isActive: true,
    },
    create: {
      slug: "anual",
      name: "Anual",
      description: "O melhor custo-benefício: pague uma vez, assista o ano todo.",
      priceCents: PRICE_YEARLY_CENTS,
      // 12 × 29,90 = 358,80 — âncora do desconto exibido na landing
      compareAtPriceCents: PRICE_YEARLY_COMPARE_AT_CENTS,
      interval: PlanInterval.YEAR,
      deviceLimit: 2,
      maxProfiles: 4,
      trialDays: 0,
      sortOrder: 2,
      features: [
        "Tudo do plano Mensal",
        "Equivale a R$ 16,42 por mês",
        "Economia de R$ 161,80 no ano",
        "Preço travado por 12 meses",
      ],
    },
  });

  console.log(`  ✓ Planos: ${mensal.name}, ${anual.name}`);

  // ---------- Gêneros ----------
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: { name: genre.name, order: genre.order },
      create: genre,
    });
  }
  console.log(`  ✓ Gêneros: ${GENRES.length}`);

  // ---------- Admin ----------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@tvhub.com.br";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.ADMIN },
    create: {
      email: adminEmail,
      name: "Administrador",
      password: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ADMIN,
      emailVerified: new Date(),
      profiles: {
        create: { name: "Admin", sortOrder: 0 },
      },
    },
  });
  console.log(`  ✓ Admin: ${admin.email} (senha: ${adminPassword})`);

  // ---------- Filmes ----------
  for (const t of TITLES) {
    await prisma.title.upsert({
      where: { slug: t.slug },
      update: {},
      create: {
        slug: t.slug,
        name: t.name,
        synopsis: t.synopsis,
        type: t.type,
        status: ContentStatus.PUBLISHED,
        posterUrl: poster(t.slug),
        backdropUrl: backdrop(t.slug),
        releaseYear: t.releaseYear,
        ageRating: t.ageRating,
        durationSeconds: t.durationSeconds,
        isFeatured: t.isFeatured ?? false,
        popularity: t.popularity,
        publishedAt: new Date(),
        // Sem vídeo real ainda: o player só libera quando videoStatus = READY
        videoStatus: VideoStatus.PENDING,
        genres: {
          connect: t.genres.map((slug) => ({ slug })),
        },
      },
    });
  }
  console.log(`  ✓ Filmes: ${TITLES.length}`);

  // ---------- Séries ----------
  for (const s of SERIES) {
    const serie = await prisma.title.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        name: s.name,
        synopsis: s.synopsis,
        type: ContentType.SERIES,
        status: ContentStatus.PUBLISHED,
        posterUrl: poster(s.slug),
        backdropUrl: backdrop(s.slug),
        releaseYear: s.releaseYear,
        ageRating: s.ageRating,
        isFeatured: s.isFeatured ?? false,
        popularity: s.popularity,
        publishedAt: new Date(),
        genres: { connect: s.genres.map((slug) => ({ slug })) },
      },
    });

    for (const ep of s.episodes) {
      await prisma.episode.upsert({
        where: {
          titleId_season_number: {
            titleId: serie.id,
            season: ep.season,
            number: ep.number,
          },
        },
        update: {},
        create: {
          titleId: serie.id,
          season: ep.season,
          number: ep.number,
          name: ep.name,
          durationSeconds: ep.durationSeconds,
          thumbnailUrl: backdrop(`${s.slug}-s${ep.season}e${ep.number}`),
          publishedAt: new Date(),
          videoStatus: VideoStatus.PENDING,
        },
      });
    }
  }
  console.log(`  ✓ Séries: ${SERIES.length}`);

  // ---------- Coleção curada ----------
  const featured = await prisma.title.findMany({
    where: { slug: { in: ["ultimo-horizonte", "estacao-central", "protocolo-vermelho", "rota-de-fuga"] } },
    select: { id: true },
  });

  const collection = await prisma.collection.upsert({
    where: { slug: "originais-tvhub" },
    update: {},
    create: {
      slug: "originais-tvhub",
      name: "Originais TVHub",
      description: "Produções exclusivas da plataforma.",
      sortOrder: 1,
    },
  });

  for (const [i, title] of featured.entries()) {
    await prisma.collectionItem.upsert({
      where: {
        collectionId_titleId: { collectionId: collection.id, titleId: title.id },
      },
      update: { sortOrder: i },
      create: { collectionId: collection.id, titleId: title.id, sortOrder: i },
    });
  }
  console.log(`  ✓ Coleção: ${collection.name} (${featured.length} títulos)`);

  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error("❌ Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
