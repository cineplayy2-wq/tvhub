import Link from "next/link";

import { BlockUserButton } from "@/components/admin/block-user-button";
import { Pagination } from "@/components/admin/pagination";
import { SearchField } from "@/components/admin/search-field";
import { SubscriptionPill, UserStatusPill } from "@/components/admin/status-pill";
import { listCustomers } from "@/lib/queries/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { items, total, totalPages } = await listCustomers({
    query: searchParams.q,
    page,
  });

  return (
    <div className="px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-display text-foreground">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assinantes cadastrados, status de pagamento e bloqueio.
        </p>
      </div>

      <div className="mb-5">
        <SearchField placeholder="Buscar por nome ou e-mail" basePath="/admin/clientes" />
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface/40 px-6 py-16 text-center text-sm text-muted-foreground">
          {searchParams.q
            ? `Nenhum cliente encontrado para "${searchParams.q}".`
            : "Nenhum cliente cadastrado ainda."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/60 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Assinatura</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Plano</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Cadastro</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clientes/${customer.id}`}
                      className="block transition-colors hover:text-primary"
                    >
                      <span className="block font-medium text-foreground">
                        {customer.name ?? "Sem nome"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {customer.email}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusPill status={customer.status} />
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionPill status={customer.subscription?.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {customer.subscription?.plan.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BlockUserButton
                      userId={customer.id}
                      isBlocked={customer.status !== "ACTIVE"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          basePath="/admin/clientes"
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}
