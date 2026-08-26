# Hackathon log

- **Project:** FetchBack
- **Event:** Convex All Gas Hackathon
- **What it does:** Multiplayer missing-pet search party — register your pet and run practice drills; when a pet is lost, volunteers claim live search territories, Firecrawl monitors shelter pages, an AgentMail inbox contacts shelters and receives replies, and OpenAI vision scores possible matches the owner confirms or rejects.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @agentmail/convex, @firecrawl/firecrawl-convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, internal functions, HTTP actions, scheduled functions, file storage, realtime queries
- **Auth:** none
- **AI models:** OpenAI (vision match scoring + outreach drafting; model configurable, default gpt-5.2)
- **Started:** 2026-08-26T02:47:00Z
- **Last updated:** 2026-08-26T03:35:00Z

## Log

### 2026-08-26 - working tree
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
