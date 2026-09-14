import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const W = 640;
const H = 640;
const M_PER_DEG = 111320;

type Board = {
  territories: Doc<"territories">[];
  sightings: Doc<"sightings">[];
};

/**
 * Hand-drawn neighborhood map. The frame is a square centered on the pet's
 * home, sized by homeRadiusM (with padding), and every lat/lng is projected
 * linearly into SVG space.
 */
export function MapBoard({
  caseId,
  caseDoc,
  pet,
  board,
}: {
  caseId: Id<"searchCases">;
  caseDoc: Doc<"searchCases">;
  pet: Doc<"pets"> | null;
  board: Board | undefined;
}) {
  const claim = useMutation(api.cases.claimTerritory);
  const sight = useMutation(api.cases.reportSighting);
  const [name, setName] = useState("");

  const homeLat = pet?.homeLat ?? caseDoc.lastSeenLat ?? 36.17;
  const homeLng = pet?.homeLng ?? caseDoc.lastSeenLng ?? -86.78;
  const radiusM = pet?.homeRadiusM ?? 1500;

  // Frame: home ± radius (in degrees), padded so edge markers stay visible.
  const halfLat = (radiusM / M_PER_DEG) * 1.25;
  const halfLng =
    (radiusM / (M_PER_DEG * Math.cos((homeLat * Math.PI) / 180))) * 1.25;
  const north = homeLat + halfLat;
  const south = homeLat - halfLat;
  const east = homeLng + halfLng;
  const west = homeLng - halfLng;

  const x = (lng: number) => ((lng - west) / (east - west)) * W;
  const y = (lat: number) => ((north - lat) / (north - south)) * H;

  const lastSeen =
    caseDoc.lastSeenLat != null && caseDoc.lastSeenLng != null
      ? { lat: caseDoc.lastSeenLat, lng: caseDoc.lastSeenLng }
      : null;

  const pinSightings = (board?.sightings ?? []).filter(
    (s) => s.lat != null && s.lng != null,
  );

  // Jitter helper for UI-reported claims/sightings: random offset within the
  // frame, biased toward the last-seen point when known.
  const jitter = (scale = 0.45) => {
    if (lastSeen) {
      const dLat = (north - south) * scale * (Math.random() - 0.5);
      const dLng = (east - west) * scale * (Math.random() - 0.5);
      return {
        lat: Math.min(north, Math.max(south, lastSeen.lat + dLat)),
        lng: Math.min(east, Math.max(west, lastSeen.lng + dLng)),
      };
    }
    return {
      lat: homeLat + (north - south) * scale * (Math.random() - 0.5),
      lng: homeLng + (east - west) * scale * (Math.random() - 0.5),
    };
  };

  const claimRandomTerritory = () => {
    const c = jitter(0.7);
    const hLat = (north - south) * 0.18;
    const hLng = (east - west) * 0.18;
    void claim({
      caseId,
      volunteerName: name,
      north: Math.min(north, c.lat + hLat),
      south: Math.max(south, c.lat - hLat),
      east: Math.min(east, c.lng + hLng),
      west: Math.max(west, c.lng - hLng),
    });
  };

  const reportSightingNearLastSeen = () => {
    const c = jitter(0.3);
    void sight({
      caseId,
      reporterName: name,
      lat: c.lat,
      lng: c.lng,
      description: "Possible sighting near the search area",
    });
  };

  return (
    <section className="card">
      <h3>Neighborhood map</h3>
      <p className="muted map-hint">
        Volunteers claim territories 🐾 sightings appear live
      </p>
      <svg
        className="map-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Neighborhood search map"
      >
        {/* paper */}
        <rect x="0" y="0" width={W} height={H} rx="14" className="map-paper" />
        {/* a couple of park blobs — soft green decoration */}
        <ellipse cx={W * 0.16} cy={H * 0.2} rx="72" ry="48" className="park" />
        <ellipse cx={W * 0.85} cy={H * 0.78} rx="88" ry="56" className="park" />
        <text x={W * 0.16} y={H * 0.2} className="park-label">
          park
        </text>
        <text x={W * 0.85} y={H * 0.78} className="park-label">
          greenway
        </text>
        {/* streets: hand-wavy grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={`h${f}`}
            x1="24"
            x2={W - 24}
            y1={H * f}
            y2={H * f + 6}
            className="street"
          />
        ))}
        {[0.3, 0.6].map((f) => (
          <line
            key={`v${f}`}
            y1="24"
            y2={H - 24}
            x1={W * f}
            x2={W * f + 6}
            className="street"
          />
        ))}

        {/* volunteer territories */}
        {(board?.territories ?? []).map((t) => {
          const rx = x(t.west);
          const ry = y(t.north);
          const rw = Math.max(8, x(t.east) - rx);
          const rh = Math.max(8, y(t.south) - ry);
          return (
            <g key={t._id} className={`terr ${t.status}`}>
              <rect x={rx} y={ry} width={rw} height={rh} rx="6" />
              <text
                x={Math.min(rx + 10, W - 120)}
                y={Math.min(ry + 22, H - 10)}
              >
                {t.volunteerName} · {t.status}
              </text>
            </g>
          );
        })}

        {/* sighting paw pins */}
        {pinSightings.map((s) => (
          <g key={s._id} className="paw-pin">
            <title>{s.description}</title>
            <text x={x(s.lng!)} y={y(s.lat!)}>
              🐾
            </text>
            {s.photoId && (
              <circle
                cx={x(s.lng!) + 13}
                cy={y(s.lat!) - 2}
                r="4"
                className="photo-dot"
              />
            )}
          </g>
        ))}

        {/* last seen ✕ */}
        {lastSeen && (
          <g className="last-seen">
            <text x={x(lastSeen.lng)} y={y(lastSeen.lat)}>
              ✕
            </text>
            <text x={x(lastSeen.lng) + 14} y={y(lastSeen.lat) + 4}>
              last seen
            </text>
          </g>
        )}

        {/* home ⌂ */}
        <g className="home-marker">
          <text x={x(homeLng)} y={y(homeLat)}>
            ⌂
          </text>
          <text x={x(homeLng) - 8} y={y(homeLat) + 22}>
            home
          </text>
        </g>
      </svg>

      <div className="map-controls">
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button disabled={!name} onClick={claimRandomTerritory}>
          Claim a territory
        </button>
        <button disabled={!name} onClick={reportSightingNearLastSeen}>
          Report sighting
        </button>
      </div>
    </section>
  );
}
