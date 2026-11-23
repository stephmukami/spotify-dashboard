import { jwtVerify, SignJWT } from "jose";
import { HttpError } from "./http.js";

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

function cookieAttributes(request: Request, maxAge: number): string {
  // Secure cookies need HTTPS; `vercel dev` serves plain http on 127.0.0.1.
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSessionCookie(request: Request, spotifyId: string): Promise<string> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(spotifyId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
  return `${COOKIE_NAME}=${token}; ${cookieAttributes(request, MAX_AGE_SECONDS)}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE_NAME}=; ${cookieAttributes(request, 0)}`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/** Returns the Spotify id of the logged-in user, or null. */
export async function getSessionUserId(request: Request): Promise<string | null> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function requireUserId(request: Request): Promise<string> {
  const id = await getSessionUserId(request);
  if (!id) throw new HttpError(401, "Not logged in");
  return id;
}
