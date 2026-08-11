import type { NextAuthConfig } from "next-auth";

/**
 * Configuração compartilhada entre o middleware (Edge) e o servidor (Node).
 *
 * NADA aqui pode importar Prisma, bcrypt ou ioredis: este arquivo é carregado
 * no Edge Runtime, onde essas libs não rodam. Os providers reais entram
 * em auth.ts, que só é carregado no Node.
 */

/** Rotas da área logada: exigem sessão válida. */
const PROTECTED_PREFIXES = [
  "/perfis",
  "/inicio",
  "/busca",
  "/minha-lista",
  "/conta",
  "/titulo",
  "/assistir",
  "/tv",
];

/** Rotas de sessão: quem já está logado não deveria vê-las. */
const AUTH_PAGES = ["/login", "/cadastro"];

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova o cookie no máximo 1x/dia
  },

  // Preenchidos em auth.ts — o Edge não consegue carregá-los
  providers: [],

  callbacks: {
    /** Chamado pelo middleware a cada request. */
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const user = auth?.user;

      const isAdminRoute = pathname.startsWith("/admin");
      const isProtected =
        isAdminRoute ||
        PROTECTED_PREFIXES.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        );
      const isAuthPage = AUTH_PAGES.includes(pathname);

      if (isAuthPage) {
        // Já logado não precisa ver login/cadastro
        if (user) {
          return Response.redirect(new URL("/perfis", request.nextUrl));
        }
        return true;
      }

      if (!isProtected) return true;

      if (!user) {
        // Guarda o destino para devolver o usuário ao lugar certo pós-login
        const loginUrl = new URL("/login", request.nextUrl);
        loginUrl.searchParams.set("next", `${pathname}${search}`);
        return Response.redirect(loginUrl);
      }

      // 404 em vez de 403: não confirma para um curioso que /admin existe
      if (isAdminRoute && user.role !== "ADMIN") {
        return Response.redirect(new URL("/inicio", request.nextUrl));
      }

      return true;
    },

    /** O que entra no JWT. Roda no login e em cada renovação do token. */
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
      }

      // Permite atualizar o token sem novo login (ex: assinatura ativada)
      if (trigger === "update" && session) {
        token.role = session.role ?? token.role;
        token.status = session.status ?? token.status;
      }

      return token;
    },

    /** O que a aplicação enxerga em `session.user`. */
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      if (token.status) session.user.status = token.status;
      return session;
    },
  },
} satisfies NextAuthConfig;
