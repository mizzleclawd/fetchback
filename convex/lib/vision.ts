// Vision/drafting seam — the single dispatch point for the AI provider.
//
// Real provider: OpenAI (./openai.ts), used when OPENAI_API_KEY is set.
// Mock provider: deterministic, clearly-labeled text heuristic used ONLY
// while OPENAI_API_KEY is unconfigured. Mock output is tagged in every
// reason string so logs/UI can never present it as real vision scoring.
//
// Product rule (both providers): only ever "possible match" plausibility,
// never certainty; the OWNER confirms or rejects.

import {
  scoreMatch as openaiScoreMatch,
  draftShelterEmail as openaiDraftShelterEmail,
  type MatchScore,
} from "./openai";

export type VisionMode = "openai" | "mock";

export function visionMode(): VisionMode {
  return process.env.OPENAI_API_KEY ? "openai" : "mock";
}

export const MOCK_TAG = "[MOCK vision adapter — no OPENAI_API_KEY configured]";

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

function mockScoreMatch(args: {
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
}): Promise<MatchScore> {
  if (visionMode() === "mock") return mockScoreMatch(args);
  return openaiScoreMatch(args);
}

export async function draftShelterEmail(args: {
  petName: string;
  petDescription: string;
  areaDescription: string;
  isDrill: boolean;
  shelterName: string;
}): Promise<{ subject: string; body: string }> {
  if (visionMode() === "mock") {
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
        `[Drafted by the offline template adapter — no OPENAI_API_KEY is configured, so this was not AI-drafted.]`,
    };
  }
  return openaiDraftShelterEmail(args);
}
