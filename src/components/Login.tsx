import { useEffect } from 'react'

function Login() {
    const clientId = "6c5fab85d9c94622b7272efbab39b088"; // Replace with your client id

    async function redirectToAuthCodeFlow(clientId: string) {
        const verifier = generateCodeVerifier(128);
        const challenge = await generateCodeChallenge(verifier);

        sessionStorage.setItem("verifier", verifier);

        const params = new URLSearchParams();
        params.append("client_id", clientId);
        params.append("response_type", "code");
        params.append("redirect_uri", "https://spotify-dashboard-sxs8-stephmukamis-projects.vercel.app/home");
        params.append("scope", "user-read-private user-read-email");
        params.append("code_challenge_method", "S256");
        params.append("code_challenge", challenge);

        document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
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
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code")
        if (!code) {
            redirectToAuthCodeFlow(clientId);
        } 

    }






    useEffect(() => {
        initiateFetch()
    }, [])

    return (
        <div>
            login page
        </div>
    )
}

export default Login
