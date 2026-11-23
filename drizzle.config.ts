import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Vercel, so load the variables pulled by `vercel env pull`.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine in CI, where DATABASE_URL is set directly.
}

export default defineConfig({
  schema: "./api/_lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
