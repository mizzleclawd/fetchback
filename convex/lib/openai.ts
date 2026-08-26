// OpenAI helper — plain fetch against the REST API (Convex default runtime,
// no "use node" needed). Vision scoring always returns "possible match"
// language with visible reasons; certainty claims are a product rule violation.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set on the deployment");
  return key;
}

function model(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5.2";
}

export type MatchScore = {
  score: number; // 0..1
  reasons: string[]; // shown verbatim in the UI
};

/**
 * Score how likely a candidate (found-pet) photo/description matches the
 * registered lost pet. Returns a bounded score plus human-readable reasons.
 */
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
        `Never claim certainty; score reflects plausibility of a match only.`,
    },
  ];
  for (const url of args.petPhotoUrls.slice(0, 3)) {
    content.push({ type: "image_url", image_url: { url } });
  }
  if (args.candidatePhotoUrl) {
    content.push({ type: "image_url", image_url: { url: args.candidatePhotoUrl } });
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: model(),
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const parsed = JSON.parse(data.choices[0].message.content) as MatchScore;
  return {
    score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
    reasons: Array.isArray(parsed.reasons)
      ? parsed.reasons.slice(0, 5).map(String)
      : [],
  };
}

/** Draft a shelter outreach email. Output is a DRAFT — humans approve sends. */
export async function draftShelterEmail(args: {
  petName: string;
  petDescription: string;
  areaDescription: string;
  isDrill: boolean;
  shelterName: string;
}): Promise<{ subject: string; body: string }> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: model(),
      messages: [
        {
          role: "user",
          content:
            `Draft a short, polite email to "${args.shelterName}" asking whether a pet matching this description has been brought in` +
            ` or reported: ${args.petDescription} (name: ${args.petName}). Area: ${args.areaDescription}.` +
            (args.isDrill
              ? ` IMPORTANT: this is a clearly-labeled PRACTICE DRILL of a lost-pet response system; the subject MUST start with "[DRILL - no action needed]" and the body must state no pet is actually missing.`
              : "") +
            ` Sign as "FetchBack search assistant, on behalf of the owner". Ask them to reply to this email with a photo if a possible match arrives.` +
            ` Respond with strict JSON: {"subject": "...", "body": "..."}.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const parsed = JSON.parse(data.choices[0].message.content) as {
    subject: string;
    body: string;
  };
  return { subject: String(parsed.subject), body: String(parsed.body) };
}
