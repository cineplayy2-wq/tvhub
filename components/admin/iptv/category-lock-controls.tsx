"use client";

import { useTransition } from "react";
import { Lock, Unlock, Radio, Film, Tv, Trophy, ShieldAlert } from "lucide-react";
import { toggleCategoryLockAction } from "@/app/actions/iptv";

const CATEGORY_CONFIG: Array<{ key: string; label: string; icon: any }> = [
  { key: "live", label: "Canais ao Vivo", icon: Radio },
  { key: "movies", label: "Filmes (VOD)", icon: Film },
  { key: "series", label: "Séries e Animes", icon: Tv },
  { key: "sports", label: "Esportes", icon: Trophy },
  { key: "adult", label: "Conteúdo Adulto (+18)", icon: ShieldAlert },
];

/**
 * Trava de categoria POR CLIENTE no catálogo compartilhado.
 *
 * `lockedCategories` vem de `UserCategoryLock` — não de `M3uGroup.isHidden`.
 */
export function CategoryLockControls({
  playlistId,
  userId,
  lockedCategories = [],
}: {
  playlistId: string;
  userId: string;
  /** Categorias já travadas para este assinante. */
  lockedCategories?: string[];
  /** @deprecated Mantido só para não quebrar callers antigos. */
  groups?: Array<{ category: string | null; isHidden: boolean }>;
}) {
  const [isPending, startTransition] = useTransition();
  const locked = new Set(lockedCategories);

  const handleToggle = (categoryKey: string, currentLocked: boolean) => {
    startTransition(async () => {
      await toggleCategoryLockAction(playlistId, categoryKey, !currentLocked, userId);
    });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-5 mb-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
        Bloqueio de Conteúdo e Categorias por Cliente
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Oculta categorias deste assinante no catálogo compartilhado. Não afeta
        os outros clientes.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_CONFIG.map((cat) => {
          const isLocked = locked.has(cat.key);
          const Icon = cat.icon;

          return (
            <div
              key={cat.key}
              className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                isLocked
                  ? "border-danger/40 bg-danger/5"
                  : "border-border/60 bg-surface-elevated/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isLocked ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{cat.label}</p>
                  <span
                    className={`text-[10px] font-bold ${
                      isLocked ? "text-danger" : "text-emerald-500"
                    }`}
                  >
                    {isLocked ? "BLOQUEADO" : "LIBERADO"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggle(cat.key, isLocked)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isLocked
                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                    : "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30"
                }`}
              >
                {isLocked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    Liberar
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Bloquear
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
