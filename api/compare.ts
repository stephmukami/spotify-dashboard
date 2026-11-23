// GET /api/compare?id=<publicId> -> why I'm connected to this user
import { and, eq, inArray } from "drizzle-orm";
import type { CompareResponse } from "../shared/types.js";
import { requireUserId } from "./_lib/auth.js";
import { db } from "./_lib/db.js";
import { handler, HttpError, json } from "./_lib/http.js";
import { artists, similarities, users } from "./_lib/schema.js";
import { isListed, publicView } from "./_lib/users.js";

export const GET = handler(async (request) => {
  const meId = await requireUserId(request);
  const publicId = new URL(request.url).searchParams.get("id");
  if (!publicId) throw new HttpError(400, "id is required");

  // Validate before querying: public_id is a uuid column and bad input would error in Postgres.
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) throw new HttpError(404, "User not found");

  const [other] = await db.select().from(users).where(eq(users.publicId, publicId));
  if (!other || other.spotifyId === meId || !isListed(other)) throw new HttpError(404, "User not found");

  const [a, b] = meId < other.spotifyId ? [meId, other.spotifyId] : [other.spotifyId, meId];
  const [edge] = await db
    .select()
    .from(similarities)
    .where(and(eq(similarities.userA, a), eq(similarities.userB, b)));

  // Only users connected (directly) to me can be compared, so the graph's
  // second-degree nodes reveal nothing beyond the name/picture already shown.
  if (!edge) throw new HttpError(404, "You are not directly matched with this user");

  const artistRows = edge.shared.artists.length
    ? await db.select().from(artists).where(inArray(artists.id, edge.shared.artists))
    : [];
  const byId = new Map(artistRows.map((r) => [r.id, r]));

  const view = publicView(other);
  const response: CompareResponse = {
    user: { id: other.publicId, label: view.label, image: view.image },
    score: edge.score,
    artistScore: edge.artistScore,
    genreScore: edge.genreScore,
    trackScore: edge.trackScore,
    sharedArtists: edge.shared.artists
      .map((id) => byId.get(id))
      .filter((r) => r !== undefined)
      .map((r) => ({ id: r.id, name: r.name, imageUrl: r.imageUrl })),
    sharedGenres: edge.shared.genres,
  };
  return json(response);
});
