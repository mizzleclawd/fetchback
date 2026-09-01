# Hackathon log

- **Project:** FetchBack
- **Event:** Convex All Gas Hackathon
- **What it does:** Multiplayer missing-pet search party — register your pet and run practice drills; when a pet is lost, volunteers claim live search territories, Firecrawl monitors shelter pages, an AgentMail inbox contacts shelters and receives replies, and OpenAI vision scores possible matches the owner confirms or rejects.
- **Live app:** not deployed (dev deployment live: https://valiant-ram-10.convex.cloud)
- **Repo:** https://github.com/mizzleclawd/fetchback (branch `main`)
- **Frontend:** Convex static hosting
- **Convex deployment:** dev `valiant-ram-10` (team dmd-tech, project fetchback); prod provisioned (`beloved-dog-203`), not yet used
- **Components:** @agentmail/convex, @firecrawl/firecrawl-convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, internal functions, HTTP actions, scheduled functions, file storage, realtime queries
- **Auth:** none
- **AI models:** OpenAI (vision match scoring + outreach drafting; model configurable, default gpt-5.2) — **currently behind the mock adapter** (see log)
- **Started:** 2026-08-26T02:47:00Z
- **Last updated:** 2026-08-31T19:05:00Z

## Log

### 2026-08-31 (later) — real webhook + attachment kill-gate (Connie)

**Env changes on dev `valiant-ram-10`:** AGENTMAIL_API_KEY re-set by Darius
(earlier 403s traced to an empty value; verified working — 200 on
GET /inboxes). AGENTMAIL_WEBHOOK_SECRET set (from webhook registration
below). AGENTMAIL_INBOX_ID=fetchback-case@agentmail.to. OPENAI_API_KEY
still ✗ — credits pending; vision remains behind the labeled mock adapter.

**Webhook registered for real (no dashboard needed):** POST /v0/webhooks →
`ep_3IhdEVr2YqdSeOY90FILXTIRr2K` at
https://valiant-ram-10.convex.site/agentmail/webhook (event:
`message.received`); the returned signing secret was set as
AGENTMAIL_WEBHOOK_SECRET and functions re-pushed.

**Verified REAL — the previously-simulated push leg is now real:**
- Drill sends: 2 real AgentMail emails (real SES message ids) — outreach +
  reply with a real 165KB JPEG attachment.
- AgentMail delivered the signed svix webhook to the .convex.site route;
  the component verified the signature; `mail:onMessageReceived` ran on
  push (no replay) → shelter correlation → sighting → match_scored events
  on the live feed.

**Bug found + fixed (webhook attachment shape):** receiver-side webhook
messages carry attachments as `{attachment_id, filename, content_type,
size}` with NO url (the sender-side thread view does have urls — why the
old replay worked). Fix: `convex/lib/attachments.ts` resolves
`attachment_id` via AgentMail Get Attachment
(GET /inboxes/{i}/messages/{m}/attachments/{a}) → signed `download_url` →
bytes → Convex file storage; `convex/mail.ts` + `convex/matches.ts` thread
`inbox_id`/`message_id` through. Verified: newest sighting photo stored
(`kg28a5wc57m2tzdd3fsp3r2akh8dk3g0`), match `candidatePhotoId` set, reasons
state the photo awaits real vision.

**Harness:** `devloop:runDrillLoop` gained `skipReplay` — sends real mail
and lets the registered webhook drive processing (true production path).

**Remaining mock (only):** OpenAI vision + drafting (`convex/lib/vision.ts`
labeled adapter). Unblocks the moment OPENAI_API_KEY is set.

### 2026-08-26 - 6d62a07
Scaffolded the full FetchBack backend and a minimal live board. Schema covers
pets, search cases (drill/active), volunteer territories, sightings, shelters,
approval-gated outreach drafts, vision-scored matches, watched pages, and an
event feed (`convex/schema.ts`). Registered both sponsor components in
`convex/convex.config.ts`: AgentMail (case inbox: outbound send via human
approval in `convex/mail.ts`, inbound webhook at `/agentmail/webhook` in
`convex/http.ts` feeding the match pipeline) and Firecrawl (shelter discovery
via search + JSON-extraction scrape in `convex/crawl.ts`). OpenAI vision
scoring and outreach drafting live in `convex/lib/openai.ts`; match verdicts
are owner-decided only (`convex/matches.ts`). Verified on a local anonymous
Convex deployment: functions push clean, seeded demo drill case
(`convex/seed.ts`), and a CLI-fired mutation appeared instantly in the open
browser's live feed — realtime subscription loop proven. Convex features:
schema, indexes, queries, mutations, actions, HTTP actions, scheduler, file
storage, realtime queries.

