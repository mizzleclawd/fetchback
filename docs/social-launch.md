---
type: social-draft
title: "FetchBack launch post — X thread + LinkedIn"
created: 2026-09-13
tags:
  - hackathon
  - convex
  - openai
  - firecrawl
  - agentmail
---

# Social launch draft

Status: DRAFT — for Darius to post (human-only step). Post early enough for
engagement to compound before Sep 25 judging. Deadline context: submission is
due **Sep 22, 12:00 PM PT**.

- **Live app:** https://beloved-dog-203.convex.site
- **Repo:** https://github.com/mizzleclawd/fetchback
- **Tags required:** @convex @OpenAI @firecrawl @agentmail (all four appear
  across the thread; LinkedIn uses the platform names since it doesn't render
  X handles)
- Every claim below is real, shipped behavior on the production deployment.
  No engagement metrics, no fake screenshots.

---

## Version A — X / Twitter thread (5 posts)

### Post 1 / 5 — the hook

> Your dog is missing. It's getting dark. Instead of one flyer on one pole, imagine a live map where neighbors claim streets to search, shelters get emailed automatically, and every photo reply is compared to your pet by AI.
>
> We built that. It's live: https://beloved-dog-203.convex.site

### Post 2 / 5 — how it works

> How FetchBack works (@convex All Gas Hackathon):
>
> 1. Register your pet, run a practice drill
> 2. Pet lost? Volunteers claim territories on a live map
> 3. @firecrawl watches shelter pages
> 4. @agentmail emails shelters
> 5. @OpenAI vision scores photo replies

### Post 3 / 5 — the safety rail

> The safety rail: the owner decides, AI only suggests.
>
> Every match comes back with a score and its evidence — coat, build, collar — plus big CONFIRM / REJECT buttons. Outreach emails stay drafts until a human approves the send.
>
> No AI sends anything. No AI decides anything.

### Post 4 / 5 — the stack is real

> Every integration is real in production:
>
> • @convex — realtime board, file storage, scheduled jobs, hosting
> • @OpenAI via Convex AI Gateway — gpt-5.2 vision, no keys stored
> • @firecrawl — finds and monitors shelter pages
> • @agentmail — the case inbox, photo replies

### Post 5 / 5 — call to action

> Try the practice drill (no pet is actually missing — the banner says so):
>
> 🐕 https://beloved-dog-203.convex.site
>
> Register a pet, claim a territory, watch the map update live, then confirm the match on Biscuit's case.
>
> Built with @convex @OpenAI @firecrawl @agentmail 🐾

**Character check (done 2026-09-13):** all five posts ≤ 274 weighted chars
(t.co links counted as 23, emoji as 2) — under the 280 limit.

Posting notes:

- Post as a thread (reply to each previous post) so the algorithm keeps them
  together; pin Post 1 or the thread after posting.
- Attach a real screen recording or screenshot of the live board on the hook
  post if you have one from the video recording session — only real captures.
- Reply to early comments; engagement counts toward scoring.

---

## Version B — LinkedIn single post

When a pet goes missing, the tools are still flyers and Facebook posts — one
person, broadcasting, hoping the right neighbor sees it.

We built FetchBack for the Convex All Gas Hackathon to flip that: a
multiplayer search party that mobilizes the whole neighborhood in seconds.

How it works:

1. Register your pet before anything happens and run a practice drill.
2. If your pet is lost, volunteers claim search territories on a live map —
   updates stream in realtime.
3. Firecrawl discovers and watches local shelter pages automatically.
4. The case's AgentMail inbox drafts outreach emails to those shelters —
   nothing sends until a human approves it.
5. When a shelter replies with a photo, OpenAI vision (through the Convex AI
   Gateway) scores it as a possible match and shows the evidence: coat, build,
   collar.
6. The owner confirms or rejects. The owner decides; AI only suggests.

Every integration is real and running in production — realtime Convex
backend, Firecrawl web monitoring, AgentMail email, OpenAI vision — no mocks
in the demo path.

Try the practice drill (clearly labeled — no pet is actually missing):
https://beloved-dog-203.convex.site

Built with Convex, OpenAI, Firecrawl, and AgentMail.
#hackathon #convex #openai #firecrawl #agentmail #buildinpublic

---

## After posting (Darius)

- Reply to early comments on both platforms; tag the sponsors in replies when
  they engage.
- Put the post link into `docs/SUBMISSION.md` if the submission form asks for
  social proof.
