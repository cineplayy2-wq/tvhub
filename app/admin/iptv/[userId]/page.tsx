import Link from "next/link";

import { CategoryLockControls } from "@/components/admin/iptv/category-lock-controls";
import { LinhaIptvForm } from "@/components/admin/iptv/linha-iptv-form";
import { ModuloAdulto } from "@/components/admin/iptv/modulo-adulto";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/queries/admin";
import {
  getSystemPlaylist,
  getUserCategoryLocks,
} from "@/lib/queries/iptv";

export const dynamic = "force-dynamic";

/**
 * Entitlements IPTV do cliente.
 *
 * O catálogo é compartilhado — aqui só se controla o que ESTE assinante
 * pode ver (módulo adulto e categorias travadas). URLs e sync ficam em
 * /admin/iptv.
 */
export default async function IptvUserPage({
  params,
}: {
  params: { userId: string };
}) {
  try {
    const customer = await getCustomer(params.userId);

    if (!customer) {
      return (
        <div className="px-8 py-10">
          <Link
            href="/admin/clientes"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Clientes
          </Link>
          <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-8 text-center">
            <h1 className="text-xl font-bold text-foreground">Cliente não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O ID informado não pertence a um cliente válido no sistema.
            </p>
          </div>
        </div>
      );
    }

    const [playlist, lockedCategories, user] = await Promise.all([
      getSystemPlaylist(),
      getUserCategoryLocks(params.userId),
      prisma.user.findUnique({
        where: { id: params.userId },
        select: { adultUnlocked: true, iptvUsername: true, iptvPassword: true },
      }),
    ]);

    const canaisAdultos = playlist
      ? await prisma.m3uChannel.count({
          where: { playlistId: playlist.id, group: { category: "adult" } },
        })
      : 0;

    return (
      <div className="px-8 py-10">
        <Link
          href={`/admin/clientes/${params.userId}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {customer.name ?? customer.email}
        </Link>

        <div className="mb-8 mt-4">
          <h1 className="text-2xl font-semibold tracking-display text-foreground">
            IPTV — {customer.name ?? customer.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Permissões deste assinante no catálogo compartilhado. Para
            editar as fontes da lista, vá em{" "}
            <Link href="/admin/iptv" className="text-primary hover:underline">
              Catálogo IPTV
            </Link>
            .
          </p>
        </div>

        {!playlist ? (
          <div className="rounded-lg border border-border bg-surface/40 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              O catálogo compartilhado ainda não foi configurado.
            </p>
            <Link
              href="/admin/iptv"
              className="mt-4 inline-flex rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
            >
              Configurar catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-surface/40 p-6">
              <p className="text-sm text-muted-foreground">
                Catálogo ativo:{" "}
                <strong className="text-foreground">{playlist.label}</strong> —{" "}
                {playlist._count.channels.toLocaleString("pt-BR")} canais
              </p>
            </div>

            <LinhaIptvForm
              userId={params.userId}
              username={user?.iptvUsername ?? null}
              hasPassword={Boolean(user?.iptvPassword)}
            />

            <ModuloAdulto
              userId={params.userId}
              liberado={user?.adultUnlocked ?? false}
              canaisAdultos={canaisAdultos}
            />

            <CategoryLockControls
              playlistId={playlist.id}
              userId={params.userId}
              lockedCategories={lockedCategories}
            />
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[IptvUserPage Error]", error);
    return (
      <div className="px-8 py-10">
        <Link
          href="/admin/clientes"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Clientes
        </Link>
        <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Erro ao carregar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ocorreu uma falha temporária ao obter os dados deste cliente.
          </p>
        </div>
      </div>
    );
  }
}
