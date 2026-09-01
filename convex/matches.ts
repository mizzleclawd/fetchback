// Match pipeline: candidate (from shelter email / web listing / sighting)
// → OpenAI vision score with visible reasons → owner confirms or rejects.
// Product rule: the model only ever says "possible match"; the OWNER decides.

import { v } from "convex/values";
import {
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { logEvent } from "./cases";
import { scoreMatch, visionMode } from "./lib/vision";
import { storePhotoAttachments } from "./lib/attachments";

/** Entry point scheduled by mail.onMessageReceived for each shelter reply. */
export const scoreInboundReply = internalAction({
  args: {
    caseId: v.id("searchCases"),
    shelterId: v.id("shelters"),
    sightingId: v.id("sightings"),
    messageText: v.string(),
    attachments: v.any(),
    inboxId: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const petCtx = await ctx.runMutation(internal.matches.petContext, {
      caseId: args.caseId,
    });
    if (!petCtx) return;

    // Kill-gate #2: inbound photo attachment → Convex file storage.
    // The first stored photo becomes the vision candidate.
    const { photos, error: attachError } = await storePhotoAttachments(
      ctx,
      args.attachments,
      { inboxId: args.inboxId, messageId: args.messageId },
    );
    const candidate = photos[0] ?? null;
    if (candidate) {
      await ctx.runMutation(internal.matches.setSightingPhoto, {
        sightingId: args.sightingId,
        photoId: candidate.storageId,
      });
    }

    const { score, reasons } = await scoreMatch({
      petDescription: petCtx.description,
      petPhotoUrls: petCtx.photoUrls,
      candidateDescription: args.messageText.slice(0, 1000),
      candidatePhotoUrl: candidate?.url,
    });
    if (attachError) reasons.push(`Attachment intake: ${attachError}`);

    await ctx.runMutation(internal.matches.saveMatch, {
      caseId: args.caseId,
      source: "shelter_email",
      sightingId: args.sightingId,
      shelterId: args.shelterId,
      candidatePhotoId: candidate?.storageId,
      candidateDescription: args.messageText.slice(0, 500),
      score,
      reasons,
    });
  },
});

export const petContext = internalMutation({
  args: { caseId: v.id("searchCases") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    if (!c) return null;
    const pet = await ctx.db.get(c.petId);
    if (!pet) return null;
    const urls = await Promise.all(
      pet.photoIds.map((id) => ctx.storage.getUrl(id)),
    );
    return {
      description: pet.description,
      photoUrls: urls.filter((u): u is string => u !== null),
    };
  },
});

/** Attach a stored photo to the sighting the reply created. */
export const setSightingPhoto = internalMutation({
  args: {
    sightingId: v.id("sightings"),
    photoId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sightingId, { photoId: args.photoId });
  },
});

export const saveMatch = internalMutation({
  args: {
    caseId: v.id("searchCases"),
    source: v.union(
      v.literal("shelter_email"),
      v.literal("web_listing"),
      v.literal("volunteer_sighting"),
    ),
    sightingId: v.optional(v.id("sightings")),
    shelterId: v.optional(v.id("shelters")),
    candidatePhotoId: v.optional(v.id("_storage")),
    candidateUrl: v.optional(v.string()),
    candidateDescription: v.optional(v.string()),
    score: v.number(),
    reasons: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("matches", {
      ...args,
      verdict: "pending",
      scoredAt: Date.now(),
    });
    await logEvent(
      ctx,
      args.caseId,
      "match_scored",
      `Possible match scored ${(args.score * 100).toFixed(0)}% — awaiting owner review`,
    );
    return id;
  },
});

/** The owner — not the model — makes the call. */
export const decideMatch = mutation({
  args: {
    matchId: v.id("matches"),
    verdict: v.union(v.literal("confirmed"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.matchId);
    if (!m) throw new Error("Match not found");
    await ctx.db.patch(args.matchId, {
      verdict: args.verdict,
      decidedAt: Date.now(),
    });
    await logEvent(
      ctx,
      m.caseId,
      "match_decided",
      args.verdict === "confirmed"
        ? "Owner CONFIRMED the match! 🎉"
        : "Owner rejected the match — search continues",
    );
  },
});
