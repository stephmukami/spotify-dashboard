import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const clientId = "6c5fab85d9c94622b7272efbab39b088";

// Fields from GET /v1/me that we display.
// https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile
interface SpotifyProfile {
  display_name: string | null;
  email?: string;
  country?: string;
  product?: string;
  followers: { total: number };
  images: { url: string; height: number | null; width: number | null }[];
  external_urls: { spotify: string };
}

function Home() {
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo(prev => [...prev, msg]);
  };

  function logout() {
    localStorage.removeItem("access_token");
    navigate("/", { replace: true });
  }

  // Exchanges ?code= for an access token. Returns the token, or null if there
  // was no code in the URL or the exchange failed.
  async function exchangeCodeForToken(): Promise<string | null> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const spotifyError = params.get("error");

    if (spotifyError) {
      addDebug(`❌ Spotify returned an error: ${spotifyError}`);
      setError(spotifyError === "access_denied" ? "You declined access to Spotify." : `Spotify error: ${spotifyError}`);
      return null;
    }

    if (!code) {
      addDebug("No code in URL, skipping token exchange");
      return null;
    }

    // CSRF check: the state Spotify echoes back must match the one we generated.
    const expectedState = localStorage.getItem("oauth_state");
    if (!state || state !== expectedState) {
      addDebug("❌ State mismatch. Ignoring this callback (possible CSRF or stale login).");
      setError("Login could not be verified. Please try again.");
      return null;
    }

    // The verifier only ever lives in this origin's storage, never in the URL.
    const verifier = localStorage.getItem("verifier");
    if (!verifier) {
      addDebug(
        `❌ Verifier not found. Make sure login started on ${window.location.origin}; ` +
        "storage is per-origin, so starting on a different URL (e.g. a Vercel preview) loses it."
      );
      setError("Login session expired. Please try again.");
      return null;
    }

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      // Must be identical to the redirect_uri sent in the authorize request.
      redirect_uri: `${window.location.origin}/home`,
      code_verifier: verifier,
    });

    // Code and verifier are single-use; clear them whatever the outcome.
    localStorage.removeItem("verifier");
    localStorage.removeItem("oauth_state");
    window.history.replaceState({}, document.title, "/home");

    addDebug("🔄 Exchanging code for access token...");
    const result = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await result.json();
    addDebug(`Token response status: ${result.status}`);

    if (!result.ok) {
      addDebug(`❌ Token exchange failed: ${data.error} ${data.error_description ?? ""}`);
      setError("Could not complete login. Please try again.");
      return null;
    }

    localStorage.setItem("access_token", data.access_token);
    addDebug("✅ Access token received and saved");
    return data.access_token;
  }

  async function fetchProfile(token: string) {
    addDebug("🔄 Fetching profile from /v1/me...");
    const result = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    addDebug(`Profile response status: ${result.status}`);

    if (result.status === 401) {
      // Token expired (they last 1 hour) or was revoked. Start over.
      addDebug("❌ Token expired or invalid, logging out");
      logout();
      return;
    }

    if (!result.ok) {
      setError(`Could not load your profile (HTTP ${result.status}).`);
      return;
    }

    setProfile(await result.json());
    addDebug("✅ Profile loaded");
  }

  async function init() {
    // Read before the exchange, which clears the query string.
    const search = new URLSearchParams(window.location.search);
    const isCallback = search.has("code") || search.has("error");

    try {
      const token = (await exchangeCodeForToken()) ?? localStorage.getItem("access_token");
      if (!token) {
        // A failed callback shows its error here; otherwise there's nothing
        // to show without a token, so go to the login page.
        if (!isCallback) navigate("/", { replace: true });
        return;
      }
      await fetchProfile(token);
    } catch (e) {
      addDebug(`❌ Network error: ${e}`);
      setError("Network error. Check your connection and try again.");
    }
  }

  // Auth codes are single-use. StrictMode's double effect run would send a
  // second exchange that fails with invalid_grant, so only run once.
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    init();
  }, []);

  const avatar = profile?.images[0]?.url;

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "640px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Spotify Dashboard</h2>
        <button onClick={logout}>Log out</button>
      </div>

      {error && (
        <div style={{ background: "#fde8e8", color: "#9b1c1c", padding: "12px", borderRadius: "6px" }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button onClick={logout} style={{ marginTop: "8px" }}>Back to login</button>
        </div>
      )}

      {!profile && !error && <p>Loading your profile…</p>}

      {profile && (
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {avatar ? (
            <img src={avatar} alt="" width={96} height={96} style={{ borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#ddd" }} />
          )}
          <div>
            <h3 style={{ margin: "0 0 4px" }}>
              <a href={profile.external_urls.spotify} target="_blank" rel="noreferrer">
                {profile.display_name ?? "Spotify user"}
              </a>
            </h3>
            {profile.email && <div>{profile.email}</div>}
            <div style={{ color: "#555", fontSize: "14px" }}>
              {profile.followers.total} followers
              {profile.country && ` · ${profile.country}`}
              {profile.product && ` · ${profile.product}`}
            </div>
          </div>
        </div>
      )}

      <details style={{ marginTop: "24px", fontFamily: "monospace", fontSize: "12px" }}>
        <summary>Debug log</summary>
        <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "5px", maxHeight: "300px", overflow: "auto" }}>
          {debugInfo.map((msg, i) => (
            <div key={i} style={{ marginBottom: "4px" }}>{msg}</div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default Home;
