import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { SITE } from "@/lib/constants";

const LINKS = [
  {
    title: "Plataforma",
    items: [
      { label: "Planos", href: "#planos" },
      { label: "Perguntas frequentes", href: "#perguntas" },
      { label: "Entrar", href: "/login" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Termos de uso", href: "/termos" },
      { label: "Política de privacidade", href: "/privacidade" },
      { label: "Cancelamento e reembolso", href: "/reembolso" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {SITE.description}
            </p>
          </div>

          <div className="flex gap-12 sm:gap-16">
            {LINKS.map((group) => (
              <div key={group.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {group.items.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SITE.name}. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
