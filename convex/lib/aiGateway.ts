// Convex AI Gateway helper. The gateway owns provider credentials; this app
// mints a short-lived, deployment-scoped token inside each Convex action.

import { getServiceToken } from "convex/server";

const GATEWAY_URL = "https://ai-gateway.convex.dev/v1/chat/completions";

export const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.2";

export function gatewayModel(): string {
  return process.env.FETCHBACK_AI_MODEL ?? DEFAULT_GATEWAY_MODEL;
}

export const GATEWAY_TAG = (model = gatewayModel()) =>
  `[Convex AI Gateway: ${model} — possible match only; owner review required]`;

export type MatchScore = {
  score: number;
  reasons: string[];
};

type ChatCompletion = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function contentFromCompletion(data: ChatCompletion): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("AI Gateway returned no text content");
  }
  return content;
}

export function parseMatchScore(content: string): MatchScore {
  const parsed = JSON.parse(content) as { score?: unknown; reasons?: unknown };
  const rawScore = typeof parsed.score === "number" ? parsed.score : 0;
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons
        .filter((reason): reason is string => typeof reason === "string")
        .map((reason) => reason.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  return {
    score: Math.max(0, Math.min(1, Number.isFinite(rawScore) ? rawScore : 0)),
    reasons,
  };
}

async function completion(body: Record<string, unknown>): Promise<string> {
  const token = await getServiceToken("ai-gateway");
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: gatewayModel(), ...body }),
  });
  if (!response.ok) {
    throw new Error(`AI Gateway request failed (HTTP ${response.status})`);
  }
  return contentFromCompletion((await response.json()) as ChatCompletion);
}

/** Compare a lost pet to a candidate. This is a lead, never an identity claim. */
export async function scoreMatch(args: {
  petDescription: string;
  petPhotoUrls: string[];
  candidateDescription?: string;
  candidatePhotoUrl?: string;
}): Promise<MatchScore> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text:
        `You compare a LOST pet against a CANDIDATE found-pet report.\n` +
        `LOST pet description: ${args.petDescription}\n` +
        (args.candidateDescription
          ? `CANDIDATE description: ${args.candidateDescription}\n`
          : "") +
        `The first image(s) are the LOST pet. ` +
        (args.candidatePhotoUrl ? `The last image is the CANDIDATE. ` : "") +
        `Respond with strict JSON: {"score": <0..1>, "reasons": [<3-5 short strings citing concrete visual/descriptive evidence>]}. ` +
        `Never claim certainty; score reflects plausibility only. The owner makes the final decision.`,
    },
  ];
  for (const url of args.petPhotoUrls.slice(0, 3)) {
    content.push({ type: "image_url", image_url: { url } });
  }
  if (args.candidatePhotoUrl) {
    content.push({ type: "image_url", image_url: { url: args.candidatePhotoUrl } });
  }

  const parsed = parseMatchScore(
    await completion({
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  );
  return {
    score: parsed.score,
    reasons: [GATEWAY_TAG(), ...parsed.reasons],
  };
}

/** Draft only. Existing human approval remains mandatory before sending. */
export async function draftShelterEmail(args: {
  petName: string;
  petDescription: string;
  areaDescription: string;
  isDrill: boolean;
  shelterName: string;
}): Promise<{ subject: string; body: string }> {
  const content = await completion({
    messages: [
      {
        role: "user",
        content:
          `Draft a short, polite email to "${args.shelterName}" asking whether a pet matching this description has been brought in` +
          ` or reported: ${args.petDescription} (name: ${args.petName}). Area: ${args.areaDescription}.` +
          (args.isDrill
            ? ` IMPORTANT: this is a clearly-labeled PRACTICE DRILL; the subject MUST start with "[DRILL - no action needed]" and the body must state no pet is actually missing.`
            : "") +
          ` Sign as "FetchBack search assistant, on behalf of the owner". Ask them to reply with a photo if a possible match arrives.` +
          ` Respond with strict JSON: {"subject": "...", "body": "..."}.`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(content) as { subject?: unknown; body?: unknown };
  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new Error("AI Gateway returned an invalid outreach draft");
  }
  return {
    subject: parsed.subject,
    body:
      `${parsed.body}\n\n` +
      `[AI-generated draft via Convex AI Gateway (${gatewayModel()}) — human approval required.]`,
  };
}

export const aiGatewayProvider = { scoreMatch, draftShelterEmail };
