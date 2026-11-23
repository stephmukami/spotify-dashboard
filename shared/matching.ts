// Matching constants, shared so the /how-it-works page always shows the
// numbers the algorithm actually uses (api/_lib/similarity.ts).

export type TimeRange = "short_term" | "medium_term" | "long_term";

/** Recent listening matters, but all-time favourites say more about taste than last month. */
export const TIME_RANGE_WEIGHTS: Record<TimeRange, number> = {
  short_term: 0.5,
  medium_term: 1,
  long_term: 0.75,
};

/** How much each signal counts towards the final score. */
export const COMPONENT_WEIGHTS = { artists: 0.5, genres: 0.3, tracks: 0.2 } as const;

/** Track artists' genres count for less than top artists' genres. */
export const TRACK_GENRE_FACTOR = 0.5;

/** Pairs scoring below this are not stored or shown. */
export const MIN_EDGE_SCORE = 0.15;
/** Matches shown around you on the graph. */
export const FIRST_DEGREE_LIMIT = 10;
/** Matches shown around each of your matches. */
export const SECOND_DEGREE_LIMIT = 3;
