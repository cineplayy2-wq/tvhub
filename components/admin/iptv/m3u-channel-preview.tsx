"use client";

import { cn } from "@/lib/utils";

type PreviewGroup = {
  name: string;
  category: string;
  channelCount: number;
};

type PreviewChannel = {
  name: string;
  groupTitle: string;
  logoUrl: string | null;
  quality: string | null;
};

export function M3uChannelPreview({
  groups,
  channels,
  totalChannels,
}: {
  groups: PreviewGroup[];
  channels: PreviewChannel[];
  totalChannels: number;
}) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-6">
        <div className="rounded-lg border border-border bg-surface/40 px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{totalChannels}</p>
          <p className="text-xs text-muted-foreground">Canais encontrados</p>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{groups.length}</p>
          <p className="text-xs text-muted-foreground">Grupos</p>
        </div>
      </div>

      {/* Groups */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Grupos detectados
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.name}
              className="flex items-center justify-between rounded-md border border-border bg-surface/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{group.name}</p>
                <p className="text-xs text-muted-foreground">
                  Categoria: {group.category}
                </p>
              </div>
              <span className="ml-2 shrink-0 rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-muted">
                {group.channelCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sample channels */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Amostra de canais ({Math.min(channels.length, 50)} de {totalChannels})
        </h3>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-border bg-surface/80 text-left backdrop-blur">
                <th className="px-3 py-2 font-medium text-muted-foreground">Canal</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Grupo</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Qualidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {channels.map((ch, i) => (
                <tr key={i} className="hover:bg-surface-hover/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {ch.logoUrl ? (
                        <img
                          src={ch.logoUrl}
                          alt=""
                          className="h-6 w-6 rounded object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-surface-elevated text-[10px] font-medium text-muted">
                          {ch.name.charAt(0)}
                        </div>
                      )}
                      <span className="truncate text-foreground">{ch.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ch.groupTitle}</td>
                  <td className="px-3 py-2">
                    {ch.quality && (
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-semibold",
                          ch.quality === "4K" && "bg-violet-500/20 text-violet-400",
                          ch.quality === "FHD" && "bg-blue-500/20 text-blue-400",
                          ch.quality === "HD" && "bg-emerald-500/20 text-emerald-400",
                          ch.quality === "SD" && "bg-surface-elevated text-muted",
                        )}
                      >
                        {ch.quality}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
