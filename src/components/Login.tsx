import { useState } from 'react'
import { Navigate } from 'react-router-dom'

const clientId = "6c5fab85d9c94622b7272efbab39b088";

const scopes = [
    "user-read-private",
    "user-read-email",
    "user-library-read",
    "user-read-playback-position",
    "user-read-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "user-top-read",
    "user-follow-read",
];

function generateRandomString(length: number) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    // Use a cryptographically secure source; Math.random() is predictable.
    const values = window.crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, (v) => possible[v % possible.length]).join('');
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function redirectToAuthCodeFlow() {
    const verifier = generateRandomString(128);
    const challenge = await generateCodeChallenge(verifier);

    // The verifier must never leave the browser. Keep it in storage only.
    // `state` is an unrelated random value used for CSRF protection.
    const state = generateRandomString(32);
    localStorage.setItem("verifier", verifier);
    localStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        // Must exactly match an entry in the Spotify app's Redirect URIs.
        redirect_uri: `${window.location.origin}/home`,
        scope: scopes.join(" "),
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function Login() {
    const [redirecting, setRedirecting] = useState(false);

    // Already logged in: go straight to the dashboard. If the token has
    // expired, Home clears it and sends the user back here.
    if (localStorage.getItem("access_token")) {
        return <Navigate to="/home" replace />;
    }

    async function handleLogin() {
        setRedirecting(true);
        await redirectToAuthCodeFlow();
    }

    return (
        <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
            <h2>Spotify Dashboard</h2>
            <p>Log in with your Spotify account to see your listening data.</p>
            <button
                onClick={handleLogin}
                disabled={redirecting}
                style={{
                    background: "#1DB954",
                    color: "#fff",
                    border: "none",
                    borderRadius: "999px",
                    padding: "12px 28px",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: redirecting ? "default" : "pointer",
                    opacity: redirecting ? 0.7 : 1,
                }}
            >
                {redirecting ? "Redirecting…" : "Log in with Spotify"}
            </button>
        </div>
    )
}

export default Login
