// GET /api/graph -> my ego graph: me, my top matches, and their top matches
import { inArray, or } from "drizzle-orm";
import type { GraphNode, GraphResponse } from "../shared/types.js";
import { requireUserId } from "./_lib/auth.js";
import { db } from "./_lib/db.js";
import { handler, json } from "./_lib/http.js";
import { similarities, users } from "./_lib/schema.js";
import { selectEgoGraph, type Edge } from "./_lib/similarity.js";
import { getUser, isListed, publicView, type UserRow } from "./_lib/users.js";

async function edgesTouching(ids: string[]): Promise<Edge[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ a: similarities.userA, b: similarities.userB, score: similarities.score })
    .from(similarities)
    .where(or(inArray(similarities.userA, ids), inArray(similarities.userB, ids)));
  return rows;
}

export const GET = handler(async (request) => {
  const meId = await requireUserId(request);
  const me = await getUser(meId);

  // My edges first, to learn who my neighbours are; then their edges.
  const myEdges = await edgesTouching([meId]);
  const neighbourIds = [...new Set(myEdges.flatMap((e) => [e.a, e.b]))].filter((id) => id !== meId);
  const edges = [...myEdges, ...(await edgesTouching(neighbourIds))];

  const involved = [...new Set(edges.flatMap((e) => [e.a, e.b]))];
  const rows: UserRow[] = involved.length ? await db.select().from(users).where(inArray(users.spotifyId, involved)) : [];
  const byId = new Map(rows.map((r) => [r.spotifyId, r]));
  byId.set(meId, me);

  const ego = selectEgoGraph(meId, edges, (id) => {
    const row = byId.get(id);
    return row !== undefined && isListed(row);
  });

  const node = (id: string, degree: GraphNode["degree"]): GraphNode => {
    const row = byId.get(id)!;
    // Show my own real name and picture to me, even if I'm anonymous to others.
    const view = degree === 0 ? { label: row.displayName ?? "You", image: row.imageUrl } : publicView(row);
    return { id: row.publicId, label: view.label, image: view.image, isMe: degree === 0, degree };
  };

  const response: GraphResponse = {
    nodes: [node(meId, 0), ...ego.first.map((id) => node(id, 1)), ...ego.second.map((id) => node(id, 2))],
    // Only ever expose public ids, never Spotify ids.
    links: ego.edges.map((e) => ({
      source: byId.get(e.a)!.publicId,
      target: byId.get(e.b)!.publicId,
      score: e.score,
    })),
  };
  return json(response);
});
