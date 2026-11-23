// GET    /api/me                 -> my taste summary (used by /how-it-works)
// PATCH  /api/me { visibility }  -> change who can see me
// DELETE /api/me                 -> delete all my data and log out
import { desc, eq, inArray, or } from "drizzle-orm";
import { VISIBILITIES, type MeResponse, type Visibility } from "../shared/types.js";
import { clearSessionCookie, requireUserId } from "./_lib/auth.js";
import { db } from "./_lib/db.js";
import { handler, HttpError, json, readJson } from "./_lib/http.js";
import { artists, similarities, userGenres, users, userTopArtists, userTopTracks } from "./_lib/schema.js";
import { rankWeight, TIME_RANGE_WEIGHTS } from "./_lib/similarity.js";
import { getUser, isListed, publicView, toSessionResponse, toSessionUser } from "./_lib/users.js";

export const GET = handler(async (request) => {
  const userId = await requireUserId(request);
  const user = await getUser(userId);

  const [topRows, genreRows, trackRows, edgeRows] = await Promise.all([
    db
      .select({
        id: artists.id,
        name: artists.name,
        imageUrl: artists.imageUrl,
        genres: artists.genres,
        rank: userTopArtists.rank,
        timeRange: userTopArtists.timeRange,
      })
      .from(userTopArtists)
      .innerJoin(artists, eq(artists.id, userTopArtists.artistId))
      .where(eq(userTopArtists.userId, userId)),
    db
      .select({ genre: userGenres.genre, weight: userGenres.weight })
      .from(userGenres)
      .where(eq(userGenres.userId, userId))
      .orderBy(desc(userGenres.weight))
      .limit(10),
    db.select({ id: userTopTracks.trackId }).from(userTopTracks).where(eq(userTopTracks.userId, userId)),
    db
      .select()
      .from(similarities)
      .where(or(eq(similarities.userA, userId), eq(similarities.userB, userId)))
      .orderBy(desc(similarities.score)),
  ]);

  // Same weighting as buildProfile, so the walkthrough shows the real numbers.
  const weights = new Map<string, MeResponse["topArtists"][number]>();
  for (const r of topRows) {
    const w = rankWeight(r.rank) * TIME_RANGE_WEIGHTS[r.timeRange];
    const existing = weights.get(r.id);
    if (existing) existing.weight += w;
    else weights.set(r.id, { id: r.id, name: r.name, imageUrl: r.imageUrl, genres: r.genres, weight: w });
  }
  const topArtists = [...weights.values()].sort((a, b) => b.weight - a.weight).slice(0, 10);

  // Count only matches I can actually see.
  const otherIds = edgeRows.map((e) => (e.userA === userId ? e.userB : e.userA));
  const others = otherIds.length ? await db.select().from(users).where(inArray(users.spotifyId, otherIds)) : [];
  const listed = new Map(others.filter(isListed).map((u) => [u.spotifyId, u]));
  const visibleEdges = edgeRows.filter((e) => listed.has(e.userA === userId ? e.userB : e.userA));
  const best = visibleEdges[0];
  const bestUser = best && listed.get(best.userA === userId ? best.userB : best.userA);

  const response: MeResponse = {
    user: toSessionUser(user),
    topArtists,
    topGenres: genreRows,
    topTrackCount: new Set(trackRows.map((r) => r.id)).size,
    matchCount: visibleEdges.length,
    bestMatch: best && bestUser ? { label: publicView(bestUser).label, score: best.score } : null,
  };
  return json(response);
});

export const PATCH = handler(async (request) => {
  const userId = await requireUserId(request);
  const { visibility } = await readJson<{ visibility?: Visibility }>(request);
  if (!visibility || !VISIBILITIES.includes(visibility)) {
    throw new HttpError(400, `visibility must be one of ${VISIBILITIES.join(", ")}`);
  }
  const [row] = await db.update(users).set({ visibility }).where(eq(users.spotifyId, userId)).returning();
  if (!row) throw new HttpError(401, "Account not found");
  return json(toSessionResponse(row));
});

export const DELETE = handler(async (request) => {
  const userId = await requireUserId(request);
  // Cascades to top artists, top tracks, genres and similarities.
  await db.delete(users).where(eq(users.spotifyId, userId));
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
});
