# Hackathon log

- **Project:** FetchBack
- **Event:** Convex All Gas Hackathon
- **What it does:** Multiplayer missing-pet search party — register your pet and run practice drills; when a pet is lost, volunteers claim live search territories, Firecrawl monitors shelter pages, an AgentMail inbox contacts shelters and receives replies, and OpenAI vision through Convex AI Gateway scores possible matches the owner confirms or rejects.
- **Live app:** https://beloved-dog-203.convex.site (prod; dev deployment also live: https://valiant-ram-10.convex.cloud)
- **Repo:** https://github.com/mizzleclawd/fetchback (branch `main`)
- **Frontend:** Convex static hosting (`@convex-dev/static-hosting` v0.2.1, app-owned root routing)
- **Convex deployment:** prod `beloved-dog-203` (team dmd-tech, project fetchback) — backend + hosted frontend + demo seed live; dev `valiant-ram-10` untouched and working
- **Components:** @agentmail/convex, @firecrawl/firecrawl-convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, internal functions, HTTP actions, scheduled functions, file storage, realtime queries
- **Auth:** @convex-dev/auth — one-tap Anonymous owner identity; owner-only guards with labeled demo passthrough
- **AI models:** OpenAI through Convex AI Gateway (vision match scoring + outreach drafting; model configurable, default `openai/gpt-5.2`) — real multimodal cloud-dev test passed; labeled mock remains the safe fallback
- **Started:** 2026-08-26T02:47:00Z
- **Last updated:** 2026-09-13T20:25:00Z

## Log

### 2026-09-13 — Production deploy (Connie)

**Live: https://beloved-dog-203.convex.site** — the full real stack, not a
preview: Convex backend + components (AgentMail, Firecrawl,
static-hosting), file storage, auth, realtime queries.

- **Hosting:** added `@convex-dev/static-hosting@0.2.1` per the live docs
  (convex.dev/components/static-hosting + INTEGRATION.md; package verified
  against installed exports). **App-owned root routing** — component mounted
  with no httpPrefix, `registerStaticRoutes` registered in `convex/http.ts`
  after the exact routes — so `/agentmail/webhook`, `/firecrawl/*`, and the
  auth routes keep their original URLs (the component's default `/api` mode
  would have moved them). Deployed via
  `static-hosting upload --build --prod` (build runs with
  `VITE_CONVEX_URL=https://beloved-dog-203.convex.cloud`; bundle verified to
  reference the prod deployment).
- **Backend:** `CONVEX_DEPLOYMENT=beloved-dog-203 convex deploy` — all
  indexes + components installed on prod.
- **Prod env (verified by name via `env list --prod --names-only`):**
  FIRECRAWL_API_KEY, AGENTMAIL_API_KEY, AGENTMAIL_WEBHOOK_SECRET,
  AGENTMAIL_INBOX_ID (fetchback-case@agentmail.to), JWT_PRIVATE_KEY, JWKS,
  SITE_URL (https://beloved-dog-203.convex.site). `FETCHBACK_ALLOW_DEVLOOP`
  confirmed absent — the dev harness stays dev-only.
- **Prod AgentMail webhook:** `ep_3JIVMmonOsx7IwEqQFXu31zS59s` at
  https://beloved-dog-203.convex.site/agentmail/webhook (message.received,
  enabled; dev webhook `ep_3IhdEVr2YqdSeOY90FILXTIRr2K` still registered).
  Unsigned POST → 401, so svix verification is live and the exact route wins
  over the static catch-all. Vision production-readiness: AI Gateway needs
  no key (deployment-scoped credential), env verified, mock/devloop flags
  absent.
- **JWT key rotation:** during env copy, a diagnostic leaked the dev
  JWT_PRIVATE_KEY into a session log → both keys discarded; fresh RS256 pair
  (kid `fetchback-20260913`) + JWKS set on dev AND prod via the CLI's stdin
  form (also works around convex CLI rejecting `-----BEGIN` values as
  unknown options). Dev + prod `/.well-known/jwks.json` both serve the new
  kid; existing sessions were invalidated (anonymous, one-tap re-sign-in).
