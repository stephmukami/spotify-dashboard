import { useEffect, useState } from "react";

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

    // Try multiple sources for the verifier
    let verifier = localStorage.getItem("verifier");
    addDebug(`Verifier from localStorage: ${verifier ? 'FOUND' : 'NOT FOUND'}`);
    
    if (!verifier) {
      verifier = sessionStorage.getItem("verifier");
      addDebug(`Verifier from sessionStorage: ${verifier ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    if (!verifier && state) {
      try {
        verifier = atob(state); // Decode from state parameter
        addDebug(`✅ Verifier decoded from state parameter: ${verifier.substring(0, 20)}...`);
      } catch (e) {
        addDebug(`❌ Failed to decode state parameter: ${e}`);
      }
    }
    
    if (!verifier) {
      addDebug("❌ CRITICAL: Verifier not found anywhere!");
      return;
    }

    const body = new URLSearchParams();
    body.append("client_id", "6c5fab85d9c94622b7272efbab39b088");
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", "https://spotify-dashboard-sxs8-stephmukamis-projects.vercel.app/home");
    body.append("code_verifier", verifier);

    addDebug(`Request body prepared with verifier: ${verifier.substring(0, 20)}...`);

    try {
      addDebug("🔄 Sending request to Spotify...");
      const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const data = await result.json();
      addDebug(`Response status: ${result.status}`);
      addDebug(`Response data: ${JSON.stringify(data)}`);

      if (!result.ok) {
        addDebug(`❌ Token exchange failed: ${JSON.stringify(data)}`);
        return;
      }

      addDebug("✅ SUCCESS! Access token received");
      localStorage.setItem("access_token", data.access_token);
      addDebug("✅ Token saved to localStorage");
      
      // Clean up
      localStorage.removeItem("verifier");
      sessionStorage.removeItem("verifier");
      window.history.replaceState({}, document.title, "/home");
      addDebug("✅ URL cleaned and verifiers removed");
    } catch (error) {
      addDebug(`❌ Fetch error: ${error}`);
      console.error("Full error:", error);
    }
  }

  useEffect(() => {
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