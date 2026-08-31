// Dev-loop helper — kill-gate rehearsal, NOT a user feature.
//
// Runs the drill email loop against the REAL AgentMail API:
//   1. ensure two real inboxes (case + shelter-sim)
//   2. point the demo shelter at the shelter-sim inbox
//   3. real DRILL outreach send: case inbox → shelter-sim (with photo)
//   4. real reply send: shelter-sim → case inbox (with photo attachment)
//   5. read the REAL received message back from the case inbox thread
//   6. replay it through components.agentmail.lib.handleEvent — the exact
//      mutation the svix-verified webhook handler calls — so
//      mail.onMessageReceived → attachment download → storage → (mock)
//      vision scoring → match row all run the production path.
//
// The only simulated part is AgentMail's push delivery of the webhook
// (impossible on localhost): everything else is real API, real mailboxes,
// real attachment bytes, real storage.
//
// Safety rails: refuses to run on production deployments; outbound mail is
// confined to AgentMail inboxes this loop creates (no real shelter is ever
// contacted). Public for CLI/`convex run` access in dev only.

import { v } from "convex/values";
import { action, internalQuery, internalMutation } from "./_generated/server";
import { createFunctionHandle } from "convex/server";
import { components, internal } from "./_generated/api";
import { AgentMail } from "@agentmail/convex";

const agentmail: AgentMail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.mail.onMessageReceived,
});

const POLL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30; // ~60s per send

export const devloopContext = internalQuery({
  args: { caseId: v.id("searchCases") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    if (!c) throw new Error("Case not found");
    const pet = await ctx.db.get(c.petId);
    if (!pet) throw new Error("Pet not found");
    const shelter = await ctx.db
      .query("shelters")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .first();
    return { case: c, petName: pet.name, petDescription: pet.description, shelter };
  },
});

export const setDevloopShelterEmail = internalMutation({
  args: { shelterId: v.id("shelters"), email: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.shelterId, {
      email: args.email,
      source: "seed",
    });
  },
});

function base64FromBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return path.includes(".") ? path : fallback;
  } catch {
    return fallback;
  }
}

/** Find an array of message-like objects in an AgentMail thread response. */
function threadMessages(thread: unknown): Record<string, unknown>[] {
  const seen = new Set<unknown>();
  const queue: unknown[] = [thread];
  const out: Record<string, unknown>[] = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    const obj = node as Record<string, unknown>;
    if ("message_id" in obj && "from" in obj) out.push(obj);
    for (const value of Object.values(obj)) queue.push(value);
  }
  return out;
}

// Component ctx types live in the component's generic world; the app's ctx
// is runtime-identical (same variance-only mismatch noted in http.ts).
type MailActionCtx = Parameters<AgentMail["createInbox"]>[0];
type MailQueryCtx = Parameters<AgentMail["status"]>[0];
type MailMutationCtx = Parameters<AgentMail["sendMessage"]>[0];

async function ensureInbox(
  ctx: MailActionCtx,
  username: string,
): Promise<{ inboxId: string; email: string }> {
  // NB: createInbox/listInboxes are internal component functions the
  // deployed @agentmail/convex@0.1.0 registry does not expose to the app,
  // so: check the component's local inbox cache first, else create via the
  // public REST API directly (same endpoint the component uses).
  type RemoteInbox = { inbox_id: string; email: string };
  const listed = (await agentmailRest("GET", "/inboxes?limit=100")) as
    | RemoteInbox[]
    | { inboxes?: RemoteInbox[] };
  const remote: RemoteInbox[] = Array.isArray(listed)
    ? listed
    : (listed.inboxes ?? []);
  const existing = remote.find((i) =>
    i.email.toLowerCase().startsWith(`${username}@`),
  );
  if (existing) return { inboxId: existing.inbox_id, email: existing.email };
  const created = (await agentmailRest("POST", "/inboxes", {
    username,
  })) as { inbox_id: string; email: string };
  return { inboxId: created.inbox_id, email: created.email };
}