- **Demo seed verified on prod:** `seed:demoWorkspace` → case
  `kd769sj7vv2fd3mketg1wryjn98ecz7e`; `cases:caseBySlug demo-biscuit`
  returns the full drill case + pet; `curl /` → 200. `bun run typecheck` +
  5/5 tests still pass. Remaining for launch: social post, <3-min video,
  vibeapps.dev submission (FETCHBACK-03).

### 2026-09-13 — Notice-board frontend complete (Connie)

Full user-facing notice board built on the verified backend, all in the
cork-board design system. Components (all live-verified on dev
`valiant-ram-10`, browser against `bun run dev`):

- **`PetHeader.tsx`** — hero card: name + MISSING/FOUND/DRILL/CLOSED stamp,
  breed/color, description, home radius, last-seen time, polaroid photo via
  the new public `cases:photoUrls` query, and the striped PRACTICE DRILL
  banner on drill cases. Verified rendering for `demo-biscuit`.
- **`MapBoard.tsx`** — hand-drawn SVG neighborhood map (no map library):
  linear lat/lng projection framed by pet home + `homeRadiusM` (padded),
  dashed territory rectangles colored by status (claimed/searching/done)
  with volunteer names, 🐾 sighting pins with photo dots, ⌂ home marker,
  ✕ last-seen marker, park/greenway decoration, wavy streets. Volunteer
  controls (claim territory / report sighting with jitter near last-seen).
  **Live-verified:** ran the CLI `claimTerritory` claim while the browser
  was open — the "MapTest · claimed" rectangle and feed event appeared
  without refresh.
- **`MatchCards.tsx`** — one card per match: candidate polaroid
  (`cases:photoUrls`), `.match-score` percentage, all gateway reasons,
  source badge, CONFIRM/REJECT (`matches:decideMatch`) while pending;
  CONFIRMED/REJECTED stamps when decided; demo-case label.
  **Live-verified end-to-end:** `devloop:runDrillLoop` with a real photo
  attachment + `skipReplay` (real AgentMail sends, real webhook push) →
  new 62% match card appeared live with real gateway reasons
  (`openai/gpt-5.2`, coat/build/collar evidence) → CONFIRM clicked in the
  UI → stamp + "Owner CONFIRMED the match! 🎉" feed event.
- **`ShelterPanel.tsx`** — shelter list (link, crawl/seed/manual badge,
  contact state), "Draft outreach" per un-contacted shelter with email,
  drafts with subject/body preview + APPROVE & SEND (`mail:approveAndSend`)
  + "sent ✓". Backing it, `mail:requestOutreachDraft` public mutation
  (owner/demo-guarded, schedules the internal AI draft).
  **Live-verified:** Draft outreach → real gateway draft appeared
  (drill-labeled) → approved → `email_sent` event landed in the live feed.
- **`RegisterPage.tsx`** + hash routing (`#/register`, `#/c/<slug>`,
  default board) with `AuthWidget` extracted for reuse. Sign-in prompt when
  signed out; pet form (name/species/breed/color/description/radius/home
  lat-lng) with real photo upload (`generateUploadUrl` → POST → storage
  ids); register → "Start practice drill" (`activateCase` isDrill) → share
  link. `activateCase` now returns `{caseId, slug}` so the share link is
  shown. **Live-verified:** signed in anonymously in the browser,
  registered fictional pet "Waffles" with a photo, started the drill,
  opened `#/c/waffles-6gnxbu` (full board renders, polaroid shows), and a
  read-only deployment query confirmed the pet row (real auth subject,
  photo stored) and the drill case row.
- **Polish** — `.board-grid` (map + feed) replaces the scaffold `.cols` for
  the top row, feed kept as the notepad `.feed` with `.kind` badges,
  `.paw-divider` 🐾 between sections, mobile single-column verified at
  390px (computed grid columns + no horizontal overflow).
  `bun run typecheck && bun run build && bun test` → 5/5 pass.

