import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMPONENT_WEIGHTS,
  FIRST_DEGREE_LIMIT,
  MIN_EDGE_SCORE,
  SECOND_DEGREE_LIMIT,
  TIME_RANGE_WEIGHTS,
} from "../../shared/matching";
import type { MeResponse } from "../../shared/types";
import { api } from "../lib/api";

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Bars({ items }: { items: { label: string; value: number; image?: string | null }[] }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <ul className="bars">
      {items.map((i) => (
        <li key={i.label}>
          {i.image !== undefined &&
            (i.image ? <img src={i.image} alt="" className="avatar sm" /> : <span className="avatar sm" />)}
          <span className="bar-label">{i.label}</span>
          <span className="bar">
            <span style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{i.value.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Small static picture of an ego graph for step 4. */
function MiniGraph() {
  const me = { x: 150, y: 90 };
  const first = [
    { x: 60, y: 40, s: 0.8 },
    { x: 240, y: 50, s: 0.6 },
    { x: 70, y: 150, s: 0.45 },
    { x: 235, y: 145, s: 0.3 },
  ];
  const second = [
    { x: 15, y: 90, from: 0 },
    { x: 290, y: 100, from: 1 },
    { x: 140, y: 175, from: 2 },
  ];
  return (
    <svg viewBox="0 0 300 190" className="mini-graph" role="img" aria-label="You in the centre, connected to your matches">
      {second.map((n, i) => (
        <line key={`s${i}`} x1={first[n.from].x} y1={first[n.from].y} x2={n.x} y2={n.y} className="mg-link faded" />
      ))}
      {first.map((n, i) => (
        <line key={`f${i}`} x1={me.x} y1={me.y} x2={n.x} y2={n.y} className="mg-link" strokeWidth={1 + n.s * 5} />
      ))}
      {second.map((n, i) => (
        <circle key={`sc${i}`} cx={n.x} cy={n.y} r={7} className="mg-node faded" />
      ))}
      {first.map((n, i) => (
        <circle key={`fc${i}`} cx={n.x} cy={n.y} r={11} className="mg-node" />
      ))}
      <circle cx={me.x} cy={me.y} r={17} className="mg-me" />
      <text x={me.x} y={me.y + 4} textAnchor="middle" className="mg-text">
        You
      </text>
    </svg>
  );
}

export default function HowItWorks() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    api.me().then(setMe, (e) => setError(e.message));
  }, []);

  if (error) return <p className="error center">{error}</p>;
  if (!me) return <p className="muted center">Loading your taste profile…</p>;

  const steps = [
    {
      title: "1. We read your top lists",
      body: (
        <>
          <p>
            Spotify keeps a ranked list of what you play most over three periods: the last 4 weeks, the last 6 months,
            and all time. We read your top 50 artists and top 50 tracks from each.
          </p>
          <p>
            For you that came to <strong>{me.topArtists.length > 0 ? "these artists" : "no artists yet"}</strong>
            {me.topTrackCount > 0 && <> and {me.topTrackCount} different tracks</>}.
          </p>
          <ul className="artist-grid">
            {me.topArtists.map((a) => (
              <li key={a.id}>
                {a.imageUrl ? <img src={a.imageUrl} alt="" className="avatar" /> : <span className="avatar" />}
                <span className="small">{a.name}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      title: "2. We build your taste profile",
      body: (
        <>
          <p>
            Each artist gets points for their position: #1 gets 1.0, #50 gets 0.02. Points are multiplied by how much
            each period counts and added up:
          </p>
          <ul className="inline-list">
            <li>All time × {TIME_RANGE_WEIGHTS.long_term}</li>
            <li>Last 6 months × {TIME_RANGE_WEIGHTS.medium_term}</li>
            <li>Last 4 weeks × {TIME_RANGE_WEIGHTS.short_term}</li>
          </ul>
          <p>So an artist who's been in your top list for years outweighs this month's discovery. Your strongest artists:</p>
          <Bars items={me.topArtists.slice(0, 6).map((a) => ({ label: a.name, value: a.weight, image: a.imageUrl }))} />
          {me.topGenres.length > 0 ? (
            <>
              <p>Each artist's points also go to their genres, which gives your genre profile:</p>
              <Bars items={me.topGenres.slice(0, 6).map((g) => ({ label: g.genre, value: g.weight }))} />
            </>
          ) : (
            <p className="muted">
              Spotify didn't return genres for your artists, so your matches are based on artists and tracks only.
            </p>
          )}
        </>
      ),
    },
    {
      title: "3. We compare you with everyone",
      body: (
        <>
          <p>Your profile is compared with every other listener on three things:</p>
          <table className="weights">
            <tbody>
              <tr>
                <td>{pct(COMPONENT_WEIGHTS.artists)}</td>
                <td>
                  <strong>Artists</strong>: how similar your artist points are. Sharing your #1 artist counts far more
                  than sharing someone at #48.
                </td>
              </tr>
              <tr>
                <td>{pct(COMPONENT_WEIGHTS.genres)}</td>
                <td>
                  <strong>Genres</strong>: the same, for genres. This catches people who like the same sound through
                  different artists.
                </td>
              </tr>
              <tr>
                <td>{pct(COMPONENT_WEIGHTS.tracks)}</td>
                <td>
                  <strong>Tracks</strong>: the share of top tracks you have in common.
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">
            Artists and genres use cosine similarity (how closely two weighted lists point the same way); tracks use
            Jaccard overlap (shared ÷ combined). If one of you has no genre data, the other two are reweighted instead
            of counting it as a mismatch.
          </p>
          {me.bestMatch ? (
            <p>
              Your closest match right now is <strong>{me.bestMatch.label}</strong> at{" "}
              <strong>{pct(me.bestMatch.score)}</strong>.
            </p>
          ) : (
            <p className="muted">You don't have any matches yet. They'll appear as more people join.</p>
          )}
        </>
      ),
    },
    {
      title: "4. We connect your closest matches",
      body: (
        <>
          <MiniGraph />
          <ul>
            <li>Anyone scoring at least {pct(MIN_EDGE_SCORE)} with you is a match.</li>
            <li>
              Your graph shows your top {FIRST_DEGREE_LIMIT} matches around you. Thicker, shorter lines mean more
              similar taste.
            </li>
            <li>
              Faded dots are your matches' own top {SECOND_DEGREE_LIMIT} matches, so you can see the wider
              neighbourhood.
            </li>
            <li>Colours group people into taste tribes: clusters who are more similar to each other than to the rest.</li>
            <li>Click a direct match to see what you have in common.</li>
          </ul>
          <p className="muted small">
            You have {me.matchCount} {me.matchCount === 1 ? "match" : "matches"}. Your visibility is{" "}
            <strong>{me.user.visibility}</strong>; change it any time in <Link to="/settings">Settings</Link>.
          </p>
        </>
      ),
    },
  ];

  const last = step === steps.length - 1;

  return (
    <section className="card walkthrough">
      <div className="dots" role="tablist">
        {steps.map((s, i) => (
          <button
            key={s.title}
            role="tab"
            aria-selected={i === step}
            aria-label={s.title}
            className={`dot ${i === step ? "active" : ""}`}
            onClick={() => setStep(i)}
          />
        ))}
      </div>
      <h2>{steps[step].title}</h2>
      {steps[step].body}
      <div className="row between">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </button>
        {last ? (
          <Link to="/graph" className="btn btn-primary">
            See your graph
          </Link>
        ) : (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
            Next
          </button>
        )}
      </div>
    </section>
  );
}
