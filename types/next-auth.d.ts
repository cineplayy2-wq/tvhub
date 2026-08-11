import type { UserRole, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Sem esta ampliação, `session.user.role` não existe para o TypeScript e todo
 * checagem de permissão vira `as any` — que é exatamente onde falha de
 * autorização passa despercebida.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    status: UserStatus;
  }
}

/**
 * `next-auth/jwt` apenas reexporta `@auth/core/jwt`, e reexport não faz merge
 * de declaração: augmentar o caminho errado compila em silêncio e deixa
 * `token.id` como `{}`. A interface real precisa ser augmentada na origem.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
  }
}
