// POST /api/consent { termsVersion, visibility } -> record acceptance of the terms
import { eq } from "drizzle-orm";
import { TERMS_VERSION, VISIBILITIES, type Visibility } from "../shared/types.js";
import { requireUserId } from "./_lib/auth.js";
import { db } from "./_lib/db.js";
import { handler, HttpError, json, readJson } from "./_lib/http.js";
import { users } from "./_lib/schema.js";
import { toSessionResponse } from "./_lib/users.js";

export const POST = handler(async (request) => {
  const userId = await requireUserId(request);
  const body = await readJson<{ termsVersion?: string; visibility?: Visibility }>(request);

  if (body.termsVersion !== TERMS_VERSION) {
    throw new HttpError(409, "The terms have changed. Please reload and review them again.");
  }
  if (!body.visibility || !VISIBILITIES.includes(body.visibility)) {
    throw new HttpError(400, `visibility must be one of ${VISIBILITIES.join(", ")}`);
  }

  const [row] = await db
    .update(users)
    .set({ termsVersion: TERMS_VERSION, consentedAt: new Date(), visibility: body.visibility })
    .where(eq(users.spotifyId, userId))
    .returning();
  if (!row) throw new HttpError(401, "Account not found");

  return json(toSessionResponse(row));
});
