import type { TimeRange } from "./similarity.js";
import { HttpError } from "./http.js";

const API = "https://api.spotify.com/v1";

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  images?: SpotifyImage[];
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album?: { images?: SpotifyImage[] };
}

interface Paging<T> {
  items: T[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function spotifyGet<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    await sleep(Math.min(retryAfter, 10) * 1000);
    return spotifyGet(token, path, attempt + 1);
  }
  if (res.status === 401) {
    throw new HttpError(401, "Spotify token expired. Please log in again.");
  }
  if (!res.ok) {
    throw new HttpError(502, `Spotify ${path} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export function getMe(token: string) {
  return spotifyGet<SpotifyUser>(token, "/me");
}

export const RANGES: TimeRange[] = ["short_term", "medium_term", "long_term"];

export interface FetchedTaste {
  topArtists: { artist: SpotifyArtist; rank: number; timeRange: TimeRange }[];
  topTracks: { track: SpotifyTrack; rank: number; timeRange: TimeRange }[];
  /** Every artist seen (top artists plus artists of top tracks), with genres where available. */
  artists: Map<string, SpotifyArtist>;
}

/** Fetches top artists and tracks for all three time ranges (6 calls, plus 1+ for genres). */
export async function fetchTaste(token: string): Promise<FetchedTaste> {
  const [artistPages, trackPages] = await Promise.all([
    Promise.all(
      RANGES.map((r) => spotifyGet<Paging<SpotifyArtist>>(token, `/me/top/artists?time_range=${r}&limit=50`)),
    ),
    Promise.all(
      RANGES.map((r) => spotifyGet<Paging<SpotifyTrack>>(token, `/me/top/tracks?time_range=${r}&limit=50`)),
    ),
  ]);

  const artists = new Map<string, SpotifyArtist>();
  const topArtists: FetchedTaste["topArtists"] = [];
  artistPages.forEach((page, i) =>
    page.items.forEach((artist, idx) => {
      artists.set(artist.id, artist);
      topArtists.push({ artist, rank: idx + 1, timeRange: RANGES[i] });
    }),
  );

  const topTracks: FetchedTaste["topTracks"] = [];
  trackPages.forEach((page, i) =>
    page.items.forEach((track, idx) => {
      topTracks.push({ track, rank: idx + 1, timeRange: RANGES[i] });
      for (const a of track.artists) {
        if (!artists.has(a.id)) artists.set(a.id, { id: a.id, name: a.name });
      }
    }),
  );

  // Track artists come without genres or images; look them up 50 at a time.
  const missing = [...artists.values()].filter((a) => a.genres === undefined).map((a) => a.id);
  for (let i = 0; i < missing.length; i += 50) {
    const ids = missing.slice(i, i + 50).join(",");
    try {
      const res = await spotifyGet<{ artists: (SpotifyArtist | null)[] }>(token, `/artists?ids=${ids}`);
      for (const a of res.artists) if (a) artists.set(a.id, a);
    } catch (e) {
      // Spotify has restricted some endpoints for development-mode apps.
      // Genres for these artists are a nice-to-have, so carry on without them.
      console.warn("Could not fetch artist details for track artists:", e);
      break;
    }
  }

  return { topArtists, topTracks, artists };
}
