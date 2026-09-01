import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireUserIdentity } from "./lib/guards";

// ---- helpers ----

export async function logEvent(
  ctx: MutationCtx,
  caseId: Id<"searchCases">,
  kind: string,
  message: string,
) {
  await ctx.db.insert("events", { caseId, kind, message, at: Date.now() });
}

function makeSlug(petName: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${petName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${rand}`;
}

// ---- pets ----

export const registerPet = mutation({
  args: {
    name: v.string(),
    species: v.union(v.literal("dog"), v.literal("cat"), v.literal("other")),
    breed: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.string(),
    microchipId: v.optional(v.string()),
    photoIds: v.array(v.id("_storage")),
    homeLat: v.number(),
    homeLng: v.number(),
    homeRadiusM: v.number(),
  },
  handler: async (ctx, args) => {
    // Owner identity comes from the signed-in user — never from the client.
    const ownerId = await requireUserIdentity(ctx);
    return await ctx.db.insert("pets", { ...args, ownerId });
  },
});

export const myPets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("pets")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .take(50);
  },
});

// ---- cases (drill or real) ----

export const activateCase = mutation({
  args: {
    petId: v.id("pets"),
    isDrill: v.boolean(),
    lastSeenLat: v.optional(v.number()),
    lastSeenLng: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet) throw new Error("Pet not found");
    // Only the pet's registered (signed-in) owner may activate a case.
    const ownerId = await requireUserIdentity(ctx);
    if (ownerId !== pet.ownerId) {
      throw new Error("Only the pet's owner can activate a case");
    }
    const caseId = await ctx.db.insert("searchCases", {
      petId: args.petId,
      ownerId: pet.ownerId,
      status: args.isDrill ? "drill" : "active",
      isDrill: args.isDrill,
      activatedAt: Date.now(),
      lastSeenLat: args.lastSeenLat ?? pet.homeLat,
      lastSeenLng: args.lastSeenLng ?? pet.homeLng,
      lastSeenAt: Date.now(),
      notes: args.notes,
      slug: makeSlug(pet.name),
    });
    await logEvent(
      ctx,
      caseId,
      "case_activated",
      args.isDrill
        ? `Practice drill started for ${pet.name}`
        : `Search activated for ${pet.name}`,
    );
    return caseId;
  },
});

export const closeCase = mutation({
  args: {
    caseId: v.id("searchCases"),
    outcome: v.union(v.literal("found"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.caseId, {
      status: args.outcome,
      closedAt: Date.now(),
    });
    await logEvent(ctx, args.caseId, "case_closed", `Case ${args.outcome}`);
  },
});

/** Public case view by share slug — the volunteer join link / judge workspace. */
export const caseBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const c = await ctx.db
      .query("searchCases")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!c) return null;
    const pet = await ctx.db.get(c.petId);
    const photoUrls = pet
      ? await Promise.all(pet.photoIds.map((id) => ctx.storage.getUrl(id)))
      : [];
    return { case: c, pet, photoUrls: photoUrls.filter(Boolean) };
  },
});

/** Everything the live board needs, one subscription. */
export const board = query({
  args: { caseId: v.id("searchCases") },
  handler: async (ctx, args) => {
    const [territories, sightings, shelters, drafts, matches, events] =
      await Promise.all([
        ctx.db
          .query("territories")
          .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
          .take(100),
        ctx.db
          .query("sightings")
          .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
          .take(200),
        ctx.db
          .query("shelters")
          .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
          .take(100),
        ctx.db
          .query("outreachDrafts")
          .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
          .take(100),
        ctx.db
          .query("matches")
          .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
          .take(100),
        ctx.db
          .query("events")
          .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
          .order("desc")
          .take(50),
      ]);
    return { territories, sightings, shelters, drafts, matches, events };
  },
});

// ---- territories (volunteer map claims) ----

export const claimTerritory = mutation({
  args: {
    caseId: v.id("searchCases"),
    volunteerName: v.string(),
    north: v.number(),
    south: v.number(),
    east: v.number(),
    west: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("territories", {
      ...args,
      status: "claimed",
      claimedAt: Date.now(),
    });
    await logEvent(
      ctx,
      args.caseId,
      "territory_claimed",
      `${args.volunteerName} claimed a search territory`,
    );
    return id;
  },
});

export const updateTerritory = mutation({
  args: {
    territoryId: v.id("territories"),
    status: v.union(
      v.literal("claimed"),
      v.literal("searching"),
      v.literal("done"),
    ),
  },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.territoryId);
    if (!t) throw new Error("Territory not found");
    await ctx.db.patch(args.territoryId, { status: args.status });
    await logEvent(
      ctx,
      t.caseId,
      "territory_updated",
      `${t.volunteerName} → ${args.status}`,
    );
  },
});

// ---- sightings ----

export const reportSighting = mutation({
  args: {
    caseId: v.id("searchCases"),
    reporterName: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    description: v.string(),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("sightings", {
      ...args,
      source: "volunteer",
      sightedAt: Date.now(),
    });
    await logEvent(
      ctx,
      args.caseId,
      "sighting",
      `Sighting reported${args.reporterName ? ` by ${args.reporterName}` : ""}: ${args.description.slice(0, 80)}`,
    );
    return id;
  },
});

/** Internal: sightings from web crawls or shelter emails. */
export const addSourcedSighting = internalMutation({
  args: {
    caseId: v.id("searchCases"),
    source: v.union(v.literal("web"), v.literal("shelter_email")),
    description: v.string(),
    sourceUrl: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("sightings", {
      caseId: args.caseId,
      source: args.source,
      description: args.description,
      sourceUrl: args.sourceUrl,
      photoId: args.photoId,
      sightedAt: Date.now(),
    });
    await logEvent(
      ctx,
      args.caseId,
      "sighting",
      `${args.source === "web" ? "Web listing" : "Shelter email"}: ${args.description.slice(0, 80)}`,
    );
    return id;
  },
});

// ---- storage ----

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
