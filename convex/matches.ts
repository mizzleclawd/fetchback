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
import { scoreMatch } from "./lib/openai";

/** Entry point scheduled by mail.onMessageReceived for each shelter reply. */
export const scoreInboundReply = internalAction({
  args: {
    caseId: v.id("searchCases"),
    shelterId: v.id("shelters"),
    sightingId: v.id("sightings"),
    messageText: v.string(),
    attachments: v.any(),
  },
  handler: async (ctx, args) => {
    const petCtx = await ctx.runMutation(internal.matches.petContext, {
      caseId: args.caseId,
    });
    if (!petCtx) return;

    // Attachment → storage → URL pipeline is kill-gate work; when a photo is
    // present its URL is passed as candidatePhotoUrl. Text-only replies still
    // get scored on description alone.
    const { score, reasons } = await scoreMatch({
      petDescription: petCtx.description,
      petPhotoUrls: petCtx.photoUrls,
      candidateDescription: args.messageText.slice(0, 1000),
    });

    await ctx.runMutation(internal.matches.saveMatch, {
      caseId: args.caseId,
      source: "shelter_email",
      sightingId: args.sightingId,
      shelterId: args.shelterId,
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
