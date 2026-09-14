import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { AuthWidget } from "./components/AuthWidget";
import { PetHeader } from "./components/PetHeader";
import { MapBoard } from "./components/MapBoard";
import { MatchCards } from "./components/MatchCards";
import { ShelterPanel } from "./components/ShelterPanel";
import { RegisterPage } from "./components/RegisterPage";

const DEFAULT_SLUG = "demo-biscuit";

type Route = { view: "case"; slug: string } | { view: "register" };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#/, "");
  if (h === "/register") return { view: "register" };
  const m = h.match(/^\/c\/([a-z0-9-]+)/i);
  if (m) return { view: "case", slug: m[1] };
  return { view: "case", slug: DEFAULT_SLUG };
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  return (
    <main className="wrap">
      <header>
        <h1>🐕 FetchBack</h1>
        <p className="tag">
          Multiplayer missing-pet search party — Convex runs it, Firecrawl
          feeds it, AgentMail gives it an inbox.
        </p>
        <nav className="nav">
          <a href="#/">Board</a>
          <a href="#/register">Register a pet</a>
        </nav>
        <AuthWidget />
      </header>
      {route.view === "register" ? (
        <RegisterPage />
      ) : (
        <CasePage slug={route.slug} />
      )}
    </main>
  );
}

function CasePage({ slug }: { slug: string }) {
  const data = useQuery(api.cases.caseBySlug, { slug });
  if (data === undefined) return <p>Connecting to Convex…</p>;
  if (data === null)
    return (
      <p>
        No case found for <code>{slug}</code>.{" "}
        {slug === DEFAULT_SLUG && (
          <>
            Run <code>bunx convex run seed:demoWorkspace</code> to create the
            demo case.
          </>
        )}
      </p>
    );
  return <Board caseDoc={data.case} pet={data.pet} />;
}

function Board({
  caseDoc,
  pet,
}: {
  caseDoc: Doc<"searchCases">;
  pet: Doc<"pets"> | null;
}) {
  const board = useQuery(api.cases.board, { caseId: caseDoc._id });
  return (
    <>
      <PetHeader caseDoc={caseDoc} pet={pet} />
      <div className="board-grid">
        <MapBoard
          caseId={caseDoc._id}
          caseDoc={caseDoc}
          pet={pet}
          board={board}
        />
        <section className="card">
          <h3>Live feed</h3>
          <ul className="feed">
            {(board?.events ?? []).map((e) => (
              <li key={e._id}>
                <span className="kind">{e.kind}</span> {e.message}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="paw-divider">🐾</div>
      <div className="cols">
        <MatchCards caseDoc={caseDoc} matches={board?.matches} />
        <ShelterPanel
          caseId={caseDoc._id}
          shelters={board?.shelters}
          drafts={board?.drafts}
        />
      </div>
    </>
  );
}
