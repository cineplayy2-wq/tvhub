"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Film, LayoutDashboard, Radio, Settings, ShieldCheck, Users, Sparkles } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/conteudo", label: "Conteúdo", icon: Film },
  { href: "/admin/iptv", label: "IPTV / M3U", icon: Radio },
  { href: "/admin/planos", label: "Planos & Preços", icon: CreditCard },
  { href: "/admin/quiz", label: "Quiz & Campanha", icon: Sparkles },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  { href: "/admin/auditoria", label: "Auditoria & Logs", icon: ShieldCheck },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface/40">
      <div className="flex h-16 items-center px-5 border-b border-border/50">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
            Admin VIP
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-none">
        {NAV.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200",
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/tv"
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          ← Voltar ao App TV
        </Link>
      </div>
    </aside>
  );
}