/** Direct AgentMail REST call (dev harness only; bypasses the component
 *  for functions the component registry doesn't expose to app code). */
async function agentmailRest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) throw new Error("AGENTMAIL_API_KEY is not set on the deployment");
  const base = (process.env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`AgentMail REST ${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function pollStatus(
  ctx: MailQueryCtx,
  outboundId: string,
): Promise<{ status: string; threadId: string | null; messageId: string | null; errorMessage: string | null }> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const s = await agentmail.status(ctx, outboundId as never);
    if (s && s.status !== "pending") {
      return { ...s, messageId: s.agentmailMessageId };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { status: "timeout", threadId: null, messageId: null, errorMessage: "poll timeout" };
}

/** Diagnostic: which component functions resolve on this deployment? */
export const probeComponents = action({
  args: {},
  handler: async (ctx) => {
    const out: Record<string, string> = {};
    const probes: Array<[string, () => Promise<unknown>]> = [
      ["agentmail.lib.listInboxes", () =>
        ctx.runAction(components.agentmail.lib.listInboxes as never)],
      ["agentmail.lib.listCachedInboxes", () =>
        ctx.runQuery(components.agentmail.lib.listCachedInboxes as never)],
      ["agentmail.lib.getCachedInbox", () =>
        ctx.runQuery(
          components.agentmail.lib.getCachedInbox as never,
          { inboxId: "x" } as unknown as never,
        )],
      ["agentmail.lib.listInboundMessages", () =>
        ctx.runQuery(
          components.agentmail.lib.listInboundMessages as never,
          { threadId: "probe" } as unknown as never,
        )],
      ["agentmail.lib.createInbox", () =>
        ctx.runAction(
          components.agentmail.lib.createInbox as never,
          { request: { username: `fetchback-probe-${Date.now() % 1000}` } } as unknown as never,
        )],
    ];
    for (const [name, fn] of probes) {
      if (name === "agentmail.lib.handleEvent") {
        out[name] = "skipped";
        continue;
      }
      try {
        const r = await fn();
        out[name] = `ok: ${JSON.stringify(r).slice(0, 80)}`;
      } catch (e) {
        out[name] = `ERR: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160);
      }
    }
    return out;
  },
});

