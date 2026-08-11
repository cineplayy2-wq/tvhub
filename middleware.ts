import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Só authConfig (sem Prisma/bcrypt): o middleware roda no Edge Runtime.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /**
     * Tudo, exceto:
     * - /api      → protegidas individualmente; o handler do Auth.js vive aqui
     * - /_next/*  → assets de build
     * - arquivos estáticos com extensão
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
