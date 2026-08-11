import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { fakeVerify, verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // O adapter serve ao login social (Account/Session/VerificationToken).
  // Credentials continua em JWT — é o que o Auth.js exige.
  adapter: PrismaAdapter(prisma),

  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },

      async authorize(credentials) {
        // O client já validou, mas o servidor nunca confia nisso
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          await fakeVerify();
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            password: true,
            role: true,
            status: true,
          },
        });

        // Conta inexistente ou criada via login social (sem senha):
        // gasta o mesmo tempo de um bcrypt real para não vazar quais e-mails existem
        if (!user?.password) {
          await fakeVerify();
          return null;
        }

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) return null;

        // Bloqueio pelo admin barra o login na origem, não só a reprodução
        if (user.status !== "ACTIVE") return null;

        // Best-effort: falha aqui não pode impedir o login
        prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
});