export const runDrillLoop = action({
  args: {
    caseId: v.id("searchCases"),
    photoUrl: v.optional(v.string()),
    replyText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (process.env.FETCHBACK_ALLOW_DEVLOOP !== "1") {
      throw new Error(
        "devloop requires FETCHBACK_ALLOW_DEVLOOP=1 on the deployment (dev/rehearsal only; never set on prod)",
      );
    }
    const info = await ctx.runQuery(internal.devloop.devloopContext, {
      caseId: args.caseId,
    });
    if (!info.shelter) throw new Error("Case has no shelter row to correlate replies");

    const mailCtx = ctx as unknown as MailActionCtx;
    const mutCtx = ctx as unknown as MailMutationCtx;
    const queryCtx = ctx as unknown as MailQueryCtx;

    // 1. Two real inboxes.
    const caseInbox = await ensureInbox(mailCtx, "fetchback-case");
    const shelterSim = await ensureInbox(mailCtx, "fetchback-shelter-sim");

    // 2. Correlate the demo shelter to the sim inbox address.
    await ctx.runMutation(internal.devloop.setDevloopShelterEmail, {
      shelterId: info.shelter._id,
      email: shelterSim.email,
    });

    // 3. Optional photo attachment (real bytes from a crawl-discovered URL).
    let attachment: { filename: string; content: string; contentType?: string } | undefined;
    if (args.photoUrl) {
      const res = await fetch(args.photoUrl, { redirect: "follow" });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
          attachment = {
            filename: filenameFromUrl(args.photoUrl, "candidate.jpg"),
            content: base64FromBytes(buf),
            contentType: res.headers.get("content-type") ?? undefined,
          };
        }
      }
    }

    // 4. Real DRILL outreach: case inbox → shelter-sim.
    const outreachId = await agentmail.sendMessage(mutCtx, caseInbox.inboxId, {
      to: shelterSim.email,
      subject: `[DRILL - no action needed] Possible match inquiry: ${info.petName}`,
      text:
        `PRACTICE DRILL — no pet is actually missing.\n\n` +
        `Checking whether a ${info.petDescription} has been brought in. ` +
        `If so, please reply with a photo.`,
      labels: ["fetchback", "devloop", `case:${args.caseId}`],
      attachments: attachment ? [attachment] : undefined,
    });
    const outreach = await pollStatus(queryCtx, outreachId);

    // 5. Real reply: shelter-sim → case inbox, photo attached.
    const replyText =
      args.replyText ??
      `We may have a dog matching your description in intake this morning — photo attached. Please confirm.`;
    const replyId = await agentmail.sendMessage(mutCtx, shelterSim.inboxId, {
      to: caseInbox.email,
      subject: `RE: [DRILL - no action needed] Possible match inquiry: ${info.petName}`,
      text: replyText,
      attachments: attachment ? [attachment] : undefined,
    });
    const reply = await pollStatus(queryCtx, replyId);
    if (reply.status === "failed" || reply.status === "timeout") {
      return {
        ok: false,
        caseInbox,
        shelterSim,
        outreach,
        reply,
        note: "reply send did not complete; inspect AgentMail dashboard",
      };
    }

    // 6. Read the REAL received message. Search the case inbox's threads for
    //    the reply (received copy); fall back to the sender's thread (sent
    //    copy — same message resource incl. attachments).
    let realMessage: Record<string, unknown> | undefined;
    for (let i = 0; i < POLL_MAX_ATTEMPTS && !realMessage; i++) {
      const lists: unknown[] = [];
      try {
        lists.push(
          await agentmailRest("GET", `/inboxes/${caseInbox.inboxId}/threads?limit=50`),
        );
      } catch { /* receiver-side listing may lag */ }
      if (reply.threadId) {
        try {
          lists.push(
            await agentmailRest(
              "GET",
              `/inboxes/${shelterSim.inboxId}/threads/${reply.threadId}`,
            ),
          );
        } catch { /* sender-side thread may also lag */ }
      }
      for (const l of lists) {
        const msgs = threadMessages(l);
        const hit = msgs.find(
          (m) =>
            typeof m.from === "string" &&
            m.from.toLowerCase().includes(shelterSim.email.toLowerCase()),
        );
        if (hit) {
          realMessage = hit;
          break;
        }
      }
      if (!realMessage) await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (!realMessage) {
      return {
        ok: false,
        caseInbox,
        shelterSim,
        outreach,
        reply,
        note: "reply sent but message not yet visible in case inbox thread",
      };
    }
    if (!realMessage.inbox_id) realMessage.inbox_id = caseInbox.inboxId;

    // 7. Replay through the component's exact webhook dispatch mutation.
    const event = {
      type: "event" as const,
      event_type: "message.received" as const,
      event_id: `devloop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: realMessage,
    };
    const config = {
      retryAttempts: 2,
      initialBackoffMs: 1000,
      onMessageReceived: {
        fnHandle: await createFunctionHandle(internal.mail.onMessageReceived),
      },
    };
    await mutCtx.runMutation(
      components.agentmail.lib.handleEvent,
      { config, event },
    );

    const attachments = Array.isArray(realMessage.attachments)
      ? (realMessage.attachments as Array<Record<string, unknown>>).map((a) => ({
          filename: a.filename ?? null,
          url: a.url ?? a.content_url ?? null,
          content_type: a.content_type ?? null,
          size: a.size ?? null,
        }))
      : [];

    return {
      ok: true,
      caseInbox,
      shelterSim,
      outreach: { outboundId: outreachId, ...outreach },
      reply: { outboundId: replyId, ...reply },
      realMessageKeys: Object.keys(realMessage).sort(),
      attachments,
      replayedEventId: event.event_id,
      note: "replayed via components.agentmail.lib.handleEvent (production webhook path minus svix push)",
    };
  },
});
