import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/types";

/**
 * Stage 3.1 — Auth.js (NextAuth v5 beta) configuration.
 *
 * JWT-session strategy + adapting the existing User table so role checks can be
 * driven by a real signed-in identity. Credentials provider resolves the exact
 * row from the Postgres `users` table; the JWT/session callbacks stamp `id` and
 * `role` into the session object consumed by the RBAC helpers in lib/auth.ts.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.toLowerCase().trim()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password || user.password !== password) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = (token.id ?? token.sub) as string;
      session.user.role = (token.role as UserRole | undefined) ?? "VIEWER";
      if (token.name != null) session.user.name = token.name;
      if (token.email != null) session.user.email = token.email;
      return session;
    },
  },
});