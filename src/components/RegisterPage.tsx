import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AuthWidget } from "./AuthWidget";

type Species = "dog" | "cat" | "other";

/** Register a pet (before loss), then start a clearly-labeled practice drill. */
export function RegisterPage() {
  const viewer = useQuery(api.users.viewer);
  const generateUploadUrl = useMutation(api.cases.generateUploadUrl);
  const registerPet = useMutation(api.cases.registerPet);
  const activateCase = useMutation(api.cases.activateCase);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [radiusKm, setRadiusKm] = useState("1.5");
  const [lat, setLat] = useState("36.17");
  const [lng, setLng] = useState("-86.78");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [petId, setPetId] = useState<Id<"pets"> | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhotos = async (files: File[]) => {
    setUploading(true);
    try {
      const ids: Id<"_storage">[] = [];
      for (const f of files) {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, { method: "POST", body: f });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = (await res.json()) as {
          storageId: Id<"_storage">;
        };
        ids.push(storageId);
      }
      return ids;
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const photoIds = photos.length ? await uploadPhotos(photos) : [];
      const id = await registerPet({
        name,
        species,
        breed: breed || undefined,
        color: color || undefined,
        description,
        photoIds,
        homeLat: Number(lat),
        homeLng: Number(lng),
        homeRadiusM: Math.round(Number(radiusKm) * 1000),
      });
      setPetId(id);
    } finally {
      setBusy(false);
    }
  };

  const startDrill = async () => {
    if (!petId) return;
    setBusy(true);
    try {
      const { slug } = await activateCase({ petId, isDrill: true });
      setShareSlug(slug);
    } finally {
      setBusy(false);
    }
  };

  if (viewer === undefined) return <p className="muted">Loading…</p>;
  if (!viewer)
    return (
      <section className="card">
        <h3>Register your pet</h3>
        <p>
          Sign in first (one tap, anonymous) so only you can activate and
          decide on your pet's cases.
        </p>
        <AuthWidget />
      </section>
    );

  if (shareSlug)
    return (
      <section className="card">
        <h3>Practice drill ready! 🐾</h3>
        <p>
          Share the search party link — anyone who opens it joins the live
          board:
        </p>
        <p>
          <a href={`#/c/${shareSlug}`}>#{"/"}c/{shareSlug}</a>
        </p>
        <p>
          <a className="button-link" href={`#/c/${shareSlug}`}>
            Open the drill board →
          </a>
        </p>
      </section>
    );

  if (petId)
    return (
      <section className="card">
        <h3>{name} registered ✓</h3>
        <p>
          Next: run a <b>practice drill</b> — a clearly-labeled rehearsal of a
          real search (volunteers, map, shelters, matches) with no pet
          actually missing.
        </p>
        <button className="good" disabled={busy} onClick={() => void startDrill()}>
          Start practice drill
        </button>
      </section>
    );

  const valid = name.trim() && description.trim() && !uploading;

  return (
    <section className="card">
      <h3>Register your pet</h3>
      <p className="muted">
        Registration happens before anything goes wrong — so a drill (or a
        real search) starts with photos and details ready.
      </p>
      <div className="form-grid">
        <label>
          Name*
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Biscuit"
          />
        </label>
        <label>
          Species*
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value as Species)}
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Breed
          <input
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="Golden Retriever"
          />
        </label>
        <label>
          Color
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="golden"
          />
        </label>
        <label>
          Search radius (km)
          <input
            type="number"
            min="0.2"
            step="0.1"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
          />
        </label>
        <label>
          Home latitude
          <input value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label>
          Home longitude
          <input value={lng} onChange={(e) => setLng(e.target.value)} />
        </label>
        <label className="full">
          Description* (what a volunteer should look for)
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Friendly golden retriever, red collar, answers to Biscuit…"
          />
        </label>
        <label className="full">
          Photos
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos([...(e.target.files ?? [])])}
          />
        </label>
      </div>
      <p className="muted">
        {photos.length > 0
          ? `${photos.length} photo${photos.length > 1 ? "s" : ""} ready — ${
              photos.map((p) => p.name).join(", ").slice(0, 60) || ""
            }`
          : "Photos make vision matching possible — add at least one for the full drill."}
      </p>
      <button disabled={!valid || busy} onClick={() => void submit()}>
        {uploading ? "Uploading photos…" : busy ? "Saving…" : "Register pet"}
      </button>
    </section>
  );
}
