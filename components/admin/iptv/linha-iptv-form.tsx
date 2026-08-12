"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";

import { salvarLinhaIptvAction } from "@/app/actions/iptv";
import { cn } from "@/lib/utils";

/**
 * Linha IPTV deste assinante no provedor.
 *
 * O catálogo é compartilhado; a conta do painel não. Sem uma linha própria,
 * este cliente compete pelas 2 conexões da conta usada na importação.
 */
export function LinhaIptvForm({
  userId,
  username,
  hasPassword,
}: {
  userId: string;
  username: string | null;
  hasPassword: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="rounded-xl border border-border bg-surface/40 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const user = String(data.get("iptvUsername") ?? "");
        const pass = String(data.get("iptvPassword") ?? "");
        setErro(null);
        setOk(false);
        iniciar(async () => {
          const r = await salvarLinhaIptvAction(userId, user, pass);
          if ("erro" in r) setErro(r.erro);
          else setOk(true);
        });
      }}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Linha IPTV deste cliente
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Usuário e senha que o provedor deu para ESTA pessoa. Na hora de
            assistir o proxy troca a conta do catálogo por esta — senão todo
            mundo divide as 2 conexões da mesma linha e o terceiro cai.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="iptvUsername" className="mb-1 block text-xs font-medium text-foreground">
            Usuário
          </label>
          <input
            id="iptvUsername"
            name="iptvUsername"
            type="text"
            required
            defaultValue={username ?? ""}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="iptvPassword" className="mb-1 block text-xs font-medium text-foreground">
            Senha
          </label>
          <input
            id="iptvPassword"
            name="iptvPassword"
            type="password"
            required
            placeholder={hasPassword ? "••••••••" : ""}
            autoComplete="new-password"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          className={cn(
            "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50",
          )}
        >
          {pendente ? "Salvando…" : "Salvar linha"}
        </button>
        {ok && <p className="text-xs text-emerald-400">Linha gravada. Este cliente toca com a conta dele.</p>}
        {erro && <p className="text-xs text-danger">{erro}</p>}
        {!username && !ok && (
          <p className="text-xs text-amber-400">
            Sem linha própria este cliente ainda usa a conta do catálogo.
          </p>
        )}
      </div>
    </form>
  );
}
