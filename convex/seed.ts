// Seeded demo workspace — the no-login judge view.
// Everything here is clearly fictional and labeled as a drill.

import { internalMutation } from "./_generated/server";
import { logEvent } from "./cases";

export const demoWorkspace = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("searchCases")
      .withIndex("by_slug", (q) => q.eq("slug", "demo-biscuit"))
      .unique();
    if (existing) return existing._id;

    const petId = await ctx.db.insert("pets", {
      ownerId: "demo",
      name: "Biscuit",
      species: "dog",
      breed: "Golden Retriever mix",
      color: "golden, white chest patch",
      description:
        "Medium golden retriever mix, ~30kg, white patch on chest, red collar with bone-shaped tag, friendly, answers to Biscuit.",
      photoIds: [],
      homeLat: 36.1627,
      homeLng: -86.7816, // Nashville
      homeRadiusM: 5000,
    });

    const caseId = await ctx.db.insert("searchCases", {
      petId,
      ownerId: "demo",
      status: "drill",
      isDrill: true,
      activatedAt: Date.now(),
      lastSeenLat: 36.1657,
      lastSeenLng: -86.7781,
      lastSeenAt: Date.now(),
      notes: "DEMO DRILL — fictional pet, fictional shelters. Judges: click around!",
      slug: "demo-biscuit",
    });

    await ctx.db.insert("shelters", {
      caseId,
      name: "Demo Animal Services (fictional)",
      email: undefined, // set to a test inbox when rehearsing the live loop
      url: "https://example.org/shelter",
      source: "seed",
    });

    await ctx.db.insert("territories", {
      caseId,
      volunteerName: "Alex (demo)",
      north: 36.17,
      south: 36.16,
      east: -86.77,
      west: -86.79,
      status: "searching",
      claimedAt: Date.now(),
    });

    await logEvent(ctx, caseId, "seed", "Demo drill workspace created");
    return caseId;
  },
});
