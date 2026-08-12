import { Baby } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paleta de fundos dos avatares. Todas foram escolhidas escuras o bastante
 * para a inicial branca manter contraste.
 */
const TINTS = [
  "bg-[#2E3A4A]",
  "bg-[#3A2E4A]",
  "bg-[#2E4A3C]",
  "bg-[#4A392E]",
];

/** Mesma cor para o mesmo perfil sempre — hash simples e determinístico. */
function tintFor(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return TINTS[sum % TINTS.length];
}

export function ProfileAvatar({
  id,
  name,
  isKids,
  avatarUrl,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  isKids?: boolean;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-9 w-9 text-sm rounded-md",
    md: "h-16 w-16 text-xl rounded-lg",
    lg: "h-28 w-28 text-4xl rounded-xl",
  };

  if (avatarUrl) {
    return (
      <span
        className={cn(
          "relative block overflow-hidden",
          sizes[size],
          className,
        )}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center font-semibold text-foreground",
        sizes[size],
        tintFor(id),
        className,
      )}
      aria-hidden
    >
      {isKids ? (
        <Baby className={size === "lg" ? "h-10 w-10" : "h-5 w-5"} strokeWidth={1.75} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
