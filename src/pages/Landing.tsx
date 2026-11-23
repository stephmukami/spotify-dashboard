import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { startLogin } from "../lib/spotifyAuth";

export default function Landing() {
  const { status, session } = useSession();
  const [redirecting, setRedirecting] = useState(false);

  if (status === "loading") return <p className="muted center">Loading…</p>;
  if (session) return <Navigate to={session.hasConsented ? "/graph" : "/terms"} replace />;

  return (
    <section className="hero">
      <h1>Find people who listen like you</h1>
      <p className="lead">
        Taste Graph compares your top artists, tracks and genres with other listeners and puts you on a map of
        people with similar taste.
      </p>
      <button
        className="btn btn-spotify"
        disabled={redirecting}
        onClick={() => {
          setRedirecting(true);
          startLogin();
        }}
      >
        {redirecting ? "Redirecting…" : "Log in with Spotify"}
      </button>
      <ol className="steps-preview">
        <li>Log in and choose how others see you</li>
        <li>We read your top artists and tracks</li>
        <li>See your closest matches on the graph</li>
      </ol>
      <p className="muted small">
        This app is in Spotify development mode, so only invited accounts can log in. Taste Graph is not affiliated
        with Spotify.
      </p>
    </section>
  );
}
