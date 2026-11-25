import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

// The Vercel Neon integration may add its variables with a prefix (DB_DATABASE_URL).
const url = process.env.DATABASE_URL ?? process.env.DB_DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL (or DB_DATABASE_URL) is not set. Run `vercel env pull .env.local`.");
}

export const db = drizzle(neon(url), { schema });
export type Db = typeof db;
