import { and, eq, isNotNull, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "./db.js";
import { artists, similarities, tracks, users, userTopArtists, userTopTracks } from "./schema.js";
import { buildProfile, computePairs, type RankedArtist, type RankedTrack, type ScoredPair, type TasteProfile } from "./similarity.js";

type Batch = [BatchItem<"pg">, ...BatchItem<"pg">[]];

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function runBatch(queries: BatchItem<"pg">[]) {
  if (queries.length === 0) return;
  await db.batch(queries as Batch);
}

/**
 * Builds taste profiles for every user who has consented and synced.
 * Loads everything at once; fine for hundreds of users. Beyond that, move to
 * pgvector nearest-neighbour search (see plan).
 */
export async function loadProfiles(): Promise<Map<string, TasteProfile>> {
  const [eligible, artistRows, trackRows, genreRows] = await Promise.all([
    db
      .select({ id: users.spotifyId })
      .from(users)
      .where(and(isNotNull(users.consentedAt), isNotNull(users.lastSyncedAt))),
    db.select().from(userTopArtists),
    db
      .select({
        userId: userTopTracks.userId,
        id: userTopTracks.trackId,
        rank: userTopTracks.rank,
        timeRange: userTopTracks.timeRange,
        artistIds: tracks.artistIds,
      })
      .from(userTopTracks)
      .innerJoin(tracks, eq(tracks.id, userTopTracks.trackId)),
    db.select({ id: artists.id, genres: artists.genres }).from(artists),
  ]);

  const genres = new Map(genreRows.map((r) => [r.id, r.genres]));
  const genresOf = (id: string) => genres.get(id) ?? [];

  const byUser = new Map<string, { artists: RankedArtist[]; tracks: RankedTrack[] }>();
  for (const { id } of eligible) byUser.set(id, { artists: [], tracks: [] });
  for (const r of artistRows) {
    byUser.get(r.userId)?.artists.push({ id: r.artistId, rank: r.rank, timeRange: r.timeRange });
  }
  for (const r of trackRows) {
    byUser.get(r.userId)?.tracks.push({ id: r.id, rank: r.rank, timeRange: r.timeRange, artistIds: r.artistIds });
  }

  const profiles = new Map<string, TasteProfile>();
  for (const [id, data] of byUser) profiles.set(id, buildProfile(data.artists, data.tracks, genresOf));
  return profiles;
}

function pairRows(pairs: ScoredPair[]) {
  return pairs.map((p) => ({
    userA: p.a,
    userB: p.b,
    score: p.score,
    artistScore: p.artistScore,
    genreScore: p.genreScore,
    trackScore: p.trackScore,
    shared: p.shared,
  }));
}

/** Recomputes one user's matches against everyone else. Returns the match count. */
export async function recomputeFor(userId: string): Promise<number> {
  const profiles = await loadProfiles();
  const pairs = computePairs(profiles, userId);
  await runBatch([
    db.delete(similarities).where(or(eq(similarities.userA, userId), eq(similarities.userB, userId))),
    ...chunk(pairRows(pairs), 500).map((rows) => db.insert(similarities).values(rows)),
  ]);
  return pairs.length;
}

/** Recomputes every pair. Used by the seed script. */
export async function recomputeAll(): Promise<number> {
  const profiles = await loadProfiles();
  const pairs = computePairs(profiles);
  await runBatch([
    db.delete(similarities),
    ...chunk(pairRows(pairs), 500).map((rows) => db.insert(similarities).values(rows)),
  ]);
  return pairs.length;
}
