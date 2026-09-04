// Dev-only live proof for Convex AI Gateway multimodal scoring.
// Internal so it cannot be called over the public Functions API. Testers with
// deployment access can still invoke it with `convex run`. Never enable the
// dev harness flag in prod.

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { gatewayModel } from "./lib/aiGateway";
import { MOCK_TAG, scoreMatch, visionMode } from "./lib/vision";

export const runMultimodal = internalAction({
  args: {
    petPhotoUrl: v.string(),
    candidatePhotoUrl: v.string(),
    petDescription: v.optional(v.string()),
    candidateDescription: v.optional(v.string()),
  },
  returns: v.object({
    configuredMode: v.union(v.literal("gateway"), v.literal("mock")),
    provider: v.union(v.literal("convex-ai-gateway"), v.literal("mock")),
    model: v.string(),
    score: v.number(),
    reasons: v.array(v.string()),
    usedMock: v.boolean(),
  }),
  handler: async (_ctx, args) => {
    if (process.env.FETCHBACK_ALLOW_DEVLOOP !== "1") {
      throw new Error(
        "gatewayTest requires FETCHBACK_ALLOW_DEVLOOP=1 (dev only; never set on prod)",
      );
    }
    const result = await scoreMatch({
      petDescription:
        args.petDescription ?? "Medium-sized tan dog with a white chest and dark muzzle",
      petPhotoUrls: [args.petPhotoUrl],
      candidateDescription:
        args.candidateDescription ?? "Found tan dog with white chest and dark muzzle",
      candidatePhotoUrl: args.candidatePhotoUrl,
    });
    const usedMock = result.reasons.some((reason) => reason.includes(MOCK_TAG));
    const provider: "mock" | "convex-ai-gateway" = usedMock
      ? "mock"
      : "convex-ai-gateway";
    return {
      configuredMode: visionMode(),
      provider,
      model: gatewayModel(),
      score: result.score,
      reasons: result.reasons,
      usedMock,
    };
  },
});
