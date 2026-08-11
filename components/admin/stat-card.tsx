import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2.5 text-3xl font-semibold tracking-display tabular-nums",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          (!tone || tone === "default") && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
