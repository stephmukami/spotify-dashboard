import { useEffect, useRef, useState } from "react";

function Home() {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo(prev => [...prev, msg]);
  };

  async function getAccessToken() {
    addDebug("=== TOKEN EXCHANGE START ===");
    addDebug(`Current URL: ${window.location.href}`);
    
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    
    addDebug(`Code from URL: ${code || 'NOT FOUND'}`);
    addDebug(`State from URL: ${state ? 'FOUND' : 'NOT FOUND'}`);
    
    if (!code) {
      addDebug("❌ No code found, skipping token exchange");
      return;
    }

    // CSRF check: the state Spotify echoes back must match the one we generated.
    const expectedState = localStorage.getItem("oauth_state");
    if (!state || state !== expectedState) {
      addDebug("❌ State mismatch. Ignoring this callback (possible CSRF or stale login).");
      return;
    }

    // The verifier only ever lives in this origin's storage, never in the URL.
    const verifier = localStorage.getItem("verifier");
    addDebug(`Verifier from localStorage: ${verifier ? 'FOUND' : 'NOT FOUND'}`);

    if (!verifier) {
      addDebug(
        `❌ Verifier not found. Make sure login started on ${window.location.origin}; ` +
        "storage is per-origin, so starting on a different URL (e.g. a Vercel preview) loses it."
      );
      return;
    }

    const body = new URLSearchParams();
    body.append("client_id", "6c5fab85d9c94622b7272efbab39b088");
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    // Must be identical to the redirect_uri sent in the authorize request.
    body.append("redirect_uri", `${window.location.origin}/home`);
    body.append("code_verifier", verifier);


    try {
      addDebug("🔄 Sending request to Spotify...");
      const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const data = await result.json();
      addDebug(`Response status: ${result.status}`);

      if (!result.ok) {
        addDebug(`❌ Token exchange failed: ${JSON.stringify(data)}`);
        return;
      }

      addDebug("✅ SUCCESS! Access token received");
      localStorage.setItem("access_token", data.access_token);
      addDebug("✅ Token saved to localStorage");
      
      // Clean up
      localStorage.removeItem("verifier");
      localStorage.removeItem("oauth_state");
      window.history.replaceState({}, document.title, "/home");
      addDebug("✅ URL cleaned and verifiers removed");
    } catch (error) {
      addDebug(`❌ Fetch error: ${error}`);
      console.error("Full error:", error);
    }
  }

  // Auth codes are single-use. StrictMode's double effect run would send a
  // second exchange that fails with invalid_grant, so only run once.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;
    addDebug("🚀 Home component mounted, useEffect running");
    getAccessToken();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h3>Home Page</h3>
      <div style={{ 
        background: "#f5f5f5", 
        padding: "15px", 
        borderRadius: "5px",
        maxHeight: "400px",
        overflow: "auto"
      }}>
        <h4>Debug Log:</h4>
        {debugInfo.length === 0 ? (
          <p>No logs yet...</p>
        ) : (
          debugInfo.map((msg, i) => (
            <div key={i} style={{ marginBottom: "5px", fontSize: "12px" }}>
              {msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Home;

