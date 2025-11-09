// import { useEffect } from "react";

// function Home() {
//   // This runs IMMEDIATELY when the file loads
//   console.log("🔴 HOME FILE LOADED - THIS SHOULD ALWAYS SHOW");
  
//   // This runs when component renders
//   console.log("🟡 HOME COMPONENT RENDERING");

//   useEffect(() => {
//     console.log("🟢 HOME USEEFFECT RUNNING");
//     console.log("URL:", window.location.href);
//     console.log("Search:", window.location.search);
//   }, []);

//   return (
//     <div style={{ padding: "20px" }}>
//       <h1>🏠 HOME PAGE LOADED</h1>
//       <p>If you see this text, the component is rendering</p>
//       <p>Current URL: {window.location.href}</p>
//       <p>Search params: {window.location.search}</p>
//     </div>
//   );
// }

// export default Home;
// Home.tsx
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
    addDebug(`Search params: ${window.location.search}`);
    
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    addDebug(`Code from URL: ${code || 'NOT FOUND'}`);
    addDebug(`All localStorage keys: ${JSON.stringify(Object.keys(localStorage))}`);
    addDebug(`Verifier from storage: ${localStorage.getItem("verifier") || 'NOT FOUND'}`);
    
    if (!code) {
      addDebug("❌ No code found, skipping token exchange");
      return;
    }

    const verifier = localStorage.getItem("verifier");
    if (!verifier) {
      addDebug("❌ CRITICAL: Verifier not found in localStorage!");
      return;
    }

    const body = new URLSearchParams();
    body.append("client_id", "6c5fab85d9c94622b7272efbab39b088");
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", "https://spotify-dashboard-sxs8-stephmukamis-projects.vercel.app/home");
    body.append("code_verifier", verifier);

    addDebug(`Request body: ${JSON.stringify(Object.fromEntries(body))}`);

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
      
      // Clean up URL
      window.history.replaceState({}, document.title, "/home");
      addDebug("✅ URL cleaned");
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