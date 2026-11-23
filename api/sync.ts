// POST /api/sync { accessToken } -> fetch top artists/tracks from Spotify, store them, recompute matches
import { eq, sql } from "drizzle-orm";
import type { SyncResponse } from "../shared/types.js";
import { requireUserId } from "./_lib/auth.js";
import { db } from "./_lib/db.js";
import { handler, HttpError, json, readJson } from "./_lib/http.js";
import { chunk, recomputeFor, runBatch } from "./_lib/profiles.js";
import { artists, tracks, userGenres, users, userTopArtists, userTopTracks } from "./_lib/schema.js";
import { buildProfile } from "./_lib/similarity.js";
import { fetchTaste, getMe } from "./_lib/spotify.js";
import { getUser } from "./_lib/users.js";

export const POST = handler(async (request) => {
  const userId = await requireUserId(request);
  const { accessToken } = await readJson<{ accessToken?: string }>(request);
  if (!accessToken) throw new HttpError(400, "accessToken is required");

  const user = await getUser(userId);
  if (!user.consentedAt) throw new HttpError(403, "Accept the terms before syncing");

  // The token must belong to the logged-in user, or someone could sync
  // another person's listening data into their own account.
  const me = await getMe(accessToken);
  if (me.id !== userId) throw new HttpError(403, "Spotify token belongs to a different account");

  const taste = await fetchTaste(accessToken);

  const artistRows = [...taste.artists.values()].map((a) => ({
    id: a.id,
    name: a.name,
    genres: a.genres ?? [],
    imageUrl: a.images?.[0]?.url ?? null,
  }));

  const trackMap = new Map(taste.topTracks.map((t) => [t.track.id, t.track]));
  const trackRows = [...trackMap.values()].map((t) => ({
    id: t.id,
    name: t.name,
    artistIds: t.artists.map((a) => a.id),
    imageUrl: t.album?.images?.[0]?.url ?? null,
  }));

  const genresOf = (id: string) => taste.artists.get(id)?.genres ?? [];
  const profile = buildProfile(
    taste.topArtists.map((t) => ({ id: t.artist.id, rank: t.rank, timeRange: t.timeRange })),
    taste.topTracks.map((t) => ({
      id: t.track.id,
      rank: t.rank,
      timeRange: t.timeRange,
      artistIds: t.track.artists.map((a) => a.id),
    })),
    genresOf,
  );

  await runBatch([
    ...chunk(artistRows, 500).map((rows) =>
      db
        .insert(artists)
        .values(rows)
        .onConflictDoUpdate({
          target: artists.id,
          set: {
            name: sql`excluded.name`,
            // Don't wipe known genres/images when a lookup came back empty.
            genres: sql`case when cardinality(excluded.genres) > 0 then excluded.genres else ${artists.genres} end`,
            imageUrl: sql`coalesce(excluded.image_url, ${artists.imageUrl})`,
          },
        }),
    ),
    ...chunk(trackRows, 500).map((rows) =>
      db
        .insert(tracks)
        .values(rows)
        .onConflictDoUpdate({
          target: tracks.id,
          set: {
            name: sql`excluded.name`,
            artistIds: sql`excluded.artist_ids`,
            imageUrl: sql`coalesce(excluded.image_url, ${tracks.imageUrl})`,
          },
        }),
    ),
    db.delete(userTopArtists).where(eq(userTopArtists.userId, userId)),
    db.delete(userTopTracks).where(eq(userTopTracks.userId, userId)),
    db.delete(userGenres).where(eq(userGenres.userId, userId)),
    ...chunk(taste.topArtists, 500).map((rows) =>
      db.insert(userTopArtists).values(
        rows.map((t) => ({ userId, artistId: t.artist.id, timeRange: t.timeRange, rank: t.rank })),
      ),
    ),
    ...chunk(taste.topTracks, 500).map((rows) =>
      db.insert(userTopTracks).values(
        rows.map((t) => ({ userId, trackId: t.track.id, timeRange: t.timeRange, rank: t.rank })),
      ),
    ),
    ...chunk([...profile.genres], 500).map((rows) =>
      db.insert(userGenres).values(rows.map(([genre, weight]) => ({ userId, genre, weight }))),
    ),
    db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.spotifyId, userId)),
  ]);

  const matches = await recomputeFor(userId);

  const result: SyncResponse = {
    artists: profile.artists.size,
    tracks: profile.tracks.size,
    genres: profile.genres.size,
    matches,
  };
  return json(result);
});
