import { useEffect } from 'react'

function Login() {
    const clientId = "6c5fab85d9c94622b7272efbab39b088";

    async function redirectToAuthCodeFlow(clientId: string) {
        console.log("🔐 Starting auth flow...");
        
        const verifier = generateCodeVerifier(128);
        const challenge = await generateCodeChallenge(verifier);

        console.log("Generated verifier (first 20 chars):", verifier.substring(0, 20) + "...");
        console.log("Generated challenge:", challenge);
        
        // Try both storage methods
        localStorage.setItem("verifier", verifier);
        sessionStorage.setItem("verifier", verifier);
        
        // Also encode in state parameter as backup
        const state = btoa(verifier); // Base64 encode the verifier
        
        console.log("✅ Verifier saved to localStorage and sessionStorage");

        const params = new URLSearchParams();
        params.append("client_id", clientId);
        params.append("response_type", "code");
        params.append("redirect_uri", "https://spotify-dashboard-sxs8-stephmukamis-projects.vercel.app/home");
        params.append("scope", "user-read-private user-read-email");
        params.append("code_challenge_method", "S256");
        params.append("code_challenge", challenge);
        params.append("state", state); // Add state parameter with encoded verifier

        const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
        console.log("🔗 About to redirect to Spotify...");
        
        window.location.href = authUrl;
    }

    function generateCodeVerifier(length: number) {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
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

    useEffect(() => {
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