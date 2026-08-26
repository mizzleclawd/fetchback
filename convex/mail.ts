// AgentMail integration — the case inbox.
// Outbound: draft → human approval → send (safety rail: nothing sends unapproved).
// Inbound: webhook → onMessageReceived → sighting + match pipeline.

import { v } from "convex/values";
import {
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
  query,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import { AgentMail } from "@agentmail/convex";
import { logEvent } from "./cases";
import { draftShelterEmail } from "./lib/openai";

export const agentmail: AgentMail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.mail.onMessageReceived,
});

function inboxId(): string {
  const id = process.env.AGENTMAIL_INBOX_ID;
  if (!id) throw new Error("AGENTMAIL_INBOX_ID is not set on the deployment");
  return id;
}

// ---- Outbound: draft → approve → send ----

/** Generate an outreach draft for one shelter (OpenAI drafts, human approves). */
export const draftOutreach = internalAction({
  args: { caseId: v.id("searchCases"), shelterId: v.id("shelters") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.mail.outreachContext, args);
    if (!data) return;
    const { subject, body } = await draftShelterEmail({
      petName: data.petName,
      petDescription: data.petDescription,
      areaDescription: data.area,
      isDrill: data.isDrill,
      shelterName: data.shelterName,
    });
    await ctx.runMutation(internal.mail.saveDraft, {
      caseId: args.caseId,
      shelterId: args.shelterId,
      subject,
      body,
    });
  },
});

export const outreachContext = internalQuery({
  args: { caseId: v.id("searchCases"), shelterId: v.id("shelters") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    const shelter = await ctx.db.get(args.shelterId);
    if (!c || !shelter) return null;
    const pet = await ctx.db.get(c.petId);
    if (!pet) return null;
    return {
      petName: pet.name,
      petDescription: pet.description,
      area: `within ~${Math.round(pet.homeRadiusM / 1000)}km of the owner's home area`,
      isDrill: c.isDrill,
      shelterName: shelter.name,
    };
  },
});

export const saveDraft = internalMutation({
  args: {
    caseId: v.id("searchCases"),
    shelterId: v.id("shelters"),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("outreachDrafts", {
      ...args,
      status: "draft",
      createdAt: Date.now(),
    });
    await logEvent(ctx, args.caseId, "draft_ready", `Draft ready: ${args.subject}`);
  },
});

/** Owner approves a draft → it sends through AgentMail. */
export const approveAndSend = mutation({
  args: { draftId: v.id("outreachDrafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    if (draft.status !== "draft") throw new Error("Draft already processed");
    const shelter = await ctx.db.get(draft.shelterId);
    if (!shelter?.email) throw new Error("Shelter has no email address");

    const outboundId = await agentmail.sendMessage(ctx, inboxId(), {
      to: shelter.email,
      subject: draft.subject,
      text: draft.body,
      labels: ["fetchback", `case:${draft.caseId}`],
    });
    await ctx.db.patch(args.draftId, {
      status: "sent",
      outboundId: String(outboundId),
      sentAt: Date.now(),
    });
    await ctx.db.patch(draft.shelterId, { contactedAt: Date.now() });
    await logEvent(
      ctx,
      draft.caseId,
      "email_sent",
      `Outreach sent to ${shelter.name}`,
    );
    return outboundId;
  },
});

// ---- Inbound: shelter replies (possibly with photo attachments) ----

export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  handler: async (ctx, args) => {
    const threadId: string | undefined = args.message?.thread_id;
    const from: string = args.message?.from ?? "unknown sender";
    const text: string = args.message?.text ?? "";

    // Correlate to a shelter (and case) by thread id when possible.
    let shelter =
      threadId !== undefined
        ? await ctx.db
            .query("shelters")
            .withIndex("by_thread", (q) => q.eq("threadId", threadId))
            .unique()
        : null;

    // First reply on a new thread: attach the thread to the shelter by sender.
    if (!shelter && threadId) {
      const candidates = await ctx.db.query("shelters").take(200);
      shelter =
        candidates.find(
          (s) => s.email && from.toLowerCase().includes(s.email.toLowerCase()),
        ) ?? null;
      if (shelter) await ctx.db.patch(shelter._id, { threadId });
    }

    if (!shelter) return; // unrelated mail; component still stores it

    await ctx.db.patch(shelter._id, { lastReplyAt: Date.now() });
    await logEvent(
      ctx,
      shelter.caseId,
      "email_reply",
      `Reply from ${shelter.name}: ${text.slice(0, 100)}`,
    );

    // Record as a sighting and kick off match scoring.
    const sightingId = await ctx.db.insert("sightings", {
      caseId: shelter.caseId,
      source: "shelter_email",
      description: text.slice(0, 500) || "(reply with attachment)",
      sightedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.matches.scoreInboundReply, {
      caseId: shelter.caseId,
      shelterId: shelter._id,
      sightingId,
      messageText: text,
      // Attachment handling (photo → storage → vision) lands in the kill-gate
      // build; message payload carries attachment metadata.
      attachments: args.message?.attachments ?? [],
    });
  },
});

// ---- UI queries ----

export const threadForShelter = query({
  args: { shelterId: v.id("shelters") },
  handler: async (ctx, args) => {
    const shelter = await ctx.db.get(args.shelterId);
    if (!shelter?.threadId) return [];
    return await ctx.runQuery(components.agentmail.lib.listInboundMessages, {
      threadId: shelter.threadId,
    });
  },
});
