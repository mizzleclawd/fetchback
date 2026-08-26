import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Shared enums
export const caseStatus = v.union(
  v.literal("drill"), // practice run — clearly labeled, safe to demo
  v.literal("active"), // pet actually lost
  v.literal("found"),
  v.literal("closed"),
);

export const matchVerdict = v.union(
  v.literal("pending"), // scored, awaiting owner decision
  v.literal("confirmed"), // owner says it's their pet
  v.literal("rejected"), // owner says no
);

export default defineSchema({
  // A registered pet. Registration happens BEFORE loss (Drill Mode onboarding).
  pets: defineTable({
    ownerId: v.string(), // auth subject; "demo" for seeded judge workspace
    name: v.string(),
    species: v.union(v.literal("dog"), v.literal("cat"), v.literal("other")),
    breed: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.string(),
    microchipId: v.optional(v.string()),
    photoIds: v.array(v.id("_storage")),
    // Home territory: center + radius the search map starts from
    homeLat: v.number(),
    homeLng: v.number(),
    homeRadiusM: v.number(),
  }).index("by_owner", ["ownerId"]),

  // A search case — a drill or a real lost-pet activation.
  searchCases: defineTable({
    petId: v.id("pets"),
    ownerId: v.string(),
    status: caseStatus,
    isDrill: v.boolean(),
    activatedAt: v.number(),
    closedAt: v.optional(v.number()),
    lastSeenLat: v.optional(v.number()),
    lastSeenLng: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    // Public share slug for the volunteer join link / judge workspace
    slug: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"]),

  // Volunteer-claimed search territories on the live map.
  territories: defineTable({
    caseId: v.id("searchCases"),
    volunteerName: v.string(),
    volunteerId: v.optional(v.string()),
    // Simple rectangle claim; polygon support can come later
    north: v.number(),
    south: v.number(),
    east: v.number(),
    west: v.number(),
    status: v.union(
      v.literal("claimed"),
      v.literal("searching"),
      v.literal("done"),
    ),
    claimedAt: v.number(),
  }).index("by_case", ["caseId"]),

  // Sightings reported by volunteers or extracted from the web.
  sightings: defineTable({
    caseId: v.id("searchCases"),
    source: v.union(
      v.literal("volunteer"),
      v.literal("web"), // Firecrawl-discovered listing
      v.literal("shelter_email"), // arrived via AgentMail
    ),
    reporterName: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    description: v.string(),
    photoId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()),
    sightedAt: v.number(),
  }).index("by_case", ["caseId"]),

  // Shelters/orgs discovered for a case's area (crawled or curated).
  shelters: defineTable({
    caseId: v.id("searchCases"),
    name: v.string(),
    email: v.optional(v.string()),
    url: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    source: v.union(v.literal("crawl"), v.literal("manual"), v.literal("seed")),
    // Outreach state
    contactedAt: v.optional(v.number()),
    threadId: v.optional(v.string()), // AgentMail thread once contacted
    lastReplyAt: v.optional(v.number()),
  })
    .index("by_case", ["caseId"])
    .index("by_thread", ["threadId"]),

  // Outbound email drafts — human-approved before send (safety rail).
  outreachDrafts: defineTable({
    caseId: v.id("searchCases"),
    shelterId: v.id("shelters"),
    subject: v.string(),
    body: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    outboundId: v.optional(v.string()), // AgentMail component outbound id
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_case", ["caseId"])
    .index("by_status", ["caseId", "status"]),

  // Candidate matches: a found-pet photo/listing scored against the lost pet.
  matches: defineTable({
    caseId: v.id("searchCases"),
    source: v.union(
      v.literal("shelter_email"),
      v.literal("web_listing"),
      v.literal("volunteer_sighting"),
    ),
    sightingId: v.optional(v.id("sightings")),
    shelterId: v.optional(v.id("shelters")),
    candidatePhotoId: v.optional(v.id("_storage")),
    candidateUrl: v.optional(v.string()),
    candidateDescription: v.optional(v.string()),
    // OpenAI vision scoring — always "possible match", never certainty
    score: v.number(), // 0..1
    reasons: v.array(v.string()), // visible reasons shown in UI
    verdict: matchVerdict,
    scoredAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_case", ["caseId"])
    .index("by_case_verdict", ["caseId", "verdict"]),

  // Cached web-monitoring results per case (Firecrawl layer).
  watchedPages: defineTable({
    caseId: v.id("searchCases"),
    url: v.string(),
    kind: v.union(v.literal("shelter_intake"), v.literal("found_listings")),
    lastCrawledAt: v.optional(v.number()),
    lastContentHash: v.optional(v.string()),
    active: v.boolean(),
  }).index("by_case", ["caseId"]),

  // Append-only case activity feed — drives the live board & demo narrative.
  events: defineTable({
    caseId: v.id("searchCases"),
    kind: v.string(), // "territory_claimed" | "sighting" | "email_sent" | "email_reply" | "match_scored" | ...
    message: v.string(),
    at: v.number(),
  }).index("by_case", ["caseId", "at"]),
});
