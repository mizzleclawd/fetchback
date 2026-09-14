# FetchBack

**The multiplayer missing-pet search party.** When a pet goes missing, the
whole neighborhood becomes a live search team on a realtime map — and an AI
pipeline behind it finds, contacts, and checks every shelter that might have
your pet.

**▶ Live app: https://beloved-dog-203.convex.site** (the default board is the
`demo-biscuit` practice drill — fictional pet, labeled as a drill in-app;
everything is clickable without an account).

Built for the [Convex All Gas Hackathon](https://www.convex.dev/hackathons/all-gas).
Repo: https://github.com/mizzleclawd/fetchback · Build log:
[`hackathon.md`](hackathon.md) · Judge demo path: [`hackathon.md`](hackathon.md#how-to-demo-for-judges).

## How it works

1. **Register & drill** — register your pet (photo, description, home area)
   and run a practice drill so the system is ready *before* anything happens.
2. **Lost → volunteers + live map** — if a pet is lost, the case goes live:
   volunteers claim search territories and report sightings on a realtime
   map board; every update streams to everyone instantly.
3. **Shelters via Firecrawl + AgentMail** — Firecrawl discovers and watches
   shelter/found-pet pages; the case's AgentMail inbox drafts outreach emails
   (AI-drafted, **human-approved** — nothing sends unapproved) and receives
   replies with photos.
4. **Gateway vision → owner decides** — OpenAI vision (through the Convex AI
   Gateway) scores each photo reply as a possible match with visible reasons;
   the **owner confirms or rejects** — AI only suggests.

## Stack

| Layer | Tech |
| --- | --- |
| Backend | **Convex** — schema/indexes, queries, mutations, actions, internal functions, HTTP actions, scheduled functions, file storage, realtime queries, static hosting (`@convex-dev/static-hosting`) |
| Components | **@agentmail/convex** (case inbox: durable sends, svix-verified webhook ingest) · **@firecrawl/firecrawl-convex** (shelter discovery + page monitoring) |
| Auth | **@convex-dev/auth** — one-tap anonymous owner identity; owner-only guards with a labeled demo passthrough |
| AI | **OpenAI through the Convex AI Gateway** (vision match scoring + outreach drafting; default `openai/gpt-5.2`; no provider API key stored by FetchBack) |
| Frontend | React + Vite, hosted on convex.site |

## Develop

```sh
bun install
bun run dev:backend   # convex dev (terminal 1)
bun run dev           # vite (terminal 2)
bunx convex run seed:demoWorkspace   # create the demo drill case
```

Checks: `bun run typecheck && bun test && bun run build`.
Deployment env vars (`bunx convex env set …`): see `.env.example`.
The gateway test + safe-mock fallback runbook:
[`docs/AI_GATEWAY_TEST.md`](docs/AI_GATEWAY_TEST.md).

## What's real vs. demo

- **All sponsor integrations are real on production.** Firecrawl really
  discovers Nashville shelters and scrapes real pages; AgentMail really sends
  email and receives replies through a svix-verified webhook; OpenAI vision
  really scores matches through the Convex AI Gateway (verified runs in
  [`hackathon.md`](hackathon.md) and
  [`docs/AI_GATEWAY_TEST.md`](docs/AI_GATEWAY_TEST.md)).
- **`demo-biscuit` is fictional.** Biscuit isn't a real pet; the case is a
  drill, stamped "PRACTICE DRILL — no pet is actually missing" in the UI.
- **The devloop harness is dev-only.** The rehearsal harness that drives a
  full mail exchange (`devloop:*`) is gated behind `FETCHBACK_ALLOW_DEVLOOP`,
  which is set on the dev deployment only and confirmed absent on prod.
- **Fallbacks are labeled.** If the gateway is ever unavailable, vision falls
  back to a clearly labeled `[MOCK vision adapter]` score rather than
  dropping the pipeline — the label always tells you which path ran.
- **No AI autonomy:** outreach sends and match verdicts both require a human
  (owner) decision. See the guards in `convex/lib/guards.ts`.
