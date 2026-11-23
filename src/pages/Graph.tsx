import { UndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { Link } from "react-router-dom";
import type { CompareResponse, GraphLink, GraphNode, GraphResponse } from "../../shared/types";
import { api } from "../lib/api";

type GNode = GraphNode & { community: number; scoreToMe: number | null };
type GLink = GraphLink;
type FGNode = NodeObject<GNode>;
type FGLink = LinkObject<GNode, GLink>;

const TRIBE_COLOURS = ["#1db954", "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#edc948", "#b07aa1", "#ff9da7"];
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** force-graph renders tooltips as HTML, and display names are user-controlled. */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Groups nodes into "taste tribes" with Louvain community detection. */
function detectCommunities(data: GraphResponse): Map<string, number> {
  const g = new UndirectedGraph();
  for (const n of data.nodes) g.addNode(n.id);
  for (const l of data.links) {
    if (!g.hasEdge(l.source, l.target)) g.addEdge(l.source, l.target, { weight: l.score });
  }
  try {
    return new Map(Object.entries(louvain(g, { getEdgeWeight: "weight" })));
  } catch {
    return new Map(); // e.g. a graph with no edges
  }
}

function radius(n: GNode) {
  return n.isMe ? 14 : n.degree === 1 ? 9 : 6;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function SidePanel({ node, onClose }: { node: GNode; onClose: () => void }) {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (node.degree !== 1) return;
    let cancelled = false;
    setData(null);
    setError(null);
    api.compare(node.id).then(
      (d) => !cancelled && setData(d),
      (e) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [node]);

  return (
    <aside className="panel">
      <button className="panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="row">
        {node.image ? <img src={node.image} alt="" className="avatar" /> : <span className="avatar" />}
        <h3>{node.label}</h3>
      </div>

      {node.degree === 2 && (
        <p className="muted">
          A match of one of your matches. You're not directly matched, so there's nothing to compare yet.
        </p>
      )}

      {node.degree === 1 && error && <p className="error">{error}</p>}
      {node.degree === 1 && !data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <p className="big-score">{pct(data.score)} match</p>
          <ul className="score-parts">
            <li>Artists: {data.artistScore === null ? "n/a" : pct(data.artistScore)}</li>
            <li>Genres: {data.genreScore === null ? "n/a" : pct(data.genreScore)}</li>
            <li>Tracks: {data.trackScore === null ? "n/a" : pct(data.trackScore)}</li>
          </ul>

          {data.sharedArtists.length > 0 && (
            <>
              <h4>Artists you share</h4>
              <ul className="shared-artists">
                {data.sharedArtists.map((a) => (
                  <li key={a.id}>
                    {a.imageUrl ? <img src={a.imageUrl} alt="" className="avatar sm" /> : <span className="avatar sm" />}
                    {a.name}
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.sharedGenres.length > 0 && (
            <>
              <h4>Genres you share</h4>
              <p className="tags">
                {data.sharedGenres.map((g) => (
                  <span key={g} className="tag">
                    {g}
                  </span>
                ))}
              </p>
            </>
          )}
        </>
      )}
    </aside>
  );
}

export default function Graph() {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const images = useRef(new Map<string, HTMLImageElement>());
  const fitted = useRef(false);

  useEffect(() => {
    api.graph().then(setData, (e) => setError(e.message));
  }, []);

  // Fresh objects for the force engine (it mutates nodes and links in place).
  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as FGNode[], links: [] as FGLink[] };
    const communities = detectCommunities(data);
    const me = data.nodes.find((n) => n.isMe);
    const scoreToMe = new Map<string, number>();
    for (const l of data.links) {
      if (l.source === me?.id) scoreToMe.set(l.target, l.score);
      if (l.target === me?.id) scoreToMe.set(l.source, l.score);
    }
    const nodes: FGNode[] = data.nodes.map((n) => ({
      ...n,
      community: communities.get(n.id) ?? 0,
      scoreToMe: scoreToMe.get(n.id) ?? null,
      // Pin me to the centre; everyone else arranges around me.
      ...(n.isMe ? { fx: 0, fy: 0 } : {}),
    }));
    return { nodes, links: data.links.map((l) => ({ ...l })) as FGLink[] };
  }, [data]);

  // Preload avatars so the canvas can draw them.
  useEffect(() => {
    for (const n of graphData.nodes) {
      if (n.image && !images.current.has(n.image)) {
        const img = new Image();
        img.src = n.image;
        images.current.set(n.image, img);
      }
    }
  }, [graphData]);

  // More similar = shorter link, so close matches sit near you.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || graphData.nodes.length === 0) return;
    fg.d3Force("link")?.distance((l: FGLink) => 40 + (1 - l.score) * 160);
    fg.d3Force("charge")?.strength(-220);
    fg.d3ReheatSimulation();
  }, [graphData, size.width]);

  const textColour = useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222",
    [],
  );

  if (error) return <p className="error center">{error}</p>;

  const onlyMe = data !== null && data.nodes.length <= 1;
  const tribeCount = new Set(graphData.nodes.map((n) => n.community)).size;

  return (
    <div className="graph-page">
      <div className="graph-canvas" ref={containerRef}>
        {!data && <p className="muted center">Loading your graph…</p>}

        {onlyMe && (
          <div className="empty">
            <h2>No matches yet</h2>
            <p className="muted">
              Nobody else scores {pct(0.15)} or more with you yet. Matches appear as more people join. Friends need to
              be added to the app's Spotify allowlist before they can log in.
            </p>
            <Link to="/how-it-works">How matching works</Link>
          </div>
        )}

        {data && !onlyMe && size.width > 0 && (
          <ForceGraph2D<GNode, GLink>
            ref={fgRef}
            graphData={graphData}
            width={size.width}
            height={size.height}
            autoPauseRedraw={false}
            cooldownTicks={150}
            onEngineStop={() => {
              if (!fitted.current) {
                fitted.current = true;
                fgRef.current?.zoomToFit(400, 60);
              }
            }}
            nodeLabel={(n) =>
              escapeHtml(n.isMe ? "You" : n.scoreToMe !== null ? `${n.label} · ${pct(n.scoreToMe)} match` : n.label)
            }
            linkWidth={(l) => 1 + l.score * 5}
            linkColor={(l) => `rgba(128, 128, 128, ${0.2 + l.score * 0.6})`}
            onNodeClick={(n) => setSelected(n.isMe ? null : (n as GNode))}
            onBackgroundClick={() => setSelected(null)}
            nodePointerAreaPaint={(n, colour, ctx) => {
              ctx.fillStyle = colour;
              ctx.beginPath();
              ctx.arc(n.x ?? 0, n.y ?? 0, radius(n) + 2, 0, 2 * Math.PI);
              ctx.fill();
            }}
            nodeCanvasObject={(n, ctx, scale) => {
              const x = n.x ?? 0;
              const y = n.y ?? 0;
              const r = radius(n);
              const colour = TRIBE_COLOURS[n.community % TRIBE_COLOURS.length];
              ctx.globalAlpha = n.degree === 2 ? 0.5 : 1;

              ctx.beginPath();
              ctx.arc(x, y, r, 0, 2 * Math.PI);
              ctx.fillStyle = colour;
              ctx.fill();

              const img = n.image ? images.current.get(n.image) : undefined;
              const inner = r - 2;
              if (img?.complete && img.naturalWidth > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, inner, 0, 2 * Math.PI);
                ctx.clip();
                ctx.drawImage(img, x - inner, y - inner, inner * 2, inner * 2);
                ctx.restore();
              } else {
                ctx.fillStyle = "#fff";
                ctx.font = `600 ${r}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText((n.label[0] ?? "?").toUpperCase(), x, y + 0.5);
              }

              if (n.isMe || n.id === selected?.id) {
                ctx.beginPath();
                ctx.arc(x, y, r + 2.5, 0, 2 * Math.PI);
                ctx.strokeStyle = n.isMe ? "#1db954" : textColour;
                ctx.lineWidth = 2.5 / scale + 1;
                ctx.stroke();
              }

              // Labels for me and direct matches, kept at a constant screen size.
              if (n.degree <= 1) {
                ctx.font = `${12 / scale}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = textColour;
                ctx.fillText(n.isMe ? "You" : n.label, x, y + r + 4);
              }
              ctx.globalAlpha = 1;
            }}
          />
        )}

        {data && !onlyMe && (
          <div className="legend">
            <span>
              <i className="lg-me" /> You
            </span>
            <span>
              <i className="lg-first" /> Your matches
            </span>
            <span>
              <i className="lg-second" /> Their matches
            </span>
            {tribeCount > 1 && <span className="muted">Colours: {tribeCount} taste tribes</span>}
          </div>
        )}
      </div>

      {selected && <SidePanel node={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
