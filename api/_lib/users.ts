import { eq } from "drizzle-orm";
import type { SessionResponse, SessionUser } from "../../shared/types.js";
import { db } from "./db.js";
import { HttpError } from "./http.js";
import { users } from "./schema.js";

export type UserRow = typeof users.$inferSelect;

export async function getUser(spotifyId: string): Promise<UserRow> {
  const [row] = await db.select().from(users).where(eq(users.spotifyId, spotifyId));
  if (!row) throw new HttpError(401, "Account not found");
  return row;
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    publicId: row.publicId,
    displayName: row.displayName,
    imageUrl: row.imageUrl,
    visibility: row.visibility,
  };
}

export function toSessionResponse(row: UserRow): SessionResponse {
  return {
    user: toSessionUser(row),
    hasConsented: row.consentedAt !== null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

/** Name and picture as other users see them, respecting visibility. */
export function publicView(row: Pick<UserRow, "publicId" | "displayName" | "imageUrl" | "visibility">) {
  if (row.visibility === "anonymous") {
    const n = parseInt(row.publicId.replace(/-/g, "").slice(0, 8), 16) % 10000;
    return { label: `Listener #${String(n).padStart(4, "0")}`, image: null };
  }
  return { label: row.displayName ?? "Spotify listener", image: row.imageUrl };
}

/** Whether other people may see this user on their graph. */
export function isListed(row: Pick<UserRow, "consentedAt" | "lastSyncedAt" | "visibility">): boolean {
  return row.consentedAt !== null && row.lastSyncedAt !== null && row.visibility !== "hidden";
}
