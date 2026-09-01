import { query } from "./_generated/server";

/** Minimal viewer: the signed-in identity's subject + name, or null. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    if (!id) return null;
    return { subject: id.subject, name: id.name ?? null };
  },
});
