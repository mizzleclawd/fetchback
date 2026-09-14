import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentmail from "@agentmail/convex/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp({
  env: {
    FIRECRAWL_API_KEY: v.string(),
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
    AGENTMAIL_API_KEY: v.string(),
    AGENTMAIL_BASE_URL: v.optional(v.string()),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
  },
});

// AgentMail — the case inbox: shelter outreach + inbound replies w/ photos.
// Env (set via `convex env set`): AGENTMAIL_API_KEY, AGENTMAIL_WEBHOOK_SECRET
// NB: env must be passed explicitly — the patched component (see patches/)
// declares it; without the pass-through the component's sends fail with
// "AGENTMAIL_API_KEY is not set".
app.use(agentmail, {
  env: {
    AGENTMAIL_API_KEY: app.env.AGENTMAIL_API_KEY,
    AGENTMAIL_BASE_URL: app.env.AGENTMAIL_BASE_URL,
    AGENTMAIL_WEBHOOK_SECRET: app.env.AGENTMAIL_WEBHOOK_SECRET,
  },
});

// Firecrawl — shelter/found-pet page monitoring and discovery.
// Webhook route mounts at <site>/firecrawl/webhook for webhook-mode crawls;
// local dev uses mode:"poll".
app.use(firecrawl, {
  httpPrefix: "/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});

// Static hosting — serves the built frontend from Convex storage at
// https://<deployment>.convex.site. App-owned root routing: no httpPrefix,
// so the app keeps the root URL space (auth routes, /agentmail/webhook,
// /firecrawl/*) and convex/http.ts registers the static catch-all after the
// exact routes. Exact routes win over the catch-all.
app.use(staticHosting);

export default app;
