# 🐕 FetchBack

**Multiplayer missing-pet search party.** Convex runs it, Firecrawl feeds it
data, AgentMail gives it an inbox.

Register your pet *before* anything happens and run a practice **drill**. If
your pet is ever actually lost: volunteers claim search territories on a live
map, sightings stream in real time, Firecrawl watches shelter and found-pet
pages, the case's AgentMail inbox emails shelters (every send human-approved),
and when a reply with a photo lands, OpenAI vision through the Convex AI
Gateway scores a *possible* match
with visible reasons — and the owner, not the model, makes the call.

Built for the [Convex All Gas Hackathon](https://www.convex.dev/hackathons/all-gas).

## Stack

- **Convex** — backend, realtime live board, file storage, scheduler, HTTP actions
- **[@agentmail/convex](https://www.npmjs.com/package/@agentmail/convex)** — case inbox: durable sends, webhook ingest, reactive threads
- **[@firecrawl/firecrawl-convex](https://www.npmjs.com/package/@firecrawl/firecrawl-convex)** — shelter discovery + page monitoring
- **Convex AI Gateway + OpenAI** — deployment-scoped vision match scoring and
  outreach drafting; no provider API key stored by FetchBack
- React + Vite frontend → Convex static hosting (convex.site)

## Develop

```sh
bun install
bun run dev:backend   # convex dev (terminal 1)
bun run dev           # vite (terminal 2)
bunx convex run seed:demoWorkspace   # create the demo drill case
```

Deployment env vars (`bunx convex env set …`): see `.env.example`.

The gateway test and its safe mock fallback are documented in
[`docs/AI_GATEWAY_TEST.md`](docs/AI_GATEWAY_TEST.md).
