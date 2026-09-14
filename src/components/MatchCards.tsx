import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const SOURCE_LABEL: Record<string, string> = {
  shelter_email: "shelter email",
  web_listing: "web",
  volunteer_sighting: "sighting",
};

/**
 * Candidate match cards. The model only ever says "possible match" —
 * the owner (or anyone, on the labeled demo case) confirms or rejects.
 */
export function MatchCards({
  caseDoc,
  matches,
}: {
  caseDoc: Doc<"searchCases">;
  matches: Doc<"matches">[] | undefined;
}) {
  const decide = useMutation(api.matches.decideMatch);
  const list = matches ?? [];

  const photoIds = useMemo(
    () =>
      [
        ...new Set(
          list
            .map((m) => m.candidatePhotoId)
            .filter((id): id is Id<"_storage"> => id !== undefined),
        ),
      ],
    [matches],
  );
  const urls = useQuery(api.cases.photoUrls, { storageIds: photoIds }) ?? [];
  const urlFor = (id: Id<"_storage"> | undefined) => {
    if (!id) return null;
    const i = photoIds.indexOf(id);
    return urls[i] ?? null;
  };

  return (
    <section className="card">
      <h3>Possible matches ({list.length})</h3>
      {caseDoc.isDrill && (
        <p className="muted demo-note">
          {caseDoc.slug === "demo-biscuit"
            ? "demo case — anyone may decide; real cases require the signed-in owner"
            : "practice drill — the signed-in owner decides"}
        </p>
      )}
      {list.length === 0 && (
        <p className="muted">
          No candidates yet — they appear when a shelter replies or a web
          listing matches.
        </p>
      )}
      {list.map((m) => {
        const photo = urlFor(m.candidatePhotoId);
        return (
          <article key={m._id} className="match-card">
            <div className="match-head">
              <span className="match-score">
                {(m.score * 100).toFixed(0)}% possible match
              </span>
              <span className="kind">{SOURCE_LABEL[m.source] ?? m.source}</span>
            </div>
            <div className="match-body">
              {photo && (
                <figure className="polaroid">
                  <img src={photo} alt="candidate" />
                </figure>
              )}
              <div className="match-reasons">
                <ul>
                  {m.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {m.verdict === "pending" ? (
                  <div>
                    <button
                      className="good"
                      onClick={() =>
                        void decide({ matchId: m._id, verdict: "confirmed" })
                      }
                    >
                      Confirm
                    </button>
                    <button
                      className="bad"
                      onClick={() =>
                        void decide({ matchId: m._id, verdict: "rejected" })
                      }
                    >
                      Reject
                    </button>
                  </div>
                ) : m.verdict === "confirmed" ? (
                  <span className="stamp found">Confirmed</span>
                ) : (
                  <span className="stamp muted">Rejected</span>
                )}
              </div>
            </div>
            {m.candidateUrl && (
              <p className="muted">
                <a href={m.candidateUrl} target="_blank" rel="noreferrer">
                  source listing
                </a>
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
