import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

// Minimal live board — proves end-to-end reactivity for the kill-gate.
// The real map UI replaces this during feature build (post-gate).

const DEMO_SLUG = "demo-biscuit";

export default function App() {
  const data = useQuery(api.cases.caseBySlug, { slug: DEMO_SLUG });
  return (
    <main className="wrap">
      <header>
        <h1>🐕 FetchBack</h1>
        <p className="tag">
          Multiplayer missing-pet search party — Convex runs it, Firecrawl feeds
          it, AgentMail gives it an inbox.
        </p>
      </header>
      {data === undefined && <p>Connecting to Convex…</p>}
      {data === null && (
        <p>
          No demo case yet. Run{" "}
          <code>bunx convex run seed:demoWorkspace</code> to create it.
        </p>
      )}
      {data && <CaseBoard caseId={data.case._id} petName={data.pet?.name} isDrill={data.case.isDrill} />}
    </main>
  );
}

function CaseBoard({
  caseId,
  petName,
  isDrill,
}: {
  caseId: string;
  petName?: string;
  isDrill: boolean;
}) {
  const board = useQuery(api.cases.board, { caseId: caseId as never });
  const claim = useMutation(api.cases.claimTerritory);
  const sight = useMutation(api.cases.reportSighting);
  const [name, setName] = useState("");

  if (!board) return <p>Loading board…</p>;
  return (
    <section>
      {isDrill && <div className="drill">PRACTICE DRILL — no pet is actually missing</div>}
      <h2>Search party for {petName ?? "…"}</h2>

      <div className="cols">
        <div>
          <h3>Territories ({board.territories.length})</h3>
          <ul>
            {board.territories.map((t) => (
              <li key={t._id}>
                {t.volunteerName} — <b>{t.status}</b>
              </li>
            ))}
          </ul>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={!name}
            onClick={() =>
              claim({
                caseId: caseId as never,
                volunteerName: name,
                north: 36.17,
                south: 36.16,
                east: -86.77,
                west: -86.79,
              })
            }
          >
            Claim a territory
          </button>
          <button
            disabled={!name}
            onClick={() =>
              sight({
                caseId: caseId as never,
                reporterName: name,
                description: "Possible sighting near the park entrance",
              })
            }
          >
            Report sighting
          </button>
        </div>

        <div>
          <h3>Live feed</h3>
          <ul className="feed">
            {board.events.map((e) => (
              <li key={e._id}>
                <span className="kind">{e.kind}</span> {e.message}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Possible matches ({board.matches.length})</h3>
          <ul>
            {board.matches.map((m) => (
              <li key={m._id}>
                {(m.score * 100).toFixed(0)}% — {m.verdict}
                <ul>
                  {m.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
