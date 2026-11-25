// Spotify login with Authorization Code + PKCE, entirely in the browser.
// The access token is only used to hand to our API (session + sync); the
// app's own session is an httpOnly cookie set by /api/session.

const CLIENT_ID = "6c5fab85d9c94622b7272efbab39b088";

// Only what matching needs. /v1/me (name, picture) works without extra scopes.
const SCOPES = ["user-top-read"];

const VERIFIER_KEY = "pkce_verifier";
const STATE_KEY = "pkce_state";
const TOKEN_KEY = "spotify_token";
// localStorage so it survives new tabs and return visits; the short-lived access token stays per-tab.
const REFRESH_KEY = "spotify_refresh_token";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

function storeTokens(data: TokenResponse) {
  sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }),
  );
  // Spotify may rotate the refresh token; keep the old one if none is returned.
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
}

/** Must exactly match a Redirect URI registered in the Spotify dashboard. */
export const redirectUri = () => `${window.location.origin}/callback`;

function randomString(length: number) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => possible[v % possible.length]).join("");
}

async function codeChallenge(verifier: string) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function startLogin() {
  const verifier = randomString(128);
  const state = randomString(32);
  // The verifier never leaves the browser; `state` is a separate CSRF token.
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: await codeChallenge(verifier),
    state,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/** Handles the /callback query string. Returns a Spotify access token or throws a user-facing Error. */
export async function completeLogin(search: URLSearchParams): Promise<string> {
  const error = search.get("error");
  if (error) {
    throw new Error(error === "access_denied" ? "You cancelled the Spotify login." : `Spotify error: ${error}`);
  }

  const code = search.get("code");
  const state = search.get("state");
  const expectedState = localStorage.getItem(STATE_KEY);
  const verifier = localStorage.getItem(VERIFIER_KEY);

  // Single-use: clear before the request so a refresh can't replay them.
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);

  if (!code) throw new Error("No authorisation code in the URL.");
  if (!state || state !== expectedState) throw new Error("Login could not be verified. Please try again.");
  if (!verifier) {
    throw new Error(`Login session not found. Start the login from ${window.location.origin}.`);
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Could not complete login (${data.error ?? res.status}).`);

  storeTokens(data);
  return data.access_token;
}

/** The Spotify token from this tab's login, if it is still valid for at least a minute. */
function getSpotifyToken(): string | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null");
    if (stored && stored.expiresAt - Date.now() > 60_000) return stored.accessToken;
  } catch {
    // Corrupt value: treat as logged out of Spotify.
  }
  return null;
}

let inFlightRefresh: Promise<string | null> | null = null;

/** Exchanges the stored refresh token for a new access token. Returns null if there is none or it was revoked. */
export function refreshSpotifyToken(): Promise<string | null> {
  // Share one request between concurrent callers: a rotated refresh token can only be used once.
  inFlightRefresh ??= (async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLIENT_ID }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 400 = invalid_grant (revoked or expired): the user has to log in again.
        if (res.status === 400) clearSpotifyToken();
        return null;
      }
      storeTokens(data as TokenResponse);
      return (data as TokenResponse).access_token;
    } catch {
      return null; // network error: keep the refresh token for next time
    }
  })().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

/** A usable Spotify access token, refreshing it if needed. Null means the user must log in to Spotify again. */
export async function getValidSpotifyToken({ forceRefresh = false } = {}): Promise<string | null> {
  if (!forceRefresh) {
    const token = getSpotifyToken();
    if (token) return token;
  }
  return refreshSpotifyToken();
}

export function clearSpotifyToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("access_token"); // left over from the first version of the app
}
