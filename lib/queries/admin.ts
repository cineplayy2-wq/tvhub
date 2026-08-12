import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

// ==========================================================
// DASHBOARD & ANALYTICS
// ==========================================================

export async function getAdminOverview() {
  const [
    totalUsers,
    blockedUsers,
    activeSubscriptions,
    publishedTitles,
    draftTitles,
    activeStreamsCount,
    paidLast30,
    totalPlaylists,
    totalChannels,
    totalProfiles,
    activeSessions,
    recentPlaylists,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { status: { not: "ACTIVE" } } }),
    prisma.subscription.count({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
        currentPeriodEnd: { gt: new Date() },
      },
    }),
    prisma.title.count({ where: { status: "PUBLISHED" } }),
    prisma.title.count({ where: { status: "DRAFT" } }),
    prisma.streamSession.count({ where: { isActive: true } }),
    prisma.payment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amountCents: true },
    }),
    prisma.m3uPlaylist.count(),
    prisma.m3uChannel.count(),
    prisma.profile.count(),
    prisma.streamSession.findMany({
      where: { isActive: true },
      take: 10,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        sessionId: true,
        deviceLabel: true,
        ipAddress: true,
        startedAt: true,
        lastSeenAt: true,
        user: { select: { name: true, email: true } },
        profile: { select: { name: true } },
      },
    }),
    prisma.m3uPlaylist.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        label: true,
        syncStatus: true,
        lastSyncAt: true,
        lastSyncError: true,
        totalChannels: true,
        totalGroups: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    totalUsers,
    blockedUsers,
    activeSubscriptions,
    publishedTitles,
    draftTitles,
    activeStreams: activeStreamsCount,
    revenueLast30Cents: paidLast30._sum.amountCents ?? 0,
    totalPlaylists,
    totalChannels,
    totalProfiles,
    activeSessions,
    recentPlaylists,
  };
}

// ==========================================================
// CLIENTES ANALYTICS
// ==========================================================

export async function listCustomers({
  query,
  page = 1,
}: {
  query?: string;
  page?: number;
}) {
  const where = {
    role: "USER" as const,
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: { select: { name: true } },
          },
        },
        m3uPlaylist: {
          select: {
            syncStatus: true,
            totalChannels: true,
            lastSyncAt: true,
          },
        },
        _count: {
          select: {
            profiles: true,
            streamSessions: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getCustomer(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      blockedAt: true,
      blockedReason: true,
      createdAt: true,
      lastLoginAt: true,
      subscription: {
        select: {
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          nextChargeAt: true,
          // O `id` alimenta o seletor de plano na ficha do cliente.
          plan: { select: { id: true, name: true, priceCents: true, deviceLimit: true } },
        },
      },
      m3uPlaylist: {
        select: {
          id: true,
          label: true,
          sourceType: true,
          syncStatus: true,
          lastSyncAt: true,
          lastSyncError: true,
          totalChannels: true,
          totalGroups: true,
          sourceUrl: true,
        },
      },
      adultUnlocked: true,
      iptvUsername: true,
      profiles: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          isKids: true,
          maxAgeRating: true,
          pinHash: true,
          watchProgress: {
            orderBy: { lastWatched: "desc" },
            take: 5,
            select: {
              id: true,
              itemKey: true,
              lastWatched: true,
              completed: true,
              title: { select: { name: true } },
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amountCents: true,
          status: true,
          method: true,
          createdAt: true,
          paidAt: true,
        },
      },
      streamSessions: {
        orderBy: { startedAt: "desc" },
        take: 15,
        select: {
          id: true,
          sessionId: true,
          deviceLabel: true,
          ipAddress: true,
          isActive: true,
          startedAt: true,
          lastSeenAt: true,
        },
      },
    },
  });
}

// ==========================================================
// CONTEÚDO
// ==========================================================

export async function listTitles({
  query,
  status,
  page = 1,
}: {
  query?: string;
  status?: string;
  page?: number;
}) {
  const statusFilter = (["DRAFT", "PUBLISHED", "ARCHIVED"] as const).find(
    (value) => value === status,
  );

  const where: Prisma.TitleWhereInput = {
    ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.title.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        posterUrl: true,
        releaseYear: true,
        ageRating: true,
        videoStatus: true,
        updatedAt: true,
        _count: { select: { episodes: true } },
      },
    }),
    prisma.title.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getTitleForEdit(id: string) {
  return prisma.title.findUnique({
    where: { id },
    include: {
      genres: { select: { slug: true, name: true } },
      episodes: { orderBy: [{ season: "asc" }, { number: "asc" }] },
    },
  });
}

export async function listGenres() {
  return prisma.genre.findMany({ orderBy: { order: "asc" } });
}
