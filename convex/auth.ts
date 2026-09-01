import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";

// Owner identity for FetchBack. Anonymous (one-tap) is deliberate:
// registering a pet / confirming matches should never ask a stressed
// owner for an email round-trip, and judges can tap it live. Each
// anonymous sign-in is still a real, distinct server-side identity
// (subject) — that subject is what guards owner-only actions.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous({
      profile: (params) => ({
        name:
          typeof params.name === "string" && params.name.trim()
            ? params.name.trim().slice(0, 40)
            : "Owner",
        isAnonymous: true,
      }),
    }),
  ],
});
