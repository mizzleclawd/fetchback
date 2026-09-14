import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

/** One-tap anonymous sign-in — the owner identity for pet registration. */
export function AuthWidget() {
  const viewer = useQuery(api.users.viewer);
  const { signIn, signOut } = useAuthActions();
  const [name, setName] = useState("");
  if (viewer === undefined) return null;
  if (viewer)
    return (
      <button className="auth" onClick={() => void signOut()}>
        Sign out{viewer.name ? ` (${viewer.name})` : ""}
      </button>
    );
  return (
    <span className="auth">
      <input
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={() => void signIn("anonymous", { name })}>
        Sign in
      </button>
    </span>
  );
}
