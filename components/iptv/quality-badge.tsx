"use client";

import { cn } from "@/lib/utils";

const QUALITY_STYLES: Record<string, { bg: string; text: string }> = {
  "4K": { bg: "bg-violet-500/20", text: "text-violet-400" },
  FHD: { bg: "bg-blue-500/20", text: "text-blue-400" },
  HD: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  SD: { bg: "bg-surface-elevated", text: "text-muted" },
};

export function QualityBadge({
  quality,
  className,
}: {
  quality: string | null | undefined;
  className?: string;
}) {
  if (!quality) return null;

  const style = QUALITY_STYLES[quality] ?? QUALITY_STYLES.SD;

  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        style.bg,
        style.text,
        className,
      )}
    >
      {quality}
    </span>
  );
}
