import React from 'react'
import { useEffect } from 'react'

function Login() {
    const clientId = "6c5fab85d9c94622b7272efbab39b088"; // Replace with your client id

async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "https://spotify-dashboard-44f2-jf9lk072e-stephmukamis-projects.vercel.app/home");
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



async function initiateFetch (){
  const params = new URLSearchParams(window.location.search);
const code = params.get("code")
if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    const accessToken = await getAccessToken(clientId, code);
    const profile = await fetchProfile(accessToken);
    populateUI(profile);
}

}


 async function getAccessToken(clientId: string, code: string): Promise<string> {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "https://spotify-dashboard-44f2-jf9lk072e-stephmukamis-projects.vercel.app/home");
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();
    return access_token;
}


async function fetchProfile(token: string): Promise<any> {
        console.log("profile token",token)

    // TODO: Call Web API
}

function populateUI(profile: any) {
    console.log("profile info",profile)
    // TODO: Update UI with profile data
}

useEffect(()=>{
initiateFetch()
},[])
  return (
    <div>
          <>
   <h1>Display your Spotify profile data</h1>

<section id="profile">
<h2>Logged in as <span id="displayName"></span></h2>
<span id="avatar"></span>
<ul>
    <li>User ID: <span id="id"></span></li>
    <li>Email: <span id="email"></span></li>
    <li>Spotify URI: <a id="uri" href="#"></a></li>
    <li>Link: <a id="url" href="#"></a></li>
    <li>Profile Image: <span id="imgUrl"></span></li>
</ul>
</section>
    </>
    </div>
  )
}

export default Login
