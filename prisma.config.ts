import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma Client codegen does not require a live database, so fall back to a
 * dummy connection string when DATABASE_URL is absent (e.g. Vercel's build
 * image before env vars are injected).
 */
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/dummy";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