Backend touches (both spec'd by the playbook): `cases:photoUrls` public
query; `mail:requestOutreachDraft` public mutation; `activateCase` return
extended to `{caseId, slug}` (no callers depended on the old shape).
Committed and pushed to `main`.

### 2026-09-03 — Convex AI Gateway multimodal path (Connie)

Replaced the direct `OPENAI_API_KEY` integration with Convex AI Gateway.
Actions mint a short-lived, deployment-scoped credential with
`getServiceToken("ai-gateway")`; FetchBack never receives or stores an OpenAI
key. The default model is provider-qualified `openai/gpt-5.2`, configurable
with `FETCHBACK_AI_MODEL`.

**Verified REAL on cloud dev `valiant-ram-10`:** two different public golden
retriever photos were submitted through `gatewayTest:runMultimodal`. Result:
`provider=convex-ai-gateway`, `model=openai/gpt-5.2`, `usedMock=false`, score
`0.55` on the final deployed-code run. Reasons cited concrete visual evidence including head/ear shape, dark
nose, coat color, and coat-length differences. The first reason visibly tags
the gateway/model and states that this is only a possible match requiring
owner review.

**Safe fallback:** gateway-disabled, gateway-unavailable, HTTP-error, and
explicit `FETCHBACK_VISION_MODE=mock` paths keep processing and return
`[MOCK vision adapter — image was NOT analyzed]`. Outreach similarly falls
back to a labeled offline template and remains human approval-gated. Five
deterministic tests pass; typecheck and production frontend build pass.
Tester instructions: `docs/AI_GATEWAY_TEST.md`.

### 2026-08-31 (evening) — LLM provider ruling + decision (Connie)

Verified against the official rules (convex.dev/hackathons/all-gas):
eligibility requires the Convex backend, at least one cohost/partner
integration (FetchBack has two: Firecrawl + AgentMail), a public repo, and
a convex.site/chatgpt.site live URL — a specific runtime LLM is NOT an
eligibility rule ("Anything goes, as long as Convex is the backend"), and
the build tool may be any agent/IDE with the Convex plugin. However,
"Sponsor stack — OpenAI, Firecrawl, and AgentMail do real work" is a
scored criterion and OpenAI fields four of the judges. Decision: OpenAI
stays the vision/drafting engine (model seam in `convex/lib/vision.ts`
remains configurable for fallbacks); awaiting a ~$10 API credit purchase.
The labeled mock adapter keeps the app fully demoable until then. No code
changed in this entry.

### 2026-08-31 (night) — credit sizing for multi-app submissions (Connie)

Context: multiple apps will be submitted (rules explicitly allow unlimited
submissions). Budget decision: OpenAI credit purchase sized at $25, not
$10 — kill-gate/demo/judge traffic across 2-3 apps estimates $10-25, and
an app rate-limiting during judging would zero the "OpenAI does real
work" criterion. Plan when OPENAI_API_KEY lands: default the vision
adapter to a low-cost vision model for public/judge traffic via the
existing model seam in `convex/lib/vision.ts` (mini-class models are
10-20x cheaper), reserving the strongest model for the recorded demo.
Credits do not expire; surplus remains account balance.

### 2026-08-31 (late) — while-waiting plan + frontend readiness audit (Connie)

Audited frontend state while awaiting OPENAI_API_KEY: `src/App.tsx` is the
126-line scaffold board (realtime feed + claim/report work) but surfaces
none of the product — no map, no shelters panel, no match photos, no
owner confirm/reject UI (`decideMatch` exists, unbound), no draft→approve
→send UI (`approveAndSend` exists, unbound), no registration/activation
flow. Static hosting not yet wired (no hosting component in
`convex/convex.config.ts`); `dist/` stale since Aug 25.

Work plan (scored-impact order, all OpenAI-independent):
1. Real frontend (map, shelters, match cards w/ photos + owner decision,
   outreach approve flow, feed, registration/drill) — in progress next.
2. Prod deploy: hosting component → `beloved-dog-203`, env vars (devloop
   flag stays OFF prod), prod webhook, clean demo seed.
3. Firecrawl watched-page cron (unused `watchedPages` table) — rescan
   shelter pages on active cases, auto-file new-listing sightings.
4. Convex Auth v2 alpha — owner identity gating match decisions.
5. Demo video storyboard + social post draft.
6. On key arrival: low-cost vision model default, real-vision kill-gate.

### 2026-08-31 (night 2) — Convex Auth added: owner identity + guards (Connie)

Installed `@convex-dev/auth@0.0.95` (+ `@auth/core@0.41.1`). Provider:
**Anonymous (one-tap)** — deliberate: no Passkey provider ships in 0.0.95,
and a stressed owner (or a judge, live) should never face an email
round-trip; each sign-in is still a real server-side subject. Wiring:
`convex/auth.ts` (provider + name param), `convex/auth.config.ts`,
`auth.addHttpRoutes` in `convex/http.ts`, `authTables` in schema,
`ConvexAuthProvider` in `src/main.tsx` + `AuthWidget` in the App header.

**Guards (`convex/lib/guards.ts`):** `registerPet` now derives `ownerId`
from the signed-in identity — closes the client-supplied-ownerId hole;
`myPets` is identity-scoped; `activateCase` checks pet ownership;
`decideMatch` + `mail:approveAndSend` are owner-only with a labeled
passthrough on the fictional `demo-biscuit` drill case so judges can
exercise the emotional beats without an account.

**Env (dev):** JWT_PRIVATE_KEY + JWKS (RS256, generated headlessly via
jose), SITE_URL. First key-set attempt leaked the key into a shell error
path (word-splitting); that key was discarded, regenerated, and set via
argv-safe `execFileSync` — no value echoed.

**Verified REAL:** `auth:signIn` round-trip returns signed JWTs
(RS256, iss=valiant-ram-10.convex.site) · `registerPet` without a session
throws `AuthError: Sign in required` · demo passthrough `decideMatch`
persists (verdict confirmed + feed event) · typecheck clean, functions
pushed.

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

### 2026-09-01 — readiness audit vs. submission requirements (Connie)

*(Supersedes the stale blockers above: AgentMail key, webhook, secret, and
inbox are all set and verified real — see the later 08-31 entries.)*

Verdict: ~60% submission-ready. DONE: Convex depth (incl. auth), Firecrawl
real, AgentMail real (send + push webhook + attachments), public repo,
build log current. NOT DONE (critical-path order): notice-board frontend →
prod deploy (`beloved-dog-203` + convex.site static hosting + prod
webhook + clean seed) → OPENAI_API_KEY (real vision; $25 credits pending
since 08-31) → social post after the live URL exists (tag
@convex @OpenAI @firecrawl @agentmail) → <3min video → vibeapps.dev
submission. Deadline: Sep 22, 12:00 PM PT (21 days). Frontend build starts
now.

### 2026-09-04 — gateway re-verified by fresh run; audit corrected (Connie)

The 09-01 readiness audit above was stale when written — commit `3d3c7da`
(sep 3) had already replaced `OPENAI_API_KEY` with the Convex AI Gateway
and verified it real. **Blockers list corrected: no OpenAI key is needed,
ever** — the gateway owns provider credentials.

Fresh verification run (this session, `gatewayTest:runMultimodal`,
verbatim runbook photos): `provider=convex-ai-gateway`,
`model=openai/gpt-5.2`, `usedMock=false`, score 0.56 — reasons cite true
visual evidence (coat feathering, ear set, lighter cream-golden candidate,
"could be grooming/season or a different dog"). An accidental
malformed-image-URL run also exercised the resilience path: HTTP 400 →
clean labeled mock fallback, attachment pipeline unaffected. Sponsor-stack
status: **OpenAI real ✅ · Firecrawl real ✅ · AgentMail real ✅**.

### 2026-09-04 (later) — Auto Run playbooks authored for the finish line (Connie)

Created a task-based Maestro Auto Run playbook (fresh agent per checkbox)
at `.maestro/playbooks/2026-09-04-FetchBack-Finish/` driving the remaining
critical path: **FETCHBACK-01** notice-board frontend (photo URLs query,
PetHeader, MapBoard SVG, MatchCards w/ CONFIRM/REJECT, ShelterPanel +
guarded `requestOutreachDraft`, RegisterPage, polish+verify, live-verified
against dev drills) → **FETCHBACK-02** prod deploy (hosting component per
current docs, prod env vars — devloop flag forbidden on prod, prod
AgentMail webhook via API, seed + live-URL verification, halt marker on
credential blockers) → **FETCHBACK-03** launch (social drafts, <3-min
video storyboard, log/README submission polish, final audit, submission
packet; posting/recording/submitting flagged human-only for Darius).
Playbook refreshed via maestro-cli; not yet launched.
