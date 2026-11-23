import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Visibility } from "../../shared/types";
import { VisibilityPicker } from "../components/VisibilityPicker";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export default function Terms() {
  const navigate = useNavigate();
  const { session, setSession } = useSession();
  const [visibility, setVisibility] = useState<Visibility>(session?.user.visibility ?? "public");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      setSession(await api.consent(visibility));
      navigate("/sync?next=/how-it-works", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your choice.");
      setSaving(false);
    }
  }

  return (
    <section className="card narrow">
      <h2>Before you join</h2>
      <p>Taste Graph only works by comparing listeners, so here's exactly what that involves.</p>

      <h3>What we read from Spotify</h3>
      <ul>
        <li>Your display name and profile picture</li>
        <li>Your top 50 artists and top 50 tracks for the last month, six months and all time</li>
        <li>The genres Spotify lists for those artists</li>
      </ul>

      <h3>What we don't touch</h3>
      <ul>
        <li>Your email, playlists, saved music or full listening history</li>
        <li>We never post, follow, play or change anything on your account</li>
      </ul>

      <h3>Who sees what</h3>
      <ul>
        <li>Other users of this app may see you on their graph, based on the visibility you choose below.</li>
        <li>People you're matched with directly can see your match score and the artists and genres you share.</li>
        <li>Nobody sees your full top lists.</li>
      </ul>

      <h3>Your data, your call</h3>
      <ul>
        <li>Your data is updated each time you log in.</li>
        <li>You can change your visibility or delete everything at any time in Settings. Deletion is immediate.</li>
        <li>Taste Graph is a personal project and is not affiliated with Spotify.</li>
      </ul>

      <VisibilityPicker value={visibility} onChange={setVisibility} disabled={saving} />

      <label className="agree">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={saving} />
        I agree to Taste Graph storing and comparing this data as described above.
      </label>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-primary" disabled={!agreed || saving} onClick={accept}>
        {saving ? "Saving…" : "Accept and continue"}
      </button>
    </section>
  );
}
