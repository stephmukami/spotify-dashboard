// Creates synthetic "Demo listener" users so the graph has something to show
// while the Spotify app is limited to a handful of real accounts.
//
//   npm run seed         replace demo users (run after your own first sync)
//   npm run seed:clear   remove demo users
//
// Demo users are built from the real artists already in the database (from
// real users' syncs), grouped into taste clusters, so they overlap with real
// people in believable ways. With an empty database it falls back to a
// made-up catalogue, which won't overlap with anyone real.

import { eq, like, not } from "drizzle-orm";
import { TERMS_VERSION, type Visibility } from "../shared/types.js";
import { db } from "../api/_lib/db.js";
import { chunk, recomputeAll, runBatch } from "../api/_lib/profiles.js";
import { artists, tracks, userGenres, users, userTopArtists, userTopTracks } from "../api/_lib/schema.js";
import { buildProfile, type RankedArtist, type RankedTrack, type TimeRange } from "../api/_lib/similarity.js";

const USER_COUNT = 50;
const CLUSTERS = 6;
const ARTISTS_PER_USER = 30;
const PREFIX = "synthetic-";

// Seeded RNG so runs are reproducible.
let seed = 42;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sample = <T>(items: T[], n: number) => shuffle(items).slice(0, n);

async function clear() {
  await db.delete(users).where(eq(users.isSynthetic, true)); // cascades to their rows
  await runBatch([
    db.delete(tracks).where(like(tracks.id, `${PREFIX}%`)),
    db.delete(artists).where(like(artists.id, `${PREFIX}%`)),
  ]);
}

const FALLBACK_GENRES = [
  ["afrobeats", "afropop"],
  ["amapiano", "south african house"],
  ["indie rock", "alternative"],
  ["hip hop", "trap"],
  ["r&b", "neo soul"],
  ["techno", "house"],
];

async function fallbackCatalogue() {
  const artistRows = FALLBACK_GENRES.flatMap((genres, g) =>
    Array.from({ length: 15 }, (_, i) => ({
      id: `${PREFIX}artist-${g}-${i}`,
      name: `Demo Artist ${g * 15 + i + 1}`,
      genres,
      imageUrl: null,
    })),
  );
  const trackRows = artistRows.flatMap((a) =>
    [1, 2, 3].map((n) => ({ id: `${a.id}-track-${n}`, name: `${a.name} Song ${n}`, artistIds: [a.id], imageUrl: null })),
  );
  await runBatch([
    ...chunk(artistRows, 500).map((rows) => db.insert(artists).values(rows)),
    ...chunk(trackRows, 500).map((rows) => db.insert(tracks).values(rows)),
  ]);
  return { artistRows, trackRows };
}

/** Assigns ranks for all three time ranges, with some reshuffling between ranges. */
function rankAcrossRanges<T extends { id: string }>(items: T[]): { item: T; rank: number; timeRange: TimeRange }[] {
  const medium = items;
  const long = shuffle(items.slice(0, Math.ceil(items.length * 0.8)).concat(items.slice(-3)));
  const short = shuffle(items.slice(0, Math.ceil(items.length * 0.6)));
  const out: { item: T; rank: number; timeRange: TimeRange }[] = [];
  const seen = new Set<string>();
  for (const [range, list] of [
    ["medium_term", medium],
    ["long_term", long],
    ["short_term", short],
  ] as const) {
    seen.clear();
    list.slice(0, 50).forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      out.push({ item, rank: seen.size, timeRange: range });
    });
  }
  return out;
}

