import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export class AuthError extends Error {}

/** The signed-in user's subject, or throw. */
export async function requireUserIdentity(ctx: QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new AuthError("Sign in required");
  return identity.subject;
}

/**
 * Owner-only action guard. The fictional demo drill case
 * (demo-biscuit) passes through for anyone so judges can click the
 * owner flow without an account — clearly labeled in the UI. Real
 * cases require the signed-in owner's subject to match.
 */
export async function requireCaseOwnerOrDemo(
  ctx: QueryCtx,
  caseId: Id<"searchCases">,
): Promise<void> {
  const c = await ctx.db.get(caseId);
  if (!c) throw new Error("Case not found");
  const identity = await ctx.auth.getUserIdentity();
  if (identity && identity.subject === c.ownerId) return;
  if (c.isDrill && c.slug === "demo-biscuit") return;
  throw new AuthError("Only the case owner can do this — sign in");
}
