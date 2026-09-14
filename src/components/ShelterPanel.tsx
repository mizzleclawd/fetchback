import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

function when(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleString() : "";
}

function contactState(s: Doc<"shelters">): string {
  if (s.lastReplyAt) return `replied ${when(s.lastReplyAt)}`;
  if (s.contactedAt) return `sent ${when(s.contactedAt)}`;
  return "not contacted";
}

/**
 * Shelter list + AI-drafted outreach. Nothing sends without human approval —
 * the APPROVE & SEND button is the safety rail.
 */
export function ShelterPanel({
  caseId,
  shelters,
  drafts,
}: {
  caseId: Id<"searchCases">;
  shelters: Doc<"shelters">[] | undefined;
  drafts: Doc<"outreachDrafts">[] | undefined;
}) {
  const requestDraft = useMutation(api.mail.requestOutreachDraft);
  const approve = useMutation(api.mail.approveAndSend);
  const list = shelters ?? [];

  return (
    <section className="card">
      <h3>Shelters & outreach</h3>
      {list.length === 0 && (
        <p className="muted">No shelters discovered for this area yet.</p>
      )}
      <ul className="shelter-list">
        {list.map((s) => (
          <li key={s._id}>
            <div className="shelter-line">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name}
                </a>
              ) : (
                <b>{s.name}</b>
              )}{" "}
              <span className="kind">{s.source}</span>{" "}
              <span className="muted">— {contactState(s)}</span>
            </div>
            {!s.contactedAt && s.email && (
              <button
                className="ghost"
                onClick={() =>
                  void requestDraft({ caseId, shelterId: s._id })
                }
              >
                Draft outreach
              </button>
            )}
          </li>
        ))}
      </ul>

      {(drafts ?? []).length > 0 && (
        <>
          <div className="paw-divider">🐾</div>
          <h3>Outreach drafts</h3>
          {(drafts ?? []).map((d) => {
            const shelter = list.find((s) => s._id === d.shelterId);
            return (
              <article key={d._id} className="draft">
                <p>
                  <b>To:</b> {shelter?.name ?? "shelter"} — <i>{d.subject}</i>
                </p>
                <pre className="draft-body">{d.body}</pre>
                {d.status === "draft" ? (
                  <button
                    className="good"
                    onClick={() => void approve({ draftId: d._id })}
                  >
                    Approve &amp; send
                  </button>
                ) : (
                  <p className="muted">
                    {d.status === "sent" ? "sent ✓" : d.status}
                  </p>
                )}
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}