async function main() {
  if (process.argv.includes("--clear")) {
    await clear();
    const pairs = await recomputeAll();
    console.log(`Removed demo users. ${pairs} matches remain between real users.`);
    return;
  }

  await clear();

  let catalogue = await db.select().from(artists).where(not(like(artists.id, `${PREFIX}%`)));
  let trackCatalogue = await db.select().from(tracks).where(not(like(tracks.id, `${PREFIX}%`)));
  if (catalogue.length < 30) {
    console.warn(
      `Only ${catalogue.length} real artists in the database. Using a made-up catalogue instead; ` +
        "sync your own account first for demo users that overlap with you.",
    );
    const fb = await fallbackCatalogue();
    catalogue = fb.artistRows;
    trackCatalogue = fb.trackRows;
  }

  // Sort by main genre, then slice into clusters, so each cluster has a coherent sound.
  const sorted = [...catalogue].sort((a, b) => (a.genres[0] ?? "~").localeCompare(b.genres[0] ?? "~"));
  const size = Math.ceil(sorted.length / CLUSTERS);
  const pools = Array.from({ length: CLUSTERS }, (_, c) => sorted.slice(c * size, (c + 1) * size));

  const tracksByArtist = new Map<string, typeof trackCatalogue>();
  for (const t of trackCatalogue) {
    for (const a of t.artistIds) {
      if (!tracksByArtist.has(a)) tracksByArtist.set(a, []);
      tracksByArtist.get(a)!.push(t);
    }
  }
  const genresById = new Map(catalogue.map((a) => [a.id, a.genres]));

  const userRows: (typeof users.$inferInsert)[] = [];
  const topArtistRows: (typeof userTopArtists.$inferInsert)[] = [];
  const topTrackRows: (typeof userTopTracks.$inferInsert)[] = [];
  const genreRows: (typeof userGenres.$inferInsert)[] = [];
  const now = new Date();

  for (let i = 0; i < USER_COUNT; i++) {
    const id = `${PREFIX}user-${i + 1}`;
    const pool = pools[i % CLUSTERS];
    // Mostly from their cluster, some from anywhere: tribes with bridges between them.
    const fromCluster = sample(pool, Math.round(ARTISTS_PER_USER * 0.8));
    const fromAnywhere = sample(catalogue, ARTISTS_PER_USER - fromCluster.length);
    const chosen = [...new Map([...fromCluster, ...fromAnywhere].map((a) => [a.id, a])).values()];

    const chosenTracks = shuffle(chosen.flatMap((a) => (tracksByArtist.get(a.id) ?? []).slice(0, 2))).slice(0, 40);

    const visibility: Visibility = i % 10 === 9 ? "hidden" : i % 5 === 4 ? "anonymous" : "public";
    userRows.push({
      spotifyId: id,
      displayName: `Demo listener ${i + 1}`,
      imageUrl: null,
      visibility,
      termsVersion: TERMS_VERSION,
      consentedAt: now,
      lastSyncedAt: now,
      isSynthetic: true,
    });

    const rankedArtists = rankAcrossRanges(shuffle(chosen));
    const rankedTracks = rankAcrossRanges(chosenTracks);
    for (const r of rankedArtists) {
      topArtistRows.push({ userId: id, artistId: r.item.id, timeRange: r.timeRange, rank: r.rank });
    }
    for (const r of rankedTracks) {
      topTrackRows.push({ userId: id, trackId: r.item.id, timeRange: r.timeRange, rank: r.rank });
    }

    const profile = buildProfile(
      rankedArtists.map((r): RankedArtist => ({ id: r.item.id, rank: r.rank, timeRange: r.timeRange })),
      rankedTracks.map((r): RankedTrack => ({
        id: r.item.id,
        rank: r.rank,
        timeRange: r.timeRange,
        artistIds: r.item.artistIds,
      })),
      (artistId) => genresById.get(artistId) ?? [],
    );
    for (const [genre, weight] of profile.genres) genreRows.push({ userId: id, genre, weight });
  }

  await runBatch([
    ...chunk(userRows, 500).map((rows) => db.insert(users).values(rows)),
    ...chunk(topArtistRows, 500).map((rows) => db.insert(userTopArtists).values(rows)),
    ...chunk(topTrackRows, 500).map((rows) => db.insert(userTopTracks).values(rows)),
    ...chunk(genreRows, 500).map((rows) => db.insert(userGenres).values(rows)),
  ]);

  const pairs = await recomputeAll();
  console.log(`Created ${USER_COUNT} demo users from ${catalogue.length} artists. ${pairs} matches computed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
