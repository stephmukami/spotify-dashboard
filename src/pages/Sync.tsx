import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { SyncResponse } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { useSession } from "../lib/session";
import { getValidSpotifyToken, startLogin } from "../lib/spotifyAuth";

/** Only allow in-app paths, so ?next= can't redirect to another site. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/graph";
}

type State =
  | { kind: "syncing" }
  | { kind: "needs-login" }
  | { kind: "done"; result: SyncResponse }
  | { kind: "error"; message: string };

export default function Sync() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { refresh } = useSession();
  const [state, setState] = useState<State>({ kind: "syncing" });

  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    /** Syncs with a valid token; on a 401 from Spotify, refreshes once and retries. */
    async function syncWithRefresh(): Promise<SyncResponse | null> {
      const token = await getValidSpotifyToken();
      if (!token) return null;
      try {
        return await api.sync(token);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) throw e;
        const fresh = await getValidSpotifyToken({ forceRefresh: true });
        return fresh ? api.sync(fresh) : null;
      }
    }

    (async () => {
      try {
        const result = await syncWithRefresh();
        if (!result) {
          setState({ kind: "needs-login" });
          return;
        }
        await refresh();
        setState({ kind: "done", result });
        setTimeout(() => navigate(next, { replace: true }), 1500);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setState({ kind: "needs-login" });
        else setState({ kind: "error", message: e instanceof Error ? e.message : "Sync failed." });
      }
    })();
  }, [navigate, next, refresh]);

  return (
    <section className="card narrow center">
      {state.kind === "syncing" && (
        <>
          <div className="spinner" aria-hidden />
          <h2>Reading your top artists and tracks…</h2>
          <p className="muted">Then comparing you with everyone else. This takes a few seconds.</p>
        </>
      )}

      {state.kind === "done" && (
        <>
          <h2>All set</h2>
          <p>
            {state.result.artists} artists, {state.result.tracks} tracks and {state.result.genres} genres analysed.
            <br />
            You have <strong>{state.result.matches}</strong> {state.result.matches === 1 ? "match" : "matches"}.
          </p>
        </>
      )}

      {state.kind === "needs-login" && (
        <>
          <h2>Spotify session expired</h2>
          <p className="muted">Log in to Spotify again so we can refresh your listening data.</p>
          <button className="btn btn-spotify" onClick={() => startLogin()}>
            Log in with Spotify
          </button>
        </>
      )}

      {state.kind === "error" && (
        <>
          <h2>Sync failed</h2>
          <p className="error">{state.message}</p>
          <Link to={next} className="btn">
            Continue without syncing
          </Link>
        </>
      )}
    </section>
  );
}
