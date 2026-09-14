---
type: video-script
title: "FetchBack demo video script — 3-minute product walkthrough"
created: 2026-09-13
duration-target: sub-3-minutes
tags:
  - hackathon
  - convex
  - openai
  - firecrawl
  - agentmail
---

# Demo video script

**Goal:** judges see the real product doing real sponsor work end-to-end, in
under three minutes. No slides, no mockups — a screen recording of the live
app.

- **Record:** the live app at https://beloved-dog-203.convex.site
  (production), 1080p screen recording, browser chrome visible enough to show
  the URL at least in the opening and closing.
- **Walkthrough case:** `demo-biscuit` (Biscuit, golden retriever mix, red
  collar — fictional and labeled as a drill in-app by the striped
  "PRACTICE DRILL — no pet is actually missing" banner).
- **Voiceover:** record after the screen capture; keep it conversational.
- **Captions:** burn in the sponsor captions listed per scene (bottom-third
  or top-left). They are the point — judges score "sponsors do real work."

## Recording prep (do this before hitting record)

1. **Reset the demo case** so the board starts clean: re-run
   `bunx convex run seed:demoWorkspace --prod` from `fetchback/` (idempotent —
   if `demo-biscuit` already exists it just returns the case id; optionally
   delete the case in the dashboard first for a fully clean feed).
2. **Point the demo shelter at a rehearsal inbox** so the outreach → reply
   exchange is real mail without emailing any real shelter. The seeded
   shelter is "Demo Animal Services (fictional)". Either:
   - create/reuse an AgentMail inbox you control (e.g. the
     `fetchback-shelter-sim` inbox from dev rehearsals) and set it as the
     shelter's email in the Convex dashboard (`shelters` table → the
     demo-biscuit shelter row → `email`), or
   - `bunx convex run crawl:setShelterEmail --prod '{"shelterId":"<id>","email":"<rehearsal-inbox@agentmail.to>"}'`.
3. **Have the reply ready to fire.** After you click APPROVE & SEND (scene
   6), send the reply FROM the rehearsal inbox with a golden-retriever photo
   attached, via the AgentMail API (this is exactly what the dev harness
   automates on dev; here it's one curl on prod):

   ```sh
   curl -X POST https://api.agentmail.com/v0/inboxes/$SHELTER_SIM_INBOX/messages \
     -H "Authorization: Bearer $AGENTMAIL_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "fetchback-case@agentmail.to",
       "subject": "RE: [DRILL - no action needed] Possible match inquiry: Biscuit",
       "text": "We may have a dog matching your description in intake this morning — photo attached. Please confirm.",
       "attachments": [{
         "filename": "candidate.jpg",
         "content": "'"$(base64 -w0 biscuit-candidate.jpg)"'",
         "contentType": "image/jpeg"
       }]
     }'
   ```

   The prod webhook (svix-verified) picks it up within seconds and the board
   updates live — that IS scene 7.
4. Rehearse once: the full flow takes ~10 minutes live; trim dead waits in
   the edit (the map updates are instant — realtime).
5. **Fallback:** if you'd rather not run the mail rehearsal on prod, record
   scenes 7–8 against the dev deployment `https://valiant-ram-10.convex.site`
   with `devloop:runDrillLoop` + `skipReplay` driving the exchange, and add a
   one-line caption: "mail exchange rehearsed on the dev deployment — dev
   harness never ships to prod." Everything else stays on the prod URL.

## Storyboard (total 2:58)

| # | Time | On screen | Voiceover (guide, not verbatim) | Sponsor caption |
|---|------|-----------|----------------------------------|-----------------|
| 0 | 0:00–0:08 | Cold open: the live board for Biscuit — polaroid photo, "MISSING · PRACTICE DRILL" stamp, feed ticking. Address bar shows `beloved-dog-203.convex.site`. | "This is what a missing-pet search looks like when the whole neighborhood — and AI — can actually help." | — |
| 1 | 0:08–0:32 | Click "Register a pet" → one-tap anonymous sign-in (AuthWidget) → fill the form (name, breed, color, description) → upload a real photo → Register. | "Register your pet before anything happens. One tap to sign in, no password for a stressed owner." | **Convex** — auth, file storage |
| 2 | 0:32–0:45 | "Start practice drill" → share link appears (`#/c/…`) → board renders live: PetHeader with drill banner, empty map, feed. | "Start a practice drill — the case goes live instantly and this board is now realtime for everyone you share it with." | **Convex** — realtime queries |
| 3 | 0:45–1:10 | Back on the demo-biscuit board: type a volunteer name → "Claim a territory" → rectangle appears on the map, feed event lands, no refresh. Then "Report sighting" → 🐾 pin drops. | "Volunteers claim streets to search. No refresh — the map and feed update the instant anyone acts." | **Convex** — realtime sync |
| 4 | 1:10–1:30 | Shelter panel: list of Nashville shelters with `crawl` source badges and links. | "Firecrawl already found the real shelters near the search area and keeps watching their pages." | **Firecrawl** — shelter discovery + monitoring |
| 5 | 1:30–1:55 | "Draft outreach" on a shelter → AI draft appears (subject + body, drill-labeled) → read one line aloud → "Approve & send" → `email_sent` lands in the feed. | "The case inbox drafts the email — and nothing sends until a human approves it." | **AgentMail** (send) + **OpenAI** (draft) via **Convex AI Gateway** |
| 6 | 1:55–2:05 | (Off-screen: fire the reply curl from prep step 3.) Keep the board in frame — wait beat. | "Now the shelter replies…" | — |
| 7 | 2:05–2:25 | Feed updates by itself: `email_reply` → 🐾 sighting with photo → `match_scored`. New match card slides in: candidate polaroid, match score %, reasons list citing visual evidence, model tag. | "The reply lands with a photo. OpenAI vision scores it as a possible match and shows its reasoning — coat, build, collar. It only suggests." | **AgentMail** (webhook) + **OpenAI** (vision) via **Convex AI Gateway** |
| 8 | 2:25–2:50 | The CONFIRM / REJECT buttons on the pending match card → click CONFIRM → stamp flips to CONFIRMED, feed celebrates ("Owner CONFIRMED the match! 🎉"). | "And the decision belongs to the one person it should: the owner." | — |
| 9 | 2:50–2:58 | Closing card (see below). | "FetchBack — try the practice drill yourself." | — |

Sum: 2:58 < 3:00. ✅

## Closing card (2:50–2:58)

Plain full-screen card, no animation needed:

```
🐕 FetchBack
The multiplayer missing-pet search party.

Try the practice drill:
https://beloved-dog-203.convex.site

Built with Convex · OpenAI · Firecrawl · AgentMail
Convex All Gas Hackathon 2026
```

## Editing checklist

- [ ] Captions present at every sponsor beat (scenes 1, 3, 4, 5, 7)
- [ ] URL visible at open and close
- [ ] No dead air over ~2s (map updates are instant — cut the waits)
- [ ] The drill banner is legible at least once (honesty beat)
- [ ] Match-card reasons legible — zoom the card if needed
- [ ] Export 1080p, upload unlisted or public, paste link into
      `docs/SUBMISSION.md`
