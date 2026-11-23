// GET    /api/session  -> who am I (401 if not logged in)
// POST   /api/session  { accessToken } -> verify with Spotify, upsert user, set session cookie
// DELETE /api/session  -> log out
import { clearSessionCookie, createSessionCookie, getSessionUserId } from "./_lib/auth.js";
import { db } from "./_lib/db.js";
import { handler, HttpError, json, readJson } from "./_lib/http.js";
import { users } from "./_lib/schema.js";
import { getMe } from "./_lib/spotify.js";
import { getUser, toSessionResponse } from "./_lib/users.js";

export const GET = handler(async (request) => {
  const id = await getSessionUserId(request);
  if (!id) throw new HttpError(401, "Not logged in");
  try {
    return json(toSessionResponse(await getUser(id)));
  } catch (e) {
    // Valid cookie but the account was deleted: clear the stale cookie.
    if (e instanceof HttpError && e.status === 401) {
      return json({ error: e.message }, { status: 401, headers: { "Set-Cookie": clearSessionCookie(request) } });
    }
    throw e;
  }
});

export const POST = handler(async (request) => {
  const { accessToken } = await readJson<{ accessToken?: string }>(request);
  if (!accessToken) throw new HttpError(400, "accessToken is required");

  // Never trust a user id from the client: ask Spotify who this token belongs to.
  const me = await getMe(accessToken);
  const profile = { displayName: me.display_name, imageUrl: me.images?.[0]?.url ?? null };

  const [row] = await db
    .insert(users)
    .values({ spotifyId: me.id, ...profile })
    .onConflictDoUpdate({ target: users.spotifyId, set: profile })
    .returning();

  return json(toSessionResponse(row), {
    headers: { "Set-Cookie": await createSessionCookie(request, me.id) },
  });
});

export const DELETE = handler(async (request) => {
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
});