### 2026-08-31 - bf92794 + 5bf4da6 - kill-gate push (Connie)

**Verified REAL (cloud dev `valiant-ram-10` unless noted):**
- Firecrawl Nashville: `discoverShelters` found 5 real Nashville orgs (cloud +
  local); `scrapeShelterPage` on nashvillehumane.org extracted real contact
  email (info@nashvillehumane.org) + 2 real adoptable-dog listings into the
  live feed. nashville.gov dept page yields nothing — target its intake
  subpage next.
- AgentMail real API: authenticated, listed inboxes, and sent two real DRILL
  emails (outreach + reply w/ photo attachment) through the component on the
  local deployment at 17:22Z. Plan limit: 3 inboxes (reused thereafter).
- Attachment → storage → match → owner decision, end-to-end on cloud: an
  inbound message with a REAL photo URL (nashvillehumane.org CDN, ~190KB
  JPEG) → bytes stored in Convex file storage (live storage URL) → sighting
  with photo → match scored (0.36) with reasons → owner confirmed via
  `matches:decideMatch` → "Owner CONFIRMED" event. Feed order verified:
  email_reply → match_scored → match_decided.

**Mocked (clearly labeled, no OpenAI key yet):**
- All vision scoring/drafting goes through `convex/lib/vision.ts`, which
  dispatches to a deterministic text-overlap heuristic while
  `OPENAI_API_KEY` is unset. Every mock reason starts with
  `[MOCK vision adapter — no OPENAI_API_KEY configured]`; mock drafts are
  labeled as offline template output. No vision claim is made anywhere.

**Simulated (mail delivery leg):**
- The inbound webhook leg was driven by calling `mail:onMessageReceived`
  directly with a faithful message payload (real photo URL) — AgentMail's
  push delivery needs a public `.convex.site` webhook, and the AgentMail
  key was REVOKED mid-test (403 everywhere from ~18:30Z; it had worked at
  17:22Z). Darius needs to issue a new key.

**Bugs found + fixed:**
- `@agentmail/convex@0.1.0` declares no env → component functions couldn't
  see AGENTMAIL_API_KEY (env isolation). Fixed via `bun patch` (patches/)
  + explicit `app.use(agentmail, { env })` pass-through in convex.config.ts.
- Same package registers inbox/thread reads (createInbox/listInboxes/
  getThread/getMessage) as internal — unreachable from app code. Dev-loop
  harness falls back to the public REST API for those; production paths
  (enqueueSend/handleEvent/listInboundMessages) are public and unaffected.

**Commands (from fetchback/):** `bun install` · `bunx convex dev --once`
(push) · `bunx convex run seed:demoWorkspace` ·
`bunx convex run crawl:discoverShelters '{"caseId":"...","areaQuery":"Nashville TN"}'` ·
`bunx convex run crawl:scrapeShelterPage '{...}'` (internal; via dashboard/MCP) ·
drill loop: `bunx convex run devloop:runDrillLoop '{"caseId":"...","photoUrl":"..."}'`
(needs FETCHBACK_ALLOW_DEVLOOP=1; AgentMail key currently revoked).

**Env on dev `valiant-ram-10`:** FIRECRAWL_API_KEY ✓ (verified working) ·
AGENTMAIL_API_KEY set but REVOKED — replace · FETCHBACK_ALLOW_DEVLOOP=1 ✓ ·
OPENAI_API_KEY ✗ · AGENTMAIL_WEBHOOK_SECRET ✗ (must be the real signing
secret from the AgentMail dashboard once the webhook is registered) ·
AGENTMAIL_INBOX_ID ✗ (set when the case inbox is created for real).

**Blockers (principal):** new AgentMail API key · OPENAI_API_KEY (vision) ·
register the AgentMail webhook → https://valiant-ram-10.convex.site/agentmail/webhook
+ set AGENTMAIL_WEBHOOK_SECRET.
