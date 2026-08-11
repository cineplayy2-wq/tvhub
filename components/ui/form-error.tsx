import { AlertCircle } from "lucide-react";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 shadow-md text-xs font-semibold text-rose-200 animate-in fade-in"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
