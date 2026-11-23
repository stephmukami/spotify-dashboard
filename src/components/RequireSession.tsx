import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../lib/session";

interface Props {
  /** Terms must have been accepted. */
  consent?: boolean;
  /** Spotify data must have been synced at least once. */
  synced?: boolean;
}

/** Route guard: sends the user to the step of the onboarding they still need. */
export function RequireSession({ consent = false, synced = false }: Props) {
  const { status, session } = useSession();
  const location = useLocation();

  if (status === "loading") return <p className="muted center">Loading…</p>;
  if (!session) return <Navigate to="/" replace />;
  if (consent && !session.hasConsented) return <Navigate to="/terms" replace />;
  if (synced && !session.lastSyncedAt) {
    return <Navigate to={`/sync?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}
