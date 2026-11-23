import { describe, expect, it } from "vitest";
import {
  buildProfile,
  compare,
  computePairs,
  cosine,
  jaccard,
  MIN_EDGE_SCORE,
  rankWeight,
  selectEgoGraph,
  type Edge,
  type RankedArtist,
  type RankedTrack,
  type TasteProfile,
} from "./similarity.js";

const GENRES: Record<string, string[]> = {
  a1: ["afrobeats"],
  a2: ["afrobeats", "afropop"],
  a3: ["amapiano"],
  b1: ["metal"],
  b2: ["metal", "rock"],
  b3: ["rock"],
};
const genresOf = (id: string) => GENRES[id] ?? [];

function artists(...ids: string[]): RankedArtist[] {
  return ids.map((id, i) => ({ id, rank: i + 1, timeRange: "medium_term" }));
}
function tracks(...items: [string, string][]): RankedTrack[] {
  return items.map(([id, artistId], i) => ({ id, rank: i + 1, timeRange: "medium_term", artistIds: [artistId] }));
}

describe("primitives", () => {
  it("weights rank 1 highest and rank 50 lowest", () => {
    expect(rankWeight(1)).toBe(1);
    expect(rankWeight(50)).toBeCloseTo(0.02);
    expect(rankWeight(80)).toBe(0);
  });

  it("cosine is 1 for identical vectors and 0 for disjoint ones", () => {
    const a = new Map([["x", 1], ["y", 2]]);
    expect(cosine(a, new Map(a))).toBeCloseTo(1);
    expect(cosine(a, new Map([["z", 1]]))).toBe(0);
    expect(cosine(a, new Map())).toBe(0);
  });

  it("jaccard handles overlap and empty sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  });
});

describe("buildProfile", () => {
  it("sums artist weights across time ranges and derives genres", () => {
    const p = buildProfile(
      [
        { id: "a1", rank: 1, timeRange: "medium_term" },
        { id: "a1", rank: 1, timeRange: "short_term" },
      ],
      [],
      genresOf,
    );
    expect(p.artists.get("a1")).toBeCloseTo(1.5);
    expect(p.genres.get("afrobeats")).toBeCloseTo(1.5);
  });

  it("gives track artists' genres half weight", () => {
    const p = buildProfile([], tracks(["t1", "b1"]), genresOf);
    expect(p.genres.get("metal")).toBeCloseTo(0.5);
    expect(p.tracks.has("t1")).toBe(true);
  });
});

describe("compare", () => {
  const afro = buildProfile(artists("a1", "a2", "a3"), tracks(["t1", "a1"], ["t2", "a2"]), genresOf);
  const metal = buildProfile(artists("b1", "b2", "b3"), tracks(["t9", "b1"]), genresOf);

  it("scores identical profiles 1", () => {
    const r = compare(afro, afro);
    expect(r.score).toBeCloseTo(1);
    expect(r.shared.artists[0]).toBe("a1");
    expect(r.shared.genres).toContain("afrobeats");
  });

  it("scores disjoint profiles 0", () => {
    const r = compare(afro, metal);
    expect(r.score).toBe(0);
    expect(r.shared.artists).toEqual([]);
  });

  it("renormalises when one user has no genre data", () => {
    const noGenres: TasteProfile = { ...afro, genres: new Map() };
    const r = compare(afro, noGenres);
    expect(r.genreScore).toBeNull();
    // Same artists and tracks, so still a perfect match on what we can compare.
    expect(r.score).toBeCloseTo(1);
  });

  it("returns 0 when there is nothing to compare", () => {
    const empty: TasteProfile = { artists: new Map(), genres: new Map(), tracks: new Set() };
    expect(compare(empty, afro).score).toBe(0);
  });
});

describe("computePairs", () => {
  const profiles = new Map<string, TasteProfile>([
    ["u1", buildProfile(artists("a1", "a2"), [], genresOf)],
    ["u2", buildProfile(artists("a2", "a1"), [], genresOf)],
    ["u3", buildProfile(artists("b1"), [], genresOf)],
  ]);

  it("keeps only pairs above the threshold, ordered a < b", () => {
    const pairs = computePairs(profiles);
    expect(pairs.map((p) => [p.a, p.b])).toEqual([["u1", "u2"]]);
    expect(pairs.every((p) => p.score >= MIN_EDGE_SCORE)).toBe(true);
  });

  it("only compares the given user when forUser is set", () => {
    expect(computePairs(profiles, "u3")).toEqual([]);
    expect(computePairs(profiles, "u2")).toHaveLength(1);
  });
});

describe("selectEgoGraph", () => {
  // "me" is connected to 15 users with decreasing scores; m0 has its own matches.
  const edges: Edge[] = [
    ...Array.from({ length: 15 }, (_, i) => ({ a: "me", b: `m${i}`, score: 0.9 - i * 0.01 })),
    { a: "m0", b: "x1", score: 0.8 },
    { a: "m0", b: "x2", score: 0.7 },
    { a: "m0", b: "x3", score: 0.6 },
    { a: "m0", b: "x4", score: 0.5 },
    { a: "hidden", b: "me", score: 0.99 },
  ];
  const visible = (id: string) => id !== "hidden";

  it("caps first-degree matches at 10, best first", () => {
    const g = selectEgoGraph("me", edges, visible);
    expect(g.first).toHaveLength(10);
    expect(g.first[0]).toBe("m0");
    expect(g.first).not.toContain("m10");
  });

  it("excludes users that are not visible", () => {
    const g = selectEgoGraph("me", edges, visible);
    expect(g.first).not.toContain("hidden");
    expect(g.edges.some((e) => e.a === "hidden" || e.b === "hidden")).toBe(false);
  });

  it("adds the top 3 matches of each match as second degree", () => {
    const g = selectEgoGraph("me", edges, visible);
    expect(g.second.sort()).toEqual(["x1", "x2", "x3"]);
    expect(g.edges).toHaveLength(13);
  });
});
