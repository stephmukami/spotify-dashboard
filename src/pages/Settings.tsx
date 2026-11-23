import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Visibility } from "../../shared/types";
import { VisibilityPicker } from "../components/VisibilityPicker";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { clearSpotifyToken } from "../lib/spotifyAuth";

export default function Settings() {
  const navigate = useNavigate();
  const { session, setSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!session) return null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const changeVisibility = (visibility: Visibility) =>
    run(async () => {
      setSession(await api.setVisibility(visibility));
      setMessage("Visibility updated.");
    });

  const signOut = (action: () => Promise<unknown>) =>
    run(async () => {
      await action();
      clearSpotifyToken();
      setSession(null);
      navigate("/", { replace: true });
    });

  const lastSynced = session.lastSyncedAt ? new Date(session.lastSyncedAt).toLocaleString() : "never";

  return (
    <section className="card narrow">
      <h2>Settings</h2>

      <VisibilityPicker value={session.user.visibility} onChange={changeVisibility} disabled={busy} />
      {message && <p className="success">{message}</p>}

      <h3>Your listening data</h3>
      <p className="muted">Last updated: {lastSynced}</p>
      <Link to="/sync?next=/settings" className="btn">
        Refresh from Spotify
      </Link>

      <h3>Account</h3>
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => signOut(api.logout)}>
          Log out
        </button>
      </div>

      <div className="danger-zone">
        <h3>Delete my data</h3>
        <p className="muted">
          Removes your profile, top artists, top tracks, genres and all your matches from Taste Graph immediately.
          To also remove the app's access to Spotify, visit your Spotify account's "Manage apps" page.
        </p>
        {confirmDelete ? (
          <div className="row">
            <button className="btn btn-danger" disabled={busy} onClick={() => signOut(api.deleteMe)}>
              Yes, delete everything
            </button>
            <button className="btn" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            Delete my data
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
