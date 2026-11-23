import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { completeLogin } from "../lib/spotifyAuth";

/** Spotify redirects here after login. */
export default function Callback() {
  const navigate = useNavigate();
  const { setSession } = useSession();
  const [error, setError] = useState<string | null>(null);

  // Auth codes are single-use; StrictMode would otherwise run this twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const search = new URLSearchParams(window.location.search);
        window.history.replaceState({}, document.title, "/callback");
        const token = await completeLogin(search);
        const session = await api.createSession(token);
        setSession(session);
        // Returning users re-sync on every login so their matches stay current.
        navigate(session.hasConsented ? "/sync?next=/graph" : "/terms", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed.");
      }
    })();
  }, [navigate, setSession]);

  if (error) {
    return (
      <section className="card narrow">
        <h2>Login failed</h2>
        <p className="error">{error}</p>
        <Link to="/" className="btn">
          Back to start
        </Link>
      </section>
    );
  }
  return <p className="muted center">Logging you in…</p>;
}
