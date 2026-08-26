// Firecrawl integration — shelter discovery + found-pet page monitoring.
// Kill-gate test #1 lives here: prove real Nashville shelter pages extract.

import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { logEvent } from "./cases";

const firecrawl = new FirecrawlClient(components.firecrawl);

/** Discover shelters near the case area via web search. */
export const discoverShelters = action({
  args: { caseId: v.id("searchCases"), areaQuery: v.string() },
  handler: async (ctx, args) => {
    const results = await firecrawl.search(
      ctx,
      `animal shelter contact email ${args.areaQuery}`,
      { limit: 5 },
    );
    const web: Array<{ title?: string; url?: string; description?: string }> =
      (results as { web?: Array<{ title?: string; url?: string; description?: string }> })
        .web ?? [];
    for (const r of web) {
      if (!r.url) continue;
      await ctx.runMutation(internal.crawl.saveShelter, {
        caseId: args.caseId,
        name: r.title ?? r.url,
        url: r.url,
      });
    }
    return web.length;
  },
});

export const saveShelter = internalMutation({
  args: {
    caseId: v.id("searchCases"),
    name: v.string(),
    url: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("shelters", { ...args, source: "crawl" });
    await logEvent(ctx, args.caseId, "shelter_found", `Found: ${args.name}`);
    return id;
  },
});

/** Manually add a shelter (also used for seeded demo workspaces). */
export const addShelter = internalMutation({
  args: {
    caseId: v.id("searchCases"),
    name: v.string(),
    email: v.optional(v.string()),
    url: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("seed")),
  },
  handler: async (ctx, args) => {
    const { source, ...rest } = args;
    const id = await ctx.db.insert("shelters", { ...rest, source });
    await logEvent(ctx, args.caseId, "shelter_found", `Added: ${args.name}`);
    return id;
  },
});

/**
 * Scrape one shelter page: extract a contact email + any found-pet listings.
 * Uses Firecrawl JSON extraction so the schema does the parsing work.
 */
export const scrapeShelterPage = internalAction({
  args: { caseId: v.id("searchCases"), shelterId: v.id("shelters"), url: v.string() },
  handler: async (ctx, args) => {
    const page = await firecrawl.scrape(ctx, args.url, {
      formats: [
        "markdown",
        {
          type: "json",
          prompt:
            "Extract: contact email address for the shelter (field: email), and an array of recently found/stray animals if listed (field: foundPets, each with description and photoUrl if present).",
        },
      ],
      onlyMainContent: true,
      maxAge: 3_600_000,
    });
    const json = (page as { json?: { email?: string; foundPets?: Array<{ description?: string; photoUrl?: string }> } }).json;
    if (json?.email) {
      await ctx.runMutation(internal.crawl.setShelterEmail, {
        shelterId: args.shelterId,
        email: json.email,
      });
    }
    for (const fp of json?.foundPets ?? []) {
      if (!fp.description) continue;
      await ctx.runMutation(internal.cases.addSourcedSighting, {
        caseId: args.caseId,
        source: "web",
        description: fp.description,
        sourceUrl: args.url,
      });
    }
    return { email: json?.email ?? null, listings: json?.foundPets?.length ?? 0 };
  },
});

export const setShelterEmail = internalMutation({
  args: { shelterId: v.id("shelters"), email: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.shelterId, { email: args.email });
  },
});
