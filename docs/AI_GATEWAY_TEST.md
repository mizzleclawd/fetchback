# Convex AI Gateway tester runbook

This test targets the personal cloud **development** deployment
`valiant-ram-10`. Do not add `--prod`, and do not enable the dev harness on
the production deployment.

## What this proves

- Convex can mint a deployment-scoped AI Gateway service token.
- `openai/gpt-5.2` receives both lost-pet and candidate image URLs through
  the Gateway's OpenAI-compatible chat-completions endpoint.
- A real result is visibly tagged with the gateway and model.
- A disabled/unavailable gateway safely returns a clearly labeled mock score
  instead of dropping the inbound attachment pipeline.

## Automated checks

From the repository root:

```sh
bun install
bun run typecheck
bun test
bun run build
```

## Live multimodal check (cloud dev only)

Use two publicly readable JPEG/PNG URLs. The command below uses the same two
public-domain golden-retriever photos as the release check:

```sh
bunx convex run gatewayTest:runMultimodal '{
  "petPhotoUrl":"https://images.rawpixel.com/image_800/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4OTIwNjM2LWltYWdlLWt3dnV0YXFjLmpwZw.jpg",
  "candidatePhotoUrl":"https://images.rawpixel.com/image_800/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZ29sZGVuX3JldHJpZXZlX3BlcnJvcl85MTgwODMtaW1hZ2Uta3liZG52aHUuanBn.jpg",
  "petDescription":"adult golden retriever with a medium golden coat and dark nose",
  "candidateDescription":"found adult golden retriever with a golden coat and dark nose"
}'
```

A real pass has all of these properties:

- `configuredMode` is `gateway`
- `provider` is `convex-ai-gateway`
- `model` is `openai/gpt-5.2` (or the explicitly configured provider-qualified model)
- `usedMock` is `false`
- the first reason begins `[Convex AI Gateway:`
- later reasons mention concrete visual evidence from the images

A safe fallback is also a valid operational result, but not a real-AI pass:

- `provider` is `mock`
- `usedMock` is `true`
- the first reason is `[MOCK vision adapter — image was NOT analyzed]`
- the next reason states whether the gateway was disabled, unavailable, or
  the request failed

`AiGatewayDisabled` means the Convex team is not on a paid plan or the beta is
not enabled. `AiGatewayUnavailable` means the test was aimed at a local or
self-hosted deployment. Neither requires an `OPENAI_API_KEY`; the gateway owns
provider credentials.

## Force the fallback for a demo

Only on the personal dev deployment:

```sh
bunx convex env set FETCHBACK_VISION_MODE mock
```

Run the live command again and confirm the mock labels above. Remove the
override afterward so the default returns to `gateway`:

```sh
bunx convex env remove FETCHBACK_VISION_MODE
```

Never return, log, or persist the service token minted by
`getServiceToken("ai-gateway")`.
