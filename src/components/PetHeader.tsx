import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

/** Hero card for a case: pet identity, status stamp, drill banner, polaroid. */
export function PetHeader({
  caseDoc,
  pet,
}: {
  caseDoc: Doc<"searchCases">;
  pet: Doc<"pets"> | null;
}) {
  const storageIds = pet?.photoIds ?? [];
  const urls = useQuery(api.cases.photoUrls, { storageIds });
  const photo = urls?.find((u): u is string => u !== null) ?? null;

  const stamp =
    caseDoc.status === "found" ? (
      <span className="stamp found">Found</span>
    ) : caseDoc.isDrill ? (
      <span className="stamp drill">Drill</span>
    ) : caseDoc.status === "closed" ? (
      <span className="stamp muted">Closed</span>
    ) : (
      <span className="stamp missing">Missing</span>
    );

  const traits = [pet?.breed, pet?.color].filter(Boolean).join(" · ");
  const lastSeen = caseDoc.lastSeenAt
    ? new Date(caseDoc.lastSeenAt).toLocaleString()
    : null;
  const radiusKm = pet ? Math.max(0.1, pet.homeRadiusM / 1000).toFixed(1) : null;

  return (
    <section className="card pet-header">
      {caseDoc.isDrill && (
        <div className="drill">PRACTICE DRILL — no pet is actually missing</div>
      )}
      <div className="pet-header-row">
        <div className="pet-facts">
          <h2>
            {pet?.name ?? "…"} {stamp}
          </h2>
          {pet && (
            <p className="muted" style={{ marginTop: 0 }}>
              {pet.species}
              {traits ? ` — ${traits}` : ""}
            </p>
          )}
          {pet?.description && <p>{pet.description}</p>}
          <p className="muted">
            Home area: within {radiusKm} km of home
            {lastSeen ? ` · Last seen ${lastSeen}` : ""}
          </p>
        </div>
        {photo && (
          <figure className="polaroid">
            <img src={photo} alt={pet?.name ?? "pet"} />
            <figcaption>{pet?.name ?? ""}</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
