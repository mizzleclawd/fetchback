import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { agentmail } from "./mail";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth — sign-in/sign-out/JWKS endpoints for the Anonymous provider.
auth.addHttpRoutes(http);

// AgentMail inbound webhook. Register in the AgentMail dashboard as:
//   https://<deployment>.convex.site/agentmail/webhook
// Svix-verified via AGENTMAIL_WEBHOOK_SECRET; deduped by event_id.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  // Cast: the component wants a generic {runMutation} ctx; ours is the
  // app-typed ActionCtx (tuple-variance mismatch only, runtime-identical).
  handler: httpAction(async (ctx, req) =>
    agentmail.handleWebhook(
      ctx as unknown as Parameters<typeof agentmail.handleWebhook>[0],
      req,
    ),
  ),
});

export default http;
