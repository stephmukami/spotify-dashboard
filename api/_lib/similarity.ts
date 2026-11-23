// Taste matching. Pure functions only (no I/O), so this is unit-testable and
// the numbers here are exactly what the /how-it-works page describes.

import {
  COMPONENT_WEIGHTS,
  FIRST_DEGREE_LIMIT,
  MIN_EDGE_SCORE,
  SECOND_DEGREE_LIMIT,
  TIME_RANGE_WEIGHTS,
  TRACK_GENRE_FACTOR,
  type TimeRange,
} from "../../shared/matching.js";

export {
  COMPONENT_WEIGHTS,
  FIRST_DEGREE_LIMIT,
  MIN_EDGE_SCORE,
  SECOND_DEGREE_LIMIT,
  TIME_RANGE_WEIGHTS,
  type TimeRange,
};

export interface RankedArtist {
  id: string;
  /** 1-based position in Spotify's top list. */
  rank: number;
  timeRange: TimeRange;
}

export interface RankedTrack extends RankedArtist {
  artistIds: string[];
}

export interface TasteProfile {
  artists: Map<string, number>;
  genres: Map<string, number>;
  tracks: Set<string>;
}

/** #1 gets 1.0, #50 gets 0.02. */
export function rankWeight(rank: number): number {
  return Math.max(0, (51 - rank) / 50);
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

export function buildProfile(
  topArtists: RankedArtist[],
  topTracks: RankedTrack[],
  genresOf: (artistId: string) => string[],
): TasteProfile {
  const artists = new Map<string, number>();
  const genres = new Map<string, number>();
  const tracks = new Set<string>();

  for (const a of topArtists) {
    const w = rankWeight(a.rank) * TIME_RANGE_WEIGHTS[a.timeRange];
    add(artists, a.id, w);
    for (const g of genresOf(a.id)) add(genres, g, w);
  }

  for (const t of topTracks) {
    tracks.add(t.id);
    if (t.artistIds.length === 0) continue;
    const w = (rankWeight(t.rank) * TIME_RANGE_WEIGHTS[t.timeRange] * TRACK_GENRE_FACTOR) / t.artistIds.length;
    for (const artistId of t.artistIds) {
      for (const g of genresOf(artistId)) add(genres, g, w);
    }
  }

  return { artists, genres, tracks };
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) dot += v * (large.get(k) ?? 0);
  if (dot === 0) return 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Keys present in both maps, strongest shared interest first. */
function sharedKeys(a: Map<string, number>, b: Map<string, number>, limit: number): string[] {
  const shared: [string, number][] = [];
  for (const [k, v] of a) {
    const other = b.get(k);
    if (other !== undefined) shared.push([k, Math.min(v, other)]);
  }
  return shared
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([k]) => k);
}

export interface Comparison {
  score: number;
  /** null when one of the users has no data for that signal. */
  artistScore: number | null;
  genreScore: number | null;
  trackScore: number | null;
  shared: { artists: string[]; genres: string[] };
}

export function compare(a: TasteProfile, b: TasteProfile): Comparison {
  const parts = {
    artists: a.artists.size && b.artists.size ? cosine(a.artists, b.artists) : null,
    genres: a.genres.size && b.genres.size ? cosine(a.genres, b.genres) : null,
    tracks: a.tracks.size && b.tracks.size ? jaccard(a.tracks, b.tracks) : null,
  };

  // Signals one side lacks (e.g. Spotify returned no genres) are dropped and
  // the remaining weights renormalised, instead of counting as a mismatch.
  let total = 0;
  let weightSum = 0;
  for (const key of ["artists", "genres", "tracks"] as const) {
    const value = parts[key];
    if (value === null) continue;
    total += value * COMPONENT_WEIGHTS[key];
    weightSum += COMPONENT_WEIGHTS[key];
  }

  return {
    score: weightSum === 0 ? 0 : total / weightSum,
    artistScore: parts.artists,
    genreScore: parts.genres,
    trackScore: parts.tracks,
    shared: {
      artists: sharedKeys(a.artists, b.artists, 10),
      genres: sharedKeys(a.genres, b.genres, 10),
    },
  };
}

export interface ScoredPair extends Comparison {
  /** Always a < b, matching the similarities table. */
  a: string;
  b: string;
}

/**
 * Compares `forUser` against everyone else (or every pair, when forUser is
 * omitted) and keeps pairs at or above MIN_EDGE_SCORE.
 */
export function computePairs(profiles: Map<string, TasteProfile>, forUser?: string): ScoredPair[] {
  const ids = [...profiles.keys()].sort();
  const pairs: ScoredPair[] = [];

  const consider = (x: string, y: string) => {
    const [a, b] = x < y ? [x, y] : [y, x];
    const result = compare(profiles.get(a)!, profiles.get(b)!);
    if (result.score >= MIN_EDGE_SCORE) pairs.push({ a, b, ...result });
  };

  if (forUser !== undefined) {
    if (!profiles.has(forUser)) return [];
    for (const other of ids) if (other !== forUser) consider(forUser, other);
  } else {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) consider(ids[i], ids[j]);
    }
  }
  return pairs;
}

export interface Edge {
  a: string;
  b: string;
  score: number;
}

export interface EgoGraph {
  first: string[];
  second: string[];
  edges: Edge[];
}

/**
 * Picks the subgraph shown on the graph page: my top matches, plus the top
 * matches of each of those, limited to users that `isVisible` allows.
 */
export function selectEgoGraph(
  me: string,
  edges: Edge[],
  isVisible: (id: string) => boolean,
  firstLimit = FIRST_DEGREE_LIMIT,
  secondLimit = SECOND_DEGREE_LIMIT,
): EgoGraph {
  const byUser = new Map<string, { other: string; edge: Edge }[]>();
  for (const e of edges) {
    for (const [self, other] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      if (other !== me && !isVisible(other)) continue;
      if (!byUser.has(self)) byUser.set(self, []);
      byUser.get(self)!.push({ other, edge: e });
    }
  }
  for (const list of byUser.values()) list.sort((x, y) => y.edge.score - x.edge.score);

  const first = (byUser.get(me) ?? []).slice(0, firstLimit);
  const firstIds = new Set(first.map((n) => n.other));
  const selected = new Map<string, Edge>();
  const key = (e: Edge) => `${e.a}|${e.b}`;
  for (const n of first) selected.set(key(n.edge), n.edge);

  const second = new Set<string>();
  for (const f of firstIds) {
    const around = (byUser.get(f) ?? []).filter((n) => n.other !== me).slice(0, secondLimit);
    for (const n of around) {
      selected.set(key(n.edge), n.edge);
      if (!firstIds.has(n.other)) second.add(n.other);
    }
  }

  return { first: [...firstIds], second: [...second], edges: [...selected.values()] };
}
