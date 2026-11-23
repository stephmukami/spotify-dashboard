import { useEffect, useRef } from 'react'

function Login() {
    const clientId = "6c5fab85d9c94622b7272efbab39b088";

    async function redirectToAuthCodeFlow(clientId: string) {
        console.log("🔐 Starting auth flow...");

        const verifier = generateCodeVerifier(128);
        const challenge = await generateCodeChallenge(verifier);

        // The verifier must never leave the browser. Keep it in storage only.
        // `state` is an unrelated random value used for CSRF protection.
        const state = generateCodeVerifier(32);
        localStorage.setItem("verifier", verifier);
        localStorage.setItem("oauth_state", state);

        console.log("✅ Verifier and state saved to localStorage");

        const params = new URLSearchParams();
        params.append("client_id", clientId);
        params.append("response_type", "code");
        // Must exactly match an entry in the Spotify app's Redirect URIs.
        params.append("redirect_uri", `${window.location.origin}/home`);
        params.append(
            "scope",
            [
                "user-read-private",
                "user-read-email",
                "user-library-read",
                "user-read-playback-position",
                "user-read-playback-state",
                "user-read-currently-playing",
                "playlist-read-private",   // ✅ correct
                "user-top-read",
                "user-follow-read"
            ].join(" ")
        );

        // params.append("scope", "user-read-private user-read-email");
        params.append("code_challenge_method", "S256");
        params.append("code_challenge", challenge);
        params.append("state", state);

        const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
        console.log("🔗 About to redirect to Spotify...");

        window.location.href = authUrl;
    }

    function generateCodeVerifier(length: number) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        // Use a cryptographically secure source; Math.random() is predictable.
        const values = window.crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values, (v) => possible[v % possible.length]).join('');
    }

    async function generateCodeChallenge(codeVerifier: string) {
        const data = new TextEncoder().encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async function initiateFetch() {
        console.log("🎬 Login page loaded");

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (!code) {
            console.log("No code found, starting auth flow...");
            await redirectToAuthCodeFlow(clientId);
        }
    }

    // StrictMode runs effects twice in dev; without this guard the second run
    // would overwrite the verifier after the first redirect was already built.
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        initiateFetch()
    }, [])

    return (
        <div style={{ padding: "20px" }}>
            <h3>Login page</h3>
            <p>Redirecting to Spotify...</p>
        </div>
    )
}

export default Login