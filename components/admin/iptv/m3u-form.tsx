"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { cn } from "@/lib/utils";
import { testarEpgAction, upsertM3uPlaylistAction } from "@/app/actions/iptv";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ResultadoEpg } from "@/lib/iptv/epg";
import type { M3uPlaylist } from "@prisma/client";
import { CalendarClock, ShieldCheck } from "lucide-react";

const TABS = [
  { value: "URL", label: "URL da Lista" },
  { value: "XTREAM", label: "Xtream Codes" },
  { value: "RAW_TEXT", label: "Colar M3U" },
] as const;

type SourceType = (typeof TABS)[number]["value"];

export function M3uForm({
  userId,
  existing,
}: {
  userId: string;
  existing?: M3uPlaylist | null;
}) {
  const [sourceType, setSourceType] = useState<SourceType>(
    (existing?.sourceType as SourceType) ?? "URL",
  );
  const [showBackup, setShowBackup] = useState(
    Boolean(existing?.backupSourceUrl || existing?.backupXtreamServer),
  );
  const [state, formAction] = useFormState(upsertM3uPlaylistAction, {});

  const [epgUrl, setEpgUrl] = useState(existing?.epgUrl ?? "");
  const [epgResultado, setEpgResultado] = useState<ResultadoEpg | null>(null);
  const [testandoEpg, setTestandoEpg] = useState(false);

  async function testarEpg() {
    setTestandoEpg(true);
    setEpgResultado(null);
    try {
      setEpgResultado(await testarEpgAction(userId, epgUrl));
    } finally {
      setTestandoEpg(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="sourceType" value={sourceType} />

      {/* Label */}
      <div>
        <label
          htmlFor="m3u-label"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Nome da lista principal
        </label>
        <input
          id="m3u-label"
          name="label"
          type="text"
          defaultValue={existing?.label ?? ""}
          placeholder="Ex: Lista Principal do Cliente"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {state.fieldErrors?.label && (
          <p className="mt-1 text-xs text-danger">{state.fieldErrors.label}</p>
        )}
      </div>

      {/* Source Type Tabs */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Tipo de fonte principal
        </p>
        <div className="flex gap-1 rounded-lg bg-surface-elevated p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSourceType(tab.value)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                sourceType === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* URL Tab */}
      <div className={sourceType === "URL" ? "space-y-2" : "hidden"}>
        <label
          htmlFor="m3u-url"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          URL da lista M3U
        </label>
        <input
          id="m3u-url"
          name="sourceUrl"
          type="url"
          defaultValue={existing?.sourceUrl ?? ""}
          placeholder="https://exemplo.com/lista.m3u"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {state.fieldErrors?.sourceUrl && (
          <p className="mt-1 text-xs text-danger">
            {state.fieldErrors.sourceUrl}
          </p>
        )}
      </div>

      {/* Xtream Tab */}
      <div className={sourceType === "XTREAM" ? "space-y-4" : "hidden"}>
        <div>
          <label
            htmlFor="xtream-server"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Servidor
          </label>
          <input
            id="xtream-server"
            name="xtreamServer"
            type="url"
            defaultValue={existing?.xtreamServer ?? ""}
            placeholder="http://servidor.com:8080"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="xtream-user"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Usuário
            </label>
            <input
              id="xtream-user"
              name="xtreamUsername"
              type="text"
              defaultValue={existing?.xtreamUsername ?? ""}
              placeholder="username"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="xtream-pass"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Senha
            </label>
            <input
              id="xtream-pass"
              name="xtreamPassword"
              type="password"
              defaultValue={existing?.xtreamPassword ?? ""}
              placeholder="••••••"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Raw Text Tab */}
      <div className={sourceType === "RAW_TEXT" ? "space-y-2" : "hidden"}>
        <label
          htmlFor="m3u-raw"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Conteúdo da lista M3U
        </label>
        <textarea
          id="m3u-raw"
          name="rawContent"
          rows={12}
          defaultValue={existing?.rawContent ?? ""}
          placeholder={"#EXTM3U\n#EXTINF:-1 tvg-logo=\"...\" group-title=\"Filmes\",Canal 1\nhttp://..."}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* PAINEL DE LISTA SECUNDÁRIA / BACKUP (FAILOVER) */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                Lista Secundária de Backup (Failover Redundante)
              </h4>
              <p className="text-xs text-muted-foreground">
                Se a transmissão da lista principal falhar, o player tenta a URL deste backup sem duplicar cards no catálogo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBackup(!showBackup)}
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            {showBackup ? "Ocultar Backup" : "Configurar Backup"}
          </button>
        </div>

        {showBackup && (
          <div className="space-y-4 pt-3 border-t border-primary/20">
            <div>
              <label htmlFor="backup-url" className="mb-1 block text-xs font-medium text-foreground">
                URL da Lista M3U Secundária (Backup)
              </label>
              <input
                id="backup-url"
                name="backupSourceUrl"
                type="url"
                defaultValue={existing?.backupSourceUrl ?? ""}
                placeholder="https://servidor-backup.com/lista.m3u"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest my-1">
              OU CREDENCIAIS XTREAM DE BACKUP
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="backup-xtream-server" className="mb-1 block text-xs font-medium text-foreground">
                  Servidor Backup
                </label>
                <input
                  id="backup-xtream-server"
                  name="backupXtreamServer"
                  type="url"
                  defaultValue={existing?.backupXtreamServer ?? ""}
                  placeholder="http://backup.com:8080"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="backup-xtream-user" className="mb-1 block text-xs font-medium text-foreground">
                  Usuário Backup
                </label>
                <input
                  id="backup-xtream-user"
                  name="backupXtreamUsername"
                  type="text"
                  defaultValue={existing?.backupXtreamUsername ?? ""}
                  placeholder="user_backup"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="backup-xtream-pass" className="mb-1 block text-xs font-medium text-foreground">
                  Senha Backup
                </label>
                <input
                  id="backup-xtream-pass"
                  name="backupXtreamPassword"
                  type="password"
                  defaultValue={existing?.backupXtreamPassword ?? ""}
                  placeholder="••••••"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GUIA DE PROGRAMAÇÃO (EPG / XMLTV) */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Guia de Programação (EPG / XMLTV)
            </h4>
            <p className="text-xs text-muted-foreground">
              URL do XMLTV do provedor. O casamento com os canais é feito pelo{" "}
              <code className="font-mono text-[11px] text-amber-300">tvg-id</code>. Use
              &quot;Testar&quot; antes de salvar para ver quantos canais realmente ganham grade.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="epg-url"
            name="epgUrl"
            type="url"
            value={epgUrl}
            onChange={(e) => {
              setEpgUrl(e.target.value);
              setEpgResultado(null);
            }}
            placeholder="http://servidor.com/xmltv.php?username=...&password=..."
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={testarEpg}
            disabled={testandoEpg || !epgUrl.trim()}
            className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testandoEpg ? "Testando..." : "Testar EPG"}
          </button>
        </div>
        {state.fieldErrors?.epgUrl && (
          <p className="text-xs text-danger">{state.fieldErrors.epgUrl}</p>
        )}

        {epgResultado && !epgResultado.ok && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
            <p className="text-xs text-danger">
              Não foi possível ler o EPG: {epgResultado.erro}
            </p>
          </div>
        )}

        {epgResultado?.ok && (
          <div className="rounded-lg border border-white/10 bg-surface/60 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {epgResultado.canaisNoEpg}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  canais no EPG
                </p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {epgResultado.casaram}/{epgResultado.canaisNaLista}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  casaram na lista
                </p>
              </div>
              <div>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    epgResultado.cobertura >= 50 ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {epgResultado.cobertura}%
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  cobertura
                </p>
              </div>
            </div>

            {epgResultado.exemplosSemCobertura.length > 0 && (
              <p className="border-t border-white/[0.06] pt-2 text-[11px] text-muted-foreground">
                Sem grade, por exemplo:{" "}
                <span className="font-mono text-foreground">
                  {epgResultado.exemplosSemCobertura.join(", ")}
                </span>
              </p>
            )}

            {epgResultado.truncado && (
              <p className="text-[11px] text-amber-400">
                O arquivo é grande e a leitura parou no limite — a cobertura real pode ser
                maior.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Auto Sync */}
      <div>
        <label
          htmlFor="m3u-sync"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Sincronização automática
        </label>
        <select
          id="m3u-sync"
          name="autoSyncHours"
          defaultValue={existing?.autoSyncHours ?? 0}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="0">Apenas manual</option>
          <option value="1">A cada 1 hora</option>
          <option value="6">A cada 6 horas</option>
          <option value="12">A cada 12 horas</option>
          <option value="24">A cada 24 horas</option>
          <option value="48">A cada 2 dias</option>
          <option value="168">A cada 7 dias</option>
        </select>
      </div>

      {/* Errors */}
      {state.error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
          <p className="text-sm text-danger">{state.error}</p>
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-3">
          <p className="text-sm text-success">
            Lista e backup salvos com sucesso! Use &quot;Sincronizar Agora&quot; para importar os canais.
          </p>
        </div>
      )}

      {/* Submit */}
      <SubmitButton variant="primary" size="md">
        {existing ? "Atualizar Lista" : "Salvar Lista"}
      </SubmitButton>
    </form>
  );
}
