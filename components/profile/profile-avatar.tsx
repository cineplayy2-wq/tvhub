import { avatarDoPerfil } from "@/lib/profile/avatars";
import { cn } from "@/lib/utils";

/**
 * Foto do perfil.
 *
 * Todo perfil tem imagem — não existe mais o quadrado colorido com a inicial.
 * Quem foi criado antes da tela de escolha recebe um avatar estável derivado do
 * próprio id (ver `avatarPadraoPara`): a foto nunca muda sozinha, porque é pela
 * imagem que a pessoa reconhece o próprio perfil antes de ler o nome.
 *
 * Não usa `next/image` de propósito: são SVGs de ~1,4 KB servidos do próprio
 * domínio, e passar isso pelo otimizador gastaria CPU da VPS para devolver um
 * arquivo maior que o original.
 */
export function ProfileAvatar({
  id,
  name,
  avatarUrl,
  isKids,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isKids?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-[34px] w-[34px]",
    sm: "h-9 w-9",
    md: "h-16 w-16",
    lg: "h-28 w-28",
  };

  const src = avatarDoPerfil({ id, avatarUrl, isKids });

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-surface-elevated ring-1 ring-white/15",
        sizes[size],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
