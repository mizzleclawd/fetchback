// Vision/drafting seam — the single dispatch point for the AI provider.
//
// Real provider: OpenAI through Convex AI Gateway (./aiGateway.ts). Convex
// mints a short-lived deployment credential; no provider key is stored here.
// Mock provider: deterministic, clearly labeled fallback. It can be forced
// with FETCHBACK_VISION_MODE=mock and is also used if the gateway is disabled
// or unavailable, so inbound mail processing never loses the attachment.
//
// Product rule (both providers): only ever "possible match" plausibility,
// never certainty; the OWNER confirms or rejects.

import {
  aiGatewayProvider,
  gatewayModel,
  type MatchScore,
} from "./aiGateway";

export type VisionMode = "gateway" | "mock";

export function visionMode(): VisionMode {
  return process.env.FETCHBACK_VISION_MODE?.toLowerCase() === "mock"
    ? "mock"
    : "gateway";
}

export const MOCK_TAG = "[MOCK vision adapter — image was NOT analyzed]";

export type VisionProvider = typeof aiGatewayProvider;

// ---- Mock: deterministic text-overlap heuristic (no network, no images) ----

const STOPWORDS = new Set([
  "the", "and", "with", "has", "have", "was", "were", "are", "his", "her",
  "its", "this", "that", "for", "from", "about", "into", "very", "old",
  "year", "years", "who", "whom", "she", "he", "they", "them", "their",
  "answers", "name", "named", "wearing", "around", "near", "when", "last",
  "seen", "found", "lost", "missing", "dog", "cat", "pet",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function mockScoreMatch(args: {
  petDescription: string;
  petPhotoUrls: string[];
  candidateDescription?: string;
  candidatePhotoUrl?: string;
}): MatchScore {
  const pet = tokens(args.petDescription);
  const cand = tokens(args.candidateDescription ?? "");
  const overlap = [...pet].filter((w) => cand.has(w));
  const jaccard =
    pet.size && cand.size ? overlap.length / Math.min(pet.size, cand.size) : 0;
  // Capped low: mock scores represent "plausible enough to keep in the
  // pipeline", never a strong match signal.
  const score = Math.round(Math.min(0.55, 0.1 + 0.45 * jaccard) * 100) / 100;
  const reasons = [
    MOCK_TAG,
    `Text-overlap heuristic: ${overlap.length} shared descriptor term(s)` +
      (overlap.length ? ` (${overlap.slice(0, 5).join(", ")})` : "") +
      ".",
    args.candidatePhotoUrl
      ? "Photo attached but NOT analyzed — the mock adapter cannot see images."
      : "No candidate photo was provided with this report.",
    "Unverified placeholder score for pipeline testing only; owner review still required.",
  ];
  return { score, reasons };
}

// ---- Public API (dispatch by configuration) ----

export async function scoreMatch(args: {
  petDescription: string;
  petPhotoUrls: string[];
  candidateDescription?: string;
  candidatePhotoUrl?: string;
}, provider: VisionProvider = aiGatewayProvider): Promise<MatchScore> {
  if (visionMode() === "mock") return mockScoreMatch(args);
  try {
    return await provider.scoreMatch(args);
  } catch (error) {
    const fallback = mockScoreMatch(args);
    const message = error instanceof Error ? error.message : "";
    const cause = message.includes("AiGatewayDisabled")
      ? "Convex AI Gateway is disabled for this team/deployment."
      : message.includes("AiGatewayUnavailable")
        ? "Convex AI Gateway is unavailable on this deployment."
        : /HTTP \d{3}/.test(message)
          ? `Convex AI Gateway request failed (${message.match(/HTTP \d{3}/)?.[0]}).`
          : "Convex AI Gateway request failed.";
    fallback.reasons.splice(1, 0, cause);
    return fallback;
  }
}

export async function draftShelterEmail(args: {
  petName: string;
  petDescription: string;
  areaDescription: string;
  isDrill: boolean;
  shelterName: string;
}, provider: VisionProvider = aiGatewayProvider): Promise<{ subject: string; body: string }> {
  if (visionMode() !== "mock") {
    try {
      return await provider.draftShelterEmail(args);
    } catch {
      // Safe fallback below. Draft creation must not block shelter outreach.
    }
  }
  const drillPrefix = args.isDrill ? "[DRILL - no action needed] " : "";
  return {
    subject: `${drillPrefix}Possible match inquiry: ${args.petName} (${args.shelterName})`,
    body:
      `Hello ${args.shelterName},\n\n` +
      `We are searching for ${args.petName}: ${args.petDescription}. ` +
      `Last seen ${args.areaDescription}.\n` +
      (args.isDrill
        ? `This is a clearly-labeled PRACTICE DRILL of a lost-pet response system — no pet is actually missing.\n`
        : "") +
      `If an animal matching this description has been brought in or reported, could you reply to this email with a photo?\n\n` +
      `Thank you,\nFetchBack search assistant, on behalf of the owner\n\n` +
      `[MOCK offline template — Convex AI Gateway (${gatewayModel()}) was not used; this was not AI-drafted.]`,
  };
}
