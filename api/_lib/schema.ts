import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { VISIBILITIES } from "../../shared/types.js";

export const users = pgTable("users", {
  spotifyId: text("spotify_id").primaryKey(),
  // Shown to other users instead of the Spotify id, which is often a username.
  publicId: uuid("public_id").notNull().unique().defaultRandom(),
  displayName: text("display_name"),
  imageUrl: text("image_url"),
  visibility: text("visibility", { enum: VISIBILITIES }).notNull().default("public"),
  termsVersion: text("terms_version"),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Catalogue tables: shared across users, not personal data.
export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  genres: text("genres").array().notNull().default([]),
  imageUrl: text("image_url"),
});

export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  artistIds: text("artist_ids").array().notNull().default([]),
  imageUrl: text("image_url"),
});

export const TIME_RANGES = ["short_term", "medium_term", "long_term"] as const;

export const userTopArtists = pgTable(
  "user_top_artists",
  {
    userId: text("user_id").notNull().references(() => users.spotifyId, { onDelete: "cascade" }),
    artistId: text("artist_id").notNull().references(() => artists.id),
    timeRange: text("time_range", { enum: TIME_RANGES }).notNull(),
    rank: integer("rank").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId, t.timeRange] })],
);

export const userTopTracks = pgTable(
  "user_top_tracks",
  {
    userId: text("user_id").notNull().references(() => users.spotifyId, { onDelete: "cascade" }),
    trackId: text("track_id").notNull().references(() => tracks.id),
    timeRange: text("time_range", { enum: TIME_RANGES }).notNull(),
    rank: integer("rank").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.trackId, t.timeRange] })],
);

export const userGenres = pgTable(
  "user_genres",
  {
    userId: text("user_id").notNull().references(() => users.spotifyId, { onDelete: "cascade" }),
    genre: text("genre").notNull(),
    weight: real("weight").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.genre] })],
);

export interface SharedTaste {
  artists: string[];
  genres: string[];
}

/** One row per pair of users above the match threshold. Always user_a < user_b. */
export const similarities = pgTable(
  "similarities",
  {
    userA: text("user_a").notNull().references(() => users.spotifyId, { onDelete: "cascade" }),
    userB: text("user_b").notNull().references(() => users.spotifyId, { onDelete: "cascade" }),
    score: real("score").notNull(),
    artistScore: real("artist_score"),
    genreScore: real("genre_score"),
    trackScore: real("track_score"),
    shared: jsonb("shared").$type<SharedTaste>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userA, t.userB] }), index("similarities_user_b_idx").on(t.userB)],
);
