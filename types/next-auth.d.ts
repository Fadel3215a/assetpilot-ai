import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types";

/**
 * Stage 3.1 — Type augmentation for the Auth.js session/JWT/user shapes so the
 * id + role stamped by the auth.ts callbacks are statically typed everywhere.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    name?: string | null;
    email?: string | null;
  }
}