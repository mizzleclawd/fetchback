import { afterEach, describe, expect, it } from "vitest";
import { MOCK_TAG, draftShelterEmail, scoreMatch, visionMode, type VisionProvider } from "./vision";

const originalMode = process.env.FETCHBACK_VISION_MODE;

afterEach(() => {
  if (originalMode === undefined) delete process.env.FETCHBACK_VISION_MODE;
  else process.env.FETCHBACK_VISION_MODE = originalMode;
});

describe("vision provider dispatch", () => {
  it("can force a clearly labeled deterministic mock", async () => {
    process.env.FETCHBACK_VISION_MODE = "mock";
    expect(visionMode()).toBe("mock");
    const result = await scoreMatch({
      petDescription: "tan dog white chest",
      petPhotoUrls: ["https://example.test/lost.jpg"],
      candidateDescription: "tan dog dark muzzle",
      candidatePhotoUrl: "https://example.test/found.jpg",
    });
    expect(result.reasons[0]).toBe(MOCK_TAG);
    expect(result.reasons.join(" ")).toContain("NOT analyzed");
  });

  it("falls back safely and visibly when the gateway is disabled", async () => {
    delete process.env.FETCHBACK_VISION_MODE;
    const unavailable: VisionProvider = {
      scoreMatch: async () => {
        throw new Error("AiGatewayDisabled");
      },
      draftShelterEmail: async () => {
        throw new Error("AiGatewayDisabled");
      },
    };
    const score = await scoreMatch(
      { petDescription: "black cat", petPhotoUrls: [] },
      unavailable,
    );
    expect(score.reasons[0]).toBe(MOCK_TAG);
    expect(score.reasons[1]).toContain("disabled");
    const draft = await draftShelterEmail(
      {
        petName: "Milo",
        petDescription: "black cat",
        areaDescription: "Nashville",
        isDrill: true,
        shelterName: "Test Shelter",
      },
      unavailable,
    );
    expect(draft.subject).toMatch(/^\[DRILL - no action needed\]/);
    expect(draft.body).toContain("[MOCK offline template");
  });
});
