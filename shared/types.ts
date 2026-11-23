// Types and constants shared by the React app (src/) and the API (api/).

/** Bump this when the terms change; users must accept the new version. */
export const TERMS_VERSION = "2026-11-v1";

export const VISIBILITIES = ["public", "anonymous", "hidden"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export interface SessionUser {
  /** Opaque id shown to other users. Never the Spotify id. */
  publicId: string;
  displayName: string | null;
  imageUrl: string | null;
  visibility: Visibility;
}

export interface SessionResponse {
  user: SessionUser;
  hasConsented: boolean;
  lastSyncedAt: string | null;
}

export interface SyncResponse {
  artists: number;
  tracks: number;
  genres: number;
  matches: number;
}

export interface GraphNode {
  id: string;
  label: string;
  image: string | null;
  isMe: boolean;
  /** 0 = me, 1 = my match, 2 = a match of my match. */
  degree: 0 | 1 | 2;
}

export interface GraphLink {
  source: string;
  target: string;
  score: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ArtistSummary {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface CompareResponse {
  user: { id: string; label: string; image: string | null };
  score: number;
  artistScore: number | null;
  genreScore: number | null;
  trackScore: number | null;
  sharedArtists: ArtistSummary[];
  sharedGenres: string[];
}

export interface MeResponse {
  user: SessionUser;
  topArtists: (ArtistSummary & { weight: number; genres: string[] })[];
  topGenres: { genre: string; weight: number }[];
  topTrackCount: number;
  matchCount: number;
  bestMatch: { label: string; score: number } | null;
}
